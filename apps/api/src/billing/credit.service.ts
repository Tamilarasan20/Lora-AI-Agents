import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const AGENT_CREDIT_COST: Record<string, number> = {
  sam_research:      4,
  clara_content:     2,
  steve_image:       3,
  steve_carousel:    5,
  sarah_calendar:    1,
  lora_review:       1,
  lora_strategy:     2,
};

export const PLAN_CREDIT_LIMIT: Record<string, number> = {
  FREE:       0,
  SOLO:       100,
  PRO:        500,
  AGENCY:     1200,
  ENTERPRISE: 2500,
};

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRemaining(userId: string): Promise<{ used: number; limit: number; remaining: number; plan: string; subscriptionStatus: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true, creditsUsedThisMonth: true, subscriptionStatus: true },
    });

    const limit = PLAN_CREDIT_LIMIT[user.plan] ?? 0;
    const used  = user.creditsUsedThisMonth;

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  async checkAndDeduct(userId: string, agentName: string, action: string): Promise<void> {
    const costKey = `${agentName.toLowerCase()}_${action.toLowerCase()}`;
    const cost = AGENT_CREDIT_COST[costKey] ?? AGENT_CREDIT_COST[`${agentName.toLowerCase()}_research`] ?? 2;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true, creditsUsedThisMonth: true, subscriptionStatus: true },
    });

    // Block if subscription is not active (except free plan which has 0 limit anyway)
    if (user.plan !== 'FREE' && user.subscriptionStatus === 'past_due') {
      throw new HttpException(
        'Your payment is past due. Please update your payment method.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const limit = PLAN_CREDIT_LIMIT[user.plan] ?? 0;

    if (user.creditsUsedThisMonth + cost > limit) {
      throw new HttpException(
        `You have used all ${limit} credits for this month. Upgrade your plan to continue.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Deduct atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { creditsUsedThisMonth: { increment: cost } },
      }),
      this.prisma.agentCreditUsage.create({
        data: { userId, agentName, action, credits: cost },
      }),
    ]);

    this.logger.debug(`Deducted ${cost} credits from user ${userId} for ${agentName}/${action}`);
  }

  async getSubscriptionDetails(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        planExpiresAt: true,
        creditsUsedThisMonth: true,
        creditsResetAt: true,
        stripeCustomerId: true,
      },
    });

    const limit     = PLAN_CREDIT_LIMIT[user.plan] ?? 0;
    const used      = user.creditsUsedThisMonth;
    const remaining = Math.max(0, limit - used);

    // Next reset = 1st of next month
    const now       = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      plan:               user.plan,
      subscriptionStatus: user.subscriptionStatus,
      renewsAt:           user.planExpiresAt ?? nextReset,
      credits: { used, limit, remaining },
      lastCreditReset:    user.creditsResetAt,
    };
  }
}
