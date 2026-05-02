import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('v1/workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.service.create(userId, workspaceId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.service.findAll(userId, workspaceId);
  }

  @Get(':projectId')
  findOne(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.service.findOne(userId, workspaceId, projectId);
  }

  @Patch(':projectId')
  update(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.service.update(userId, workspaceId, projectId, dto);
  }

  @Delete(':projectId')
  remove(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.service.remove(userId, workspaceId, projectId);
  }
}
