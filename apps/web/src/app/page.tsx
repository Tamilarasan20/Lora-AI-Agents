import Link from 'next/link';
import { ArrowRight, Zap, BarChart2, Calendar, Sparkles, Link2, MessageSquare } from 'lucide-react';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-powered content',
    description: 'Clara, your AI agent, writes platform-native captions, hashtags, and hooks — in your brand voice.',
  },
  {
    icon: Calendar,
    title: 'Smart scheduling',
    description: 'Publish at the perfect time. Loraloop learns your audience and schedules automatically.',
  },
  {
    icon: Link2,
    title: 'All platforms, one hub',
    description: 'Instagram, TikTok, LinkedIn, Twitter, Facebook — manage everything from a single dashboard.',
  },
  {
    icon: BarChart2,
    title: 'Real-time analytics',
    description: "See what's working across every platform. Track reach, engagement, and follower growth.",
  },
  {
    icon: MessageSquare,
    title: 'Engagement inbox',
    description: 'Reply to comments and DMs from one place. Never miss a conversation.',
  },
  {
    icon: Zap,
    title: 'Instant publish',
    description: 'Go from idea to published in under 60 seconds. Clara handles adaptation for every platform.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-md">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">Loraloop</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Log in
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              Get started free <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-brand-100">
          <Sparkles className="w-3.5 h-3.5" /> Powered by Claude AI
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
          Your AI social media<br />
          <span className="text-brand-500">co-pilot</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Loraloop writes, schedules, and publishes content across every platform — so you can focus on what matters. Powered by Clara, your built-in AI agent.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-brand-200 text-base"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium text-base border border-gray-200 hover:border-gray-300 px-8 py-3.5 rounded-xl transition-colors"
          >
            See pricing
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required · Free plan available</p>
      </section>

      {/* Dashboard preview */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl aspect-video flex items-center justify-center shadow-2xl shadow-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand-400" />
            </div>
            <span className="text-sm font-medium">Loraloop Dashboard</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything you need to grow</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">One platform for AI content creation, scheduling, analytics, and engagement.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Ready to grow faster?</h2>
          <p className="text-gray-500 mb-8 text-lg">Join thousands of creators using Loraloop to save hours every week.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-10 py-4 rounded-xl transition-colors shadow-lg shadow-brand-200 text-base"
          >
            Get started for free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>© {new Date().getFullYear()} Loraloop. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-gray-600 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
