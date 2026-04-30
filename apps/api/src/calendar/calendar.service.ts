import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { RescheduleDto } from '../scheduler/dto/schedule-post.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
  ) {}

  async getRange(userId: string, from: string, to: string, platform?: string) {
    const where: any = {
      userId,
      scheduledAt: { gte: new Date(from), lte: new Date(to) },
    };
    if (platform) where.platform = platform;

    const posts = await this.prisma.scheduledPost.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: {
        content: {
          select: {
            id: true, contentType: true,
            rawContent: true, mediaAssets: true, targetPlatforms: true,
          },
        },
      },
    });

    // Group by date for frontend calendar rendering
    const byDate: Record<string, typeof posts> = {};
    for (const post of posts) {
      const key = post.scheduledAt.toISOString().split('T')[0];
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(post);
    }

    return { from, to, byDate, total: posts.length };
  }

  async getWeek(userId: string, weekStart: string, platform?: string) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return this.getRange(userId, start.toISOString(), end.toISOString(), platform);
  }

  async getMonth(userId: string, year: number, month: number, platform?: string) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);
    return this.getRange(userId, from.toISOString(), to.toISOString(), platform);
  }

  // Drag-and-drop reschedule
  async move(userId: string, scheduledPostId: string, newTime: string) {
    return this.scheduler.reschedule(userId, scheduledPostId, { scheduledAt: newTime } as RescheduleDto);
  }

  async getConflicts(userId: string, platform: string, scheduledAt: string, windowMinutes = 30) {
    const target = new Date(scheduledAt);
    const min = new Date(target.getTime() - windowMinutes * 60_000);
    const max = new Date(target.getTime() + windowMinutes * 60_000);

    const conflicts = await this.prisma.scheduledPost.findMany({
      where: {
        userId, platform,
        scheduledAt: { gte: min, lte: max },
        status: { in: ['SCHEDULED', 'PUBLISHING'] },
      },
      select: { id: true, scheduledAt: true, status: true },
    });

    return { hasConflict: conflicts.length > 0, conflicts };
  }
}
