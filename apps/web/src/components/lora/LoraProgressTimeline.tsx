'use client';

import type { LoraSocketEvent } from '@/lib/hooks/useLoraSocket';

const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  'lora.strategy.started':          { icon: '👩‍💼', label: 'Lora is building your strategy',      color: 'text-violet-600' },
  'lora.strategy.created':          { icon: '📊', label: 'Strategy created',                       color: 'text-violet-700' },
  'lora.task.created':              { icon: '📋', label: 'Tasks assigned to team',                 color: 'text-blue-600' },
  'agent.task.started':             { icon: '⚡', label: 'Agent started task',                     color: 'text-blue-500' },
  'agent.task.completed':           { icon: '✅', label: 'Agent completed task',                   color: 'text-green-600' },
  'agent.task.failed':              { icon: '❌', label: 'Task failed',                            color: 'text-red-500' },
  'steve.image.started':            { icon: '🎨', label: 'Steve is generating image',              color: 'text-orange-500' },
  'steve.image.generated':          { icon: '🖼️', label: 'Image generated',                       color: 'text-orange-600' },
  'steve.carousel.started':         { icon: '🎨', label: 'Steve is generating carousel',           color: 'text-orange-500' },
  'steve.carousel.slide.generated': { icon: '🖼️', label: 'Carousel slide generated',             color: 'text-orange-600' },
  'lora.output.reviewed':           { icon: '👩‍💼', label: 'Lora reviewed output',                  color: 'text-violet-600' },
  'approval.pending':               { icon: '⏳', label: 'Ready for your approval',               color: 'text-amber-600' },
  'approval.approved':              { icon: '✅', label: 'Approved',                               color: 'text-green-700' },
  'approval.rejected':              { icon: '❌', label: 'Rejected',                              color: 'text-red-600' },
  'lora.calendar.updated':          { icon: '📅', label: 'Calendar updated',                       color: 'text-teal-600' },
  'workflow.completed':             { icon: '🎉', label: 'Workflow complete',                       color: 'text-green-700' },
  'workflow.failed':                { icon: '🚨', label: 'Workflow failed',                        color: 'text-red-600' },
};

interface Props {
  events: LoraSocketEvent[];
  className?: string;
}

export function LoraProgressTimeline({ events, className = '' }: Props) {
  if (!events.length) return null;

  const relevant = events.filter((e) => EVENT_CONFIG[e.eventName]);

  if (!relevant.length) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {relevant.map((event, i) => {
        const cfg = EVENT_CONFIG[event.eventName];
        const payload = event.payload;
        const detail =
          (payload?.agentName ? `${payload.agentName}: ` : '') +
          (payload?.message ?? payload?.title ?? '');

        return (
          <div key={i} className="flex items-start gap-2.5">
            <div className="flex-shrink-0 mt-0.5 w-5 text-center text-sm">{cfg.icon}</div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              {detail && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{detail as string}</p>
              )}
            </div>
            <span className="text-xs text-gray-300 flex-shrink-0">
              {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
