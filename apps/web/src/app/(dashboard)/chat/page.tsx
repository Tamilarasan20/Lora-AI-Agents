'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, RotateCcw, Sparkles, Image as ImageIcon, Settings,
  ArrowUp, Square, Paperclip, X,
} from 'lucide-react';
import { useChat, AGENT_META, AgentType, ChatMessage } from '@/lib/hooks/useChat';
import { useBrandProfile } from '@/lib/hooks/useBrand';
import PlatformPreview from '@/components/social/PlatformPreview';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Find top 10 trending topics in my niche',
  'Create next 10 post ideas',
  'Write an Instagram caption for our latest product',
  'What is my best performing content type?',
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('• '))
          return <div key={i} className="flex gap-2"><span className="text-blue-500">•</span><span>{line.slice(2)}</span></div>;
        if (line === '') return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function ChatPage() {
  const sessionId = useMemo(() => `session_${Date.now()}`, []);
  const { messages, activeAgent, isConnected, isStreaming, sendMessage, clearChat, switchAgent } =
    useChat(sessionId);
  const { data: brand } = useBrandProfile();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agentMeta = AGENT_META[activeAgent];
  const brandName = brand?.brandName ?? 'Brand';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setInput('');
    inputRef.current?.focus();
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-[#F4F5F7] overflow-hidden">

      {/* ── LORA AGENT PANEL ── */}
      <div className="w-[280px] flex-shrink-0 bg-gradient-to-b from-[#1E40AF] to-[#0F172A] flex flex-col relative shadow-xl z-10">
        <div className="p-7 pb-4 relative z-10">
          {/* Agent Avatar */}
          <div
            className="w-28 h-28 mx-auto rounded-full flex items-center justify-center mb-5 ring-4 ring-white/10 text-5xl shadow-lg"
            style={{ background: agentMeta.color + '30' }}
          >
            {agentMeta.emoji}
          </div>

          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white text-2xl font-bold">{agentMeta.name}</h2>
            <div className="flex gap-2">
              <button className="text-white/50 hover:text-white transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-white/60 text-[13px] mb-5">{agentMeta.tagline}</p>

          <button
            onClick={clearChat}
            className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white py-2.5 rounded-xl font-semibold shadow-lg transition-colors text-[14px]"
          >
            New Chat +
          </button>
        </div>

        {/* Agent Switcher */}
        <div className="flex-1 px-4 mt-2 overflow-y-auto">
          <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2">Switch Agent</h3>
          <div className="space-y-1">
            {(Object.entries(AGENT_META) as [AgentType, typeof AGENT_META[AgentType]][]).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => switchAgent(key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-[13px] font-medium',
                  activeAgent === key
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8',
                )}
              >
                <span className="text-xl w-7 h-7 flex items-center justify-center">{meta.emoji}</span>
                <div>
                  <p className="leading-tight">{meta.name}</p>
                  <p className={cn('text-[11px]', activeAgent === key ? 'text-white/60' : 'text-white/40')}>
                    {meta.tagline}
                  </p>
                </div>
                {activeAgent === key && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                )}
              </button>
            ))}
          </div>

          {/* Recent messages */}
          {messages.filter(m => m.role === 'user').length > 0 && (
            <div className="mt-5">
              <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-2">Recent</h3>
              {messages.filter(m => m.role === 'user').slice(-4).reverse().map((m) => (
                <div
                  key={m.id}
                  className="text-white/60 text-[12px] mb-1.5 truncate hover:text-white cursor-pointer transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
                >
                  {m.content.slice(0, 38)}{m.content.length > 38 ? '…' : ''}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Credits Banner */}
        <div className="p-5 mt-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 mb-2.5 border border-white/5">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-white text-[13px] font-bold">Earn AI Credits</span>
              <span className="text-white/60 text-xs">🎁</span>
            </div>
            <p className="text-white/50 text-[11px]">100 credits per paid referral</p>
          </div>
          <div className="bg-[#E0EEBA] rounded-xl p-2.5 flex items-center gap-2 text-[#111111] font-bold text-[13px]">
            <Sparkles className="w-4 h-4 text-blue-600" />
            250 AI Credits
          </div>
        </div>
      </div>

      {/* ── MAIN CHAT AREA ── */}
      <div className="flex-1 flex flex-col relative bg-white">

        {/* Connection status badge */}
        {!isConnected && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-1.5 rounded-full font-medium">
            Reconnecting…
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-7 scroll-smooth">

          {/* Empty state with suggestions */}
          {messages.length <= 1 && (
            <div className="max-w-3xl mx-auto pt-6">
              <div className="flex items-center gap-3 mb-8">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg"
                  style={{ background: agentMeta.color + '20', border: `2px solid ${agentMeta.color}30` }}
                >
                  {agentMeta.emoji}
                </div>
                <h1 className="text-xl font-medium text-[#111111]">
                  Hi! I&apos;m {agentMeta.name} — {agentMeta.tagline.toLowerCase()}.
                </h1>
              </div>
              <div className="flex flex-col gap-3">
                {SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(sug)}
                    className="self-start text-left bg-white border border-[#E5E7EB] hover:border-[#3B82F6] hover:shadow-md px-5 py-3.5 rounded-2xl text-[14px] text-[#3F3F46] hover:text-[#111111] transition-all font-medium flex items-center justify-between min-w-[300px]"
                  >
                    {sug}
                    <ArrowUp className="w-4 h-4 rotate-45 opacity-40 ml-3 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div className="max-w-4xl mx-auto w-full space-y-7 pb-6">
            {messages.map((msg) => {
              const meta = AGENT_META[msg.agent];
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={cn('flex gap-4', isUser ? 'justify-end' : 'justify-start')}>
                  {!isUser && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-1 shadow-sm"
                      style={{ background: meta.color + '20', border: `2px solid ${meta.color}30` }}
                    >
                      {meta.emoji}
                    </div>
                  )}

                  <div className={cn('flex flex-col max-w-[78%]', isUser ? 'items-end' : 'items-start')}>
                    {!isUser && (
                      <span className="text-[11px] font-semibold mb-1 px-1" style={{ color: meta.color }}>
                        {meta.name}
                      </span>
                    )}
                    <div
                      className={cn(
                        'px-5 py-3.5 rounded-[22px] text-[14.5px] leading-relaxed shadow-sm',
                        isUser
                          ? 'bg-[#E2E8F0] text-[#0F172A] rounded-tr-sm'
                          : 'bg-white border border-[#E5E7EB] text-[#111111] rounded-tl-sm',
                      )}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                            AI Agents
                          </span>
                        </div>
                      )}
                      {msg.isStreaming && msg.content === '' ? (
                        <TypingDots />
                      ) : (
                        <MessageContent content={msg.content} />
                      )}
                      {msg.isStreaming && msg.content !== '' && (
                        <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#A1A1AA] px-1 mt-1">
                      {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex gap-4 justify-start">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-1"
                  style={{ background: agentMeta.color + '20' }}
                >
                  {agentMeta.emoji}
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-[22px] rounded-tl-sm px-5 py-3.5">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-[#F4F4F5]">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agentMeta.name}…`}
                disabled={!isConnected || isStreaming}
                className="w-full bg-[#FAFBFC] border border-[#E5E7EB] rounded-full py-4 pl-5 pr-14 text-[15px] text-[#111111] outline-none hover:border-[#D4D4D8] focus:border-[#3B82F6] focus:bg-white transition-all placeholder:text-[#A1A1AA] disabled:opacity-50"
              />
              {isStreaming ? (
                <button
                  onClick={() => {}}
                  className="absolute right-3 w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-500 hover:bg-red-200 transition-colors"
                >
                  <Square className="w-4 h-4" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || !isConnected}
                  className={cn(
                    'absolute right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all',
                    input.trim() && !isStreaming && isConnected
                      ? 'text-white shadow-md hover:opacity-90'
                      : 'bg-[#D4D4D8] text-white cursor-not-allowed',
                  )}
                  style={
                    input.trim() && !isStreaming && isConnected
                      ? { background: agentMeta.color }
                      : {}
                  }
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-center text-[12px] text-[#A1A1AA] mt-3">
              Press Enter to send · Shift+Enter for new line · Powered by Loraloop AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
