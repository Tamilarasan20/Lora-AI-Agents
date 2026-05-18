import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { MetaAdsService, CreateCampaignDto } from './meta-ads.service';

@ApiTags('Meta Ads')
@Controller('meta-ads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MetaAdsController {
  constructor(private readonly ads: MetaAdsService) {}

  // ── Ad Accounts ───────────────────────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: 'List connected Meta ad accounts' })
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.ads.listAdAccounts(user.id);
  }

  @Post('accounts/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync ad accounts from Meta' })
  async syncAccounts(
    @CurrentUser() user: AuthUser,
    @Body('accessToken') accessToken: string,
  ) {
    await this.ads.syncAdAccounts(user.id, accessToken);
    return { synced: true };
  }

  @Get('accounts/:accountId/insights')
  @ApiOperation({ summary: 'Get ad account-level insights' })
  getAccountInsights(
    @CurrentUser() user: AuthUser,
    @Param('accountId') adAccountDbId: string,
    @Query('datePreset') datePreset?: string,
  ) {
    return this.ads.getAccountInsights(adAccountDbId, user.id, datePreset);
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  @Get('accounts/:accountId/campaigns')
  @ApiOperation({ summary: 'List campaigns for an ad account' })
  listCampaigns(
    @CurrentUser() user: AuthUser,
    @Param('accountId') adAccountDbId: string,
  ) {
    return this.ads.listCampaigns(adAccountDbId, user.id);
  }

  @Post('accounts/:accountId/campaigns')
  @ApiOperation({ summary: 'Create a new campaign' })
  createCampaign(
    @CurrentUser() user: AuthUser,
    @Param('accountId') adAccountDbId: string,
    @Body() body: Omit<CreateCampaignDto, 'adAccountDbId' | 'userId'>,
  ) {
    return this.ads.createAdCampaign({ ...body, adAccountDbId, userId: user.id });
  }

  @Patch('campaigns/:campaignId/status')
  @ApiOperation({ summary: 'Update campaign status (ACTIVE/PAUSED/DELETED/ARCHIVED)' })
  updateCampaign(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignDbId: string,
    @Body('status') status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
  ) {
    return this.ads.updateCampaign(campaignDbId, user.id, status);
  }

  @Post('accounts/:accountId/campaigns/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync campaigns from Meta' })
  async syncCampaigns(
    @CurrentUser() user: AuthUser,
    @Param('accountId') adAccountDbId: string,
  ) {
    await this.ads.syncCampaigns(adAccountDbId, user.id);
    return { synced: true };
  }

  @Get('accounts/:accountId/campaigns/insights')
  @ApiOperation({ summary: 'Get per-campaign insights' })
  getCampaignInsights(
    @CurrentUser() user: AuthUser,
    @Param('accountId') adAccountDbId: string,
    @Query('datePreset') datePreset?: string,
  ) {
    return this.ads.getCampaignInsights(adAccountDbId, user.id, datePreset);
  }

  // ── Ad Sets ───────────────────────────────────────────────────────────────

  @Get('campaigns/:campaignId/adsets')
  @ApiOperation({ summary: 'List ad sets for a campaign' })
  listAdSets(
    @CurrentUser() user: AuthUser,
    @Param('campaignId') campaignDbId: string,
  ) {
    return this.ads.listAdSets(campaignDbId, user.id);
  }
}
