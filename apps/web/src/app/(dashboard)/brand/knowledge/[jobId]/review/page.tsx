'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Link2, MoreVertical, Upload, X } from 'lucide-react';
import {
  useApproveBrandKnowledgeJob,
  useBrandKnowledgeJob,
  useUpdateBrandKnowledgeDraft,
} from '@/lib/hooks/useBrand';

type ReviewTab = 'all' | 'documents' | 'guidelines';
type DocumentKey =
  | 'businessProfile'
  | 'marketResearch'
  | 'socialStrategy'
  | 'brandGuidelines'
  | 'visualIntelligence';

const documentMeta: { key: DocumentKey; label: string }[] = [
  { key: 'businessProfile', label: 'Business profile' },
  { key: 'marketResearch', label: 'Market research' },
  { key: 'socialStrategy', label: 'Strategy' },
  { key: 'visualIntelligence', label: 'SEO/GEO keywords' },
  { key: 'brandGuidelines', label: 'Brand guidelines' },
];

export default function ReviewBrandKnowledgePage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId as string;
  const { data: job, isLoading } = useBrandKnowledgeJob(jobId);
  const updateDraft = useUpdateBrandKnowledgeDraft(jobId);
  const approve = useApproveBrandKnowledgeJob(jobId);

  const [draft, setDraft] = useState<Record<string, any>>({});
  const [tab, setTab] = useState<ReviewTab>('all');
  const [activeDocument, setActiveDocument] = useState<DocumentKey>('businessProfile');
  const [openDocument, setOpenDocument] = useState<DocumentKey | null>(null);
  const documentUploadRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
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
        <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ecf9f4] text-[#10885f]">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-slate-900">Knowledge base approved</h1>
          <p className="mt-3 text-slate-500">Your brand profile is now ready for the rest of Loraloop.</p>
          <button
            onClick={() => router.push('/brand')}
            className="mt-8 rounded-full bg-[#2f80ed] px-6 py-3 font-semibold text-white"
          >
            Go to brand
          </button>
        </div>
      </Centered>
    );
  }

  if (job.status !== 'AWAITING_REVIEW') {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-slate-500">Job status: {job.status}</p>
          <button
            onClick={() => router.push(`/brand/knowledge/${jobId}`)}
            className="mt-4 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to status
          </button>
        </div>
      </Centered>
    );
  }

  const setField = (key: string, value: any) => setDraft((prev) => ({ ...prev, [key]: value }));
  const setNested = (parent: string, key: string, value: any) =>
    setDraft((prev) => ({ ...prev, [parent]: { ...(prev[parent] ?? {}), [key]: value } }));

  const onSave = async () => {
    const patch: Record<string, any> = {};
    for (const key of Object.keys(draft)) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(initialDraft[key])) {
        patch[key] = draft[key];
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

  const documents = draft.documents ?? {};
  const activeDocumentContent = openDocument ? (documents?.[openDocument]?.content ?? '') : '';
  const imageUrls = ((draft.referenceImages ?? draft.imageUrls ?? []) as string[]).filter(Boolean);
  const colorList = [
    draft.brandColors?.primary,
    ...(draft.brandColors?.secondary ?? []),
    draft.brandColors?.accent,
  ].filter(Boolean) as string[];
  const documentCards = documentMeta.filter(({ key }) => Boolean(documents?.[key]?.content));

  const onDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setNested('documents', activeDocument, {
      ...(documents?.[activeDocument] ?? {}),
      content: text,
      filename: file.name,
    });
    event.target.value = '';
  };

  const onImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const urls = files.map((file) => URL.createObjectURL(file));
    const nextImages = [...new Set([...(imageUrls ?? []), ...urls])];
    setField('imageUrls', nextImages);
    setField('referenceImages', nextImages);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-10 md:py-10">
      <input
        ref={documentUploadRef}
        type="file"
        accept=".md,.txt,.doc,.docx"
        className="hidden"
        onChange={onDocumentUpload}
      />
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onImageUpload}
      />
      <div className="mx-auto max-w-[1320px]">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_30%,#f8b4d9,#8b5cf6_72%,#2f80ed)] text-2xl font-semibold text-white shadow-[0_20px_40px_rgba(47,128,237,0.2)]">
            L
          </div>
          <h1 className="text-5xl font-semibold tracking-[-0.05em] text-slate-900">Lora knowledge</h1>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <TabButton active={tab === 'all'} onClick={() => setTab('all')}>All</TabButton>
            <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>Documents</TabButton>
            <TabButton active={tab === 'guidelines'} onClick={() => setTab('guidelines')}>Brand Guidelines</TabButton>
          </div>
        </div>

        {(tab === 'all' || tab === 'documents') && (
          <section className="mt-10 rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)] md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">Documents</h2>
              <button
                type="button"
                onClick={() => documentUploadRef.current?.click()}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-lg font-medium text-slate-700 shadow-sm"
              >
                Upload
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {documentCards.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveDocument(key);
                    setOpenDocument(key);
                  }}
                  className={`flex items-center justify-between rounded-[22px] px-5 py-4 text-left transition ${
                    activeDocument === key
                      ? 'bg-[#edf4ff] shadow-sm'
                      : 'bg-[#f8fafc] hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                      <span className="text-lg">📄</span>
                    </div>
                    <span className="text-[1.15rem] font-medium text-slate-800">{label}</span>
                  </div>
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </section>
        )}

        {(tab === 'all' || tab === 'guidelines') && (
          <section className="mt-10 rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)] md:p-7">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900">Brand Guidelines</h2>

            <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="rounded-[28px] bg-[#f8fafc] p-6">
                  <input
                    value={draft.brandName ?? ''}
                    onChange={(e) => setField('brandName', e.target.value)}
                    className="w-full bg-transparent text-5xl font-semibold tracking-[-0.05em] text-slate-900 outline-none placeholder:text-slate-300"
                    placeholder="Brand name"
                  />
                  <div className="mt-4 flex items-center gap-2 text-lg text-slate-400">
                    <Link2 className="h-5 w-5" />
                    <input
                      value={job.websiteUrl ?? ''}
                      readOnly
                      className="w-full bg-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-[28px] bg-[#f8fafc] p-6">
                    <p className="text-lg font-medium text-slate-500">Logo</p>
                    <div className="mt-6 flex h-[280px] items-center justify-center rounded-[24px] bg-white">
                      {draft.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.logoUrl as string} alt="Logo" className="max-h-[220px] max-w-[220px] object-contain" />
                      ) : (
                        <div className="text-slate-300">No logo captured</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] bg-[#f8fafc] p-6">
                    <p className="text-lg font-medium text-slate-500">Fonts</p>
                    <div className="mt-6 rounded-[24px] bg-white p-6">
                      <div className="text-[4rem] font-semibold leading-none text-[#7fb61b]">Aa</div>
                      <input
                        value={(draft.visualIntelligence?.fonts?.[0] ?? draft.visualIntelligence?.fontFamily ?? '') as string}
                        onChange={(e) =>
                          setNested('visualIntelligence', 'fontFamily', e.target.value)
                        }
                        className="mt-4 w-full bg-transparent text-2xl font-medium text-slate-800 outline-none placeholder:text-slate-300"
                        placeholder="Primary font"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-[28px] bg-[#f8fafc] p-6">
                    <p className="text-lg font-medium text-slate-500">Business overview</p>
                    <textarea
                      value={(draft.valueProposition || draft.productDescription || '') as string}
                      onChange={(e) => setField('valueProposition', e.target.value)}
                      className="mt-5 h-[220px] w-full resize-none bg-transparent text-[1.05rem] leading-9 text-slate-700 outline-none"
                    />
                  </div>

                  <div className="rounded-[28px] bg-[#f8fafc] p-6">
                    <p className="text-lg font-medium text-slate-500">Brand voice</p>
                    <TagEditor
                      className="mt-5"
                      values={(draft.voiceCharacteristics ?? []) as string[]}
                      onChange={(value) => setField('voiceCharacteristics', value)}
                      placeholder="Add a tone cue"
                    />
                    <p className="mt-6 text-lg font-medium text-slate-500">SEO/GEO keywords</p>
                    <TagEditor
                      className="mt-4"
                      values={(draft.seoKeywords ?? []) as string[]}
                      onChange={(value) => setField('seoKeywords', value)}
                      placeholder="Add a keyword"
                    />
                  </div>
                </div>

                {colorList.length > 0 && (
                  <div className="rounded-[28px] bg-[#f8fafc] p-6">
                    <p className="text-lg font-medium text-slate-500">Colors</p>
                    <div className="mt-6 grid gap-5 sm:grid-cols-3">
                      {colorList.slice(0, 3).map((color) => (
                        <div key={color} className="rounded-[24px] bg-white p-5 text-center">
                          <div className="mx-auto h-24 w-24 rounded-full border border-slate-100" style={{ backgroundColor: color }} />
                          <p className="mt-4 text-2xl font-medium text-slate-700">{color}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[28px] bg-[#f8fafc] p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xl font-semibold text-slate-900">Images</p>
                  <button
                    type="button"
                    onClick={() => imageUploadRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#ecffcf] text-[#7fb61b]"
                  >
                    <div className="text-center">
                      <Upload className="mx-auto h-5 w-5" />
                      <span className="mt-2 block text-xs font-semibold">UPLOAD IMAGES</span>
                    </div>
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {imageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="overflow-hidden rounded-[22px] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Brand asset ${index + 1}`} className="h-36 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 mt-10 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center justify-center gap-8 px-6 py-5">
          <button
            onClick={() => setDraft(initialDraft)}
            className="text-2xl font-medium text-slate-600"
          >
            Reset
          </button>
          <button
            onClick={onApprove}
            disabled={approve.isPending || updateDraft.isPending}
            className="rounded-full bg-[#2f80ed] px-10 py-4 text-2xl font-semibold text-white shadow-[0_18px_32px_rgba(47,128,237,0.22)] disabled:opacity-50"
          >
            {approve.isPending ? 'Saving…' : 'Looks Good'}
          </button>
        </div>
      </div>

      {openDocument && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-[#eef4ff] shadow-[0_30px_100px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#2f80ed]">Knowledge document</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  {documentMeta.find(({ key }) => key === openDocument)?.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenDocument(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="Close document"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-6 md:px-10">
              <article className="mx-auto min-h-[70vh] max-w-3xl rounded-[10px] bg-white px-7 py-8 text-slate-800 shadow-[0_18px_60px_rgba(15,23,42,0.12)] md:px-12 md:py-11">
                <MarkdownPreview content={activeDocumentContent} />
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-base text-slate-500">This document has not been generated yet.</p>;
  }

  const lines = content.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-2" />;
        if (trimmed.startsWith('# ')) {
          return <h1 key={index} className="mb-5 text-3xl font-semibold leading-tight text-slate-950">{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={index} className="mt-7 text-xl font-semibold text-slate-900">{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={index} className="mt-5 text-lg font-semibold text-slate-900">{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith('- ')) {
          return (
            <div key={index} className="flex gap-3 pl-1 text-base leading-7 text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f80ed]" />
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          return <p key={index} className="text-base leading-7 text-slate-700">{renderInlineMarkdown(trimmed)}</p>;
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={index} className="border-l-4 border-[#2f80ed] bg-[#f5f9ff] px-4 py-3 text-base leading-7 text-slate-700">
              {renderInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }
        if (trimmed.startsWith('![')) return null;
        if (trimmed === '---') return <hr key={index} className="my-6 border-slate-200" />;
        return <p key={index} className="text-base leading-7 text-slate-700">{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-7 py-3 text-xl font-medium transition ${
        active
          ? 'bg-[#edf4ff] text-[#2f80ed]'
          : 'border border-slate-200 bg-white text-slate-500'
      }`}
    >
      {children}
    </button>
  );
}

function TagEditor({
  values,
  onChange,
  placeholder,
  className,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [value, setValue] = useState('');

  return (
    <div className={`rounded-[24px] bg-white p-4 ${className ?? ''}`}>
      <div className="flex flex-wrap gap-3">
        {values.map((item, index) => (
          <button
            key={`${item}-${index}`}
            type="button"
            onClick={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-lg font-medium text-slate-600"
          >
            {item}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            e.preventDefault();
            onChange([...values, value.trim()]);
            setValue('');
          }
        }}
        placeholder={placeholder}
        className="mt-4 w-full bg-transparent text-lg text-slate-500 outline-none placeholder:text-slate-300"
      />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-6">{children}</div>;
}
