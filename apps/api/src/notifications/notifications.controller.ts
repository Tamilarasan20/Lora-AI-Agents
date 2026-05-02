import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @CurrentUser() user: AuthUser,
    @Query('unreadOnly') unreadOnly = 'false',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationsService.list(
      user.id,
      unreadOnly === 'true',
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 100),
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notificationsService.markRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.notificationsService.markAllRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notificationsService.delete(user.id, id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: Partial<{ email: boolean; push: boolean; inApp: boolean; digest: boolean; digestFrequency: string }>,
  ) {
    return this.notificationsService.updatePreferences(user.id, dto);
  }
}
