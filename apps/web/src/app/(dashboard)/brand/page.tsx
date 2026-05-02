'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const [tab, setTab] = useState<Tab>('analyze');

  return (
    <>
      <Header title="Brand Settings" />
      <div className="flex-1 p-6 max-w-6xl">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'analyze' && <AnalyzeTab onSuccess={() => setTab('knowledge')} />}
        {tab === 'knowledge' && <KnowledgeBaseTab />}
        {tab === 'profile' && <BrandProfileTab />}
        {tab === 'voice' && <BrandVoiceTab />}
        {tab === 'competitors' && <CompetitorsTab />}
      </div>
    </>
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Build your brand knowledge base</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Paste your website URL and Loraloop will crawl it, extract brand intelligence, and generate reusable knowledge documents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="analyze-url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyze.mutate(url.trim())}
                disabled={analyze.isPending}
              />
            </div>
            <Button
              onClick={() => analyze.mutate(url.trim())}
              loading={analyze.isPending}
              disabled={!url.trim() || analyze.isPending}
            >
              <Wand2 className="w-4 h-4" />
              Analyze
            </Button>
          </div>

          {analyze.isPending && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                <span className="text-sm font-medium text-brand-700">{STEPS[stepIdx]}</span>
              </div>
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIdx ? 'bg-brand-500' : 'bg-brand-100'}`}
                  />
                ))}
              </div>
            </div>
          )}

          {analyze.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              Analysis failed. Please verify the website URL and try again.
            </div>
          )}

          {analyze.isSuccess && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Knowledge base created. Opening the Knowledge Base tab…
              </div>

              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {result.logoUrl && (
                  <div className="md:col-span-2 flex items-center gap-3">
                    <img src={result.logoUrl} alt="Logo" className="h-10 w-auto object-contain rounded" />
                    <span className="text-gray-500 text-xs">Logo extracted and saved</span>
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
            <div className="flex items-center gap-2 text-xs text-gray-400">
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
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Knowledge status" value={brand?.lastValidatedAt ? 'Ready' : 'Pending'} hint={brand?.lastValidatedAt ? formatDateTime(brand.lastValidatedAt) : 'Run AI Analyzer'} />
        <StatCard label="Documents ready" value={`${availableDocs}/5`} hint="Structured markdown assets" />
        <StatCard label="Pages scraped" value={String(pagesScraped.length)} hint="Captured from your site" />
        <StatCard label="Competitors found" value={String(competitors.length)} hint="Tracked in brand profile" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Knowledge documents</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Open the reusable brand documents generated from your latest website analysis.
              </p>
            </div>
            <Button variant="secondary" onClick={handleLoadDocuments} loading={documents.isFetching}>
              <Download className="w-4 h-4" />
              Refresh docs
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {docEntries.map((doc) => (
              <div key={doc.key} className="rounded-xl border border-gray-200 p-4 bg-gray-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <FileText className="w-4 h-4 text-brand-600" />
                      {doc.label}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {doc.url ? 'Ready to download' : 'Not available yet'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={doc.url ? 'outline' : 'ghost'}
                    disabled={!doc.url}
                    onClick={() => doc.url && window.open(doc.url, '_blank')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Brand DNA</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Deeper brand positioning extracted from the knowledge base.
              </p>
            </div>
            <Button variant="outline" onClick={() => extractDna.mutate()} loading={extractDna.isPending}>
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
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Brand snapshot</h2>
            <p className="text-sm text-gray-500 mt-0.5">
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
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Knowledge memory</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                A short history of detected changes across your brand profile.
              </p>
            </CardHeader>
            <CardContent>
              {memory.isLoading ? (
                <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ) : memoryItems.length ? (
                <div className="space-y-3">
                  {memoryItems.map((item: any) => (
                    <div key={item.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium text-gray-900">{humanizeKey(item.changeType ?? item.field)}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(item.detectedAt)}</span>
                      </div>
                      <p className="text-xs text-gray-600">
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

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Validation history</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Recent audit runs for the brand knowledge base pipeline.
              </p>
            </CardHeader>
            <CardContent>
              {validation.isLoading ? (
                <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ) : validationItems.length ? (
                <div className="space-y-3">
                  {validationItems.slice(0, 5).map((item: any) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Score {Math.round((item.overallScore ?? 0) * 100)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.pagesScraped ?? 0} pages scraped • {item.imagesFound ?? 0} images found
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
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
    <Card>
      <CardHeader><h2 className="font-semibold text-gray-900">Brand profile</h2></CardHeader>
      <CardContent className="space-y-4">
        <Input
          id="brand-name"
          label="Brand name"
          value={form.brandName}
          onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
        />
        <Input id="brand-website" label="Website" value={data?.websiteUrl ?? ''} disabled />
        <Input
          id="brand-industry"
          label="Industry"
          placeholder="e.g. Fashion & Apparel"
          value={form.industry}
          onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product description</label>
          <textarea
            rows={3}
            value={form.brandDescription}
            onChange={(e) => setForm((f) => ({ ...f, brandDescription: e.target.value }))}
            placeholder="What does your brand do? What makes it unique?"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target audience</label>
          <textarea
            rows={2}
            value={form.targetAudience}
            onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            placeholder="Who are your customers? Age, interests, pain points…"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => update.mutate(form)} loading={update.isPending}>
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
      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Tone of voice</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary tone</label>
              <select
                value={form.tone}
                onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {TONE_OPTIONS.map((tone) => (
                  <option key={tone} value={tone}>{tone}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice characteristics</label>
              <Input
                id="voice-characteristics"
                placeholder="clear, helpful, premium"
                value={characteristicsText}
                onChange={(e) => setCharacteristicsText(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value proposition</label>
            <textarea
              rows={3}
              value={form.valueProposition}
              onChange={(e) => setForm((f) => ({ ...f, valueProposition: e.target.value }))}
              placeholder="The core promise your brand delivers"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand description for AI</label>
            <textarea
              rows={4}
              value={form.brandDescription}
              onChange={(e) => setForm((f) => ({ ...f, brandDescription: e.target.value }))}
              placeholder="Describe the brand in a way your AI agents should understand and reuse"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={form.autoReplyEnabled}
                onChange={(e) => setForm((f) => ({ ...f, autoReplyEnabled: e.target.checked }))}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Allow AI auto-replies</p>
                <p className="text-xs text-gray-500 mt-1">Keep this on if Sarah should reply automatically when sentiment is safe.</p>
              </div>
            </label>

            <div className="rounded-xl border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sentiment threshold</label>
              <Input
                id="sentiment-threshold"
                type="number"
                step="0.1"
                min="-1"
                max="1"
                value={String(form.sentimentThreshold)}
                onChange={(e) => setForm((f) => ({ ...f, sentimentThreshold: Number(e.target.value) }))}
              />
              <p className="text-xs text-gray-500 mt-2">Lower values are more permissive. Typical range: `-1` to `1`.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => update.mutate({ ...form, voiceCharacteristics })}
              loading={update.isPending}
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
      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Track competitors</h2></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Mark AI monitors these accounts and uses their content patterns to help you stay competitive.
          </p>

          <div className="flex gap-2">
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className="pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={handleAdd} loading={addCompetitor.isPending} disabled={!newHandle.trim()}>
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
                <div key={competitor.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
                  <span className="text-lg">{PLATFORM_ICONS[competitor.platform] ?? '🌐'}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">@{competitor.handle}</span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">{competitor.platform}</span>
                  </div>
                  <button
                    onClick={() => removeCompetitor.mutate(competitor.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
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
    <Card className="p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </Card>
  );
}

function LabelValue({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-gray-500 font-medium">{label}: </span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 mt-1">{value || 'Not available yet'}</p>
    </div>
  );
}

function TagList({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
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
      <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Palette className="w-4 h-4 text-brand-600" />
        Visual identity
      </h3>
      {logoUrl && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <img src={logoUrl} alt="Brand logo" className="h-12 w-auto object-contain" />
        </div>
      )}
      {swatches.length ? (
        <div className="grid grid-cols-2 gap-2">
          {swatches.map((swatch) => (
            <div key={`${swatch.name}-${swatch.value}`} className="rounded-xl border border-gray-200 p-2">
              <div className="h-10 rounded-lg border border-black/5" style={{ backgroundColor: swatch.value }} />
              <p className="text-xs font-medium text-gray-700 mt-2">{swatch.name}</p>
              <p className="text-xs text-gray-400">{swatch.value}</p>
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
