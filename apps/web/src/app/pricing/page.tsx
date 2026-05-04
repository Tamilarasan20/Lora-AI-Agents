'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useCreateCheckout, useOpenPortal } from '@/lib/hooks/useBilling';

type BillingPeriod = 'monthly' | 'quarterly' | 'annual';

interface PlanPrice {
  monthly:   number;
  quarterly: number;
  annual:    number;
  priceIds: {
    monthly:   string | null;
    quarterly: string | null;
    annual:    string | null;
  };
}

interface Plan {
  id: string;
  name: string;
  description: string;
  highlighted?: boolean;
  soon?: boolean;
  prices: PlanPrice;
  features: Array<{ label: string; soon?: boolean }>;
}

const PLANS: Plan[] = [
  {
    id: 'SOLO',
    name: 'Solo',
    description: 'For individual creators getting started',
    prices: {
      monthly:   19,
      quarterly: 15.99,
      annual:    9.99,
      priceIds: {
        monthly:   'price_solo_monthly',
        quarterly: 'price_solo_quarterly',
        annual:    'price_solo_annual',
      },
    },
    features: [
      { label: 'All 9 AI helpers' },
      { label: '100 monthly AI credits' },
      { label: '2 Seats' },
      { label: '1 Workspace' },
      { label: 'Support working hours' },
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    description: 'For creators & solopreneurs scaling up',
    highlighted: true,
    prices: {
      monthly:   49,
      quarterly: 41.65,
      annual:    29.99,
      priceIds: {
        monthly:   'price_pro_monthly',
        quarterly: 'price_pro_quarterly',
        annual:    'price_pro_annual',
      },
    },
    features: [
      { label: 'All 9 AI helpers' },
      { label: '500 monthly AI credits' },
      { label: '5 Seats' },
      { label: '3 Workspaces' },
      { label: 'Support 24/7' },
    ],
  },
  {
    id: 'AGENCY',
    name: 'Agency',
    description: 'For growing teams and agencies',
    prices: {
      monthly:   89,
      quarterly: 75.65,
      annual:    69.99,
      priceIds: {
        monthly:   'price_agency_monthly',
        quarterly: 'price_agency_quarterly',
        annual:    'price_agency_annual',
      },
    },
    features: [
      { label: 'All 9 AI helpers' },
      { label: '1,200 monthly AI credits' },
      { label: '25 Seats' },
      { label: '10 Workspaces' },
      { label: 'Support 24/7' },
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'For large teams needing full control',
    prices: {
      monthly:   199,
      quarterly: 169.15,
      annual:    149.99,
      priceIds: {
        monthly:   'price_enterprise_monthly',
        quarterly: 'price_enterprise_quarterly',
        annual:    'price_enterprise_annual',
      },
    },
    features: [
      { label: 'All 9 AI helpers' },
      { label: '2,500 monthly AI credits' },
      { label: 'Unlimited Seats' },
      { label: 'Unlimited Workspaces' },
      { label: 'Priority Support 24/7' },
      { label: 'Customise your own plan', soon: true },
    ],
  },
];

const BILLING_OPTIONS: { id: BillingPeriod; label: string; badge?: string }[] = [
  { id: 'monthly',   label: 'Month plan' },
  { id: 'quarterly', label: '3-month plan', badge: 'Save 15%' },
  { id: 'annual',    label: '12-month plan', badge: 'Save 30%' },
];

function formatPrice(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default function PricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const { user, isAuthenticated } = useAuthStore();
  const checkout = useCreateCheckout();
  const portal   = useOpenPortal();

  const handlePlan = (plan: Plan) => {
    if (plan.soon) return;
    if (!isAuthenticated) { window.location.href = '/register'; return; }
    const priceId = plan.prices.priceIds[period];
    if (!priceId) { window.location.href = '/dashboard'; return; }
    if (user?.plan === plan.id) { portal.mutate(window.location.href); return; }
    checkout.mutate({ priceId, returnUrl: window.location.href });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Loraloop</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard"><Button size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link href="/register"><Button size="sm">Get started free</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Pricing</h1>
        <p className="text-lg text-gray-500 max-w-md mx-auto">
          Start free, scale when you're ready. No hidden fees, cancel anytime.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {BILLING_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPeriod(opt.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === opt.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt.label}
              {opt.badge && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  period === opt.id
                    ? 'bg-white/20 text-white'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {opt.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = isAuthenticated && user?.plan === plan.id;
            const currentPrice = plan.prices[period];
            const monthlyPrice = plan.prices.monthly;
            const showStrike = period !== 'monthly';

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl flex flex-col ${
                  plan.highlighted
                    ? 'ring-2 ring-violet-500 shadow-xl shadow-violet-100'
                    : 'border border-gray-200 shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="p-6 flex-1">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h2>
                  <p className="text-xs text-gray-500 mb-5">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {showStrike && (
                      <div className="text-sm text-gray-400 line-through mb-0.5">
                        {formatPrice(monthlyPrice)}
                      </div>
                    )}
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-gray-900">{formatPrice(currentPrice)}</span>
                      <span className="text-sm text-gray-400 mb-1">/mo</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <span>{f.label}</span>
                        {f.soon && (
                          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                            Soon
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-6 pb-6">
                  <button
                    onClick={() => handlePlan(plan)}
                    disabled={checkout.isPending || portal.isPending}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                      plan.highlighted
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {isCurrent ? 'Current plan' : 'Get Loraloop'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          All plans include SSL, 99.9% uptime SLA, and GDPR-compliant data handling.
        </p>
      </div>
    </div>
  );
}
