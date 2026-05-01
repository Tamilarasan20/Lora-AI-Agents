import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

export const PLANS = {
  FREE:  { name: 'Free',       posts: 10,  ai: 5,    price: null },
  PRO:   { name: 'Pro',        posts: 150, ai: 100,  price: 'price_pro_monthly' },
  AGENCY:{ name: 'Agency',     posts: 999, ai: 999,  price: 'price_agency_monthly' },
} as const;

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

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
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
          data: { plan: 'FREE' },
        });
        break;
      }
    }
  }

  private async syncSubscription(sub: Stripe.Subscription) {
    const priceId = sub.items.data[0]?.price.id;
    const plan = Object.entries(PLANS).find(([, v]) => v.price === priceId)?.[0] ?? 'FREE';

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: sub.customer as string },
      data: { plan },
    });
  }

  getPlans() {
    return PLANS;
  }
}
