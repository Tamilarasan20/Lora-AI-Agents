import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { MetaService } from './meta.service';
import { MetaWebhookService, MetaWebhookBody } from './meta-webhook.service';
import { InstagramPublishService, IgPublishRequest } from './instagram-publish.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Meta / Instagram')
@Controller('meta')
export class MetaController {
  constructor(
    private readonly meta: MetaService,
    private readonly webhook: MetaWebhookService,
    private readonly publisher: InstagramPublishService,
    private readonly config: ConfigService,
  ) {}

  // ── OAuth ─────────────────────────────────────────────────────────────────

  @Post('oauth/url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate Meta OAuth URL' })
  getOAuthUrl(@CurrentUser() user: AuthUser, @Body('state') state: string) {
    const url = this.meta.buildOAuthUrl(state);
    return { url };
  }

  @Post('oauth/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete Meta OAuth: exchange code, fetch IG accounts, store tokens' })
  async completeOAuth(@CurrentUser() user: AuthUser, @Body('code') code: string) {
    if (!code) throw new UnauthorizedException('Missing OAuth code');
    return this.meta.completeOAuth(user.id, code);
  }

  // ── Instagram accounts ────────────────────────────────────────────────────

  @Get('instagram/accounts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List connected Instagram Business accounts' })
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.meta.listInstagramAccounts(user.id);
  }

  // ── Publishing ────────────────────────────────────────────────────────────

  @Post('instagram/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish an Instagram post immediately' })
  async publishNow(@CurrentUser() user: AuthUser, @Body() body: Omit<IgPublishRequest, 'userId'>) {
    return this.publisher.publishNow({ ...body, userId: user.id });
  }

  @Post('instagram/schedule')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule an Instagram post' })
  async schedulePost(
    @CurrentUser() user: AuthUser,
    @Body() body: Omit<IgPublishRequest, 'userId'> & { scheduledAt: string },
  ) {
    return this.publisher.schedulePost({
      ...body,
      userId: user.id,
      scheduledAt: new Date(body.scheduledAt),
    });
  }

  // ── Token refresh ─────────────────────────────────────────────────────────

  @Post('instagram/refresh-token/:connectionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-refresh a Meta long-lived token' })
  async refreshToken(@CurrentUser() user: AuthUser, @Param('connectionId') connectionId: string) {
    await this.meta.refreshToken(connectionId);
    return { refreshed: true };
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'Meta webhook verification challenge (GET)' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.meta.verifyWebhook(mode, token, challenge);
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta webhook event receiver (POST)' })
  async receiveWebhook(@Req() req: Request, @Body() body: MetaWebhookBody) {
    const signature = (req.headers['x-hub-signature-256'] as string) ?? '';
    const secret = this.config.getOrThrow<string>('META_APP_SECRET');
    const rawBody = JSON.stringify(body);

    if (!this.webhook.verifySignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Respond immediately; all processing is async
    void this.webhook.handleWebhook(body);
    return { status: 'ok' };
  }
}
