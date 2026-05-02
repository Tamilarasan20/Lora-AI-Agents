import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    await this.assertWorkspaceOwner(userId, workspaceId);
    return this.prisma.project.create({
      data: { userId, workspaceId, crawlDepth: 3, ...dto },
    });
  }

  async findAll(userId: string, workspaceId: string) {
    await this.assertWorkspaceOwner(userId, workspaceId);
    return this.prisma.project.findMany({
      where: { workspaceId, userId },
      include: {
        _count: { select: { crawls: true, akeAssets: true } },
        knowledgeBase: { select: { generatedAt: true, confidenceScore: true } },
        seoData: { select: { generatedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, userId },
      include: {
        crawls: { orderBy: { createdAt: 'desc' }, take: 5 },
        knowledgeBase: true,
        seoData: true,
        strategies: { orderBy: { generatedAt: 'desc' } },
        _count: { select: { akeAssets: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(userId: string, workspaceId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOne(userId, workspaceId, projectId);
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async remove(userId: string, workspaceId: string, projectId: string) {
    await this.findOne(userId, workspaceId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    return { deleted: true };
  }

  private async assertWorkspaceOwner(userId: string, workspaceId: string) {
    const ws = await this.prisma.workspace.findFirst({ where: { id: workspaceId, userId } });
    if (!ws) throw new ForbiddenException('Workspace not found or access denied');
    return ws;
  }
}
