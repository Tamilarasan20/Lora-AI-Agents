'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

type Status = 'loading' | 'success' | 'error';

export default function ConnectionsCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');   // format: "userId:nonce"
    const platform = params.get('platform') ?? detectPlatformFromState(state ?? '');
    const error = params.get('error');
    const errorDesc = params.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDesc ?? error);
      return;
    }

    if (!code || !platform) {
      setStatus('error');
      setMessage('Missing required parameters from OAuth callback.');
      return;
    }

    const redirectUri = `${window.location.origin}/connections/callback`;

    api
      .post('/connections/exchange', { platform, code, redirectUri })
      .then(() => {
        setStatus('success');
        setMessage(`${capitalize(platform)} connected successfully!`);
        setTimeout(() => router.push('/connections'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err?.response?.data?.message ?? `Failed to connect ${capitalize(platform)}.`,
        );
      });
  }, [params, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Connecting your account…</h2>
            <p className="text-sm text-gray-500 mt-2">This only takes a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Connected!</h2>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <p className="text-xs text-gray-400 mt-4">Redirecting you back…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Connection failed</h2>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <button
              onClick={() => router.push('/connections')}
              className="mt-6 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
            >
              Back to Connections
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Some platforms encode the platform name in the state param
function detectPlatformFromState(state: string): string {
  const known = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube', 'pinterest'];
  const lower = state.toLowerCase();
  return known.find((p) => lower.includes(p)) ?? '';
}
