'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useOpenPortal } from '@/lib/hooks/useBilling';
import { useCredits } from '@/lib/hooks/useCredits';

export function PaymentFailedBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: credits } = useCredits();
  const portal = useOpenPortal();

  if (dismissed || credits?.subscriptionStatus !== 'past_due') return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">
        Your last payment failed. Update your payment method to keep your plan active.
      </span>
      <button
        onClick={() => portal.mutate(window.location.href)}
        disabled={portal.isPending}
        className="flex-shrink-0 bg-white text-red-600 text-xs font-semibold px-3 py-1 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors"
      >
        {portal.isPending ? 'Opening…' : 'Update payment'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
