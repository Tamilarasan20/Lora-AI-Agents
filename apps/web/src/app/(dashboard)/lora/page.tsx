'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoraDashboard, useCreateStrategy } from '@/lib/hooks/useLora';

const AGENTS = [
  {
    name: 'Lora',
    role: 'AI Marketing Lead',
    description: 'Orchestrates your entire marketing strategy',
    avatar: '👩‍💼',
    color: 'from-violet-500 to-fuchsia-500',
  },
  {
    name: 'Sam',
    role: 'AI Strategist',
    description: 'Trend research, competitor analysis, market insights',
    avatar: '🔍',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Clara',
    role: 'AI Content Writer',
    description: 'Captions, emails, blogs, hooks, and CTAs',
    avatar: '✍️',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Steve',
    role: 'AI Visual Designer',
    description: 'Images, carousels, ad creatives, and visual concepts',
    avatar: '🎨',
    color: 'from-orange-500 to-amber-500',
  },
  {
    name: 'Sarah',
    role: 'AI Social Manager',
    description: 'Scheduling, publishing, and engagement management',
    avatar: '📅',
    color: 'from-pink-500 to-rose-500',
  },
];

export default function LoraPage() {
  const router = useRouter();
  const { data: dashboard, isLoading } = useLoraDashboard();
  const createStrategy = useCreateStrategy();

  const [showForm, setShowForm] = useState(false);
  const [goal, setGoal] = useState('');
  const [timeline, setTimeline] = useState('30 days');
  const [audience, setAudience] = useState('');
  const [context, setContext] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    const result = await createStrategy.mutateAsync({
      businessId: 'default',
      goal: goal.trim(),
      timeline,
      targetAudience: audience || undefined,
      additionalContext: context || undefined,
    });
    router.push(`/lora/strategy/${result.strategyId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl">
              👩‍💼
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lora AI Marketing Team</h1>
              <p className="text-sm text-gray-500">Your AI-powered marketing department</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href="/lora/approvals"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Approvals
            {(dashboard?.pendingApprovals?.length ?? 0) > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                {dashboard?.pendingApprovals?.length}
              </span>
            )}
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            + New Strategy
          </button>
        </div>
      </div>

      {/* New Strategy Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Tell Lora your goal</h2>
            <p className="text-sm text-gray-500 mb-5">
              Describe what you want to achieve and Lora will build a full marketing strategy with your team.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marketing goal *</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Launch our new product and grow Instagram followers to 10k in 30 days"
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                  <select
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                  >
                    <option>7 days</option>
                    <option>14 days</option>
                    <option>30 days</option>
                    <option>60 days</option>
                    <option>90 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target audience</label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. Entrepreneurs 25-40"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional context</label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Product details, upcoming events, budget, etc."
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStrategy.isPending || !goal.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {createStrategy.isPending ? 'Building strategy…' : 'Build strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Team Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {AGENTS.map((agent) => (
          <Link
            key={agent.name}
            href={agent.name === 'Lora' ? '/lora/team' : '/lora/team'}
            className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
          >
            <div
              className={`h-10 w-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl mb-3`}
            >
              {agent.avatar}
            </div>
            <div className="text-sm font-semibold text-gray-900">{agent.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{agent.role}</div>
          </Link>
        ))}
      </div>

      {/* Lora's Recommendations */}
      {dashboard?.loraRecommendations && dashboard.loraRecommendations.length > 0 && (
        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100 p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">👩‍💼</span>
            <span className="text-sm font-semibold text-violet-900">Lora recommends</span>
          </div>
          <ul className="space-y-1.5">
            {dashboard.loraRecommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-violet-800">
                <span className="mt-0.5 text-violet-400">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats Row */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Active strategies" value={dashboard?.activeStrategies?.length ?? 0} icon="📊" />
          <StatCard label="Pending tasks" value={dashboard?.pendingTasks?.length ?? 0} icon="⚡" />
          <StatCard label="Pending approvals" value={dashboard?.pendingApprovals?.length ?? 0} icon="✅" accent />
          <StatCard label="Upcoming posts" value={dashboard?.upcomingCalendarItems?.length ?? 0} icon="📅" />
        </div>
      )}

      {/* Recent Strategies */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Active Strategies</h2>
            <Link href="/lora/strategies" className="text-xs text-violet-600 hover:underline">
              View all
            </Link>
          </div>
          {!dashboard?.activeStrategies?.length ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">No active strategies yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-violet-600 hover:underline"
              >
                Tell Lora your first goal →
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {dashboard.activeStrategies.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/lora/strategy/${s.id}`}
                    className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:bg-gray-50"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">{s.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.goalType?.replace('_', ' ')}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {s.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Pending Tasks</h2>
            <Link href="/lora/tasks" className="text-xs text-violet-600 hover:underline">
              View all
            </Link>
          </div>
          {!dashboard?.pendingTasks?.length ? (
            <p className="py-8 text-center text-sm text-gray-500">No pending tasks.</p>
          ) : (
            <ul className="space-y-3">
              {dashboard.pendingTasks.slice(0, 5).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-base">
                      {task.assignedAgent === 'Sam' ? '🔍' : task.assignedAgent === 'Clara' ? '✍️' : task.assignedAgent === 'Steve' ? '🎨' : '📅'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">{task.title}</div>
                      <div className="text-xs text-gray-500">{task.assignedAgent}</div>
                    </div>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent = false }: { label: string; value: number; icon: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${accent ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[priority] ?? styles.medium}`}>
      {priority}
    </span>
  );
}
