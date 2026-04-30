import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { SchedulePostDto, BulkScheduleDto, RescheduleDto } from './dto/schedule-post.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Scheduler')
@ApiBearerAuth()
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a post at a specific time' })
  schedule(@CurrentUser() user: AuthUser, @Body() dto: SchedulePostDto) {
    return this.schedulerService.schedule(user.id, dto);
  }

  @Post('ai')
  @ApiOperation({ summary: 'Let Sarah pick the optimal publish time automatically' })
  scheduleWithAI(
    @CurrentUser() user: AuthUser,
    @Body() dto: { contentId: string; connectionId: string; platform: string; timezone?: string },
  ) {
    return this.schedulerService.scheduleWithAI(
      user.id, dto.contentId, dto.connectionId, dto.platform, dto.timezone ?? 'UTC',
    );
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Schedule multiple posts at once' })
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkScheduleDto) {
    return Promise.all(dto.posts.map((p) => this.schedulerService.schedule(user.id, p)));
  }

  @Get()
  @ApiOperation({ summary: 'List scheduled posts' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    return this.schedulerService.findAll(user.id, platform, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scheduled post' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedulerService.findOne(user.id, id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get BullMQ job status for a scheduled post' })
  jobStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedulerService.getJobStatus(user.id, id);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule a post to a new time' })
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.schedulerService.reschedule(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a scheduled post' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.schedulerService.cancel(user.id, id);
  }
}
