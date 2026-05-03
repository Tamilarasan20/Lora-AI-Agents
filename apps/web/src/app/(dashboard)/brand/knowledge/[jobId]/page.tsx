'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Sparkles } from 'lucide-react';
import { useBrandKnowledgeJob, useCancelBrandKnowledgeJob } from '@/lib/hooks/useBrand';

export default function GeneratingBrandKnowledgePage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const invalidJobId = !jobId || jobId === 'undefined' || jobId === 'null';
  const { data: job, isLoading } = useBrandKnowledgeJob(jobId);
  const cancel = useCancelBrandKnowledgeJob(jobId);

  useEffect(() => {
    if (job?.status === 'AWAITING_REVIEW') {
      router.replace(`/brand/knowledge/${jobId}/review`);
    }
  }, [job?.status, jobId, router]);

  if (invalidJobId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-lg rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">Couldn&apos;t open this job</h1>
          <p className="mt-4 text-slate-500">
            No valid brand analysis id was found. Please start the analysis again from the knowledge base page.
          </p>
          <button
            onClick={() => router.replace('/brand/knowledge')}
            className="mt-8 rounded-full bg-[#2f80ed] px-6 py-3 font-semibold text-white"
          >
            Back to knowledge base
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !job) {
    return <CenteredLoading label="Loading analysis…" />;
  }

  const failed = job.status === 'FAILED';
  const cancelled = job.status === 'CANCELLED';
  const jobDraft = (job.draftResult ?? {}) as Record<string, any>;
  const previewImages =
    (jobDraft.imageUrls as string[] | undefined) ??
    (jobDraft.referenceImages as string[] | undefined) ??
    [];
  const previewImage =
    previewImages[0] ??
    (jobDraft.logoUrl as string | undefined) ??
    null;

  return (
    <div className="flex min-h-screen flex-col px-4 py-8 md:px-10 md:py-12">
      <div className="mb-8">
        <button
          onClick={() => router.push('/brand/knowledge')}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[760px] rounded-[40px] border border-[#d7e3f8] bg-white p-7 shadow-[0_32px_90px_rgba(31,78,152,0.12)] md:p-10">
          <div className="text-center">
            <h1 className="text-[2.7rem] font-semibold tracking-[-0.05em] text-slate-900 md:text-[3.25rem]">
              {failed ? 'Generation failed' : cancelled ? 'Generation cancelled' : 'Building your knowledge'}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-500">
              {failed
                ? `We couldn’t finish analysing ${job.websiteUrl}.`
                : cancelled
                ? 'This run was cancelled. You can start again whenever you’re ready.'
                : 'We’re researching your website, identifying the business, checking competitors, and building the final knowledge base.'}
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ecf9f4] px-5 py-3 text-base font-semibold text-[#10885f]">
              <Sparkles className="h-4 w-4" />
              {failed ? 'Stopped' : cancelled ? 'Cancelled' : humanStage(job.currentStage ?? undefined)}
            </div>
          </div>

          {previewImage ? (
            <div className="mt-8 overflow-hidden rounded-[30px] border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Website preview"
                className="h-[260px] w-full object-cover object-top"
              />
            </div>
          ) : (
            <div className="mt-8 flex h-[260px] items-center justify-center rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_50%_20%,rgba(47,128,237,0.10),transparent_35%),#f8fbff]">
              <div className="text-center text-slate-400">
                <Globe className="mx-auto h-10 w-10" />
                <p className="mt-3 text-sm">Preview will appear as we collect assets</p>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-4">
            {job.stages.map((stage) => (
              <div key={stage.key} className="flex items-center gap-4 text-[1.05rem] text-slate-500">
                <StageMarker status={stage.status} />
                <span className={stage.status === 'running' || stage.status === 'completed' ? 'text-slate-800' : ''}>
                  {stage.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 h-2 overflow-hidden rounded-full bg-[#edf2fb]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                failed ? 'bg-red-400' : cancelled ? 'bg-slate-300' : 'bg-[#2f80ed]'
              }`}
              style={{ width: `${job.progressPct ?? 0}%` }}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3 rounded-full bg-[#f5f9ff] px-4 py-3 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6e5ff] border-t-[#2f80ed]" />
              This may take a few minutes
            </div>

            {!failed && !cancelled ? (
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel run
              </button>
            ) : (
              <button
                onClick={() => router.push('/brand/knowledge')}
                className="rounded-full bg-[#2f80ed] px-5 py-3 text-sm font-semibold text-white"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageMarker({ status }: { status: 'pending' | 'running' | 'completed' | 'failed' }) {
  if (status === 'completed') {
    return <span className="h-6 w-6 rounded-full border border-[#9ee5c4] bg-[#ecf9f4]" />;
  }
  if (status === 'running') {
    return <span className="h-6 w-6 rounded-full border-2 border-[#c9daf8] bg-white" />;
  }
  if (status === 'failed') {
    return <span className="h-6 w-6 rounded-full border border-red-200 bg-red-50" />;
  }
  return <span className="h-6 w-6 rounded-full border-2 border-slate-300 bg-white" />;
}

function humanStage(stage?: string) {
  const map: Record<string, string> = {
    crawl: 'Website Analyse',
    images: 'Analysing Brand Assets',
    extract: 'Business Identification',
    documents: 'Analysing Competitor',
    finalize: 'Building your knowledge',
  };
  return stage ? (map[stage] ?? stage) : 'Analysing your website';
}

function CenteredLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-[#d6e5ff] border-t-[#2f80ed]" />
        <p className="mt-4 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
