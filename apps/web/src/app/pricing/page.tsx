'use client';
import { CheckCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useCreateCheckout, useOpenPortal } from '@/lib/hooks/useBilling';

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Try Loraloop risk-free',
    priceId: null,
    features: [
      '10 posts per month',
      '5 AI generations',
      '1 social account',
      'Basic analytics',
    ],
    cta: 'Get started',
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For creators & solopreneurs',
    priceId: 'price_pro_monthly',
    features: [
      '150 posts per month',
      '100 AI generations',
      '5 social accounts',
      'Advanced analytics',
      'Priority support',
      'Custom brand voice',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    id: 'AGENCY',
    name: 'Agency',
    price: '$99',
    period: '/month',
    description: 'For teams & agencies',
    priceId: 'price_agency_monthly',
    features: [
      'Unlimited posts',
      'Unlimited AI generations',
      'Unlimited social accounts',
      'White-label reports',
      'Dedicated account manager',
      'API access',
      'Team collaboration',
    ],
    cta: 'Upgrade to Agency',
  },
];

export default function PricingPage() {
  const { user, isAuthenticated } = useAuthStore();
  const checkout = useCreateCheckout();
  const portal = useOpenPortal();

  const handlePlan = (plan: typeof PLANS[0]) => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }
    if (!plan.priceId) {
      window.location.href = '/dashboard';
      return;
    }
    if (user?.plan === plan.id) {
      portal.mutate(window.location.href);
      return;
    }
    checkout.mutate({ priceId: plan.priceId, returnUrl: window.location.href });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
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
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Start free, upgrade when you need more. No hidden fees, cancel anytime.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => {
            const isCurrent = isAuthenticated && user?.plan === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? 'ring-2 ring-brand-500 shadow-xl shadow-brand-100'
                    : 'border border-gray-200 shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-3">Most popular</div>
                )}
                <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  onClick={() => handlePlan(plan)}
                  loading={checkout.isPending || portal.isPending}
                  disabled={isCurrent && plan.id === 'FREE'}
                >
                  {isCurrent ? 'Current plan' : plan.cta}
                </Button>
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
