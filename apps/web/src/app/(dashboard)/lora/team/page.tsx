'use client';

import Link from 'next/link';

const AGENTS = [
  {
    name: 'Lora',
    role: 'AI Marketing Lead — CMO',
    avatar: '👩‍💼',
    color: 'from-violet-500 to-fuchsia-500',
    description:
      'Lora is your AI Chief Marketing Officer. She listens to your business goal, builds the full strategy, assigns work to the team, reviews every output, and manages the approval workflow.',
    capabilities: [
      'Full marketing strategy creation',
      'Goal classification and planning',
      'Agent task assignment and orchestration',
      'Output quality review with scoring',
      'Approval workflow management',
      'Next best action recommendations',
    ],
    credits: '5 credits per strategy',
    status: 'active',
  },
  {
    name: 'Sam',
    role: 'AI Strategist — Trend & Competitor Analyst',
    avatar: '🔍',
    color: 'from-blue-500 to-cyan-500',
    description:
      'Sam researches your market, analyzes competitors, identifies content opportunities, and surfaces the trends your audience actually cares about. He gives Lora the intelligence she needs to build winning campaigns.',
    capabilities: [
      'Trend analysis by platform and industry',
      'Competitor content strategy audit',
      'Content opportunity identification',
      'Recommended content angles',
      'Platform-specific suggestions',
      'Risk identification',
    ],
    credits: '4 credits per research task',
    status: 'active',
  },
  {
    name: 'Clara',
    role: 'AI Content Writer',
    avatar: '✍️',
    color: 'from-emerald-500 to-teal-500',
    description:
      'Clara writes scroll-stopping content for every platform. From Instagram captions to email campaigns, blog posts, and ad copy — Clara matches your brand voice and writes content that converts.',
    capabilities: [
      'Social media captions (all platforms)',
      'Email marketing campaigns',
      'Blog posts and long-form content',
      'Hooks, CTAs, and ad copy',
      'Content variants for A/B testing',
      'Brand voice consistency',
    ],
    credits: '3 credits per content piece',
    status: 'active',
  },
  {
    name: 'Steve',
    role: 'AI Visual Designer + Image Generation',
    avatar: '🎨',
    color: 'from-orange-500 to-amber-500',
    description:
      'Steve creates visual concepts, generates image prompts, designs carousel layouts, and produces ad creatives. He generates actual image assets and ensures every visual is brand-aligned and platform-optimized.',
    capabilities: [
      'Social media post image generation',
      'Instagram & LinkedIn carousel creation',
      'Ad creative image generation',
      'Product promo visual direction',
      'Image generation prompts',
      'Platform-specific format optimization',
    ],
    credits: '3 credits per visual concept',
    status: 'active',
  },
  {
    name: 'Sarah',
    role: 'AI Social Media Manager',
    avatar: '📅',
    color: 'from-pink-500 to-rose-500',
    description:
      'Sarah schedules approved content across all platforms, adapts copy for each channel, manages posting cadence, and handles engagement. She only publishes after Lora and the user approve.',
    capabilities: [
      'Content scheduling across platforms',
      'Platform-specific content adaptation',
      'Optimal posting time recommendations',
      'Engagement reply management',
      'Publishing calendar management',
      'Post performance tracking setup',
    ],
    credits: '2 credits per schedule plan',
    status: 'active',
  },
];

export default function TeamPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl">
          🤝
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Your AI Marketing Team</h1>
          <p className="text-sm text-gray-500">5 specialized agents, one unified marketing engine</p>
        </div>
        <Link
          href="/lora"
          className="ml-auto text-sm text-violet-600 hover:underline"
        >
          ← Command center
        </Link>
      </div>

      <div className="space-y-5">
        {AGENTS.map((agent) => (
          <div key={agent.name} className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-start gap-5">
              <div
                className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-2xl flex-shrink-0`}
              >
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{agent.name}</h2>
                    <p className="text-sm text-gray-500">{agent.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{agent.credits}</span>
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs text-green-600 font-medium">Active</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 mb-4">{agent.description}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                  {agent.capabilities.map((cap) => (
                    <div key={cap} className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                      {cap}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100 p-6 text-center">
        <div className="text-2xl mb-3">🚀</div>
        <h3 className="text-base font-semibold text-violet-900 mb-1">Ready to launch your first strategy?</h3>
        <p className="text-sm text-violet-700 mb-4">Tell Lora your goal and the whole team gets to work.</p>
        <Link
          href="/lora"
          className="inline-block rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Go to Lora →
        </Link>
      </div>
    </div>
  );
}
