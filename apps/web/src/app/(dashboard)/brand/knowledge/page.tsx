'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { useStartBrandKnowledgeJob } from '@/lib/hooks/useBrand';

export default function StartBrandKnowledgePage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const start = useStartBrandKnowledgeJob();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) return;
    const job = await start.mutateAsync(websiteUrl.trim());
    if (!job?.jobId) {
      throw new Error('Brand analysis started but no job id was returned.');
    }
    router.push(`/brand/knowledge/${job.jobId}`);
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-8 md:px-10 md:py-12">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="hidden rounded-[40px] bg-[radial-gradient(circle_at_30%_20%,rgba(47,128,237,0.18),transparent_38%),linear-gradient(180deg,#f4f8ff_0%,#ecf3ff_100%)] p-10 lg:flex lg:flex-col lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#2f80ed] shadow-sm">
                  <Sparkles className="h-4 w-4" />
                  Lora Knowledge Base
                </div>
                <h1 className="mt-8 max-w-md text-5xl font-semibold tracking-[-0.04em] text-slate-900">
                  Turn any website into usable brand intelligence.
                </h1>
                <p className="mt-5 max-w-lg text-lg leading-8 text-slate-500">
                  We analyze the website, collect visual assets, identify market signals, and turn everything into a clean knowledge base your agents can use.
                </p>
              </div>

              <div className="grid gap-4">
                <FeatureCard title="Business profile" body="Founder story, product lineup, retail presence, positioning, and differentiation." />
                <FeatureCard title="Market research" body="Competitor signals, audience motivations, category trends, and opportunity space." />
                <FeatureCard title="Brand guidelines" body="Colors, fonts, visuals, tone of voice, image library, and knowledge docs." />
              </div>
            </div>

            <div className="mx-auto w-full max-w-2xl self-center rounded-[36px] border border-[#d7e3f8] bg-white px-7 py-8 shadow-[0_32px_80px_rgba(31,78,152,0.10)] md:px-10 md:py-10">
              <div className="text-center">
                <h2 className="text-[2.75rem] font-semibold tracking-[-0.05em] text-slate-900 md:text-[3rem]">
                  Enter your website
                </h2>
                <p className="mt-3 text-lg text-slate-500">
                  We&apos;ll analyse your business details and generate knowledge base
                </p>
              </div>

              <form onSubmit={onSubmit} className="mt-10">
                <div className="flex rounded-[30px] border border-slate-200 bg-white px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="yourwebsite.com"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 py-4 text-2xl font-medium text-slate-700 outline-none placeholder:text-slate-300 md:text-[2rem]"
                    disabled={start.isPending}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={start.isPending || !websiteUrl.trim()}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-[#2f80ed] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Continue"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-full bg-[#edf4ff] px-8 py-5 text-xl font-semibold text-[#2f80ed] transition hover:bg-[#e0ebff]"
                  >
                    No Website Yet?
                  </button>
                  <button
                    type="submit"
                    disabled={start.isPending || !websiteUrl.trim()}
                    className="rounded-full bg-[#2f80ed] px-8 py-5 text-xl font-semibold text-white shadow-[0_18px_32px_rgba(47,128,237,0.24)] transition hover:bg-[#1f72e3] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {start.isPending ? 'Starting…' : 'Continue'}
                  </button>
                </div>

                {start.isError && (
                  <p className="mt-4 text-sm font-medium text-red-600">
                    {(start.error as Error)?.message ?? 'Could not start analysis.'}
                  </p>
                )}
              </form>

              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
                <ArrowRight className="h-4 w-4" />
                <span>Website analysis, competitors, assets, and brand docs in one flow</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white/70 p-5 backdrop-blur">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-500">{body}</p>
    </div>
  );
}
