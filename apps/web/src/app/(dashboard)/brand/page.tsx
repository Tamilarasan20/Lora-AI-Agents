'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Brain,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  Loader2,
  Mic2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useAddCompetitor,
  useAnalyzeBrandWebsite,
  useBrandDocuments,
  useBrandDna,
  useBrandMemory,
  useBrandProfile,
  useBrandValidationHistory,
  useBrandVoice,
  useCompetitors,
  useExtractDna,
  useRemoveCompetitor,
  useUpdateBrand,
  useUpdateBrandVoice,
} from '@/lib/hooks/useBrand';
import { PLATFORM_ICONS } from '@/lib/utils';

type Tab = 'analyze' | 'knowledge' | 'profile' | 'voice' | 'competitors';

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'analyze', label: 'AI Analyzer', icon: <Wand2 className="w-4 h-4" /> },
  { key: 'knowledge', label: 'Knowledge Base', icon: <Brain className="w-4 h-4" /> },
  { key: 'profile', label: 'Brand profile', icon: <Building2 className="w-4 h-4" /> },
  { key: 'voice', label: 'Brand voice', icon: <Mic2 className="w-4 h-4" /> },
  { key: 'competitors', label: 'Competitors', icon: <Users className="w-4 h-4" /> },
];

const STEPS = [
  'Scraping pages…',
  'Downloading images…',
  'AI analysis…',
  'Saving to knowledge base…',
];

const DOCUMENT_LABELS: Record<string, string> = {
  business_profile: 'Business Profile',
  market_research: 'Market Research',
  social_strategy: 'Social Strategy',
  brand_guidelines: 'Brand Guidelines',
  visual_intelligence: 'Visual Intelligence',
};

export default function BrandPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    requestedTab && TABS.some((item) => item.key === requestedTab) ? (requestedTab as Tab) : 'analyze',
  );

  useEffect(() => {
    if (requestedTab && TABS.some((item) => item.key === requestedTab)) {
      setTab(requestedTab as Tab);
    }
  }, [requestedTab]);

  return (
    <div className="min-h-full bg-[#FAFBFC]">
      <Header title="Brand Settings" />
      <div className="mx-auto flex-1 max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#2563EB]">
              <Sparkles className="h-3.5 w-3.5" />
              Lora Knowledge Base
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Build and manage your brand intelligence</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Analyze your website, generate reusable brand documents, and keep your profile, voice, and competitors in a clean workspace modeled after the latest Loraloop knowledge base experience.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 rounded-[24px] border border-[#E5E7EB] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.04)] lg:w-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-[#3B82F6] text-white shadow-[0_12px_30px_rgba(59,130,246,0.22)]'
                    : 'text-slate-600 hover:bg-[#F8FAFC] hover:text-slate-900'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pomelli-style guided flow entry — separate from the legacy AnalyzeTab */}
        <a
          href="/brand/knowledge"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-5 py-4 transition hover:border-violet-300 hover:shadow-sm"
        >
          <div>
            <div className="text-sm font-semibold text-violet-700">
              ✨ New: Guided Knowledge Base builder
            </div>
            <div className="mt-0.5 text-sm text-violet-900/80">
              Generate, review, and approve your full brand knowledge base in one flow.
            </div>
          </div>
          <span className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-sm">
            Start →
          </span>
        </a>

        {tab === 'analyze' && <AnalyzeTab onSuccess={() => setTab('knowledge')} />}
        {tab === 'knowledge' && <KnowledgeBaseTab />}
        {tab === 'profile' && <BrandProfileTab />}
        {tab === 'voice' && <BrandVoiceTab />}
        {tab === 'competitors' && <CompetitorsTab />}
      </div>
    </div>
  );
}

