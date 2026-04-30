import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EngagementService } from './engagement.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

class ReplyBodyDto {
  @ApiProperty()
  @IsString()
  replyText: string;
}

@ApiTags('Engagement')
@ApiBearerAuth()
@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'List comments, mentions, DMs (inbox)' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['COMMENT', 'DM', 'MENTION', 'REPLY'] })
  @ApiQuery({ name: 'replied', required: false, type: Boolean })
  @ApiQuery({ name: 'escalated', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  inbox(
    @CurrentUser() user: AuthUser,
    @Query('platform') platform?: string,
    @Query('type') type?: string,
    @Query('replied') replied?: string,
    @Query('escalated') escalated?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.engagementService.listInbox(user.id, {
      platform, type,
      replied: replied !== undefined ? replied === 'true' : undefined,
      escalated: escalated !== undefined ? escalated === 'true' : undefined,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread engagement items' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.engagementService.getUnreadCount(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single engagement item' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engagementService.getItem(user.id, id);
  }

  @Post(':id/approve-reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Approve and send Sarah's AI-drafted reply" })
  async approveReply(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.engagementService.approveReply(user.id, id);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a manual human reply' })
  async manualReply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplyBodyDto,
  ) {
    await this.engagementService.manualReply(user.id, id, dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark engagement item as read' })
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.engagementService.markRead(user.id, id);
  }
}
