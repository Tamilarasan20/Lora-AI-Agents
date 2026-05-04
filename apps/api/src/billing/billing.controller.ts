import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards, Headers,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { BillingService } from './billing.service';
import { CreditService } from './credit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly credits: CreditService,
  ) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List available subscription plans' })
  getPlans() {
    return this.billing.getPlans();
  }

  @Get('credits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get remaining AI credits for the current user' })
  getCredits(@CurrentUser() user: AuthUser) {
    return this.credits.getRemaining(user.id);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription details — plan, status, renewal date, credits' })
  getSubscription(@CurrentUser() user: AuthUser) {
    return this.credits.getSubscriptionDetails(user.id);
  }

  @Get('checkout/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a completed Stripe Checkout session' })
  verifyCheckout(
    @CurrentUser() user: AuthUser,
    @Query('session_id') sessionId: string,
  ) {
    return this.billing.verifyCheckoutSession(user.id, sessionId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe Checkout session' })
  createCheckout(
    @CurrentUser() user: AuthUser,
    @Body() body: { priceId: string; returnUrl: string },
  ) {
    return this.billing.createCheckoutSession(user.id, body.priceId, body.returnUrl);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open Stripe customer portal' })
  createPortal(
    @CurrentUser() user: AuthUser,
    @Body() body: { returnUrl: string },
  ) {
    return this.billing.createPortalSession(user.id, body.returnUrl);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver — requires raw body' })
  async handleWebhook(
    @Req() req: FastifyRequest,
    @Headers('stripe-signature') sig: string,
  ) {
    const raw = (req as any).rawBody as Buffer;
    await this.billing.handleWebhook(raw, sig);
    return { received: true };
  }
}
