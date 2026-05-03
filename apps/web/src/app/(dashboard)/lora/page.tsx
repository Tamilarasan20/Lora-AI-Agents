'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoraChat } from '@/components/lora/LoraChat';
import { useLoraDashboard } from '@/lib/hooks/useLora';
import { useAuthStore } from '@/lib/stores/auth.store';

const AGENT_TABS = [
  { name: 'Chat', href: '/lora', icon: '💬', active: true },
  { name: 'Tasks', href: '/lora/tasks', icon: '⚡' },
  { name: 'Assets', href: '/lora/assets', icon: '🎨' },
  { name: 'Calendar', href: '/lora/calendar', icon: '📅' },
  { name: 'Approvals', href: '/lora/approvals', icon: '✅' },
  { name: 'Team', href: '/lora/team', icon: '🤝' },
];

export default function LoraPage() {
  const user = useAuthStore((s) => s.user);
  const { data: dashboard } = useLoraDashboard();
  const [showStats, setShowStats] = useState(false);

  const userId = user?.id ?? '';
  const businessId = 'default';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top Nav */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-1">
          {AGENT_TABS.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab.active
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.name}
              {tab.name === 'Approvals' && (dashboard?.pendingApprovals?.length ?? 0) > 0 && (
                <span className="ml-0.5 bg-amber-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {dashboard?.pendingApprovals?.length}
                </span>
              )}
            </Link>
          ))}
        </div>

        <button
          onClick={() => setShowStats((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {showStats ? 'Hide stats' : 'Stats'}
        </button>
      </div>

      {/* Stats Bar */}
      {showStats && dashboard && (
        <div className="flex gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs flex-shrink-0 overflow-x-auto">
          <Stat label="Strategies" value={dashboard.activeStrategies?.length ?? 0} />
          <Stat label="Pending tasks" value={dashboard.pendingTasks?.length ?? 0} />
          <Stat label="Approvals" value={dashboard.pendingApprovals?.length ?? 0} accent />
          <Stat label="Calendar" value={dashboard.upcomingCalendarItems?.length ?? 0} />
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        {userId ? (
          <LoraChat userId={userId} businessId={businessId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${accent && value > 0 ? 'bg-amber-100' : ''}`}>
      <span className={`font-bold ${accent && value > 0 ? 'text-amber-700' : 'text-gray-700'}`}>{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  );
}
