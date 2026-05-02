import { Injectable, Logger } from '@nestjs/common';
import { CreditContext } from '../llm-router.types';

export interface UserUsage {
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
  lastRequestAt: Date;
}

export interface ModelUsageRecord {
  calls: number;
  tokens: number;
  costUsd: number;
  latencyMs: number;
  failures: number;
}

@Injectable()
export class CostTracker {
  private readonly logger = new Logger(CostTracker.name);

  // In-memory stores — swap for Redis in production for multi-instance support
  private readonly userUsage = new Map<string, UserUsage>();
  private readonly modelUsage = new Map<string, ModelUsageRecord>();

  // ─── Per-user tracking ──────────────────────────────────────────────────────

  trackRequest(
    userId: string,
    tokens: { input: number; output: number },
    costUsd: number,
  ): void {
    const existing = this.userUsage.get(userId) ?? {
      totalTokens: 0, totalCostUsd: 0, requestCount: 0, lastRequestAt: new Date(),
    };

    existing.totalTokens += tokens.input + tokens.output;
    existing.totalCostUsd += costUsd;
    existing.requestCount++;
    existing.lastRequestAt = new Date();

    this.userUsage.set(userId, existing);
  }

  getUserUsage(userId: string): UserUsage {
    return this.userUsage.get(userId) ?? {
      totalTokens: 0, totalCostUsd: 0, requestCount: 0, lastRequestAt: new Date(),
    };
  }

  /**
   * Check if a user has sufficient credits for a request.
   * Returns true if allowed, false if credit exhausted.
   */
  hasSufficientCredits(ctx: CreditContext, estimatedCostUsd: number): boolean {
    const estimatedCents = Math.ceil(estimatedCostUsd * 100);
    return ctx.creditsRemainingCents >= estimatedCents;
  }

  /**
   * Deduct credits after a successful request.
   * Returns updated context (caller is responsible for persisting).
   */
  deductCredits(ctx: CreditContext, actualCostUsd: number): CreditContext {
    const deductCents = Math.ceil(actualCostUsd * 100);
    const updated: CreditContext = {
      ...ctx,
      creditsRemainingCents: Math.max(0, ctx.creditsRemainingCents - deductCents),
      monthlyTokensUsed: ctx.monthlyTokensUsed,
    };

    this.logger.debug(
      `Credits: user=${ctx.userId} deducted=${deductCents}¢ remaining=${updated.creditsRemainingCents}¢`,
    );

    return updated;
  }

  // ─── Per-model tracking ─────────────────────────────────────────────────────

  recordModelSuccess(
    modelKey: string,
    tokens: { input: number; output: number },
    costUsd: number,
    latencyMs: number,
  ): void {
    const r = this.getOrCreateModelRecord(modelKey);
    r.calls++;
    r.tokens += tokens.input + tokens.output;
    r.costUsd += costUsd;
    r.latencyMs = r.calls === 1 ? latencyMs : (r.latencyMs * (r.calls - 1) + latencyMs) / r.calls;
    this.modelUsage.set(modelKey, r);
  }

  recordModelFailure(modelKey: string): void {
    const r = this.getOrCreateModelRecord(modelKey);
    r.calls++;
    r.failures++;
    this.modelUsage.set(modelKey, r);
  }

  getModelMetrics(): Record<string, ModelUsageRecord> {
    return Object.fromEntries(this.modelUsage);
  }

  getAllUserMetrics(): Record<string, UserUsage> {
    return Object.fromEntries(this.userUsage);
  }

  private getOrCreateModelRecord(key: string): ModelUsageRecord {
    return this.modelUsage.get(key) ?? {
      calls: 0, tokens: 0, costUsd: 0, latencyMs: 0, failures: 0,
    };
  }
}
