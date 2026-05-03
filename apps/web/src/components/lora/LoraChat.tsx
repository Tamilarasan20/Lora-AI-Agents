'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useLoraChat } from '@/lib/hooks/useLoraChat';
import { useLoraSocket } from '@/lib/hooks/useLoraSocket';
import { LoraProgressTimeline } from './LoraProgressTimeline';
import type { ChatMessage } from '@/lib/hooks/useLoraChat';

const AGENT_AVATARS: Record<string, string> = {
  Lora: '👩‍💼', Sam: '🔍', Clara: '✍️', Steve: '🎨', Sarah: '📅', system: '⚙️',
};

const SUGGESTIONS = [
  'Launch my new product on Instagram with a 5-slide carousel',
  'Build a 30-day content strategy for brand awareness',
  'Create ad creatives for Facebook and Instagram',
  'Write 10 captions and a weekly posting schedule',
  'Research my competitors and find content opportunities',
];

interface Props {
  userId: string;
  businessId: string;
}

export function LoraChat({ userId, businessId }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, conversationId, isWorking, sendMessage, addAgentEvent } = useLoraChat({
    userId,
    businessId,
  });

  const { connected, events } = useLoraSocket({
    userId,
    businessId,
    conversationId,
    enabled: !!conversationId,
  });

  // Feed socket events into the chat as agent messages
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;

    const { eventName, payload } = last;

    if (eventName === 'lora.output.reviewed' && payload.approved && payload.notes) {
      addAgentEvent('Lora', `Review complete. ${payload.notes as string}`, payload);
    }
    if (eventName === 'approval.pending') {
      addAgentEvent('Lora', `✅ Ready for your approval! [View approvals →](/lora/approvals)`, payload);
    }
    if (eventName === 'steve.carousel.slide.generated') {
      addAgentEvent('Steve', `Slide ${payload.slideNumber} generated: "${payload.headline}"`, payload);
    }
    if (eventName === 'workflow.failed') {
      addAgentEvent('system', `Something went wrong: ${payload.error}. Please try again.`, payload);
    }
    if (eventName === 'workflow.completed') {
      addAgentEvent('Lora', '🎉 All done! Check your approvals and calendar.', payload);
    }
  }, [events, addAgentEvent]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isWorking) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-lg">
            👩‍💼
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Lora AI Marketing Lead</div>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-500">{connected ? 'Live' : 'Connecting…'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/lora/approvals" className="text-xs text-violet-600 hover:underline">Approvals</Link>
          <span className="text-gray-200">·</span>
          <Link href="/lora/assets" className="text-xs text-violet-600 hover:underline">Assets</Link>
          <span className="text-gray-200">·</span>
          <Link href="/lora/calendar" className="text-xs text-violet-600 hover:underline">Calendar</Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center pt-12">
            <div className="text-4xl mb-4">👩‍💼</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Hi, I'm Lora</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              Your AI Marketing Lead. Tell me your goal and I'll build the full strategy,
              assign Sam, Clara, Steve, and Sarah, and manage the whole workflow.
            </p>
            <div className="grid gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left text-sm px-4 py-2.5 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isWorking && (
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-base flex-shrink-0">
              👩‍💼
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Progress Timeline */}
      {events.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 max-h-40 overflow-y-auto flex-shrink-0">
          <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Team activity</div>
          <LoraProgressTimeline events={events} />
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Lora your marketing goal…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 min-h-[44px] max-h-32 overflow-y-auto"
            style={{ height: 'auto' }}
            disabled={isWorking}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isWorking}
            className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-sm hover:opacity-90 disabled:opacity-40 flex-shrink-0"
          >
            <svg className="h-4 w-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Lora orchestrates Sam · Clara · Steve · Sarah in the background
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const avatar = AGENT_AVATARS[message.agentName ?? message.role] ?? '🤖';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
        message.role === 'system' ? 'bg-red-100' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
      }`}>
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        {message.agentName && (
          <div className="text-xs text-gray-400 font-medium mb-1">{message.agentName}</div>
        )}
        <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[85%] inline-block ${
          message.role === 'system' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-900'
        }`}>
          {message.content}
        </div>
        {!!message.metadata?.approvalId && (
          <div className="mt-2">
            <Link
              href="/lora/approvals"
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200"
            >
              ⏳ Review approval →
            </Link>
          </div>
        )}
        {!!(message.metadata as Record<string, unknown>)?.assetUrl && (
          <div className="mt-2">
            <img
              src={(message.metadata as Record<string, unknown>).assetUrl as string}
              alt="Generated asset"
              className="rounded-xl max-w-xs border border-gray-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}
