import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { SarahAgent } from '../agents/sarah/sarah.agent';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { SchedulePostDto, RescheduleDto } from './dto/schedule-post.dto';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly sarah: SarahAgent,
  ) {}

  async schedule(userId: string, dto: SchedulePostDto) {
    // Validate content exists and belongs to user
    const content = await this.prisma.content.findFirst({
      where: { id: dto.contentId, userId },
    });
    if (!content) throw new NotFoundException('Content not found');
    if (!['APPROVED', 'DRAFT'].includes(content.status)) {
      throw new BadRequestException('Content must be APPROVED or DRAFT to schedule');
    }

    // Validate connection
    const connection = await this.prisma.platformConnection.findFirst({
      where: { id: dto.connectionId, userId, connectionStatus: 'ACTIVE' },
    });
    if (!connection) throw new NotFoundException('Active platform connection not found');

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Scheduled time must be in the future');

    // Create ScheduledPost record
    const scheduledPost = await this.prisma.scheduledPost.create({
      data: {
        contentId: dto.contentId,
        userId,
        platformConnectionId: dto.connectionId,
        platform: dto.platform,
        scheduledAt,
        timezone: dto.timezone ?? 'UTC',
        priority: dto.priority ?? 5,
        status: 'SCHEDULED',
      },
    });

    // Enqueue BullMQ delayed job
    const jobId = await this.queue.scheduleJob(
      QUEUE_NAMES.PUBLISH_POST,
      JOB_NAMES.PUBLISH_SCHEDULED_POST,
      {
        scheduledPostId: scheduledPost.id,
        contentId: dto.contentId,
        userId,
        platform: dto.platform,
        connectionId: dto.connectionId,
      },
      scheduledAt,
    );

    // Store job ID back on the record
    await this.prisma.scheduledPost.update({
      where: { id: scheduledPost.id },
      data: { bullJobId: jobId },
    });

    return { ...scheduledPost, bullJobId: jobId };
  }

  async scheduleWithAI(userId: string, contentId: string, connectionId: string, platform: string, timezone: string) {
    // Ask Sarah to determine the optimal publish time
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const result = await this.sarah.decidePublishTime({
      contentId,
      userId,
      platform,
      timezone: timezone || user?.timezone || 'UTC',
    });

    let scheduledAt: string;
    try {
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      scheduledAt = parsed?.scheduledFor;
    } catch {
      throw new BadRequestException('Sarah could not determine a publish time');
    }
    if (!scheduledAt) throw new BadRequestException('Sarah could not determine a publish time');

    return this.schedule(userId, { contentId, connectionId, platform, scheduledAt, timezone });
  }

  async reschedule(userId: string, scheduledPostId: string, dto: RescheduleDto) {
    const post = await this.findOne(userId, scheduledPostId);
    if (post.status === 'PUBLISHED') throw new BadRequestException('Cannot reschedule a published post');

    const newTime = new Date(dto.scheduledAt);
    if (newTime <= new Date()) throw new BadRequestException('New scheduled time must be in the future');

    // Remove old BullMQ job
    if (post.bullJobId) {
      await this.queue.removeJob(QUEUE_NAMES.PUBLISH_POST, post.bullJobId);
    }

    // Enqueue new job
    const jobId = await this.queue.scheduleJob(
      QUEUE_NAMES.PUBLISH_POST,
      JOB_NAMES.PUBLISH_SCHEDULED_POST,
      {
        scheduledPostId,
        contentId: post.contentId,
        userId,
        platform: post.platform,
        connectionId: post.platformConnectionId,
      },
      newTime,
    );

    return this.prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { scheduledAt: newTime, bullJobId: jobId, status: 'SCHEDULED' },
    });
  }

  async cancel(userId: string, scheduledPostId: string): Promise<void> {
    const post = await this.findOne(userId, scheduledPostId);
    if (post.status === 'PUBLISHED') throw new BadRequestException('Cannot cancel a published post');

    if (post.bullJobId) {
      await this.queue.removeJob(QUEUE_NAMES.PUBLISH_POST, post.bullJobId);
    }

    await this.prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { status: 'CANCELLED' },
    });
  }

  async findAll(userId: string, platform?: string, status?: string) {
    return this.prisma.scheduledPost.findMany({
      where: {
        userId,
        ...(platform && { platform }),
        ...(status && { status: status as any }),
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const post = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Scheduled post not found');
    if (post.userId !== userId) throw new ForbiddenException();
    return post;
  }

  async getJobStatus(userId: string, scheduledPostId: string) {
    const post = await this.findOne(userId, scheduledPostId);
    if (!post.bullJobId) return { status: post.status, bullJob: null };
    const jobStatus = await this.queue.getJobStatus(QUEUE_NAMES.PUBLISH_POST, post.bullJobId);
    return { status: post.status, bullJob: jobStatus };
  }
}
