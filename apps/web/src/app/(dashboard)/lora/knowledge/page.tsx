'use client';

import Link from 'next/link';
import { ArrowRight, Globe, Loader2, Plus, Sparkles, Brain, FileText, Zap } from 'lucide-react';
import { useBrandProfile } from '@/lib/hooks/useBrand';

export default function LoraKnowledgeBasePage() {
  const { data: brand, isLoading } = useBrandProfile();
  const hasBrand = !!brand?.brandName;

  // Documents come embedded in profile as a Record<string, string|null>
  const docEntries = brand?.documents
    ? Object.entries(brand.documents).filter(([, v]) => v != null)
    : [];

  const dna = brand?.dna;

  return (
    <div className="min-h-screen bg-[#FAFBFC] p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-[#111111] tracking-tight mb-2 flex items-center gap-2.5">
              <Sparkles className="w-7 h-7 text-[#3B82F6]" />
              Lora Knowledge Base
            </h1>
            <p className="text-[#71717A] text-[15px]">
              Your brand intelligence — DNA, voice, documents, and competitive insights.
            </p>
          </div>
          <Link
            href="/brand"
            className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm shadow-blue-500/20 text-[14px]"
          >
            <Plus className="w-4 h-4" />
            Manage Brand
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
          </div>
        ) : !hasBrand ? (
          /* Empty state */
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-16 text-center shadow-sm">
            <Globe className="w-12 h-12 text-[#D4D4D8] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#111111] mb-2">No Brand Knowledge Yet</h3>
            <p className="text-[#71717A] mb-6">
              Extract your brand DNA to power AI content generation.
            </p>
            <Link
              href="/brand"
              className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#27272A] text-white px-6 py-3 rounded-xl font-medium transition-colors text-[14px]"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Brand Hero Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]" />
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-2xl shrink-0 shadow-sm border border-blue-100">
                  {brand.brandName?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-[#111111]">{brand.brandName}</h2>
                    {brand.industry && (
                      <span className="text-[12px] font-medium bg-[#F4F4F5] text-[#71717A] px-2.5 py-0.5 rounded-full">
                        {brand.industry}
                      </span>
                    )}
                  </div>
                  {brand.valueProposition && (
                    <p className="text-[14px] text-[#71717A] leading-relaxed line-clamp-2">
                      {brand.valueProposition}
                    </p>
                  )}
                  {brand.targetAudience && (
                    <p className="text-[13px] text-[#A1A1AA] mt-1.5">
                      🎯 {brand.targetAudience}
                    </p>
                  )}
                </div>
                <Link
                  href="/chat"
                  className="flex items-center gap-2 text-[#3B82F6] text-[13px] font-semibold hover:underline shrink-0 mt-1"
                >
                  Chat with Lora <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Knowledge Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Brand DNA */}
              <Link href="/brand" className="group block">
                <div className="bg-white border border-[#E5E7EB] hover:border-[#3B82F6]/40 rounded-2xl p-5 transition-all hover:shadow-[0_8px_30px_rgb(59,130,246,0.10)] h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                      <Brain className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-[#111111]">Brand DNA</h3>
                  </div>
                  {dna?.archetype || dna?.coreValues?.length > 0 ? (
                    <div className="space-y-2 flex-1">
                      {dna.archetype && (
                        <p className="text-[13px] text-[#71717A]">
                          <span className="font-medium text-[#111111]">Archetype:</span> {dna.archetype}
                        </p>
                      )}
                      {dna.brandPromise && (
                        <p className="text-[13px] text-[#71717A] line-clamp-2">{dna.brandPromise}</p>
                      )}
                      {dna.coreValues?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {dna.coreValues.slice(0, 3).map((v: string) => (
                            <span key={v} className="text-[11px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#A1A1AA] flex-1">Extract your brand DNA to unlock AI insights.</p>
                  )}
                  <div className="mt-4 pt-3 border-t border-[#F4F4F5] flex items-center text-[#3B82F6] text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    View DNA <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </Link>

              {/* Documents */}
              <Link href="/brand" className="group block">
                <div className="bg-white border border-[#E5E7EB] hover:border-[#3B82F6]/40 rounded-2xl p-5 transition-all hover:shadow-[0_8px_30px_rgb(59,130,246,0.10)] h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-bold text-[#111111]">Brand Documents</h3>
                  </div>
                  {docEntries.length > 0 ? (
                    <div className="space-y-1.5 flex-1">
                      {docEntries.slice(0, 4).map(([key]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          <span className="text-[13px] text-[#71717A] capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                      {docEntries.length > 4 && (
                        <p className="text-[12px] text-[#A1A1AA] mt-1">+{docEntries.length - 4} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#A1A1AA] flex-1">No brand documents generated yet.</p>
                  )}
                  <div className="mt-4 pt-3 border-t border-[#F4F4F5] flex items-center text-[#3B82F6] text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    View docs <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </Link>

              {/* Quick Actions */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-[#111111]">Quick Actions</h3>
                </div>
                <div className="space-y-2 flex-1">
                  {[
                    { label: 'Chat with Lora', href: '/chat' },
                    { label: 'Edit Brand Profile', href: '/brand' },
                    { label: 'Extract Brand DNA', href: '/brand/knowledge' },
                    { label: 'Generate Content', href: '/content' },
                    { label: 'View Analytics', href: '/analytics' },
                  ].map(({ label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="flex items-center justify-between px-3 py-2.5 bg-[#FAFBFC] hover:bg-blue-50 rounded-xl transition-colors group/item"
                    >
                      <span className="text-[13px] font-medium text-[#3F3F46] group-hover/item:text-[#3B82F6]">{label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#A1A1AA] group-hover/item:text-[#3B82F6]" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Brand Voice */}
            {brand.tone && (
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-[#111111] mb-4 flex items-center gap-2">
                  <span className="text-lg">🎙️</span> Brand Voice
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-1">Tone</p>
                    <p className="text-[13px] text-[#111111] font-medium">{brand.tone}</p>
                  </div>
                  {brand.voiceCharacteristics?.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-1">Voice Traits</p>
                      <div className="flex flex-wrap gap-1.5">
                        {brand.voiceCharacteristics.slice(0, 4).map((trait: string) => (
                          <span key={trait} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {brand.preferredHashtags?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-1">Hashtags</p>
                      <p className="text-[12px] text-blue-500">
                        {brand.preferredHashtags.slice(0, 3).join(' ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
