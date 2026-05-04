'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const PLAN_CREDITS: Record<string, number> = {
  SOLO: 100, PRO: 500, AGENCY: 1200, ENTERPRISE: 2500,
};

interface VerifyResult {
  success: boolean;
  plan: string;
  credits: number;
}

export default function BillingSuccessPage() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const qc            = useQueryClient();
  const sessionId     = searchParams.get('session_id');

  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!sessionId) { setState('error'); return; }

    api.get<VerifyResult>(`/billing/checkout/verify?session_id=${sessionId}`)
      .then(({ data }) => {
        if (data.success) {
          // Invalidate all billing and user queries so sidebar + settings refresh
          qc.invalidateQueries({ queryKey: ['billing'] });
          qc.invalidateQueries({ queryKey: ['auth', 'me'] });
          setState('success');
          setResult(data);
        } else {
          setState('error');
        }
      })
      .catch(() => setState('error'));
  }, [sessionId, qc]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-violet-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Confirming your upgrade…</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6">
            We couldn't verify your payment. If you were charged, your plan will update automatically. Check your email for a receipt.
          </p>
          <button
            onClick={() => router.push('/settings?tab=billing')}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
          >
            Go to billing settings
          </button>
        </div>
      </div>
    );
  }

  const planName    = result?.plan ?? 'Pro';
  const credits     = result?.credits ?? PLAN_CREDITS[planName] ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-violet-100 p-8 max-w-md w-full text-center">
        {/* Success icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You're on {planName}!
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Your plan is now active. Welcome to the team.
        </p>

        {/* Credit callout */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-violet-900">{credits} AI credits ready</div>
            <div className="text-xs text-violet-600">Resets on the 1st of each month</div>
          </div>
        </div>

        {/* What's included */}
        <div className="text-left mb-6 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What's included</div>
          {[
            'Sam — market research & competitor analysis',
            'Clara — copywriting & content creation',
            'Steve — AI image & carousel generation',
            'Sarah — smart content calendar planning',
            'Lora — AI marketing orchestration',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/lora')}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 flex items-center justify-center gap-2 transition-colors"
        >
          Start with Lora <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-2 mt-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
