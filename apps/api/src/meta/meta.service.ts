import { Injectable, Logger, BadRequestException, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import {
  buildMetaOAuthUrl,
  exchangeCodeForShortToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  getMe,
  getPages,
  getIgProfile,
  MetaApiError,
  META_API_VERSION,
} from './meta-graph.client';
import { FacebookPageService } from '../facebook/facebook-page.service';
import { MetaAdsService } from '../meta-ads/meta-ads.service';

export const META_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_manage_comments',
  'instagram_manage_messages',
];

export interface MetaConnectResult {
  connectionId: string;
  instagramAccounts: Array<{
    id: string;
    igAccountId: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
    followerCount: number;
    facebookPageId?: string;
    facebookPageName?: string;
  }>;
}

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  private get clientId() {
    return this.config.getOrThrow<string>('META_APP_ID');
  }
  private get clientSecret() {
    return this.config.getOrThrow<string>('META_APP_SECRET');
  }
  private get configId() {
    return this.config.getOrThrow<string>('META_CONFIG_ID');
  }
  private get redirectUri() {
    return this.config.getOrThrow<string>('META_REDIRECT_URI');
  }

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly queue: QueueService,
    @Inject(forwardRef(() => FacebookPageService))
    private readonly facebookPageService: FacebookPageService,
    @Inject(forwardRef(() => MetaAdsService))
    private readonly metaAdsService: MetaAdsService,
  ) {}

  // ── OAuth URL ─────────────────────────────────────────────────────────────

  buildOAuthUrl(state: string): string {
    return buildMetaOAuthUrl({
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      state,
      configId: this.configId,
      scopes: META_SCOPES,
    });
  }

  // ── Complete OAuth flow ───────────────────────────────────────────────────

  async completeOAuth(userId: string, code: string): Promise<MetaConnectResult> {
    this.logger.log(`Completing Meta OAuth for user ${userId}`);

    // 1. Exchange code for short-lived token
    const shortToken = await exchangeCodeForShortToken({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
      code,
    });

    // 2. Exchange for long-lived token (~60 days)
    const longToken = await exchangeForLongLivedToken({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      shortLivedToken: shortToken.access_token,
    });

    const expiresAt = new Date(Date.now() + longToken.expires_in * 1000);

    // 3. Fetch the user's Facebook profile
    const me = await getMe(longToken.access_token);

    // 4. Create/update PlatformConnection
    const encryptedToken = this.encryption.encrypt(longToken.access_token);

    const connection = await this.prisma.platformConnection.upsert({
      where: {
        userId_platform_platformUserId: {
          userId,
          platform: 'instagram',
          platformUserId: me.id,
        },
      },
      create: {
        userId,
        platform: 'instagram',
        platformUserId: me.id,
        platformDisplayName: me.name,
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        scopes: META_SCOPES,
        connectionStatus: 'ACTIVE',
        connectedAt: new Date(),
        lastRefreshedAt: new Date(),
        metadata: { apiVersion: META_API_VERSION },
      },
      update: {
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        scopes: META_SCOPES,
        connectionStatus: 'ACTIVE',
        lastRefreshedAt: new Date(),
        metadata: { apiVersion: META_API_VERSION },
      },
    });

    // 5. Fetch Pages → Instagram Business Accounts
    const pages = await getPages(longToken.access_token);
    const igAccounts: MetaConnectResult['instagramAccounts'] = [];

    for (const page of pages.data) {
      if (!page.instagram_business_account?.id) continue;

      const igAccountId = page.instagram_business_account.id;
      const profile = await getIgProfile(igAccountId, page.access_token).catch(() => null);

      const encryptedPageToken = this.encryption.encrypt(page.access_token);

      const igRecord = await this.prisma.instagramAccount.upsert({
        where: {
          platformConnectionId_igAccountId: {
            platformConnectionId: connection.id,
            igAccountId,
          },
        },
        create: {
          platformConnectionId: connection.id,
          userId,
          igAccountId,
          username: profile?.username ?? igAccountId,
          name: profile?.name,
          profilePictureUrl: profile?.profile_picture_url,
          biography: profile?.biography,
          website: profile?.website,
          followerCount: profile?.followers_count ?? 0,
          followingCount: profile?.follows_count ?? 0,
          mediaCount: profile?.media_count ?? 0,
          facebookPageId: page.id,
          facebookPageName: page.name,
          facebookPageToken: encryptedPageToken,
          isActive: true,
          lastSyncedAt: new Date(),
        },
        update: {
          username: profile?.username ?? igAccountId,
          name: profile?.name,
          profilePictureUrl: profile?.profile_picture_url,
          biography: profile?.biography,
          website: profile?.website,
          followerCount: profile?.followers_count ?? 0,
          followingCount: profile?.follows_count ?? 0,
          mediaCount: profile?.media_count ?? 0,
          facebookPageId: page.id,
          facebookPageName: page.name,
          facebookPageToken: encryptedPageToken,
          isActive: true,
          lastSyncedAt: new Date(),
        },
      });

      igAccounts.push({
        id: igRecord.id,
        igAccountId,
        username: igRecord.username,
        name: igRecord.name ?? undefined,
        profilePictureUrl: igRecord.profilePictureUrl ?? undefined,
        followerCount: igRecord.followerCount,
        facebookPageId: igRecord.facebookPageId ?? undefined,
        facebookPageName: igRecord.facebookPageName ?? undefined,
      });
    }

    // 6. Schedule token refresh 50 days from now (before 60-day expiry)
    await this.scheduleTokenRefresh(connection.id, userId, expiresAt);

    // 7. Sync Facebook Pages
    await this.facebookPageService.syncPagesForConnection(connection.id, userId, longToken.access_token).catch((e) =>
      this.logger.warn(`FB page sync failed: ${e.message}`),
    );

    // 8. Sync Ad Accounts
    await this.metaAdsService.syncAdAccounts(userId, longToken.access_token).catch((e) =>
      this.logger.warn(`Ad account sync failed: ${e.message}`),
    );

    this.logger.log(`Meta OAuth complete: connection ${connection.id}, ${igAccounts.length} IG accounts`);

    return { connectionId: connection.id, instagramAccounts: igAccounts };
  }

  // ── Token refresh ─────────────────────────────────────────────────────────

  async refreshToken(connectionId: string): Promise<void> {
    const conn = await this.prisma.platformConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    if (conn.platform !== 'instagram') {
      throw new BadRequestException('Connection is not a Meta/Instagram connection');
    }

    const decrypted = this.encryption.decrypt(conn.accessToken);

    const refreshed = await refreshLongLivedToken({
      accessToken: decrypted,
      clientSecret: this.clientSecret,
    });

    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    await this.prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: this.encryption.encrypt(refreshed.access_token),
        tokenExpiresAt: expiresAt,
        connectionStatus: 'ACTIVE',
        lastRefreshedAt: new Date(),
      },
    });

    await this.scheduleTokenRefresh(connectionId, conn.userId, expiresAt);
    this.logger.log(`Token refreshed for connection ${connectionId}, expires ${expiresAt.toISOString()}`);
  }

  async getDecryptedToken(connectionId: string, userId: string): Promise<string> {
    const conn = await this.prisma.platformConnection.findFirstOrThrow({
      where: { id: connectionId, userId, connectionStatus: 'ACTIVE' },
    });
    return this.encryption.decrypt(conn.accessToken);
  }

  async getDecryptedPageToken(igAccountId: string, userId: string): Promise<{ token: string; igAccountId: string }> {
    const account = await this.prisma.instagramAccount.findFirstOrThrow({
      where: { id: igAccountId, userId, isActive: true },
    });

    if (!account.facebookPageToken) {
      throw new UnauthorizedException('No page token available — please reconnect Instagram');
    }

    return {
      token: this.encryption.decrypt(account.facebookPageToken),
      igAccountId: account.igAccountId,
    };
  }

  // ── Account listing ───────────────────────────────────────────────────────

  async listInstagramAccounts(userId: string) {
    return this.prisma.instagramAccount.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        igAccountId: true,
        username: true,
        name: true,
        profilePictureUrl: true,
        biography: true,
        followerCount: true,
        followingCount: true,
        mediaCount: true,
        facebookPageId: true,
        facebookPageName: true,
        lastSyncedAt: true,
        platformConnection: {
          select: { connectionStatus: true, tokenExpiresAt: true },
        },
      },
      orderBy: { followerCount: 'desc' },
    });
  }

  // ── Webhook: verify ───────────────────────────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string {
    const expected = this.config.getOrThrow<string>('META_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    throw new UnauthorizedException('Invalid webhook verification token');
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async scheduleTokenRefresh(connectionId: string, userId: string, expiresAt: Date): Promise<void> {
    // Refresh 10 days before expiry
    const refreshAt = new Date(expiresAt.getTime() - 10 * 24 * 60 * 60 * 1000);
    const delay = Math.max(0, refreshAt.getTime() - Date.now());

    const refreshJob = await this.prisma.tokenRefreshJob.create({
      data: {
        platformConnectionId: connectionId,
        userId,
        status: 'PENDING',
        scheduledFor: refreshAt,
      },
    });

    const bullJobId = await this.queue.addJob(
      QUEUE_NAMES.REFRESH_TOKEN,
      JOB_NAMES.REFRESH_PLATFORM_TOKEN,
      { connectionId, userId, jobId: refreshJob.id },
      { delay },
    );

    await this.prisma.tokenRefreshJob.update({
      where: { id: refreshJob.id },
      data: { bullJobId },
    });
  }
}
