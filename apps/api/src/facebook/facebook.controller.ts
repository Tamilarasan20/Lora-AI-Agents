import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { FacebookPageService, FbPublishRequest } from './facebook-page.service';

@ApiTags('Facebook Pages')
@Controller('facebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class FacebookController {
  constructor(private readonly fbPage: FacebookPageService) {}

  @Get('pages')
  @ApiOperation({ summary: 'List connected Facebook Pages' })
  listPages(@CurrentUser() user: AuthUser) {
    return this.fbPage.listPages(user.id);
  }

  @Post('pages/:pageId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a post to a Facebook Page now' })
  publishNow(
    @CurrentUser() user: AuthUser,
    @Param('pageId') facebookPageDbId: string,
    @Body() body: Omit<FbPublishRequest, 'userId' | 'facebookPageDbId'>,
  ) {
    return this.fbPage.publishNow({ ...body, facebookPageDbId, userId: user.id });
  }

  @Post('pages/:pageId/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule a post to a Facebook Page' })
  schedulePost(
    @CurrentUser() user: AuthUser,
    @Param('pageId') facebookPageDbId: string,
    @Body() body: Omit<FbPublishRequest, 'userId' | 'facebookPageDbId'> & { scheduledAt: string },
  ) {
    return this.fbPage.schedulePost({
      ...body,
      facebookPageDbId,
      userId: user.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  @Get('pages/:pageId/insights')
  @ApiOperation({ summary: 'Get Facebook Page analytics' })
  getInsights(
    @CurrentUser() user: AuthUser,
    @Param('pageId') pageDbId: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    return this.fbPage.getPageInsights(
      pageDbId,
      user.id,
      since ? new Date(since) : undefined,
      until ? new Date(until) : undefined,
    );
  }

  @Get('pages/:pageId/posts')
  @ApiOperation({ summary: 'List posts for a Facebook Page' })
  listPosts(@CurrentUser() user: AuthUser, @Param('pageId') pageDbId: string) {
    return this.fbPage.listPosts(pageDbId, user.id);
  }
}
