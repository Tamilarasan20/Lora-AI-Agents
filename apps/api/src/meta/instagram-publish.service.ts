import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import {
  createIgImageContainer,
  createIgCarouselItemContainer,
  createIgCarouselContainer,
  createIgReelContainer,
  publishIgContainer,
  waitForContainerReady,
  MetaApiError,
} from './meta-graph.client';

export type IgPostType = 'IMAGE' | 'CAROUSEL' | 'REEL';

export interface IgPublishRequest {
  igAccountDbId: string; // DB id of InstagramAccount row
  userId: string;
  type: IgPostType;
  caption?: string;
  mediaUrls: string[];
  scheduledAt?: Date; // if set, schedule rather than publish now
}

export interface IgPublishResult {
  platformPostId: string;
  platformUrl: string;
  publishedAt: Date;
}

@Injectable()
export class InstagramPublishService {
  private readonly logger = new Logger(InstagramPublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly queue: QueueService,
  ) {}

  async publishNow(request: IgPublishRequest): Promise<IgPublishResult> {
    const { token, igAccountId } = await this.getCredentials(request.igAccountDbId, request.userId);

    let containerId: string;

    switch (request.type) {
      case 'IMAGE':
        containerId = await this.createImageContainer(igAccountId, token, request);
        break;
      case 'CAROUSEL':
        containerId = await this.createCarouselContainer(igAccountId, token, request);
        break;
      case 'REEL':
        containerId = await this.createReelContainer(igAccountId, token, request);
        break;
      default:
        throw new BadRequestException(`Unsupported post type: ${request.type}`);
    }

    await waitForContainerReady(containerId, token);

    const published = await publishIgContainer({ igAccountId, containerId, accessToken: token });

    const postUrl = `https://www.instagram.com/p/${published.id}/`;
    const publishedAt = new Date();

    this.logger.log(`Published IG post ${published.id} for account ${igAccountId}`);

    return { platformPostId: published.id, platformUrl: postUrl, publishedAt };
  }

  async schedulePost(request: IgPublishRequest & { scheduledAt: Date }): Promise<{ jobId: string; scheduledPostId: string }> {
    if (!request.scheduledAt) throw new BadRequestException('scheduledAt is required for scheduled posts');

    const account = await this.prisma.instagramAccount.findFirstOrThrow({
      where: { id: request.igAccountDbId, userId: request.userId, isActive: true },
      include: { platformConnection: { select: { userId: true } } },
    });

    const scheduledPost = await this.prisma.scheduledPost.create({
      data: {
        contentId: (request as any).contentId ?? (await this.getOrCreateContentId(request)),
        userId: request.userId,
        platformConnectionId: account.platformConnectionId,
        platform: 'instagram',
        adaptedCaption: request.caption,
        adaptedMedia: request.mediaUrls,
        scheduledAt: request.scheduledAt,
        status: 'SCHEDULED',
        metadata: { igAccountDbId: request.igAccountDbId, type: request.type },
      },
    });

    const jobId = await this.queue.scheduleJob(
      QUEUE_NAMES.PUBLISH_POST,
      JOB_NAMES.PUBLISH_SCHEDULED_POST,
      {
        platform: 'instagram',
        scheduledPostId: scheduledPost.id,
        userId: request.userId,
        igAccountDbId: request.igAccountDbId,
        type: request.type,
        caption: request.caption,
        mediaUrls: request.mediaUrls,
      },
      request.scheduledAt,
    );

    await this.prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: { bullJobId: jobId },
    });

    this.logger.log(`Scheduled IG post ${scheduledPost.id} for ${request.scheduledAt.toISOString()}`);
    return { jobId, scheduledPostId: scheduledPost.id };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getCredentials(igAccountDbId: string, userId: string): Promise<{ token: string; igAccountId: string }> {
    const account = await this.prisma.instagramAccount.findFirstOrThrow({
      where: { id: igAccountDbId, userId, isActive: true },
    });

    if (!account.facebookPageToken) {
      throw new BadRequestException('No page access token — please reconnect your Instagram account');
    }

    return {
      token: this.encryption.decrypt(account.facebookPageToken),
      igAccountId: account.igAccountId,
    };
  }

  private async createImageContainer(igAccountId: string, token: string, req: IgPublishRequest): Promise<string> {
    if (!req.mediaUrls[0]) throw new BadRequestException('IMAGE post requires at least one media URL');
    const container = await createIgImageContainer({
      igAccountId,
      imageUrl: req.mediaUrls[0],
      caption: req.caption,
      accessToken: token,
    });
    return container.id;
  }

  private async createCarouselContainer(igAccountId: string, token: string, req: IgPublishRequest): Promise<string> {
    if (req.mediaUrls.length < 2) throw new BadRequestException('CAROUSEL requires at least 2 media items');
    if (req.mediaUrls.length > 10) throw new BadRequestException('CAROUSEL supports max 10 items');

    const itemIds: string[] = [];
    for (const url of req.mediaUrls) {
      const isVideo = /\.(mp4|mov|m4v)$/i.test(url);
      const item = await createIgCarouselItemContainer({
        igAccountId,
        mediaUrl: url,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        accessToken: token,
      });
      itemIds.push(item.id);
    }

    const carousel = await createIgCarouselContainer({
      igAccountId,
      mediaUrls: req.mediaUrls,
      caption: req.caption,
      accessToken: token,
      itemIds,
    });
    return carousel.id;
  }

  private async createReelContainer(igAccountId: string, token: string, req: IgPublishRequest): Promise<string> {
    if (!req.mediaUrls[0]) throw new BadRequestException('REEL post requires a video URL');
    const container = await createIgReelContainer({
      igAccountId,
      videoUrl: req.mediaUrls[0],
      caption: req.caption,
      accessToken: token,
      shareToFeed: true,
    });
    return container.id;
  }

  private async getOrCreateContentId(req: IgPublishRequest): Promise<string> {
    const content = await this.prisma.content.create({
      data: {
        userId: req.userId,
        source: 'API',
        contentType: req.type === 'REEL' ? 'REEL' : req.type === 'CAROUSEL' ? 'CAROUSEL' : 'SOCIAL_POST',
        rawContent: { caption: req.caption, mediaUrls: req.mediaUrls },
        targetPlatforms: ['instagram'],
        status: 'APPROVED',
      },
    });
    return content.id;
  }
}
