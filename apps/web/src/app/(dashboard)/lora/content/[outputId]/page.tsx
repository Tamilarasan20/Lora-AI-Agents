'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AgentOutput {
  id: string;
  agentName: string;
  outputType: string;
  content: Record<string, unknown>;
  status: string;
  qualityScore?: number;
  brandFitScore?: number;
  goalAlignmentScore?: number;
  reviewNotes?: string;
  reviewedByLora: boolean;
  createdAt: string;
}

interface ContentRevision {
  id: string;
  version: number;
  content: Record<string, unknown>;
  editedBy: string;
  createdAt: string;
}

export default function ContentEditorPage() {
  const { outputId } = useParams<{ outputId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['lora', 'output', outputId],
    queryFn: () => api.get(`/lora/content/${outputId}`).then((r) => r.data as { output: AgentOutput; revisions: ContentRevision[] }),
    enabled: !!outputId,
  });

  const output = data?.output;
  const revisions = data?.revisions ?? [];

  // Editable fields (Clara content)
  const [hook, setHook]     = useState('');
  const [body, setBody]     = useState('');
  const [cta, setCta]       = useState('');
  const [hashtags, setHashtags] = useState('');
  const [dirty, setDirty]   = useState(false);
  const [activeVariant, setActiveVariant] = useState(0);

  // Populate from output when loaded
  const populated = useState(false);
  if (output && !populated[0]) {
    populated[1](true);
    const c = output.content as Record<string, unknown>;
    setHook((c.hook as string) ?? '');
    setBody((c.body as string) ?? '');
    setCta((c.cta as string) ?? '');
    setHashtags(((c.hashtags as string[]) ?? []).join(' '));
  }

  const saveEdit = useMutation({
    mutationFn: (content: unknown) => api.patch(`/lora/content/${outputId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lora', 'output', outputId] });
      setDirty(false);
    },
  });

  const approve = useMutation({
    mutationFn: (approvalId: string) => api.post(`/approvals/${approvalId}/approve`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lora'] }); router.push('/lora/approvals'); },
  });

  const reject = useMutation({
    mutationFn: (approvalId: string) => api.post(`/approvals/${approvalId}/reject`, {}),
    onSuccess: () => router.push('/lora/approvals'),
  });

  const handleSave = () => {
    saveEdit.mutate({
      ...(output?.content ?? {}),
      hook, body, cta,
      hashtags: hashtags.split(/\s+/).filter(Boolean),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (!output) return <div className="p-8 text-center text-gray-500">Output not found.</div>;

  const c = output.content as Record<string, unknown>;
  const variants = (c.variants as string[]) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">✍️</span>
          <h1 className="text-lg font-bold text-gray-900">Edit Clara's Output</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {output.qualityScore && <ScoreBadge label="Quality" score={output.qualityScore} />}
          {output.brandFitScore && <ScoreBadge label="Brand" score={output.brandFitScore} />}
        </div>
      </div>

      {/* Lora Review Notes */}
      {output.reviewNotes && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-5 flex gap-2">
          <span className="text-lg">👩‍💼</span>
          <p className="text-sm text-violet-800">{output.reviewNotes}</p>
        </div>
      )}

      {/* Variants */}
      {variants.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variants</div>
          <div className="flex gap-2 flex-wrap">
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => { setActiveVariant(i); setHook(v); setDirty(true); }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  activeVariant === i
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Variant {i + 1}
              </button>
            ))}
          </div>
          {variants[activeVariant] && (
            <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-700 italic">
              "{variants[activeVariant]}"
            </div>
          )}
        </div>
      )}

      {/* Editable fields */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-5">
        <Field label="Hook" value={hook} onChange={(v) => { setHook(v); setDirty(true); }} multiline />
        <Field label="Body" value={body} onChange={(v) => { setBody(v); setDirty(true); }} multiline rows={5} />
        <Field label="Call to Action" value={cta} onChange={(v) => { setCta(v); setDirty(true); }} />
        <Field label="Hashtags" value={hashtags} onChange={(v) => { setHashtags(v); setDirty(true); }} placeholder="#brand #launch #product" />
      </div>

      {/* Platform-specific content */}
      {!!c.platform && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <div className="text-xs text-gray-400 mb-1">Platform</div>
          <div className="text-sm font-medium text-gray-700">{c.platform as string}</div>
        </div>
      )}

      {/* Revision History */}
      {revisions.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Edit History</div>
          <div className="space-y-1.5">
            {revisions.map((rev) => (
              <div key={rev.id} className="flex items-center justify-between text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-lg">
                <span>Version {rev.version}</span>
                <span>{new Date(rev.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saveEdit.isPending}
            className="flex-1 rounded-xl border-2 border-violet-400 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            {saveEdit.isPending ? 'Saving…' : 'Save edits'}
          </button>
        )}
        <button
          onClick={() => router.push('/lora/approvals')}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Back to approvals
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, multiline = false, rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      )}
    </div>
  );
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label} {score}
    </span>
  );
}
