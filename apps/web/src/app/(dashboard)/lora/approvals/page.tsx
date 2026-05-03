'use client';

import { useState } from 'react';
import { useLoraApprovals, useApproveOutput, useRejectOutput } from '@/lib/hooks/useLora';
import type { Approval } from '@/lib/hooks/useLora';

const AGENT_AVATARS: Record<string, string> = {
  Sam: '🔍', Clara: '✍️', Steve: '🎨', Sarah: '📅', Lora: '👩‍💼',
};

export default function ApprovalsPage() {
  const { data: approvals = [], isLoading, refetch } = useLoraApprovals();
  const approve = useApproveOutput();
  const reject = useRejectOutput();

  const [selected, setSelected] = useState<Approval | null>(null);
  const [notes, setNotes] = useState('');

  const handleApprove = async (id: string) => {
    await approve.mutateAsync({ id, notes: notes || undefined });
    setSelected(null);
    setNotes('');
    refetch();
  };

  const handleReject = async (id: string) => {
    await reject.mutateAsync({ id, notes: notes || undefined });
    setSelected(null);
    setNotes('');
    refetch();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg">✅</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-sm text-gray-500">Review and approve agent outputs before publishing</p>
        </div>
        {approvals.length > 0 && (
          <span className="ml-auto bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1 rounded-full">
            {approvals.length} pending
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">All caught up!</h2>
          <p className="text-sm text-gray-500">No pending approvals right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onSelect={() => setSelected(approval)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{AGENT_AVATARS[selected.output?.agentName ?? ''] ?? '🤖'}</span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{selected.output?.agentName} output</div>
                  <div className="text-xs text-gray-500">{selected.type?.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Scores */}
            {selected.output?.qualityScore && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <ScoreChip label="Quality" score={selected.output.qualityScore} />
                <ScoreChip label="Brand fit" score={selected.output.brandFitScore ?? 0} />
                <ScoreChip label="Goal alignment" score={selected.output.goalAlignmentScore ?? 0} />
              </div>
            )}

            {/* Content Preview */}
            {selected.output?.content && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 overflow-auto max-h-60">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                  {JSON.stringify(selected.output.content, null, 2)}
                </pre>
              </div>
            )}

            {/* Lora notes */}
            {selected.output?.reviewNotes && (
              <div className="bg-violet-50 rounded-xl px-4 py-3 mb-4 flex gap-2">
                <span>👩‍💼</span>
                <p className="text-sm text-violet-800">{selected.output.reviewNotes}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add feedback or approval notes..."
                rows={2}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReject(selected.id)}
                disabled={reject.isPending}
                className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {reject.isPending ? 'Rejecting…' : '✕ Reject'}
              </button>
              <button
                onClick={() => handleApprove(selected.id)}
                disabled={approve.isPending}
                className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {approve.isPending ? 'Approving…' : '✓ Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ approval, onSelect }: { approval: Approval; onSelect: () => void }) {
  const avatar = AGENT_AVATARS[approval.output?.agentName ?? ''] ?? '🤖';
  const avg = approval.output?.qualityScore
    ? Math.round(
        ((approval.output.qualityScore ?? 0) +
          (approval.output.brandFitScore ?? 0) +
          (approval.output.goalAlignmentScore ?? 0)) / 3
      )
    : null;

  return (
    <button
      onClick={onSelect}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{avatar}</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {approval.output?.agentName ?? 'Agent'} — {approval.type?.replace(/_/g, ' ')}
            </div>
            {approval.output?.reviewNotes && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                👩‍💼 {approval.output.reviewNotes}
              </p>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {new Date(approval.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avg !== null && (
            <div className={`text-sm font-bold ${avg >= 80 ? 'text-green-600' : avg >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
              {avg}%
            </div>
          )}
          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
            pending
          </span>
        </div>
      </div>
    </button>
  );
}

function ScoreChip({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <div className="text-lg font-bold">{score}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  );
}
