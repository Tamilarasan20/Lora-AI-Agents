import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const PLANS = {
  FREE:       { name: 'Free',       credits: 0,    seats: 1,  workspaces: 1,  priceIds: { monthly: null,                     quarterly: null,                     annual: null                     } },
  SOLO:       { name: 'Solo',       credits: 100,  seats: 2,  workspaces: 1,  priceIds: { monthly: 'price_solo_monthly',       quarterly: 'price_solo_quarterly',       annual: 'price_solo_annual'       } },
  PRO:        { name: 'Pro',        credits: 500,  seats: 5,  workspaces: 3,  priceIds: { monthly: 'price_pro_monthly',        quarterly: 'price_pro_quarterly',        annual: 'price_pro_annual'        } },
  AGENCY:     { name: 'Agency',     credits: 1200, seats: 25, workspaces: 10, priceIds: { monthly: 'price_agency_monthly',     quarterly: 'price_agency_quarterly',     annual: 'price_agency_annual'     } },
  ENTERPRISE: { name: 'Enterprise', credits: 2500, seats: -1, workspaces: -1, priceIds: { monthly: 'price_enterprise_monthly', quarterly: 'price_enterprise_quarterly', annual: 'price_enterprise_annual' } },
} as const;

// Flat map of all priceIds → plan name for webhook sync
const PRICE_TO_PLAN: Record<string, string> = Object.fromEntries(
  Object.entries(PLANS).flatMap(([planId, plan]) =>
    Object.values(plan.priceIds).filter(Boolean).map((pid) => [pid, planId]),
  ),
);

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (key) this.stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  }

  async createCheckoutSession(userId: string, priceId: string, returnUrl: string) {
    if (!this.stripe) throw new BadRequestException('Billing not configured');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email: user.email, metadata: { userId } });
      customerId = customer.id;
      await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    const baseUrl   = returnUrl.replace(/\/billing\/success.*$/, '');
    const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: returnUrl,
    });

    return { url: session.url };
  }

  async createPortalSession(userId: string, returnUrl: string) {
    if (!this.stripe) throw new BadRequestException('Billing not configured');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.stripeCustomerId) throw new BadRequestException('No billing account found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!this.stripe) return;

    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) return;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.prisma.user.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: { plan: 'FREE', subscriptionStatus: 'canceled' },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.prisma.user.updateMany({
          where: { stripeCustomerId: invoice.customer as string },
          data: { subscriptionStatus: 'past_due' },
        });
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // Only flip to active on subscription invoices (not one-off)
        if ((invoice as any).subscription) {
          await this.prisma.user.updateMany({
            where: { stripeCustomerId: invoice.customer as string },
            data: { subscriptionStatus: 'active' },
          });
        }
        break;
      }
    }
  }

  private async syncSubscription(sub: Stripe.Subscription) {
    const priceId = sub.items.data[0]?.price.id ?? '';
    const plan = (PRICE_TO_PLAN[priceId] ?? 'FREE') as Plan;

    // Map Stripe subscription status → our subscriptionStatus
    const statusMap: Record<string, string> = {
      active:   'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid:   'past_due',
      paused:   'paused',
    };
    const subscriptionStatus = statusMap[sub.status] ?? 'active';

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: sub.customer as string },
      data: { plan, subscriptionStatus },
    });
  }

  async verifyCheckoutSession(userId: string, sessionId: string) {
    if (!this.stripe) throw new BadRequestException('Billing not configured');

    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      return { success: false, plan: 'FREE', credits: 0 };
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true },
    });

    const credits = PLANS[user.plan as keyof typeof PLANS]?.credits ?? 0;
    return { success: true, plan: user.plan, credits };
  }

  getPlans() {
    return PLANS;
  }
}
