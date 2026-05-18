import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import {
  getFbPages,
  publishFbTextPost,
  publishFbPhotoPost,
  publishFbVideoPost,
  getFbPageInsights,
} from '../meta/meta-graph.client';

export type FbPostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK';

export interface FbPublishRequest {
  facebookPageDbId: string;
  userId: string;
  type: FbPostType;
  message?: string;
  link?: string;
  mediaUrls?: string[];
}

export interface FbScheduleRequest extends FbPublishRequest {
  scheduledAt: Date;
}

@Injectable()
export class FacebookPageService {
  private readonly logger = new Logger(FacebookPageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}

  // ── Sync pages from Meta ──────────────────────────────────────────────────

  async syncPagesForConnection(connectionId: string, userId: string, accessToken: string): Promise<void> {
    const pages = await getFbPages(accessToken);

    for (const page of pages.data) {
      const encryptedToken = this.encryption.encrypt(page.access_token);
      await this.prisma.facebookPage.upsert({
        where: {
          platformConnectionId_pageId: {
            platformConnectionId: connectionId,
            pageId: page.id,
          },
        },
        create: {
          platformConnectionId: connectionId,
          userId,
          pageId: page.id,
          name: page.name,
          category: page.category,
          pictureUrl: page.picture?.data?.url,
          followerCount: page.followers_count ?? 0,
          fanCount: page.fan_count ?? 0,
          encryptedPageToken: encryptedToken,
          isActive: true,
          lastSyncedAt: new Date(),
        },
        update: {
          name: page.name,
          category: page.category,
          pictureUrl: page.picture?.data?.url,
          followerCount: page.followers_count ?? 0,
          fanCount: page.fan_count ?? 0,
          encryptedPageToken: encryptedToken,
          isActive: true,
          lastSyncedAt: new Date(),
        },
      });
    }

    this.logger.log(`Synced ${pages.data.length} Facebook pages for connection ${connectionId}`);
  }

  async listPages(userId: string) {
    return this.prisma.facebookPage.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        pageId: true,
        name: true,
        category: true,
        pictureUrl: true,
        followerCount: true,
        fanCount: true,
        lastSyncedAt: true,
        platformConnection: { select: { connectionStatus: true } },
      },
      orderBy: { fanCount: 'desc' },
    });
  }

  // ── Publishing ────────────────────────────────────────────────────────────

  async publishNow(request: FbPublishRequest): Promise<{ postId: string; type: string }> {
    const { token, pageId } = await this.getCredentials(request.facebookPageDbId, request.userId);

    let postId: string;

    switch (request.type) {
      case 'TEXT':
      case 'LINK': {
        if (!request.message) throw new BadRequestException('message is required for TEXT/LINK posts');
        const res = await publishFbTextPost({
          pageId,
          message: request.message,
          link: request.link,
          accessToken: token,
        });
        postId = res.id;
        break;
      }
      case 'IMAGE': {
        const url = request.mediaUrls?.[0];
        if (!url) throw new BadRequestException('mediaUrls[0] required for IMAGE posts');
        const res = await publishFbPhotoPost({
          pageId,
          imageUrl: url,
          caption: request.message,
          accessToken: token,
        });
        postId = res.post_id ?? res.id;
        break;
      }
      case 'VIDEO': {
        const url = request.mediaUrls?.[0];
        if (!url) throw new BadRequestException('mediaUrls[0] required for VIDEO posts');
        const res = await publishFbVideoPost({
          pageId,
          videoUrl: url,
          description: request.message,
          accessToken: token,
        });
        postId = res.id;
        break;
      }
      default:
        throw new BadRequestException(`Unsupported post type: ${(request as any).type}`);
    }

    await this.prisma.facebookPost.create({
      data: {
        facebookPageId: request.facebookPageDbId,
        userId: request.userId,
        pagePostId: postId,
        message: request.message,
        link: request.link,
        mediaUrls: request.mediaUrls ?? [],
        postType: request.type,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Published FB post ${postId} for page ${pageId}`);
    return { postId, type: request.type };
  }

  async schedulePost(request: FbScheduleRequest): Promise<{ facebookPostId: string; jobId: string }> {
    await this.getCredentials(request.facebookPageDbId, request.userId);

    const dbPost = await this.prisma.facebookPost.create({
      data: {
        facebookPageId: request.facebookPageDbId,
        userId: request.userId,
        message: request.message,
        link: request.link,
        mediaUrls: request.mediaUrls ?? [],
        postType: request.type,
        status: 'SCHEDULED',
        scheduledAt: request.scheduledAt,
      },
    });

    const delay = Math.max(0, request.scheduledAt.getTime() - Date.now());
    const jobId = await this.queue.addJob(
      QUEUE_NAMES.FACEBOOK_PUBLISH,
      JOB_NAMES.FACEBOOK_PUBLISH_POST,
      {
        facebookPostDbId: dbPost.id,
        facebookPageDbId: request.facebookPageDbId,
        userId: request.userId,
        type: request.type,
        message: request.message,
        link: request.link,
        mediaUrls: request.mediaUrls,
      },
      { delay },
    );

    await this.prisma.facebookPost.update({
      where: { id: dbPost.id },
      data: { bullJobId: jobId },
    });

    return { facebookPostId: dbPost.id, jobId };
  }

  // ── Insights ──────────────────────────────────────────────────────────────

  async getPageInsights(pageDbId: string, userId: string, since?: Date, until?: Date) {
    const { token, page } = await this.getCredentialsWithPage(pageDbId, userId);
    const insights = await getFbPageInsights(page.pageId, token, since, until);

    const posts = await this.prisma.facebookPost.findMany({
      where: { facebookPageId: pageDbId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        pagePostId: true,
        message: true,
        postType: true,
        publishedAt: true,
        impressions: true,
        reach: true,
        likes: true,
        comments: true,
        shares: true,
      },
    });

    return { page: { id: page.pageId, name: page.name }, insights, recentPosts: posts };
  }

  async listPosts(pageDbId: string, userId: string) {
    return this.prisma.facebookPost.findMany({
      where: { facebookPageId: pageDbId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async getCredentials(pageDbId: string, userId: string): Promise<{ token: string; pageId: string }> {
    const page = await this.prisma.facebookPage.findFirstOrThrow({
      where: { id: pageDbId, userId, isActive: true },
    });
    return { token: this.encryption.decrypt(page.encryptedPageToken), pageId: page.pageId };
  }

  private async getCredentialsWithPage(pageDbId: string, userId: string) {
    const page = await this.prisma.facebookPage.findFirstOrThrow({
      where: { id: pageDbId, userId, isActive: true },
    });
    return { token: this.encryption.decrypt(page.encryptedPageToken), page };
  }
}
