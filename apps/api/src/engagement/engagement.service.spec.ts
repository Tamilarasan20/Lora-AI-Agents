import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EngagementService } from './engagement.service';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRegistryService } from '../plugins/plugin-registry.service';
import { EncryptionService } from '../encryption/encryption.service';
import { EventBusService } from '../events/event-bus.service';

const mockPrisma = {
  engagementItem: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  platformConnection: { findFirst: jest.fn() },
};

const mockPlugins = { getPlugin: jest.fn() };
const mockEncryption = { decrypt: jest.fn().mockReturnValue('decrypted-token') };
const mockEventBus = {
  emitPostPublished: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
};

const USER_ID = 'user-1';
const ITEM_ID = 'item-1';

const fakeItem = {
  id: ITEM_ID, userId: USER_ID, platform: 'instagram',
  type: 'COMMENT', text: 'Love your content!', authorUsername: 'fan123',
  replied: false, isRead: false, replyText: 'Thank you!',
  engagementCreatedAt: new Date(), repliedAt: null, repliedBy: null,
};

describe('EngagementService', () => {
  let service: EngagementService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PluginRegistryService, useValue: mockPlugins },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<EngagementService>(EngagementService);
  });

  describe('listInbox', () => {
    it('returns paginated engagement items', async () => {
      mockPrisma.engagementItem.findMany.mockResolvedValueOnce([fakeItem]);
      mockPrisma.engagementItem.count.mockResolvedValueOnce(1);

      const result = await service.listInbox(USER_ID, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by platform and type', async () => {
      mockPrisma.engagementItem.findMany.mockResolvedValueOnce([]);
      mockPrisma.engagementItem.count.mockResolvedValueOnce(0);

      await service.listInbox(USER_ID, { platform: 'instagram', type: 'DM', page: 1, limit: 10 });

      const call = mockPrisma.engagementItem.findMany.mock.calls[0][0];
      expect(call.where.platform).toBe('instagram');
      expect(call.where.type).toBe('DM');
    });
  });

  describe('getItem', () => {
    it('returns item when owned by user', async () => {
      mockPrisma.engagementItem.findUnique.mockResolvedValueOnce(fakeItem);
      const result = await service.getItem(USER_ID, ITEM_ID);
      expect(result.id).toBe(ITEM_ID);
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrisma.engagementItem.findUnique.mockResolvedValueOnce(null);
      await expect(service.getItem(USER_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when owned by another user', async () => {
      mockPrisma.engagementItem.findUnique.mockResolvedValueOnce({
        ...fakeItem, userId: 'other-user',
      });
      await expect(service.getItem(USER_ID, ITEM_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markRead', () => {
    it('updates isRead flag', async () => {
      mockPrisma.engagementItem.findUnique.mockResolvedValueOnce(fakeItem);
      mockPrisma.engagementItem.update.mockResolvedValueOnce({ ...fakeItem, isRead: true });

      await service.markRead(USER_ID, ITEM_ID);

      expect(mockPrisma.engagementItem.update).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { isRead: true },
      });
    });
  });
});
