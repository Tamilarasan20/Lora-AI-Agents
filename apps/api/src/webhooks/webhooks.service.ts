import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRegistryService } from '../plugins/plugin-registry.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plugins: PluginRegistryService,
    private readonly eventBus: EventBusService,
    private readonly queue: QueueService,
  ) {}

  // ── Verification handshakes (GET) ─────────────────────────────────────────

  verifyInstagramChallenge(mode: string, challenge: string, verifyToken: string): string {
    const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    if (mode !== 'subscribe' || verifyToken !== expected) {
      throw new UnauthorizedException('Invalid webhook verification');
    }
    return challenge;
  }

  // ── Incoming events (POST) ────────────────────────────────────────────────

  async handleInstagram(payload: unknown, signature: string): Promise<void> {
    this.verifySignature(JSON.stringify(payload), signature, process.env.META_CLIENT_SECRET ?? '');
    const events = (payload as any).entry ?? [];

    for (const entry of events) {
      for (const change of entry.changes ?? []) {
        await this.processInstagramChange(change);
      }
    }
  }

  async handleFacebook(payload: unknown, signature: string): Promise<void> {
    this.verifySignature(JSON.stringify(payload), signature, process.env.FACEBOOK_CLIENT_SECRET ?? '');
    const events = (payload as any).entry ?? [];

    for (const entry of events) {
      for (const messaging of entry.messaging ?? []) {
        await this.processFacebookMessaging(messaging);
      }
    }
  }

  async handleTwitter(payload: unknown, crcToken?: string): Promise<{ response_token?: string }> {
    // Twitter CRC challenge (GET-style verification in POST)
    if (crcToken) {
      const hmac = createHmac('sha256', process.env.TWITTER_CLIENT_SECRET ?? '')
        .update(crcToken)
        .digest('base64');
      return { response_token: `sha256=${hmac}` };
    }

    const events = payload as Record<string, unknown>;
    if (events.tweet_create_events) {
      this.logger.log('Twitter tweet_create_events received');

      const connection = await this.prisma.platformConnection.findFirst({
        where: { platform: 'twitter', connectionStatus: 'ACTIVE' },
      });

      for (const tweet of events.tweet_create_events as any[]) {
        // Skip self-tweets
        if (connection && tweet.user?.id_str === connection.platformUserId) continue;
        if (!connection) continue;

        await this.prisma.engagementItem.create({
          data: {
            userId: connection.userId,
            platform: 'twitter',
            platformEngagementId: tweet.id_str,
            type: 'MENTION',
            platformAuthorId: tweet.user?.id_str ?? '',
            platformAuthorUsername: tweet.user?.screen_name ?? '',
            text: tweet.text ?? '',
            sentiment: 'NEUTRAL',
            engagementCreatedAt: new Date(),
          },
        });

        await this.queue.addJob(QUEUE_NAMES.PROCESS_ENGAGEMENT, JOB_NAMES.PROCESS_MENTION, {
          platform: 'twitter',
          type: 'mention',
          text: tweet.text ?? '',
          authorUsername: tweet.user?.screen_name ?? '',
          userId: connection.userId,
        });
      }
    }
    return {};
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private verifySignature(body: string, signature: string, secret: string): void {
    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    try {
      const match = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      if (!match) throw new UnauthorizedException('Invalid webhook signature');
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async processInstagramChange(change: any): Promise<void> {
    if (change.field === 'comments') {
      const value = change.value;
      // Find the post owner via platformPostId
      const publishedPost = await this.prisma.publishedPost.findFirst({
        where: { platform: 'instagram', platformPostId: value.media?.id },
      });
      if (!publishedPost) return;

      // Enqueue engagement processing
      await this.queue.addJob(QUEUE_NAMES.PROCESS_ENGAGEMENT, JOB_NAMES.PROCESS_COMMENT, {
        engagementItemId: value.id,
        platform: 'instagram',
        type: 'comment',
        text: value.text,
        authorUsername: value.from?.username ?? '',
        postContext: `Instagram post ${value.media?.id}`,
        brandTone: 'professional',
        userId: publishedPost.userId,
      });
    }
  }

  private async processFacebookMessaging(messaging: any): Promise<void> {
    if (messaging.message) {
      this.logger.log(`Facebook DM from ${messaging.sender?.id}`);

      const connection = await this.prisma.platformConnection.findFirst({
        where: { platform: 'facebook', platformUserId: messaging.recipient?.id, connectionStatus: 'ACTIVE' },
      });
      if (!connection) return;

      await this.prisma.engagementItem.create({
        data: {
          userId: connection.userId,
          platform: 'facebook',
          platformEngagementId: messaging.message?.mid ?? `fb_dm_${Date.now()}`,
          type: 'DM',
          platformAuthorId: messaging.sender?.id ?? '',
          platformAuthorUsername: messaging.sender?.id ?? '',
          text: messaging.message?.text ?? '',
          sentiment: 'NEUTRAL',
          engagementCreatedAt: new Date(),
        },
      });

      await this.queue.addJob(QUEUE_NAMES.PROCESS_ENGAGEMENT, JOB_NAMES.PROCESS_DM, {
        platform: 'facebook',
        type: 'dm',
        text: messaging.message?.text ?? '',
        authorUsername: messaging.sender?.id ?? '',
        userId: connection.userId,
      });
    }
  }
}
