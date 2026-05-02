'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStartBrandKnowledgeJob } from '@/lib/hooks/useBrand';

/**
 * Pomelli-style entry screen.
 * User enters a URL, we enqueue a backend job, then redirect to the
 * Generating screen which polls for status until the draft is ready
 * for review.
 */
export default function StartBrandKnowledgePage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const start = useStartBrandKnowledgeJob();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl.trim()) return;
    const job = await start.mutateAsync(websiteUrl.trim());
    router.push(`/brand/knowledge/${job.jobId}`);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-2xl mb-4">
            ✨
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Build your brand knowledge base
          </h1>
          <p className="mt-3 text-gray-600">
            Drop a website URL and we&apos;ll research your brand — voice, audience,
            competitors, visual identity, and more. You&apos;ll review everything
            before it&apos;s saved.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your website
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yourbrand.com"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              disabled={start.isPending}
              autoFocus
            />
            <button
              type="submit"
              disabled={start.isPending || !websiteUrl.trim()}
              className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-3 font-medium text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {start.isPending ? 'Starting…' : 'Generate'}
            </button>
          </div>

          {start.isError && (
            <p className="mt-3 text-sm text-red-600">
              {(start.error as Error)?.message ?? 'Could not start analysis.'}
            </p>
          )}

          <p className="mt-4 text-xs text-gray-500">
            This usually takes a few minutes. You can leave this page — your
            knowledge base will be ready when you come back.
          </p>
        </form>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
          <Bullet icon="🌐" title="Crawl" body="Multi-page scrape of your site, blog, and key pages." />
          <Bullet icon="🧠" title="Analyze" body="Gemini 2.5 Pro extracts brand DNA, voice, and audience." />
          <Bullet icon="✅" title="Review" body="You edit and approve before anything is saved." />
        </div>
      </div>
    </div>
  );
}

function Bullet({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-medium text-gray-900">{title}</div>
      <div className="mt-1 text-gray-600">{body}</div>
    </div>
  );
}
