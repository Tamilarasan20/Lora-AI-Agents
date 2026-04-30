import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, fullName: true, avatarUrl: true,
        timezone: true, plan: true, planExpiresAt: true,
        status: true, emailVerified: true, lastLoginAt: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true, email: true, fullName: true, avatarUrl: true,
        timezone: true, plan: true, updatedAt: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
    });
  }

  async getStats(id: string) {
    const [connections, totalContent, scheduledPosts, publishedPosts] = await Promise.all([
      this.prisma.platformConnection.count({ where: { userId: id, connectionStatus: 'ACTIVE' } }),
      this.prisma.content.count({ where: { userId: id } }),
      this.prisma.scheduledPost.count({ where: { userId: id, status: { in: ['SCHEDULED', 'PUBLISHING'] } } }),
      this.prisma.publishedPost.count({ where: { userId: id } }),
    ]);
    return { connections, totalContent, scheduledPosts, publishedPosts };
  }
}
