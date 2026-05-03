'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CreditUsage {
  total: number;
  byAgent: Record<string, number>;
  byStrategy: Record<string, number>;
  transactions: Array<{
    id: string;
    agentName: string;
    action: string;
    credits: number;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
}

const AGENT_AVATARS: Record<string, string> = {
  Lora: '👩‍💼', Sam: '🔍', Clara: '✍️', Steve: '🎨', Sarah: '📅',
};

const AGENT_COLORS: Record<string, string> = {
  Lora:  'bg-violet-500',
  Sam:   'bg-blue-500',
  Clara: 'bg-emerald-500',
  Steve: 'bg-orange-500',
  Sarah: 'bg-pink-500',
};

export default function CreditsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['lora', 'credits'],
    queryFn: () => api.get('/lora/credits/usage').then((r) => r.data as CreditUsage),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const total = data?.total ?? 0;
  const byAgent = data?.byAgent ?? {};
  const transactions = data?.transactions ?? [];

  const sortedAgents = Object.entries(byAgent).sort(([, a], [, b]) => b - a);
  const maxAgentCredits = sortedAgents[0]?.[1] ?? 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl">
          ⚡
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Credit Usage</h1>
          <p className="text-sm text-gray-500">AI agent usage across your marketing team</p>
        </div>
      </div>

      {/* Total */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100 p-5">
          <div className="text-xs text-violet-600 font-medium mb-1">Total used</div>
          <div className="text-3xl font-bold text-violet-900">{total}</div>
          <div className="text-xs text-violet-500 mt-1">credits</div>
        </div>
        <StatCard label="Strategies" value={Object.values(data?.byStrategy ?? {}).length} icon="📊" />
        <StatCard label="Sam researches" value={Math.round((byAgent['Sam'] ?? 0) / 4)} icon="🔍" />
        <StatCard label="Images (Steve)" value={Math.round((byAgent['Steve'] ?? 0) / 3)} icon="🎨" />
      </div>

      {/* By Agent */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Credits by agent</h2>
        <div className="space-y-4">
          {sortedAgents.map(([agent, credits]) => (
            <div key={agent}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span>{AGENT_AVATARS[agent] ?? '🤖'}</span>
                  <span className="text-sm font-medium text-gray-700">{agent}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{credits}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${AGENT_COLORS[agent] ?? 'bg-gray-400'}`}
                  style={{ width: `${(credits / maxAgentCredits) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {sortedAgents.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No credit usage yet.</p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 30).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-base">{AGENT_AVATARS[t.agentName] ?? '🤖'}</span>
                  <div>
                    <div className="text-xs font-medium text-gray-700">{t.agentName}</div>
                    <div className="text-xs text-gray-400">{t.action.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 w-8 text-right">-{t.credits}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
