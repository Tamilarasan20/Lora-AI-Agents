import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const existing = await this.prisma.workspace.findFirst({
      where: { userId, slug: dto.slug },
    });
    if (existing) throw new ConflictException(`Workspace slug "${dto.slug}" already exists`);

    return this.prisma.workspace.create({
      data: { userId, ...dto },
      include: { _count: { select: { projects: true } } },
    });
  }

  async findAll(userId: string) {
    return this.prisma.workspace.findMany({
      where: { userId },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const ws = await this.prisma.workspace.findFirst({
      where: { id, userId },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, websiteUrl: true, status: true, lastCrawledAt: true, createdAt: true },
        },
        _count: { select: { projects: true } },
      },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async update(userId: string, id: string, dto: UpdateWorkspaceDto) {
    await this.findOne(userId, id);
    return this.prisma.workspace.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.workspace.delete({ where: { id } });
    return { deleted: true };
  }
}
