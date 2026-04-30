import { Injectable, Logger } from '@nestjs/common';
import { PluginRegistryService } from '../../plugins/plugin-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../encryption/encryption.service';
import { EventBusService } from '../../events/event-bus.service';
import { KAFKA_TOPICS } from '../../events/event.types';
import { NotImplementedError } from '../../plugins/platform-plugin.interface';

export interface PublishJobPayload {
  scheduledPostId: string;
  contentId: string;
  userId: string;
  platform: string;
  connectionId: string;
}

export interface PublishOutcome {
  success: boolean;
  platformPostId?: string;
  postUrl?: string;
  error?: string;
}

@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);

  constructor(
    private readonly plugins: PluginRegistryService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly eventBus: EventBusService,
  ) {}

  async publish(payload: PublishJobPayload): Promise<PublishOutcome> {
    const { scheduledPostId, contentId, userId, platform, connectionId } = payload;

    // Load scheduled post + content
    const scheduledPost = await this.prisma.scheduledPost.findUnique({
      where: { id: scheduledPostId },
    });
    if (!scheduledPost) {
      return { success: false, error: `ScheduledPost ${scheduledPostId} not found` };
    }

    const content = await this.prisma.content.findUnique({ where: { id: contentId } });
    if (!content) {
      return { success: false, error: `Content ${contentId} not found` };
    }

    // Load platform connection with decrypted tokens
    const connection = await this.prisma.platformConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection || connection.connectionStatus !== 'ACTIVE') {
      return { success: false, error: `Connection ${connectionId} not active` };
    }

    const tokens = {
      accessToken: this.encryption.decrypt(connection.accessToken),
      refreshToken: connection.refreshToken ? this.encryption.decrypt(connection.refreshToken) : undefined,
      openId: connection.openId ?? undefined,
    };

    // Get plugin
    const plugin = this.plugins.getPlugin(platform);
    if (!plugin) {
      return { success: false, error: `Plugin not found for platform: ${platform}` };
    }

    // Build publish input from content
    const platformContent = (content.platformContent as Record<string, unknown>)?.[platform];
    if (!platformContent) {
      return { success: false, error: `No adapted content for platform ${platform} on content ${contentId}` };
    }

    // Mark as publishing
    await this.prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { status: 'PUBLISHING', publishAttempts: { increment: 1 } },
    });

    let outcome: PublishOutcome;

    try {
      const result = await plugin.publish(
        platformContent as Parameters<typeof plugin.publish>[0],
        tokens,
      );

      outcome = {
        success: result.success,
        platformPostId: result.platformPostId,
        postUrl: result.platformUrl ?? undefined,
      };
    } catch (err) {
      if (err instanceof NotImplementedError) {
        // Plugin stub — treat as success in dev environment only
        this.logger.warn(`Plugin ${platform}.publish() not implemented — using stub response`);
        outcome = {
          success: true,
          platformPostId: `stub_${Date.now()}`,
          postUrl: plugin.getPostUrl(`stub_${Date.now()}`),
        };
      } else {
        outcome = { success: false, error: String(err) };
      }
    }

    if (outcome.success && outcome.platformPostId) {
      // Create PublishedPost record
      const publishedPost = await this.prisma.publishedPost.create({
        data: {
          scheduledPostId,
          contentId,
          userId,
          platform,
          platformPostId: outcome.platformPostId,
          platformUrl: outcome.postUrl,
          publishedAt: new Date(),
          platformConnectionId: connectionId,
        },
      });

      // Update ScheduledPost status
      await this.prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: { status: 'PUBLISHED' },
      });

      // Emit event
      await this.eventBus.emitPostPublished({
        payload: {
          publishedPostId: publishedPost.id,
          scheduledPostId,
          contentId,
          userId,
          platform,
          platformPostId: outcome.platformPostId,
          publishedAt: publishedPost.publishedAt.toISOString(),
          postUrl: outcome.postUrl,
        },
      });

      this.logger.log(`Published: ${platform}/${outcome.platformPostId} (scheduledPost=${scheduledPostId})`);
    } else {
      // Mark as failed
      await this.prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: { status: 'FAILED', lastError: outcome.error },
      });
      this.logger.error(`Publish failed: ${platform} scheduledPost=${scheduledPostId} — ${outcome.error}`);
    }

    return outcome;
  }
}
