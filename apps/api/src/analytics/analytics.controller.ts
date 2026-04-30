import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Aggregate totals and averages across all published posts' })
  @ApiQuery({ name: 'platform', required: false })
  overview(@CurrentUser() user: AuthUser, @Query('platform') platform?: string) {
    return this.analyticsService.getOverview(user.id, platform);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Paginated post performance table' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['engagementRate', 'impressions', 'publishedAt'] })
  posts(
    @CurrentUser() user: AuthUser,
    @Query('platform') platform?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sortBy') sortBy = 'publishedAt',
  ) {
    return this.analyticsService.getPostPerformance(user.id, {
      platform, from, to,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      sortBy,
    });
  }

  @Get('platforms')
  @ApiOperation({ summary: 'Breakdown of performance by platform' })
  platforms(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getPlatformBreakdown(user.id);
  }

  @Get('time-series')
  @ApiOperation({ summary: 'Daily time-series for charts (last N days)' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'days', required: false, type: Number })
  timeSeries(
    @CurrentUser() user: AuthUser,
    @Query('platform') platform?: string,
    @Query('days') days = '30',
  ) {
    return this.analyticsService.getTimeSeries(user.id, platform, parseInt(days, 10));
  }

  @Get('top-posts')
  @ApiOperation({ summary: 'Top performing posts by engagement rate' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  topPosts(
    @CurrentUser() user: AuthUser,
    @Query('platform') platform?: string,
    @Query('limit') limit = '10',
  ) {
    return this.analyticsService.getTopPosts(user.id, platform, parseInt(limit, 10));
  }
}
