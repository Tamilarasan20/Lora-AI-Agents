import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { PluginRegistryService } from '../plugins/plugin-registry.service';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly plugins: PluginRegistryService,
  ) {}

  getOAuthUrl(userId: string, platform: string, redirectUri: string) {
    const plugin = this.getPlugin(platform);
    const state = `${userId}:${randomUUID()}`;
    const url = plugin.getOAuthUrl(state, redirectUri);
    return { url, state };
  }

  async exchangeCode(userId: string, platform: string, code: string, redirectUri: string) {
    const plugin = this.getPlugin(platform);
    const tokens = await plugin.exchangeCode(code, redirectUri);

    const encryptedAccess = this.encryption.encrypt(tokens.accessToken);
    const encryptedRefresh = tokens.refreshToken
      ? this.encryption.encrypt(tokens.refreshToken)
      : null;

    const connection = await this.prisma.platformConnection.upsert({
      where: {
        userId_platform_platformUserId: {
          userId,
          platform,
          platformUserId: tokens.platformUserId,
        },
      },
      create: {
        userId,
        platform,
        platformUserId: tokens.platformUserId,
        platformUsername: tokens.platformUsername,
        platformDisplayName: tokens.platformDisplayName,
        platformAvatarUrl: tokens.platformAvatarUrl,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        connectionStatus: 'ACTIVE',
        connectedAt: new Date(),
        lastRefreshedAt: new Date(),
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        connectionStatus: 'ACTIVE',
        lastRefreshedAt: new Date(),
      },
      select: {
        id: true, platform: true, platformUsername: true,
        platformDisplayName: true, platformAvatarUrl: true,
        connectionStatus: true, scopes: true, connectedAt: true,
      },
    });

    return connection;
  }

  async listConnections(userId: string) {
    return this.prisma.platformConnection.findMany({
      where: { userId },
      select: {
        id: true, platform: true, platformUsername: true,
        platformDisplayName: true, platformAvatarUrl: true,
        connectionStatus: true, scopes: true, tokenExpiresAt: true,
        connectedAt: true, lastRefreshedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });
  }

  async getConnection(userId: string, connectionId: string) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
      select: {
        id: true, platform: true, platformUsername: true,
        platformDisplayName: true, platformAvatarUrl: true,
        connectionStatus: true, scopes: true, tokenExpiresAt: true,
        connectedAt: true, lastRefreshedAt: true,
      },
    });
    if (!conn) throw new NotFoundException('Connection not found');
    return conn;
  }

  async refreshConnection(userId: string, connectionId: string) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) throw new NotFoundException('Connection not found');
    if (!conn.refreshToken) throw new BadRequestException('No refresh token available');

    const plugin = this.getPlugin(conn.platform);
    const decryptedRefresh = this.encryption.decrypt(conn.refreshToken);
    const tokens = await plugin.refreshToken(decryptedRefresh);

    await this.prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: this.encryption.encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? this.encryption.encrypt(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
        lastRefreshedAt: new Date(),
        connectionStatus: 'ACTIVE',
      },
    });

    return { refreshed: true, expiresAt: tokens.expiresAt };
  }

  async disconnectConnection(userId: string, connectionId: string): Promise<void> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) throw new NotFoundException('Connection not found');

    await this.prisma.platformConnection.update({
      where: { id: connectionId },
      data: { connectionStatus: 'REVOKED' },
    });
  }

  async checkHealth(userId: string, connectionId: string) {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) throw new NotFoundException('Connection not found');

    const plugin = this.getPlugin(conn.platform);
    const decryptedAccess = this.encryption.decrypt(conn.accessToken);

    try {
      const valid = await plugin.validateToken(decryptedAccess);
      if (!valid) {
        await this.prisma.platformConnection.update({
          where: { id: connectionId },
          data: { connectionStatus: 'EXPIRED' },
        });
      }
      return { healthy: valid, platform: conn.platform, status: valid ? 'ACTIVE' : 'EXPIRED' };
    } catch {
      return { healthy: false, platform: conn.platform, status: 'ERROR' };
    }
  }

  private getPlugin(platform: string) {
    const plugin = this.plugins.getPlugin(platform);
    if (!plugin) throw new BadRequestException(`Unsupported platform: ${platform}`);
    return plugin;
  }
}
