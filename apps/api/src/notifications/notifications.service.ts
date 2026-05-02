import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway: NotificationsGateway,
  ) {}

  async list(userId: string, unreadOnly: boolean, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { unread: count };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.userId !== userId) throw new ForbiddenException();
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async create(userId: string, data: {
    type: string; title: string; message: string; metadata?: Record<string, unknown>;
  }) {
    const notification = await this.prisma.notification.create({
      data: { userId, ...data, isRead: false },
    });

    if (this.gateway) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { supabaseId: true },
      });
      if (user?.supabaseId) {
        this.gateway.pushToUser(user.supabaseId, notification as any);
        const unread = await this.prisma.notification.count({
          where: { userId, isRead: false },
        });
        this.gateway.pushUnreadCount(user.supabaseId, unread);
      }
    }

    return notification;
  }

  async delete(userId: string, id: string): Promise<void> {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException();
    if (notif.userId !== userId) throw new ForbiddenException();
    await this.prisma.notification.delete({ where: { id } });
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updatePreferences(
    userId: string,
    dto: Partial<{ email: boolean; push: boolean; inApp: boolean; digest: boolean; digestFrequency: string }>,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
}
