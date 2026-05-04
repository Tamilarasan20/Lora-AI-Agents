'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Zap, X, CheckCircle } from 'lucide-react';
import { useCreateCheckout } from '@/lib/hooks/useBilling';
import { useCredits } from '@/lib/hooks/useCredits';

interface UpgradeModalState {
  open: boolean;
  reason?: string;
}

interface UpgradeModalContextValue {
  showUpgrade: (reason?: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue>({ showUpgrade: () => {} });

export function useUpgradeModal() {
  return useContext(UpgradeModalContext);
}

const NEXT_PLAN: Record<string, { id: string; name: string; credits: number; price: string; priceId: string; perks: string[] }> = {
  FREE: {
    id: 'SOLO', name: 'Solo', credits: 100, price: '$9.99/mo',
    priceId: 'price_solo_annual',
    perks: ['100 monthly AI credits', 'All 9 AI helpers', '2 seats', 'Working hours support'],
  },
  SOLO: {
    id: 'PRO', name: 'Pro', credits: 500, price: '$29.99/mo',
    priceId: 'price_pro_annual',
    perks: ['500 monthly AI credits', 'All 9 AI helpers', '5 seats', '3 workspaces', '24/7 support'],
  },
  PRO: {
    id: 'AGENCY', name: 'Agency', credits: 1200, price: '$69.99/mo',
    priceId: 'price_agency_annual',
    perks: ['1,200 monthly AI credits', 'All 9 AI helpers', '25 seats', '10 workspaces', '24/7 support'],
  },
  AGENCY: {
    id: 'ENTERPRISE', name: 'Enterprise', credits: 2500, price: '$149.99/mo',
    priceId: 'price_enterprise_annual',
    perks: ['2,500 monthly AI credits', 'Unlimited seats', 'Unlimited workspaces', 'Priority 24/7 support'],
  },
};

function UpgradeModal({ state, onClose }: { state: UpgradeModalState; onClose: () => void }) {
  const { data: credits } = useCredits();
  const checkout = useCreateCheckout();

  const currentPlan = credits?.plan ?? 'FREE';
  const nextPlan = NEXT_PLAN[currentPlan];

  if (!state.open || !nextPlan) return null;

  const handleUpgrade = () => {
    checkout.mutate({ priceId: nextPlan.priceId, returnUrl: `${window.location.origin}/billing/success` });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold mb-1">
            {state.reason === 'credits_exhausted'
              ? "You've run out of credits"
              : 'Upgrade your plan'}
          </h2>
          <p className="text-sm text-white/80">
            {state.reason === 'credits_exhausted'
              ? `Your ${currentPlan} plan credits are used up for this month.`
              : 'Unlock more AI power for your marketing team.'}
          </p>
        </div>

        {/* Plan details */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Upgrade to</div>
              <div className="text-lg font-bold text-gray-900">{nextPlan.name}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-violet-600">{nextPlan.price}</div>
              <div className="text-xs text-gray-400">billed annually</div>
            </div>
          </div>

          <ul className="space-y-2.5 mb-6">
            {nextPlan.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
                {perk}
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={checkout.isPending}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {checkout.isPending ? 'Opening checkout…' : `Upgrade to ${nextPlan.name}`}
          </button>
          <button onClick={onClose} className="w-full py-2 mt-2 text-sm text-gray-500 hover:text-gray-700">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UpgradeModalState>({ open: false });

  const showUpgrade = useCallback((reason?: string) => {
    setState({ open: true, reason });
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ showUpgrade }}>
      {children}
      <UpgradeModal state={state} onClose={() => setState({ open: false })} />
    </UpgradeModalContext.Provider>
  );
}
