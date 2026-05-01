'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight, ArrowLeft, Zap, Link2, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useOAuthUrl } from '@/lib/hooks/useConnections';
import api from '@/lib/api';

const STEPS = [
  { id: 1, title: 'Connect a platform', icon: Link2, description: 'Link your first social account to get started' },
  { id: 2, title: 'Set your brand voice', icon: Palette, description: 'Tell Clara how you want to sound' },
  { id: 3, title: 'Generate first content', icon: Sparkles, description: 'Let AI create your first post' },
  { id: 4, title: "You're all set!", icon: CheckCircle, description: 'Start publishing with Loraloop' },
];

const PLATFORMS = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook'];
const TONES = ['Professional', 'Casual', 'Witty', 'Inspirational', 'Educational', 'Playful'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const oauthUrl = useOAuthUrl();
  const [step, setStep] = useState(1);
  const [connected, setConnected] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const [brandDesc, setBrandDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleConnect = async (platform: string) => {
    try {
      const res = await oauthUrl.mutateAsync(platform);
      window.open(res.data.url, '_blank', 'width=600,height=700');
      setConnected((prev) => [...new Set([...prev, platform])]);
    } catch {
      // silently ignore — user may close popup
    }
  };

  const handleFinish = async () => {
    setGenerating(true);
    try {
      await api.patch('/auth/onboarding-complete');
    } catch { /* non-fatal */ }
    setGenerating(false);
    setDone(true);
    setTimeout(() => router.push('/dashboard'), 1200);
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl text-gray-900">Loraloop</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step > s.id ? 'bg-brand-500 text-white' :
                  step === s.id ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
                </div>
              </div>
            ))}
          </div>
          <div className="relative h-1.5 bg-gray-100 rounded-full mt-1">
            <div
              className="absolute inset-y-0 left-0 bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Connect a platform</h2>
            <p className="text-sm text-gray-500 mb-6">Connect at least one social account to publish content.</p>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleConnect(p)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    connected.includes(p)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 hover:border-brand-300 text-gray-700'
                  }`}
                >
                  <span className="text-lg">{
                    p === 'instagram' ? '📸' :
                    p === 'twitter' ? '🐦' :
                    p === 'linkedin' ? '💼' :
                    p === 'tiktok' ? '🎵' : '👍'
                  }</span>
                  <span className="capitalize">{p}</span>
                  {connected.includes(p) && <CheckCircle className="w-3.5 h-3.5 ml-auto text-brand-500" />}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">You can connect more platforms later in Settings.</p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Set your brand voice</h2>
            <p className="text-sm text-gray-500 mb-6">Clara will use this to write content that sounds like you.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred tone</label>
              <div className="flex flex-wrap gap-2 mb-5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      tone === t ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Describe your brand in a sentence</label>
              <textarea
                value={brandDesc}
                onChange={(e) => setBrandDesc(e.target.value)}
                rows={3}
                placeholder="e.g. We help small businesses grow through authentic social media storytelling…"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-brand-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to generate!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your first piece of content is just one click away. You can generate from the Content tab anytime.
            </p>
            <Button onClick={() => router.push('/content?generate=true')} variant="outline" className="w-full mb-3">
              <Sparkles className="w-4 h-4" /> Generate my first post
            </Button>
            <p className="text-xs text-gray-400">Or skip and explore the dashboard first.</p>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {done ? 'Heading to dashboard…' : "You're all set!"}
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Welcome{user?.name ? `, ${user.name}` : ''}! Loraloop is ready to help you grow.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && connected.length === 0}
            >
              {step === 1 && connected.length === 0 ? 'Connect to continue' : 'Continue'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleFinish} loading={generating}>
              Go to dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Skip */}
        {step < STEPS.length && (
          <p className="text-center mt-4">
            <button onClick={() => setStep((s) => s + 1)} className="text-xs text-gray-400 hover:text-gray-600">
              Skip this step
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
