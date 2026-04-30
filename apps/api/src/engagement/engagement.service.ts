import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRegistryService } from '../plugins/plugin-registry.service';
import { EncryptionService } from '../encryption/encryption.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';

export class ReplyDto {
  replyText: string;
}

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plugins: PluginRegistryService,
    private readonly encryption: EncryptionService,
    private readonly eventBus: EventBusService,
  ) {}

  async listInbox(userId: string, opts: {
    platform?: string; type?: string; replied?: boolean;
    escalated?: boolean; page: number; limit: number;
  }) {
    const { platform, type, replied, escalated, page, limit } = opts;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (platform) where.platform = platform;
    if (type) where.type = type;
    if (replied !== undefined) where.replied = replied;
    if (escalated !== undefined) where.escalated = escalated;

    const [items, total] = await Promise.all([
      this.prisma.engagementItem.findMany({
        where,
        orderBy: { engagementCreatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.engagementItem.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getItem(userId: string, id: string) {
    const item = await this.prisma.engagementItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Engagement item not found');
    if (item.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async approveReply(userId: string, id: string): Promise<void> {
    const item = await this.getItem(userId, id);
    if (!item.replyText) throw new NotFoundException('No AI reply draft to approve');

    const connection = await this.prisma.platformConnection.findFirst({
      where: { userId, platform: item.platform, connectionStatus: 'ACTIVE' },
    });
    if (!connection) throw new NotFoundException('No active connection for platform');

    const plugin = this.plugins.getPlugin(item.platform);
    if (!plugin) return;

    const credentials = {
      accessToken: this.encryption.decrypt(connection.accessToken),
      refreshToken: connection.refreshToken ? this.encryption.decrypt(connection.refreshToken) : undefined,
    };

    const result = await plugin.replyToComment(
      item.platformEngagementId,
      item.replyText,
      credentials,
    );

    await this.prisma.engagementItem.update({
      where: { id },
      data: {
        replied: true,
        replyId: result.replyId,
        repliedAt: result.publishedAt,
        repliedBy: 'AI',
        isRead: true,
      },
    });

    await this.eventBus.emit(KAFKA_TOPICS.ENGAGEMENT_REPLIED, {
      eventType: 'engagement.replied',
      userId,
      payload: {
        engagementItemId: id,
        replyText: item.replyText,
        repliedBy: 'AI',
        repliedAt: result.publishedAt.toISOString(),
      },
    });
  }

  async manualReply(userId: string, id: string, dto: ReplyDto): Promise<void> {
    const item = await this.getItem(userId, id);

    const connection = await this.prisma.platformConnection.findFirst({
      where: { userId, platform: item.platform, connectionStatus: 'ACTIVE' },
    });
    if (!connection) throw new NotFoundException('No active connection for platform');

    const plugin = this.plugins.getPlugin(item.platform);
    if (!plugin) return;

    const credentials = {
      accessToken: this.encryption.decrypt(connection.accessToken),
      refreshToken: connection.refreshToken ? this.encryption.decrypt(connection.refreshToken) : undefined,
    };

    const result = await plugin.replyToComment(
      item.platformEngagementId,
      dto.replyText,
      credentials,
    );

    await this.prisma.engagementItem.update({
      where: { id },
      data: {
        replied: true,
        replyText: dto.replyText,
        replyId: result.replyId,
        repliedAt: result.publishedAt,
        repliedBy: 'HUMAN',
        isRead: true,
      },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.getItem(userId, id);
    await this.prisma.engagementItem.update({ where: { id }, data: { isRead: true } });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.engagementItem.count({
      where: { userId, isRead: false },
    });
    return { unread: count };
  }
}
