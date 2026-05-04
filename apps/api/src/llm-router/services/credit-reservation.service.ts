import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CREDITS_PER_USD = 1000; // 1 USD = 1000 credits

@Injectable()
export class CreditReservationService {
  private readonly logger = new Logger(CreditReservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: {
    workspaceId:    string;
    userId:         string;
    requestId:      string;
    estimatedCostUsd: number;
    ledgerId?:      string;
  }): Promise<{ reservationId: string; reservedCredits: number }> {
    const reservedCredits = Math.ceil(input.estimatedCostUsd * CREDITS_PER_USD) + 10; // +10 buffer

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { creditsUsedThisMonth: true, plan: true, subscriptionStatus: true },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const creditLimit = this.getCreditLimit(user.plan);
    const remaining = creditLimit - user.creditsUsedThisMonth;

    if (remaining < reservedCredits) {
      throw new HttpException(
        `Insufficient credits — need ${reservedCredits}, have ${remaining}. Upgrade your plan.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

    const reservation = await this.prisma.aiCreditReservation.create({
      data: {
        workspaceId:     input.workspaceId,
        userId:          input.userId,
        requestId:       input.requestId,
        reservedCredits,
        status:          'reserved',
        expiresAt,
        ledgerId:        input.ledgerId,
      },
    });

    this.logger.debug(`Reserved ${reservedCredits} credits for user ${input.userId} (req ${input.requestId})`);
    return { reservationId: reservation.id, reservedCredits };
  }

  async consume(reservationId: string, actualCostUsd: number): Promise<void> {
    const consumedCredits = Math.ceil(actualCostUsd * CREDITS_PER_USD);

    const reservation = await this.prisma.aiCreditReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.status !== 'reserved') {
      this.logger.warn(`Reservation ${reservationId} not found or already consumed`);
      return;
    }

    const refundedCredits = Math.max(0, reservation.reservedCredits - consumedCredits);

    await this.prisma.$transaction([
      this.prisma.aiCreditReservation.update({
        where: { id: reservationId },
        data: {
          status:          'consumed',
          consumedCredits,
          refundedCredits,
          updatedAt:       new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: reservation.userId },
        data: { creditsUsedThisMonth: { increment: consumedCredits } },
      }),
    ]);

    this.logger.debug(`Consumed ${consumedCredits} credits, refunded ${refundedCredits} for reservation ${reservationId}`);
  }

  async refund(reservationId: string): Promise<void> {
    const reservation = await this.prisma.aiCreditReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.status !== 'reserved') {
      return;
    }

    await this.prisma.aiCreditReservation.update({
      where: { id: reservationId },
      data: {
        status:         'refunded',
        refundedCredits: reservation.reservedCredits,
        updatedAt:      new Date(),
      },
    });

    this.logger.debug(`Refunded ${reservation.reservedCredits} credits for reservation ${reservationId}`);
  }

  async expireStale(): Promise<void> {
    const result = await this.prisma.aiCreditReservation.updateMany({
      where: {
        status:    'reserved',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired', updatedAt: new Date() },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale credit reservations`);
    }
  }

  private getCreditLimit(plan: string): number {
    const limits: Record<string, number> = {
      FREE:       500,
      SOLO:      5000,
      PRO:      25000,
      AGENCY:   75000,
      ENTERPRISE: 200000,
    };
    return limits[plan] ?? 500;
  }

  usdToCredits(usd: number): number {
    return Math.ceil(usd * CREDITS_PER_USD);
  }
}
