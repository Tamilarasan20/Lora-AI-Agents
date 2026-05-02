'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useApproveBrandKnowledgeJob,
  useBrandKnowledgeJob,
  useUpdateBrandKnowledgeDraft,
} from '@/lib/hooks/useBrand';

/**
 * Pomelli-style review screen.
 *
 * Shows every field the AI extracted, lets the user edit anything,
 * and only commits to BrandKnowledge once they hit Approve.
 *
 * Sections (collapsible-ish — kept flat for clarity):
 *   • Identity:  brandName, industry, valueProposition, productDescription
 *   • Audience:  targetAudience, audiencePsychology
 *   • Voice:     tone, voiceCharacteristics, contentPillars
 *   • Visual:    logoUrl, brandColors, imageUrls
 *   • Tags:      preferredHashtags, prohibitedWords
 *   • Competitors
 *   • Strategy:  socialStrategy, marketIntelligence (read-only — too deep to inline-edit)
 */
export default function ReviewBrandKnowledgePage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const { data: job, isLoading } = useBrandKnowledgeJob(jobId);
  const updateDraft = useUpdateBrandKnowledgeDraft(jobId);
  const approve = useApproveBrandKnowledgeJob(jobId);

  // Local editable state. We only PATCH on save / approve to avoid
  // hammering the API on every keystroke.
  const [draft, setDraft] = useState<Record<string, any>>({});
  const initialDraft = useMemo(() => job?.draftResult ?? {}, [job?.draftResult]);

  useEffect(() => {
    if (job?.status === 'AWAITING_REVIEW' && job.draftResult) {
      setDraft(job.draftResult as Record<string, any>);
    }
  }, [job?.status, job?.draftResult]);

  if (isLoading || !job) return <Centered>Loading review…</Centered>;

  if (job.status === 'APPROVED') {
    return (
      <Centered>
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-4 text-2xl font-semibold">Knowledge base approved</h1>
          <p className="mt-2 text-gray-600">Your brand profile is now active.</p>
          <button
            onClick={() => router.push('/brand')}
            className="mt-6 rounded-xl bg-violet-600 px-5 py-2 font-medium text-white hover:bg-violet-700"
          >
            Go to brand
          </button>
        </div>
      </Centered>
    );
  }

  if (job.status !== 'AWAITING_REVIEW') {
    // Shouldn't normally land here, but guard the UX.
    return (
      <Centered>
        <p className="text-gray-600">Job status: {job.status}</p>
        <button
          onClick={() => router.push(`/brand/knowledge/${jobId}`)}
          className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Back to status
        </button>
      </Centered>
    );
  }

  const setField = (key: string, value: any) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setNested = (parent: string, key: string, value: any) =>
    setDraft((prev) => ({ ...prev, [parent]: { ...(prev[parent] ?? {}), [key]: value } }));

  const onSave = async () => {
    // Only send what changed
    const patch: Record<string, any> = {};
    for (const k of Object.keys(draft)) {
      if (JSON.stringify(draft[k]) !== JSON.stringify((initialDraft as any)[k])) {
        patch[k] = draft[k];
      }
    }
    if (Object.keys(patch).length === 0) return;
    await updateDraft.mutateAsync(patch);
  };

  const onApprove = async () => {
    await onSave();
    await approve.mutateAsync();
    router.push('/brand');
  };

  const colors = (draft.brandColors ?? {}) as { primary?: string; secondary?: string[]; accent?: string };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Review your knowledge base</h1>
          <p className="mt-2 text-gray-600">
            We analyzed <span className="font-medium">{job.websiteUrl}</span>. Edit anything that
            doesn&apos;t look right, then approve to save.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onSave}
            disabled={updateDraft.isPending}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {updateDraft.isPending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={onApprove}
            disabled={approve.isPending}
            className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {approve.isPending ? 'Approving…' : 'Approve & save'}
          </button>
        </div>
      </div>

      {/* Identity */}
      <Section title="Brand identity" subtitle="Who you are at a glance.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Brand name">
            <input
              className={inputCls}
              value={draft.brandName ?? ''}
              onChange={(e) => setField('brandName', e.target.value)}
            />
          </Field>
          <Field label="Industry">
            <input
              className={inputCls}
              value={draft.industry ?? ''}
              onChange={(e) => setField('industry', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Value proposition">
          <textarea
            rows={2}
            className={inputCls}
            value={draft.valueProposition ?? ''}
            onChange={(e) => setField('valueProposition', e.target.value)}
          />
        </Field>
        <Field label="Product description">
          <textarea
            rows={3}
            className={inputCls}
            value={draft.productDescription ?? ''}
            onChange={(e) => setField('productDescription', e.target.value)}
          />
        </Field>
      </Section>

      {/* Audience */}
      <Section title="Audience" subtitle="Who you're talking to.">
        <Field label="Target audience">
          <textarea
            rows={3}
            className={inputCls}
            value={draft.targetAudience ?? ''}
            onChange={(e) => setField('targetAudience', e.target.value)}
          />
        </Field>
      </Section>

      {/* Voice */}
      <Section title="Brand voice" subtitle="How you sound.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary tone">
            <input
              className={inputCls}
              value={draft.tone ?? ''}
              onChange={(e) => setField('tone', e.target.value)}
              placeholder="e.g. witty, professional, bold"
            />
          </Field>
        </div>
        <Field label="Voice characteristics" hint="Press Enter to add">
          <ChipEditor
            values={(draft.voiceCharacteristics ?? []) as string[]}
            onChange={(v) => setField('voiceCharacteristics', v)}
          />
        </Field>
        <Field label="Content pillars" hint="The 4–6 themes your content circles around">
          <ChipEditor
            values={(draft.contentPillars ?? []) as string[]}
            onChange={(v) => setField('contentPillars', v)}
          />
        </Field>
      </Section>

      {/* Visual */}
      <Section title="Visual identity">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Logo">
            {draft.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.logoUrl as string}
                alt="Logo"
                className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg border border-dashed border-gray-300" />
            )}
          </Field>
          <Field label="Primary color">
            <ColorInput
              value={colors.primary ?? '#000000'}
              onChange={(v) => setNested('brandColors', 'primary', v)}
            />
          </Field>
          <Field label="Accent color">
            <ColorInput
              value={colors.accent ?? '#ffffff'}
              onChange={(v) => setNested('brandColors', 'accent', v)}
            />
          </Field>
        </div>
        <Field label="Secondary colors">
          <ChipEditor
            values={(colors.secondary ?? []) as string[]}
            onChange={(v) => setNested('brandColors', 'secondary', v)}
            placeholder="#hex"
          />
        </Field>
        {(draft.imageUrls ?? []).length > 0 && (
          <Field label="Reference images">
            <div className="flex flex-wrap gap-2">
              {(draft.imageUrls as string[]).slice(0, 12).map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={u}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                />
              ))}
            </div>
          </Field>
        )}
      </Section>

      {/* Tags */}
      <Section title="Tags & vocabulary">
        <Field label="Preferred hashtags">
          <ChipEditor
            values={(draft.preferredHashtags ?? []) as string[]}
            onChange={(v) => setField('preferredHashtags', v)}
            placeholder="hashtag (no #)"
          />
        </Field>
        <Field label="Prohibited words" hint="Words the brand should never use">
          <ChipEditor
            values={(draft.prohibitedWords ?? []) as string[]}
            onChange={(v) => setField('prohibitedWords', v)}
          />
        </Field>
      </Section>

      {/* Competitors */}
      <Section title="Competitors">
        <Field label="Tracked competitors">
          <ChipEditor
            values={(draft.competitors ?? []) as string[]}
            onChange={(v) => setField('competitors', v)}
            placeholder="competitor name"
          />
        </Field>
      </Section>

      {/* Read-only deep insights */}
      <Section title="Strategic insights" subtitle="Generated for your agents to reference.">
        <ReadOnlyJson label="Audience psychology" value={draft.audiencePsychology} />
        <ReadOnlyJson label="Market intelligence" value={draft.marketIntelligence} />
        <ReadOnlyJson label="Social strategy" value={draft.socialStrategy} />
        <ReadOnlyJson label="Visual intelligence" value={draft.visualIntelligence} />
      </Section>

      {/* Sticky footer */}
      <div className="sticky bottom-4 mt-10 flex justify-end">
        <div className="flex gap-2 rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
          <button
            onClick={() => router.push('/brand')}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={updateDraft.isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {updateDraft.isPending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={onApprove}
            disabled={approve.isPending}
            className="rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {approve.isPending ? 'Approving…' : 'Approve & save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ChipEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-2">
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="text-violet-400 hover:text-violet-700"
            aria-label="Remove"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? 'Add and press Enter'}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            onChange([...values, draft.trim()]);
            setDraft('');
          } else if (e.key === 'Backspace' && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-2 py-1.5">
      <input
        type="color"
        value={normalizeHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}

function normalizeHex(v: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return '#000000';
}

function ReadOnlyJson({ label, value }: { label: string; value: unknown }) {
  if (!value || (typeof value === 'object' && Object.keys(value as object).length === 0)) {
    return null;
  }
  return (
    <details className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-700">{label}</summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-gray-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center px-6">{children}</div>;
}
