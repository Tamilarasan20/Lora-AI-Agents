'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBrandKnowledgeJob, useCancelBrandKnowledgeJob } from '@/lib/hooks/useBrand';

/**
 * Pomelli-style "Generating your Knowledge Base" screen.
 * Polls the backend job every 2s and shows weighted progress + per-stage status.
 * Auto-redirects to the review page once status === AWAITING_REVIEW.
 */
export default function GeneratingBrandKnowledgePage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const { data: job, isLoading } = useBrandKnowledgeJob(jobId);
  const cancel = useCancelBrandKnowledgeJob(jobId);

  useEffect(() => {
    if (job?.status === 'AWAITING_REVIEW') {
      router.replace(`/brand/knowledge/${jobId}/review`);
    }
  }, [job?.status, jobId, router]);

  if (isLoading || !job) {
    return <CenteredSpinner label="Loading job…" />;
  }

  const failed = job.status === 'FAILED';
  const cancelled = job.status === 'CANCELLED';
  const progress = job.progressPct ?? 0;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-3xl mb-4">
            {failed ? '⚠️' : cancelled ? '⏹' : '✨'}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {failed
              ? 'Generation failed'
              : cancelled
              ? 'Generation cancelled'
              : 'Generating your knowledge base'}
          </h1>
          <p className="mt-3 text-gray-600">
            {failed ? (
              <>We couldn&apos;t finish analyzing <span className="font-medium">{job.websiteUrl}</span>.</>
            ) : cancelled ? (
              <>This run was cancelled. You can start over any time.</>
            ) : (
              <>
                We&apos;re researching and analyzing <span className="font-medium">{job.websiteUrl}</span>.
                It will take several minutes. Feel free to come back later.
              </>
            )}
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              {failed ? 'Stopped' : cancelled ? 'Cancelled' : `${progress}%`}
            </span>
            <span className="text-xs text-gray-500">
              {job.currentStage ? humanStage(job.currentStage) : ''}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                failed
                  ? 'bg-red-400'
                  : cancelled
                  ? 'bg-gray-300'
                  : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <ul className="mt-6 space-y-3">
            {job.stages.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <StageIcon status={s.status} />
                <span
                  className={`text-sm ${
                    s.status === 'completed'
                      ? 'text-gray-900'
                      : s.status === 'running'
                      ? 'text-gray-900 font-medium'
                      : s.status === 'failed'
                      ? 'text-red-600'
                      : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
                {s.error && (
                  <span className="text-xs text-red-500 truncate">— {s.error}</span>
                )}
              </li>
            ))}
          </ul>

          {failed && job.errorMessage && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {job.errorMessage}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => router.push('/brand')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to Brand
            </button>
            {!failed && !cancelled && job.status !== 'APPROVED' && (
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                Cancel this run
              </button>
            )}
            {(failed || cancelled) && (
              <button
                onClick={() => router.push('/brand/knowledge')}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Try again
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Job ID: <span className="font-mono">{jobId}</span>
        </p>
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: 'pending' | 'running' | 'completed' | 'failed' }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        ✓
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center">
        <span className="block h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600">
        !
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-400">
      ○
    </span>
  );
}

function humanStage(key: string) {
  const map: Record<string, string> = {
    crawl: 'Crawling pages…',
    images: 'Saving brand assets…',
    extract: 'Reading the brand mind…',
    documents: 'Writing knowledge docs…',
    finalize: 'Finalizing…',
  };
  return map[key] ?? key;
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <span className="block h-6 w-6 mx-auto animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
        <p className="mt-3 text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