function AnalyzeTab({ onSuccess }: { onSuccess: () => void }) {
  const [url, setUrl] = useState('');
  const [stepIdx, setStepIdx] = useState(0);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyze = useAnalyzeBrandWebsite();

  useEffect(() => {
    if (analyze.isPending) {
      setStepIdx(0);
      stepTimer.current = setInterval(() => {
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      }, 4000);
    } else if (stepTimer.current) {
      clearInterval(stepTimer.current);
    }

    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, [analyze.isPending]);

  useEffect(() => {
    if (!analyze.isSuccess) return undefined;
    const timer = setTimeout(onSuccess, 1800);
    return () => clearTimeout(timer);
  }, [analyze.isSuccess, onSuccess]);

  const result = analyze.data as any;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border-[#E5E7EB] shadow-[0_22px_60px_rgba(15,23,42,0.06)]">
        <div className="h-1 w-full bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#BFDBFE]" />
        <CardHeader className="border-b-[#EFF6FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#2563EB]">
                <Sparkles className="h-3.5 w-3.5" />
                New extraction
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Build your brand knowledge base</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Paste your website URL and Loraloop will crawl it, extract brand intelligence, and generate reusable knowledge documents.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Pages', value: 'Auto crawl' },
                { label: 'Visuals', value: 'Logo + colors' },
                { label: 'Voice', value: 'Brand tone' },
                { label: 'Docs', value: '5 outputs' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 bg-white">
          <div className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  id="analyze-url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyze.mutate(url.trim())}
                  disabled={analyze.isPending}
                  className="h-12 rounded-2xl border-[#D1D5DB] bg-white px-4 shadow-none focus:border-[#60A5FA] focus:ring-[#BFDBFE]"
                />
              </div>
              <Button
                onClick={() => analyze.mutate(url.trim())}
                loading={analyze.isPending}
                disabled={!url.trim() || analyze.isPending}
                className="h-12 rounded-2xl bg-[#3B82F6] px-5 hover:bg-[#2563EB] focus:ring-[#3B82F6]"
              >
                <Wand2 className="w-4 h-4" />
                Analyze Website
              </Button>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">Scan public pages, metadata, and messaging cues</div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">Extract tone, positioning, colors, and value props</div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">Save documents directly to your local knowledge base</div>
          </div>

          {analyze.isPending && (
            <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-5">
              <div className="mb-3 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
                <span className="text-sm font-medium text-[#1D4ED8]">{STEPS[stepIdx]}</span>
              </div>
              <div className="flex gap-2">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-colors ${i <= stepIdx ? 'bg-[#3B82F6]' : 'bg-[#DBEAFE]'}`}
                  />
                ))}
              </div>
            </div>
          )}

          {analyze.isError && (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              Analysis failed. Please verify the website URL and try again.
            </div>
          )}

          {analyze.isSuccess && result && (
            <div className="space-y-4 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                Knowledge base created. Opening the Knowledge Base tab…
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-[20px] border border-white/80 bg-white/80 p-4 text-sm md:grid-cols-2">
                {result.logoUrl && (
                  <div className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <img src={result.logoUrl} alt="Logo" className="h-10 w-auto object-contain rounded" />
                    <span className="text-xs text-slate-500">Logo extracted and saved</span>
                  </div>
                )}
                <LabelValue label="Brand name" value={result.brandName} />
                <LabelValue label="Industry" value={result.industry} />
                <LabelValue label="Tone" value={result.tone} />
                <LabelValue label="Target audience" value={result.targetAudience} />
                <div className="md:col-span-2">
                  <LabelValue label="Value proposition" value={result.valueProposition} />
                </div>
              </div>
            </div>
          )}

          {!analyze.isPending && !analyze.isSuccess && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Globe className="w-3.5 h-3.5" />
              The first pass usually finishes in under a minute, then documents become available in the knowledge base.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KnowledgeBaseTab() {
  const { data: brand, isLoading } = useBrandProfile();
  const documents = useBrandDocuments();
  const dna = useBrandDna();
  const memory = useBrandMemory(6);
  const validation = useBrandValidationHistory();
  const extractDna = useExtractDna();

  const docs = (documents.data ?? {}) as Record<string, string | null>;
  const docEntries = Object.entries(DOCUMENT_LABELS).map(([key, label]) => ({
    key,
    label,
    url: docs[key] ?? null,
  }));

  const availableDocs = docEntries.filter((doc) => !!doc.url).length;
  const colors = normalizeBrandColors(brand?.brandColors);
  const competitors = Array.isArray(brand?.competitors) ? brand.competitors : [];
  const pagesScraped = Array.isArray(brand?.pagesScraped) ? brand.pagesScraped : [];
  const referenceImages = Array.isArray(brand?.referenceImages) ? brand.referenceImages : [];
  const voiceCharacteristics = Array.isArray(brand?.voiceCharacteristics) ? brand.voiceCharacteristics : [];
  const pillars = Array.isArray(brand?.contentPillars) ? brand.contentPillars : [];
  const memoryItems = Array.isArray(memory.data) ? memory.data : [];
  const validationItems = Array.isArray(validation.data) ? validation.data : [];

  const handleLoadDocuments = async () => {
    const result = await documents.refetch();
    const loadedDocs = (result.data ?? {}) as Record<string, string | null>;
    const firstUrl = Object.values(loadedDocs).find(Boolean);
    if (firstUrl) window.open(firstUrl, '_blank');
  };

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Knowledge status" value={brand?.lastValidatedAt ? 'Ready' : 'Pending'} hint={brand?.lastValidatedAt ? formatDateTime(brand.lastValidatedAt) : 'Run AI Analyzer'} />
        <StatCard label="Documents ready" value={`${availableDocs}/5`} hint="Structured markdown assets" />
        <StatCard label="Pages scraped" value={String(pagesScraped.length)} hint="Captured from your site" />
        <StatCard label="Competitors found" value={String(competitors.length)} hint="Tracked in brand profile" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-5">
        <Card className="overflow-hidden rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div className="h-1 w-full bg-gradient-to-r from-[#3B82F6] to-[#BFDBFE]" />
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b-[#EFF6FF]">
            <div>
              <h2 className="font-semibold text-slate-900">Knowledge documents</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Open the reusable brand documents generated from your latest website analysis.
              </p>
            </div>
            <Button variant="secondary" onClick={handleLoadDocuments} loading={documents.isFetching} className="rounded-2xl bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]">
              <Download className="w-4 h-4" />
              Refresh docs
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {docEntries.map((doc) => (
              <div key={doc.key} className="rounded-[24px] border border-[#E5E7EB] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <FileText className="w-4 h-4 text-[#2563EB]" />
                      {doc.label}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {doc.url ? 'Ready to download' : 'Not available yet'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={doc.url ? 'outline' : 'ghost'}
                    disabled={!doc.url}
                    onClick={() => doc.url && window.open(doc.url, '_blank')}
                    className={doc.url ? 'rounded-xl border-[#DBEAFE] text-[#2563EB] hover:bg-[#EFF6FF]' : 'rounded-xl'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div className="h-1 w-full bg-gradient-to-r from-[#2563EB] to-[#93C5FD]" />
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b-[#EFF6FF]">
            <div>
              <h2 className="font-semibold text-slate-900">Brand DNA</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Deeper brand positioning extracted from the knowledge base.
              </p>
            </div>
            <Button variant="outline" onClick={() => extractDna.mutate()} loading={extractDna.isPending} className="rounded-2xl border-[#DBEAFE] text-[#2563EB] hover:bg-[#EFF6FF]">
              <Sparkles className="w-4 h-4" />
              Re-extract
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm">
              <InfoBlock label="Archetype" value={dna.data?.archetype} />
              <InfoBlock label="Persuasion style" value={dna.data?.persuasionStyle} />
              <InfoBlock label="Emotional energy" value={dna.data?.emotionalEnergy} />
              <InfoBlock label="Brand promise" value={dna.data?.brandPromise} />
            </div>
            <TagList title="Core values" items={dna.data?.coreValues} emptyLabel="No DNA values extracted yet" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <CardHeader className="border-b-[#EFF6FF]">
            <h2 className="font-semibold text-slate-900">Brand snapshot</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              The latest profile currently powering content generation and automation.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <InfoBlock label="Brand name" value={brand?.brandName} />
              <InfoBlock label="Industry" value={brand?.industry} />
              <InfoBlock label="Website" value={brand?.websiteUrl} />
              <InfoBlock label="Tone" value={brand?.tone} />
            </div>
            <InfoBlock label="Value proposition" value={brand?.valueProposition} />
            <InfoBlock label="Target audience" value={brand?.targetAudience} />
            <InfoBlock label="Product description" value={brand?.productDescription} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ColorSection colors={colors} logoUrl={brand?.logoUrl} />
              <div className="space-y-5">
                <TagList title="Voice characteristics" items={voiceCharacteristics} emptyLabel="No voice traits saved yet" />
                <TagList title="Content pillars" items={pillars} emptyLabel="No content pillars saved yet" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Competitors</h3>
              {competitors.length ? (
                <div className="flex flex-wrap gap-2">
                  {competitors.map((competitor: any) => (
                    <span key={competitor.id ?? competitor.handle ?? competitor} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {competitor.handle ?? competitor}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No competitors tracked yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <CardHeader className="border-b-[#EFF6FF]">
              <h2 className="font-semibold text-slate-900">Scraped image library</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                High-confidence brand images captured during knowledge base generation.
              </p>
            </CardHeader>
            <CardContent>
              {referenceImages.length ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {referenceImages.slice(0, 9).map((image) => (
                    <a
                      key={image}
                      href={image}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFE]"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-[#F8FAFC]">
                        <img
                          src={image}
                          alt="Scraped brand asset"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="border-t border-[#EFF6FF] px-3 py-2 text-[11px] text-slate-500">
                        Captured reference image
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No reusable brand images captured yet. Run AI Analyzer to scrape visual references.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <CardHeader className="border-b-[#EFF6FF]">
              <h2 className="font-semibold text-slate-900">Knowledge memory</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                A short history of detected changes across your brand profile.
              </p>
            </CardHeader>
            <CardContent>
              {memory.isLoading ? (
                <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ) : memoryItems.length ? (
                <div className="space-y-3">
                  {memoryItems.map((item: any) => (
                    <div key={item.id} className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFE] p-4">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium text-slate-900">{humanizeKey(item.changeType ?? item.field)}</span>
                        <span className="text-xs text-slate-400">{formatDateTime(item.detectedAt)}</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {truncateText(item.currentValue) || truncateText(item.previousValue) || 'Change detected'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No brand memory events yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <CardHeader className="border-b-[#EFF6FF]">
              <h2 className="font-semibold text-slate-900">Validation history</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Recent audit runs for the brand knowledge base pipeline.
              </p>
            </CardHeader>
            <CardContent>
              {validation.isLoading ? (
                <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ) : validationItems.length ? (
                <div className="space-y-3">
                  {validationItems.slice(0, 5).map((item: any) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFE] p-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Score {Math.round((item.overallScore ?? 0) * 100)}%
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.pagesScraped ?? 0} pages scraped • {item.imagesFound ?? 0} images found
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-slate-400">
                        {formatDateTime(item.validatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No validation runs recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BrandProfileTab() {
  const { data, isLoading } = useBrandProfile();
  const update = useUpdateBrand();
  const [form, setForm] = useState({
    brandName: '',
    industry: '',
    brandDescription: '',
    targetAudience: '',
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      brandName: data.brandName ?? '',
      industry: data.industry ?? '',
      brandDescription: data.productDescription ?? '',
      targetAudience: data.targetAudience ?? '',
    });
  }, [data]);

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <CardHeader className="border-b-[#EFF6FF]">
        <h2 className="font-semibold text-slate-900">Brand profile</h2>
        <p className="mt-0.5 text-sm text-slate-500">Edit the core details that power your brand profile and knowledge outputs.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          id="brand-name"
          label="Brand name"
          value={form.brandName}
          onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
          className="rounded-2xl border-[#D1D5DB] focus:border-[#60A5FA] focus:ring-[#BFDBFE]"
        />
        <Input id="brand-website" label="Website" value={data?.websiteUrl ?? ''} disabled className="rounded-2xl border-[#E5E7EB] bg-[#F8FAFC]" />
        <Input
          id="brand-industry"
          label="Industry"
          placeholder="e.g. Fashion & Apparel"
          value={form.industry}
          onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
          className="rounded-2xl border-[#D1D5DB] focus:border-[#60A5FA] focus:ring-[#BFDBFE]"
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Product description</label>
          <textarea
            rows={3}
            value={form.brandDescription}
            onChange={(e) => setForm((f) => ({ ...f, brandDescription: e.target.value }))}
            placeholder="What does your brand do? What makes it unique?"
            className="block w-full resize-none rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Target audience</label>
          <textarea
            rows={2}
            value={form.targetAudience}
            onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            placeholder="Who are your customers? Age, interests, pain points…"
            className="block w-full resize-none rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => update.mutate(form)} loading={update.isPending} className="rounded-2xl bg-[#3B82F6] px-5 hover:bg-[#2563EB] focus:ring-[#3B82F6]">
            <Save className="w-4 h-4" />
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const TONE_OPTIONS = ['professional', 'casual', 'humorous', 'inspirational', 'educational', 'bold', 'empathetic', 'friendly', 'authoritative'];

function BrandVoiceTab() {
  const { data, isLoading } = useBrandVoice();
  const update = useUpdateBrandVoice();
  const [characteristicsText, setCharacteristicsText] = useState('');
  const [form, setForm] = useState({
    tone: 'professional',
    brandDescription: '',
    valueProposition: '',
    autoReplyEnabled: true,
    sentimentThreshold: -0.5,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      tone: data.tone ?? 'professional',
      brandDescription: data.brandDescription ?? '',
      valueProposition: data.valueProposition ?? '',
      autoReplyEnabled: data.autoReplyEnabled ?? true,
      sentimentThreshold: data.sentimentThreshold ?? -0.5,
    });
    setCharacteristicsText((data.voiceCharacteristics ?? []).join(', '));
  }, [data]);

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

  const voiceCharacteristics = characteristicsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <CardHeader className="border-b-[#EFF6FF]">
          <h2 className="font-semibold text-slate-900">Tone of voice</h2>
          <p className="mt-0.5 text-sm text-slate-500">Define how your AI agents should sound and what they should prioritize.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Primary tone</label>
              <select
                value={form.tone}
                onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                className="block w-full rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
              >
                {TONE_OPTIONS.map((tone) => (
                  <option key={tone} value={tone}>{tone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Voice characteristics</label>
              <Input
                id="voice-characteristics"
                placeholder="clear, helpful, premium"
                value={characteristicsText}
                onChange={(e) => setCharacteristicsText(e.target.value)}
                className="rounded-2xl border-[#D1D5DB] focus:border-[#60A5FA] focus:ring-[#BFDBFE]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Value proposition</label>
            <textarea
              rows={3}
              value={form.valueProposition}
              onChange={(e) => setForm((f) => ({ ...f, valueProposition: e.target.value }))}
              placeholder="The core promise your brand delivers"
              className="block w-full resize-none rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Brand description for AI</label>
            <textarea
              rows={4}
              value={form.brandDescription}
              onChange={(e) => setForm((f) => ({ ...f, brandDescription: e.target.value }))}
              placeholder="Describe the brand in a way your AI agents should understand and reuse"
              className="block w-full resize-none rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFE] p-4">
              <input
                type="checkbox"
                checked={form.autoReplyEnabled}
                onChange={(e) => setForm((f) => ({ ...f, autoReplyEnabled: e.target.checked }))}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">Allow AI auto-replies</p>
                <p className="mt-1 text-xs text-slate-500">Keep this on if Sarah should reply automatically when sentiment is safe.</p>
              </div>
            </label>

            <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FCFDFE] p-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Sentiment threshold</label>
              <Input
                id="sentiment-threshold"
                type="number"
                step="0.1"
                min="-1"
                max="1"
                value={String(form.sentimentThreshold)}
                onChange={(e) => setForm((f) => ({ ...f, sentimentThreshold: Number(e.target.value) }))}
                className="rounded-2xl border-[#D1D5DB] focus:border-[#60A5FA] focus:ring-[#BFDBFE]"
              />
              <p className="mt-2 text-xs text-slate-500">Lower values are more permissive. Typical range: `-1` to `1`.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => update.mutate({ ...form, voiceCharacteristics })}
              loading={update.isPending}
              className="rounded-2xl bg-[#3B82F6] px-5 hover:bg-[#2563EB] focus:ring-[#3B82F6]"
            >
              <Save className="w-4 h-4" />
              Save voice settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PLATFORMS_LIST = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook'];

function CompetitorsTab() {
  const { data: competitors, isLoading } = useCompetitors();
  const addCompetitor = useAddCompetitor();
  const removeCompetitor = useRemoveCompetitor();
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newHandle, setNewHandle] = useState('');

  const handleAdd = async () => {
    if (!newHandle.trim()) return;
    await addCompetitor.mutateAsync({ platform: newPlatform, handle: newHandle.replace('@', '') });
    setNewHandle('');
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] border-[#E5E7EB] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <CardHeader className="border-b-[#EFF6FF]">
          <h2 className="font-semibold text-slate-900">Track competitors</h2>
          <p className="mt-0.5 text-sm text-slate-500">Keep a focused watchlist so your knowledge base can compare positioning and content patterns.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Mark AI monitors these accounts and uses their content patterns to help you stay competitive.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className="rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
            >
              {PLATFORMS_LIST.map((platform) => (
                <option key={platform} value={platform}>{PLATFORM_ICONS[platform]} {platform}</option>
              ))}
            </select>
            <input
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              placeholder="@username"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 rounded-2xl border border-[#D1D5DB] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFDBFE]"
            />
            <Button onClick={handleAdd} loading={addCompetitor.isPending} disabled={!newHandle.trim()} className="rounded-2xl bg-[#3B82F6] px-5 hover:bg-[#2563EB] focus:ring-[#3B82F6]">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (competitors ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No competitors tracked yet</p>
          ) : (
            <div className="space-y-2">
              {(competitors ?? []).map((competitor: any) => (
                <div key={competitor.id} className="flex items-center gap-3 rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFE] px-4 py-3">
                  <span className="text-lg">{PLATFORM_ICONS[competitor.platform] ?? '🌐'}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-900">@{competitor.handle}</span>
                    <span className="ml-2 text-xs capitalize text-slate-400">{competitor.platform}</span>
                  </div>
                  <button
                    onClick={() => removeCompetitor.mutate(competitor.id)}
                    className="text-slate-400 transition-colors hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-[24px] border-[#E5E7EB] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </Card>
  );
}

function LabelValue({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
      <span className="font-medium text-slate-500">{label}: </span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[22px] border border-[#E5E7EB] bg-[#FCFDFE] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900">{value || 'Not available yet'}</p>
    </div>
  );
}

function TagList({ title, items, emptyLabel }: { title: string; items?: string[]; emptyLabel: string }) {
  const safeItems = items ?? [];
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">{title}</h3>
      {safeItems.length ? (
        <div className="flex flex-wrap gap-2">
          {safeItems.map((item) => (
            <span key={item} className="inline-flex items-center rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#2563EB]">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      )}
    </div>
  );
}

function ColorSection({
  colors,
  logoUrl,
}: {
  colors: { primary?: string; secondary: string[]; accent?: string };
  logoUrl?: string | null;
}) {
  const swatches = [
    { name: 'Primary', value: colors.primary },
    { name: 'Accent', value: colors.accent },
    ...colors.secondary.map((value, index) => ({ name: `Secondary ${index + 1}`, value })),
  ].filter((item) => !!item.value);

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        <Palette className="w-4 h-4 text-[#2563EB]" />
        Visual identity
      </h3>
      {logoUrl && (
        <div className="mb-3 rounded-[22px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <img src={logoUrl} alt="Brand logo" className="h-12 w-auto object-contain" />
        </div>
      )}
      {swatches.length ? (
        <div className="grid grid-cols-2 gap-2">
          {swatches.map((swatch) => (
            <div key={`${swatch.name}-${swatch.value}`} className="rounded-[20px] border border-[#E5E7EB] p-3">
              <div className="h-10 rounded-lg border border-black/5" style={{ backgroundColor: swatch.value }} />
              <p className="mt-2 text-xs font-medium text-slate-700">{swatch.name}</p>
              <p className="text-xs text-slate-400">{swatch.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No brand colors captured yet.</p>
      )}
    </div>
  );
}

function normalizeBrandColors(input: any): { primary?: string; secondary: string[]; accent?: string } {
  if (!input || typeof input !== 'object') return { secondary: [] };
  return {
    primary: typeof input.primary === 'string' ? input.primary : undefined,
    accent: typeof input.accent === 'string' ? input.accent : undefined,
    secondary: Array.isArray(input.secondary)
      ? input.secondary.filter((item: unknown): item is string => typeof item === 'string')
      : [],
  };
}

function truncateText(value?: string | null, max = 120) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}
