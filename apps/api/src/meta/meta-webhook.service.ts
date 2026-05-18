import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';

export interface MetaWebhookBody {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  time: number;
  changes?: MetaWebhookChange[];
  messaging?: MetaWebhookMessage[];
}

export interface MetaWebhookChange {
  field: string;
  value: Record<string, unknown>;
}

export interface MetaWebhookMessage {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: { mid: string; text?: string };
}

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  verifySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = signatureHeader.replace('sha256=', '');
    try {
      return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  async handleWebhook(body: MetaWebhookBody): Promise<void> {
    // Store raw event immediately for idempotency/replay
    const stored = await this.prisma.webhookEvent.create({
      data: {
        platform: 'instagram',
        eventType: body.object,
        rawPayload: body as unknown as Record<string, unknown>,
        processed: false,
      },
    });

    // Process async via queue — never block the 200 response
    try {
      await this.queue.addJob(
        QUEUE_NAMES.WEBHOOK_EVENTS,
        JOB_NAMES.PROCESS_WEBHOOK_EVENT,
        { webhookEventId: stored.id, body },
        { jobId: `webhook:${stored.id}` }, // idempotency key
      );
    } catch (err) {
      this.logger.error('Failed to enqueue webhook event', (err as Error).message);
    }
  }

  async processWebhookEvent(webhookEventId: string, body: MetaWebhookBody): Promise<void> {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        await this.processChange(change).catch((err) =>
          this.logger.error(`Failed to process change ${change.field}: ${err.message}`),
        );
      }

      for (const msg of entry.messaging ?? []) {
        await this.processMessaging(msg).catch((err) =>
          this.logger.error(`Failed to process messaging event: ${err.message}`),
        );
      }
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processed: true, processedAt: new Date() },
    });
  }

  // ── Change processors ─────────────────────────────────────────────────────

  private async processChange(change: MetaWebhookChange): Promise<void> {
    switch (change.field) {
      case 'comments':
        await this.handleComment(change.value);
        break;
      case 'mentions':
        await this.handleMention(change.value);
        break;
      case 'media':
        await this.handleMediaPublishStatus(change.value);
        break;
      case 'messages':
        await this.handleInstagramDm(change.value);
        break;
      default:
        this.logger.debug(`Unhandled webhook field: ${change.field}`);
    }
  }

  private async handleComment(value: Record<string, unknown>): Promise<void> {
    const mediaId = (value.media as any)?.id;
    const publishedPost = mediaId
      ? await this.prisma.publishedPost.findFirst({ where: { platform: 'instagram', platformPostId: mediaId } })
      : null;

    if (!publishedPost) return;

    await this.queue.addJob(QUEUE_NAMES.PROCESS_ENGAGEMENT, JOB_NAMES.PROCESS_COMMENT, {
      engagementItemId: value.id as string,
      platform: 'instagram',
      type: 'comment',
      text: value.text as string,
      authorUsername: (value.from as any)?.username ?? '',
      postContext: `Instagram post ${mediaId}`,
      userId: publishedPost.userId,
    });
  }

  private async handleMention(value: Record<string, unknown>): Promise<void> {
    const igAccount = await this.prisma.instagramAccount.findFirst({
      where: { igAccountId: value.mentioned_media_id as string ?? value.commentId as string },
    });
    if (!igAccount) return;

    await this.queue.addJob(QUEUE_NAMES.PROCESS_ENGAGEMENT, JOB_NAMES.PROCESS_MENTION, {
      platform: 'instagram',
      type: 'mention',
      mediaId: value.media_id as string,
      userId: igAccount.userId,
    });
  }

  private async handleMediaPublishStatus(value: Record<string, unknown>): Promise<void> {
    const postId = value.media_id as string | undefined;
    if (!postId) return;

    const post = await this.prisma.scheduledPost.findFirst({
      where: { platformPostId: postId },
    });
    if (!post) return;

    await this.prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  private async handleInstagramDm(value: Record<string, unknown>): Promise<void> {
    const senderId = (value.sender as any)?.id;
    const recipientId = (value.recipient as any)?.id;
    const text = (value.message as any)?.text ?? '';

    const account = await this.prisma.instagramAccount.findFirst({
      where: { igAccountId: recipientId },
    });
    if (!account) return;

    await this.prisma.engagementItem.create({
      data: {
        userId: account.userId,
        platform: 'instagram',
        platformEngagementId: (value.message as any)?.mid ?? `ig_dm_${Date.now()}`,
        type: 'DM',
        platformAuthorId: senderId ?? '',
        platformAuthorUsername: senderId ?? '',
        text,
        sentiment: 'NEUTRAL',
        engagementCreatedAt: new Date(),
      },
    }).catch(() => null); // ignore duplicates

    await this.queue.addJob(QUEUE_NAMES.PROCESS_ENGAGEMENT, JOB_NAMES.PROCESS_DM, {
      platform: 'instagram',
      type: 'dm',
      text,
      authorUsername: senderId ?? '',
      userId: account.userId,
    });
  }

  private async processMessaging(msg: MetaWebhookMessage): Promise<void> {
    const text = msg.message?.text ?? '';
    const account = await this.prisma.instagramAccount.findFirst({
      where: { igAccountId: msg.recipient.id },
    });
    if (!account) return;

    await this.prisma.engagementItem.create({
      data: {
        userId: account.userId,
        platform: 'instagram',
        platformEngagementId: msg.message?.mid ?? `ig_msg_${msg.timestamp}`,
        type: 'DM',
        platformAuthorId: msg.sender.id,
        platformAuthorUsername: msg.sender.id,
        text,
        sentiment: 'NEUTRAL',
        engagementCreatedAt: new Date(msg.timestamp),
      },
    }).catch(() => null);
  }
}
