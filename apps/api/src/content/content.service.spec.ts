import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentTypeEnum } from './dto/create-content.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { ClaraAgent } from '../agents/clara/clara.agent';

const mockPrisma = {
  content: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  mediaAsset: { findMany: jest.fn() },
  brandKnowledge: { findUnique: jest.fn() },
};

const mockEventBus = { emitContentCreated: jest.fn().mockResolvedValue(undefined) };

const mockClara = {
  generateContent: jest.fn(),
  adaptForPlatform: jest.fn(),
};

const USER_ID = 'user-abc';
const CONTENT_ID = 'content-123';

const fakeContent = {
  id: CONTENT_ID, userId: USER_ID, status: 'DRAFT',
  targetPlatforms: ['instagram'], rawContent: { caption: 'Hello world' },
  hashtags: [], createdAt: new Date(), updatedAt: new Date(),
};

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: ClaraAgent, useValue: mockClara },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
  });

  describe('create', () => {
    it('creates content and emits event', async () => {
      mockPrisma.mediaAsset.findMany.mockResolvedValueOnce([]);
      mockPrisma.content.create.mockResolvedValueOnce(fakeContent);

      const result = await service.create(USER_ID, {
        caption: 'Hello world',
        targetPlatforms: ['instagram'],
        contentType: ContentTypeEnum.SOCIAL_POST,
        hashtags: ['summer'],
      });

      expect(result.id).toBe(CONTENT_ID);
      expect(mockEventBus.emitContentCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated content for user', async () => {
      mockPrisma.content.findMany.mockResolvedValueOnce([fakeContent]);
      mockPrisma.content.count.mockResolvedValueOnce(1);

      const result = await service.findAll(USER_ID, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns content when found and owned by user', async () => {
      mockPrisma.content.findUnique.mockResolvedValueOnce(fakeContent);
      const result = await service.findOne(USER_ID, CONTENT_ID);
      expect(result.id).toBe(CONTENT_ID);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.content.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne(USER_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when owned by another user', async () => {
      mockPrisma.content.findUnique.mockResolvedValueOnce({ ...fakeContent, userId: 'other-user' });
      await expect(service.findOne(USER_ID, CONTENT_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates and returns updated content', async () => {
      mockPrisma.content.findUnique.mockResolvedValueOnce(fakeContent);
      const updated = { ...fakeContent, hashtags: ['newTag'] };
      mockPrisma.content.update.mockResolvedValueOnce(updated);

      const result = await service.update(USER_ID, CONTENT_ID, { hashtags: ['newTag'] });
      expect(result.hashtags).toContain('newTag');
    });
  });

  describe('delete', () => {
    it('deletes content owned by user', async () => {
      mockPrisma.content.findUnique.mockResolvedValueOnce(fakeContent);
      mockPrisma.content.delete.mockResolvedValueOnce(fakeContent);

      await expect(service.delete(USER_ID, CONTENT_ID)).resolves.toBeUndefined();
      expect(mockPrisma.content.delete).toHaveBeenCalledWith({ where: { id: CONTENT_ID } });
    });

    it('throws ForbiddenException when deleting another user content', async () => {
      mockPrisma.content.findUnique.mockResolvedValueOnce({ ...fakeContent, userId: 'other' });
      await expect(service.delete(USER_ID, CONTENT_ID)).rejects.toThrow(ForbiddenException);
    });
  });
});
