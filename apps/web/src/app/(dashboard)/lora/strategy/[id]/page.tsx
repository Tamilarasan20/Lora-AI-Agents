'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useStrategy, useRunAgentTask } from '@/lib/hooks/useLora';

const AGENT_AVATARS: Record<string, string> = {
  Sam: '🔍', Clara: '✍️', Steve: '🎨', Sarah: '📅', Lora: '👩‍💼',
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  needs_revision: 'bg-red-100 text-red-700',
};

export default function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: strategy, isLoading, refetch } = useStrategy(id);
  const runTask = useRunAgentTask();

  const changeStatus = useMutation({
    mutationFn: (action: 'activate' | 'pause' | 'complete' | 'archive') =>
      api.post(`/lora/strategy/${id}/${action}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lora', 'strategy', id] }); },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Strategy not found.</p>
        <Link href="/lora" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
          ← Back to Lora
        </Link>
      </div>
    );
  }

  const handleRunTask = async (taskId: string, agentName: string) => {
    await runTask.mutateAsync({ taskId, agentName });
    refetch();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/lora" className="hover:text-gray-700">Lora</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Strategy</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[strategy.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {strategy.status}
              </span>
              <span className="text-xs text-gray-400">{strategy.goalType?.replace(/_/g, ' ')}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{strategy.title}</h1>
            <p className="text-sm text-gray-600 mt-1">{strategy.goal}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400">{strategy.creditsUsed} credits</span>
            {strategy.status === 'draft' && (
              <button
                onClick={() => changeStatus.mutate('activate')}
                disabled={changeStatus.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Activate
              </button>
            )}
            {strategy.status === 'active' && (
              <>
                <button
                  onClick={() => changeStatus.mutate('pause')}
                  disabled={changeStatus.isPending}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Pause
                </button>
                <button
                  onClick={() => changeStatus.mutate('complete')}
                  disabled={changeStatus.isPending}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Complete
                </button>
              </>
            )}
            {strategy.status === 'paused' && (
              <button
                onClick={() => changeStatus.mutate('activate')}
                disabled={changeStatus.isPending}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Resume
              </button>
            )}
            {(strategy.status === 'completed' || strategy.status === 'paused') && (
              <button
                onClick={() => changeStatus.mutate('archive')}
                disabled={changeStatus.isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>
        </div>

        {strategy.summary && (
          <div className="mt-4 p-4 bg-violet-50 rounded-xl">
            <p className="text-sm text-violet-900">{strategy.summary}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {strategy.targetAudience && (
            <InfoChip label="Audience" value={strategy.targetAudience} />
          )}
          {strategy.positioning && (
            <InfoChip label="Positioning" value={strategy.positioning} />
          )}
          {strategy.brandVoiceDirection && (
            <InfoChip label="Voice" value={strategy.brandVoiceDirection} />
          )}
          {(strategy.channels as string[])?.length > 0 && (
            <InfoChip label="Channels" value={(strategy.channels as string[]).join(', ')} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tasks</h2>
            {!strategy.tasks?.length ? (
              <p className="text-sm text-gray-500 py-4 text-center">No tasks yet.</p>
            ) : (
              <ul className="space-y-3">
                {strategy.tasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                          {AGENT_AVATARS[task.assignedAgent] ?? '🤖'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{task.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs text-gray-500">{task.assignedAgent}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] ?? ''}`}>
                              {task.priority}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {task.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleRunTask(task.id, task.assignedAgent)}
                          disabled={runTask.isPending}
                          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 disabled:opacity-50"
                        >
                          Run
                        </button>
                      )}
                    </div>
                    {task.reviewNotes && (
                      <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        Lora: {task.reviewNotes}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Content Pillars */}
          {(strategy.contentPillars as string[])?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Content Pillars</h3>
              <ul className="space-y-1.5">
                {(strategy.contentPillars as string[]).map((pillar, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    {pillar}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Campaign Ideas */}
          {(strategy.campaignIdeas as string[])?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Campaign Ideas</h3>
              <ul className="space-y-1.5">
                {(strategy.campaignIdeas as string[]).map((idea, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-fuchsia-400 flex-shrink-0" />
                    {idea}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Best Actions */}
          {(strategy.nextBestActions as string[])?.length > 0 && (
            <div className="bg-violet-50 rounded-2xl border border-violet-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span>👩‍💼</span>
                <h3 className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Lora says next</h3>
              </div>
              <ul className="space-y-1.5">
                {(strategy.nextBestActions as string[]).map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-violet-800">
                    <span className="mt-0.5 text-violet-400">→</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {(strategy.risks as string[])?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Risks</h3>
              <ul className="space-y-1.5">
                {(strategy.risks as string[]).map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-xs font-medium text-gray-700 line-clamp-2">{value}</div>
    </div>
  );
}
