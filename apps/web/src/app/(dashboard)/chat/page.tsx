'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Paperclip, Send, Settings, Wifi, WifiOff } from 'lucide-react';
import { AGENT_META, AgentType, ChatMessage, useChat } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS: Record<AgentType, string[]> = {
  lora: [
    'Find top 5 trending topic in your niche',
    'Create next 5 posts idea',
    'Analyse my insta account performance suggest improvement',
  ],
  clara: [
    'Write 3 Instagram captions for our next launch',
    'Turn this idea into a short LinkedIn post',
    'Give me a week of content hooks',
  ],
  sarah: [
    'Help me reply to negative comments politely',
    'Write DM replies for warm leads',
    'Create a social engagement playbook',
  ],
  mark: [
    'Review my account analytics and summarize insights',
    'What content format is growing fastest for this niche?',
    'How do I improve retention on short-form video?',
  ],
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  agentMeta,
}: {
  message: ChatMessage;
  agentMeta: typeof AGENT_META[AgentType];
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_30%,#f8b4d9,#8b5cf6_72%,#2f80ed)] text-lg font-semibold text-white shadow-sm">
          {agentMeta.name[0]}
        </div>
      )}
      <div className={cn('max-w-[820px]', isUser ? 'order-first' : '')}>
        {!isUser && <p className="mb-2 text-sm font-medium text-slate-400">{agentMeta.name}</p>}
        <div
          className={cn(
            'rounded-[28px] px-5 py-4 text-[15px] leading-8 shadow-sm',
            isUser
              ? 'bg-[#2f80ed] text-white'
              : 'border border-slate-200 bg-white text-slate-700',
          )}
        >
          {message.isStreaming && message.content === '' ? (
            <TypingIndicator />
          ) : (
            <MessageContent content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-2">
      {content.split('\n').map((line, index) => (
        <p key={`${line}-${index}`}>{line || '\u00a0'}</p>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const sessionId = useMemo(() => `session_${Date.now()}`, []);
  const { messages, activeAgent, isConnected, isStreaming, sendMessage, clearChat } = useChat(sessionId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentMeta = AGENT_META[activeAgent];
  const suggestions = QUICK_PROMPTS[activeAgent];
  const showWelcome = messages.length <= 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const value = input.trim();
    if (!value || isStreaming) return;
    sendMessage(value);
    setInput('');
    textareaRef.current?.focus();
  }, [input, isStreaming, sendMessage]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <div className="hidden w-[370px] flex-col overflow-hidden border-r border-slate-200 bg-[linear-gradient(180deg,#0a55b2_0%,#06397a_100%)] text-white md:flex">
        <div className="relative px-6 pb-10 pt-8">
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.28),transparent_55%)]" />
          <div className="relative overflow-hidden rounded-[34px]">
            <div className="h-[260px] bg-[radial-gradient(circle_at_50%_25%,rgba(255,211,165,0.95),rgba(139,92,246,0.7)_48%,rgba(10,85,178,0.85)_80%),linear-gradient(180deg,#fbbf24_0%,#1d4ed8_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0b4a9a] via-[#0b4a9a]/90 to-transparent" />
          </div>

          <div className="relative -mt-1 flex items-end justify-between gap-4 px-4">
            <div>
              <h1 className="text-[2.6rem] font-semibold tracking-[-0.05em]">{agentMeta.name}</h1>
              <p className="mt-1 text-[1.35rem] text-white/80">{agentMeta.tagline}</p>
            </div>
            <div className="flex items-center gap-3 pb-3">
              <button type="button" className="rounded-2xl border border-white/20 bg-white/10 p-2.5">
                <ImagePlus className="h-5 w-5" />
              </button>
              <button type="button" className="rounded-2xl border border-white/20 bg-white/10 p-2.5">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            onClick={clearChat}
            className="relative mt-8 w-full rounded-full bg-[#2f80ed] px-6 py-4 text-2xl font-semibold shadow-[0_18px_32px_rgba(47,128,237,0.35)]"
          >
            + New Chat
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-10 text-center">
          <div>
            <p className="text-4xl font-semibold tracking-[-0.04em]">History is empty</p>
            <p className="mt-4 text-xl leading-9 text-white/70">
              New conversations will
              <br />
              appear here
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 pb-40 pt-8 md:px-12">
          {showWelcome ? (
            <div className="flex min-h-[calc(100vh-16rem)] flex-col items-center justify-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_50%_30%,#f8b4d9,#8b5cf6_72%,#2f80ed)] text-3xl font-semibold text-white shadow-[0_24px_48px_rgba(47,128,237,0.18)]">
                {agentMeta.name[0]}
              </div>
              <p className="mt-8 text-center text-[2rem] italic text-slate-700">
                Hi, How can i help you today
              </p>

              <div className="mt-8 w-full max-w-[760px] space-y-4">
                {suggestions.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="flex w-full items-center justify-between rounded-[28px] border border-slate-200 bg-white px-8 py-6 text-left text-[1.05rem] font-medium text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:border-[#c9daf8] hover:shadow-[0_18px_36px_rgba(47,128,237,0.08)]"
                  >
                    <span>{prompt}</span>
                    <span className="text-3xl text-slate-300">›</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[920px] space-y-6 pt-8">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} agentMeta={AGENT_META[message.agent]} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/90 px-4 py-5 backdrop-blur md:left-[336px] md:px-12">
          <div className="mx-auto max-w-[1120px]">
            <div className="rounded-[36px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="How can Loraloop help you today?"
                  disabled={!isConnected}
                  className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent text-lg text-slate-700 outline-none placeholder:text-slate-300 disabled:opacity-50"
                />

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || !isConnected}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full transition',
                    input.trim() && isConnected && !isStreaming
                      ? 'bg-[#2f80ed] text-white shadow-[0_12px_24px_rgba(47,128,237,0.24)]'
                      : 'bg-slate-100 text-slate-300',
                  )}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                {isConnected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-red-400" />}
                <span>{isConnected ? 'Loraloop Helpers can make mistakes. Verify important information.' : 'Chat is offline right now.'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
