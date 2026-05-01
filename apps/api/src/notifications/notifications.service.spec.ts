import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const USER_ID = 'user-1';
const NOTIF_ID = 'notif-1';

const fakeNotif = {
  id: NOTIF_ID, userId: USER_ID, type: 'INFO',
  title: 'Post published', message: 'Your post went live!',
  isRead: false, createdAt: new Date(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('list', () => {
    it('returns paginated notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValueOnce([fakeNotif]);
      mockPrisma.notification.count.mockResolvedValueOnce(1);

      const result = await service.list(USER_ID, false, 1, 10);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      mockPrisma.notification.count.mockResolvedValueOnce(3);
      const result = await service.getUnreadCount(USER_ID);
      expect(result.unread).toBe(3);
    });
  });

  describe('markRead', () => {
    it('marks notification as read', async () => {
      mockPrisma.notification.findUnique.mockResolvedValueOnce(fakeNotif);
      mockPrisma.notification.update.mockResolvedValueOnce({ ...fakeNotif, isRead: true });

      await service.markRead(USER_ID, NOTIF_ID);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: NOTIF_ID }, data: { isRead: true },
      });
    });

    it('throws NotFoundException for unknown notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValueOnce(null);
      await expect(service.markRead(USER_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for another user notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValueOnce({ ...fakeNotif, userId: 'other' });
      await expect(service.markRead(USER_ID, NOTIF_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications as read for user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 5 });

      await service.markAllRead(USER_ID);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('create', () => {
    it('creates a notification', async () => {
      mockPrisma.notification.create.mockResolvedValueOnce(fakeNotif);

      const result = await service.create(USER_ID, {
        type: 'INFO', title: 'Post published', message: 'Your post went live!',
      });
      expect(result.id).toBe(NOTIF_ID);
    });
  });
});
