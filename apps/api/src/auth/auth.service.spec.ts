import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      'auth.jwtSecret': 'test-secret',
      'auth.jwtExpiresIn': '15m',
      'auth.refreshSecret': 'test-refresh-secret',
      'auth.refreshExpiresIn': '7d',
    };
    return map[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.register({ email: 'test@example.com', password: 'Pass123!', fullName: 'Test User' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user and returns token pair on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'user-1', email: 'test@example.com', plan: 'FREE',
      });

      const result = await service.register({
        email: 'test@example.com', password: 'Pass123!', fullName: 'Test User',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'noone@example.com', password: 'Pass123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPass!', 12);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', email: 'test@example.com', passwordHash: hash,
        status: 'ACTIVE', plan: 'FREE',
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for suspended account', async () => {
      const hash = await bcrypt.hash('Pass123!', 12);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', email: 'test@example.com', passwordHash: hash,
        status: 'SUSPENDED', plan: 'FREE',
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'Pass123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns token pair on valid credentials', async () => {
      const hash = await bcrypt.hash('Pass123!', 12);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1', email: 'test@example.com', passwordHash: hash,
        status: 'ACTIVE', plan: 'FREE',
      });
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.login({
        email: 'test@example.com', password: 'Pass123!',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });
  });

  describe('refresh', () => {
    it('generates new token pair', async () => {
      const result = await service.refresh('user-1', 'test@example.com', 'FREE');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('forgotPassword', () => {
    it('returns silently even when email not found (prevents enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.forgotPassword('ghost@example.com')).resolves.toBeUndefined();
    });
  });
});
