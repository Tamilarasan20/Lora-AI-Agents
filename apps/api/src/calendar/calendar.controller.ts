import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

class MovePostDto {
  @ApiProperty({ example: '2026-05-06T09:00:00Z' })
  @IsDateString()
  scheduledAt: string;
}

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('range')
  @ApiOperation({ summary: 'Get all scheduled posts in a date range' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'platform', required: false })
  range(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('platform') platform?: string,
  ) {
    return this.calendarService.getRange(user.id, from, to, platform);
  }

  @Get('week')
  @ApiOperation({ summary: 'Get weekly calendar view' })
  @ApiQuery({ name: 'weekStart', required: true, description: 'ISO date of week start (Monday)' })
  @ApiQuery({ name: 'platform', required: false })
  week(
    @CurrentUser() user: AuthUser,
    @Query('weekStart') weekStart: string,
    @Query('platform') platform?: string,
  ) {
    return this.calendarService.getWeek(user.id, weekStart, platform);
  }

  @Get('month')
  @ApiOperation({ summary: 'Get monthly calendar view' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'platform', required: false })
  month(
    @CurrentUser() user: AuthUser,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('platform') platform?: string,
  ) {
    return this.calendarService.getMonth(user.id, parseInt(year, 10), parseInt(month, 10), platform);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Drag-and-drop reschedule (move a post to a new time)' })
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MovePostDto,
  ) {
    return this.calendarService.move(user.id, id, dto.scheduledAt);
  }

  @Get('conflicts')
  @ApiOperation({ summary: 'Check if a time slot has nearby posts (conflict detection)' })
  @ApiQuery({ name: 'platform', required: true })
  @ApiQuery({ name: 'scheduledAt', required: true })
  @ApiQuery({ name: 'windowMinutes', required: false, type: Number })
  conflicts(
    @CurrentUser() user: AuthUser,
    @Query('platform') platform: string,
    @Query('scheduledAt') scheduledAt: string,
    @Query('windowMinutes') windowMinutes = '30',
  ) {
    return this.calendarService.getConflicts(user.id, platform, scheduledAt, parseInt(windowMinutes, 10));
  }
}
