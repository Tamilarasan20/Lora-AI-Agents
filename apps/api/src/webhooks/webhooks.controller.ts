import {
  Body, Controller, Get, Headers, HttpCode, HttpStatus,
  Post, Query, RawBodyRequest, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { WebhooksService } from './webhooks.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // ── Instagram ─────────────────────────────────────────────────────────────

  @Get('instagram')
  @ApiOperation({ summary: 'Instagram webhook verification challenge' })
  instagramChallenge(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
  ): string {
    return this.webhooksService.verifyInstagramChallenge(mode, challenge, verifyToken);
  }

  @Post('instagram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Instagram webhook events' })
  async instagramEvent(
    @Body() payload: unknown,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<void> {
    await this.webhooksService.handleInstagram(payload, signature);
  }

  // ── Facebook ──────────────────────────────────────────────────────────────

  @Get('facebook')
  @ApiOperation({ summary: 'Facebook webhook verification challenge' })
  facebookChallenge(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
  ): string {
    return this.webhooksService.verifyInstagramChallenge(mode, challenge, verifyToken);
  }

  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Facebook webhook events' })
  async facebookEvent(
    @Body() payload: unknown,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<void> {
    await this.webhooksService.handleFacebook(payload, signature);
  }

  // ── Twitter / X ───────────────────────────────────────────────────────────

  @Get('twitter')
  @ApiOperation({ summary: 'Twitter CRC challenge response' })
  async twitterCrc(@Query('crc_token') crcToken: string): Promise<{ response_token: string }> {
    return this.webhooksService.handleTwitter({}, crcToken) as Promise<{ response_token: string }>;
  }

  @Post('twitter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Twitter webhook events' })
  async twitterEvent(@Body() payload: unknown): Promise<Record<string, unknown>> {
    return this.webhooksService.handleTwitter(payload) as Promise<Record<string, unknown>>;
  }
}
