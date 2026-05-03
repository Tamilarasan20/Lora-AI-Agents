'use client';

import { useState } from 'react';
import { useLoraTasks, useRunAgentTask } from '@/lib/hooks/useLora';
import type { MarketingTask } from '@/lib/hooks/useLora';

const COLUMNS = [
  { id: 'pending', label: 'Pending', color: 'bg-gray-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'pending_approval', label: 'Needs Approval', color: 'bg-amber-50' },
  { id: 'completed', label: 'Completed', color: 'bg-green-50' },
];

const AGENT_AVATARS: Record<string, string> = {
  Sam: '🔍', Clara: '✍️', Steve: '🎨', Sarah: '📅', Lora: '👩‍💼',
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-300',
};

export default function TasksPage() {
  const { data: tasks = [], isLoading, refetch } = useLoraTasks();
  const runTask = useRunAgentTask();
  const [filter, setFilter] = useState<string>('all');

  const grouped = COLUMNS.reduce<Record<string, MarketingTask[]>>((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {});

  const handleRun = async (taskId: string, agentName: string) => {
    await runTask.mutateAsync({ taskId, agentName });
    refetch();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">{tasks.length} total tasks across all agents</p>
        </div>
        <div className="flex gap-2">
          {['all', 'Sam', 'Clara', 'Steve', 'Sarah'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All agents' : `${AGENT_AVATARS[f]} ${f}`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-3">
              <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
              {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = grouped[col.id]?.filter((t) =>
              filter === 'all' || t.assignedAgent === filter
            ) ?? [];
            return (
              <div key={col.id}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{col.label}</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onRun={handleRun} isRunning={runTask.isPending} />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 p-4 text-center">
                      <p className="text-xs text-gray-400">No tasks here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onRun,
  isRunning,
}: {
  task: MarketingTask;
  onRun: (id: string, agent: string) => void;
  isRunning: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{AGENT_AVATARS[task.assignedAgent] ?? '🤖'}</span>
          <span className="text-xs text-gray-500 font-medium">{task.assignedAgent}</span>
        </div>
        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`} title={task.priority} />
      </div>
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{task.title}</p>
      <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>

      {task.reviewNotes && (
        <div className="mt-2 text-xs text-violet-700 bg-violet-50 rounded-lg px-2 py-1 line-clamp-2">
          👩‍💼 {task.reviewNotes}
        </div>
      )}

      {task.status === 'pending' && (
        <button
          onClick={() => onRun(task.id, task.assignedAgent)}
          disabled={isRunning}
          className="mt-3 w-full text-xs py-1.5 rounded-lg bg-violet-50 text-violet-700 font-medium hover:bg-violet-100 disabled:opacity-50"
        >
          Run with {task.assignedAgent}
        </button>
      )}
    </div>
  );
}
