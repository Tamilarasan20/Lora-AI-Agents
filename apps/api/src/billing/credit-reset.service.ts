import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_CREDITS: Record<string, number> = {
  SOLO:       100,
  PRO:        500,
  AGENCY:     1200,
  ENTERPRISE: 2500,
};

@Injectable()
export class CreditResetService {
  private readonly logger = new Logger(CreditResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs at midnight on the 1st of every month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyCredits(): Promise<void> {
    this.logger.log('Monthly credit reset started');

    // Only reset users whose subscription is currently active
    const users = await this.prisma.user.findMany({
      where: {
        subscriptionStatus: 'active',
        plan: { not: 'FREE' },
      },
      select: { id: true, plan: true, email: true },
    });

    if (users.length === 0) {
      this.logger.log('No active subscribers to reset');
      return;
    }

    let resetCount = 0;

    for (const user of users) {
      const planLimit = PLAN_CREDITS[user.plan];
      if (!planLimit) continue;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          creditsUsedThisMonth: 0,
          creditsResetAt: new Date(),
        },
      });

      resetCount++;
    }

    this.logger.log(`Monthly credit reset complete — ${resetCount} users reset`);
  }

  // Manual trigger (for testing or support use)
  async resetCreditsForUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, subscriptionStatus: true },
    });

    if (!user || user.subscriptionStatus !== 'active' || user.plan === 'FREE') {
      throw new Error('User does not have an active paid subscription');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { creditsUsedThisMonth: 0, creditsResetAt: new Date() },
    });
  }

  async getRemainingCredits(userId: string): Promise<{ used: number; limit: number; remaining: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true, creditsUsedThisMonth: true },
    });

    const limit = PLAN_CREDITS[user.plan] ?? 0;
    const used  = user.creditsUsedThisMonth;

    return { used, limit, remaining: Math.max(0, limit - used) };
  }
}
