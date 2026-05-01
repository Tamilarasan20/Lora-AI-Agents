'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Trash2, RotateCcw, Wifi, WifiOff, Sparkles, ChevronDown } from 'lucide-react';
import { useChat, AGENT_META, AgentType, ChatMessage } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS: Record<AgentType, string[]> = {
  lora: [
    'What can Loraloop help me with?',
    'How do I schedule my first post?',
    'Explain the AI agents',
    'How does content approval work?',
  ],
  clara: [
    'Write an Instagram post about our summer sale',
    'Adapt this caption for Twitter',
    'Give me 5 hashtag ideas for a fitness brand',
    'Write a LinkedIn thought leadership post',
  ],
  sarah: [
    'Help me reply to a negative comment',
    'How should I respond to DMs on Instagram?',
    'Write a community engagement reply',
    'How to handle a PR crisis on social media',
  ],
  mark: [
    'What is a good engagement rate?',
    'Best times to post on Instagram',
    'How to grow on LinkedIn in 2025',
    'Interpret my analytics data',
  ],
};

function TypingIndicator() {
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

function MessageBubble({ message, agentMeta }: {
  message: ChatMessage;
  agentMeta: typeof AGENT_META[AgentType];
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1 shadow-sm"
          style={{ background: agentMeta.color + '20', border: `2px solid ${agentMeta.color}30` }}
        >
          <span>{agentMeta.emoji}</span>
        </div>
      )}

      <div className={cn('max-w-[75%] space-y-1', isUser ? 'items-end' : 'items-start', 'flex flex-col')}>
        {!isUser && (
          <span className="text-xs font-medium text-gray-400 px-1">{agentMeta.name}</span>
        )}

        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
            isUser
              ? 'bg-brand-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm',
          )}
        >
          {message.isStreaming && message.content === '' ? (
            <TypingIndicator />
          ) : (
            <MessageContent content={message.content} isUser={isUser} />
          )}
          {message.isStreaming && message.content !== '' && (
            <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        <span className="text-xs text-gray-400 px-1">
          {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  // Simple markdown-ish renderer: bold, code, bullet lists
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className={isUser ? 'text-brand-200' : 'text-brand-500'}>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.startsWith('# ')) {
          return <p key={i} className="font-bold text-base">{line.slice(2)}</p>;
        }
        if (line.startsWith('## ')) {
          return <p key={i} className="font-semibold">{line.slice(3)}</p>;
        }
        if (line === '') return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="bg-black/10 px-1 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function ChatPage() {
  const sessionId = useMemo(() => `session_${Date.now()}`, []);
  const { messages, activeAgent, isConnected, isStreaming, sendMessage, clearChat, switchAgent } =
    useChat(sessionId);

  const [input, setInput] = useState('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const agentMeta = AGENT_META[activeAgent];

  // Auto-scroll
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Agent sidebar */}
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">AI Agents</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select your assistant</p>
        </div>

        <div className="p-3 space-y-1 flex-1">
          {(Object.entries(AGENT_META) as [AgentType, typeof AGENT_META[AgentType]][]).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => switchAgent(key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all',
                activeAgent === key
                  ? 'text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50',
              )}
              style={
                activeAgent === key
                  ? { background: meta.color }
                  : {}
              }
            >
              <span className="text-xl w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 flex-shrink-0">
                {meta.emoji}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sm">{meta.name}</p>
                <p className={cn('text-xs truncate', activeAgent === key ? 'text-white/70' : 'text-gray-400')}>
                  {meta.tagline}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Connection status */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-green-600">Connected</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-500">Offline</span></>
            )}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm"
              style={{ background: agentMeta.color + '15', border: `2px solid ${agentMeta.color}20` }}
            >
              {agentMeta.emoji}
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{agentMeta.name}</h1>
              <p className="text-xs text-gray-400">{agentMeta.tagline}</p>
            </div>
          </div>

          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 min-h-0">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} agentMeta={AGENT_META[msg.agent]} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts — shown when only welcome message exists */}
        {messages.length <= 1 && (
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-400">Quick prompts</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS[activeAgent].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="px-3 py-1.5 text-xs rounded-full border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="bg-white border-t border-gray-100 px-4 py-4 flex-shrink-0">
          <div className="flex items-end gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agentMeta.name}…`}
              rows={1}
              disabled={!isConnected}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none max-h-32 leading-relaxed disabled:opacity-50"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !isConnected}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                input.trim() && !isStreaming && isConnected
                  ? 'text-white shadow-sm hover:opacity-90'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              )}
              style={
                input.trim() && !isStreaming && isConnected
                  ? { background: agentMeta.color }
                  : {}
              }
            >
              {isStreaming ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
