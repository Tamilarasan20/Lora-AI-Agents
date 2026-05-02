'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Brain, Globe, Zap, Search, Eye, Sparkles, ChevronLeft,
  Loader2, CheckCircle2, Clock, AlertCircle, Play, RefreshCw,
  TrendingUp, Image, Lightbulb, FileText, Target,
} from 'lucide-react';
import {
  useProject, useProjectCrawls, useStartCrawl, useCrawlStatus,
  useKnowledgeBase, useSeoData, useVisualAssets, useCreatives, useGenerateCreative,
} from '@/lib/hooks/useAke';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Tab = 'overview' | 'knowledge' | 'seo' | 'visual' | 'creatives';

export default function ProjectPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [activeCrawlId, setActiveCrawlId] = useState('');
  const [creativeType, setCreativeType] = useState('PAID_ADS');
  const [creativePlatform, setCreativePlatform] = useState('Meta/Instagram');
  const [creativeContext, setCreativeContext] = useState('');

  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const { data: crawls } = useProjectCrawls(projectId);
  const { data: crawlStatus } = useCrawlStatus(activeCrawlId);
  const { data: knowledge } = useKnowledgeBase(projectId);
  const { data: seoData } = useSeoData(projectId);
  const { data: assets } = useVisualAssets(projectId);
  const { data: creatives } = useCreatives(projectId);
  const startCrawl = useStartCrawl();
  const generateCreative = useGenerateCreative(projectId);

  const handleStartCrawl = async () => {
    const crawl = await startCrawl.mutateAsync({
      projectId,
      workspaceId,
      websiteUrl: project.websiteUrl,
      depth: project.crawlDepth,
    });
    setActiveCrawlId(crawl.id);
    setTab('overview');
  };

  const handleGenerateCreative = async () => {
    await generateCreative.mutateAsync({
      type: creativeType,
      platform: creativePlatform,
      count: 5,
      additionalContext: creativeContext,
    });
  };

  const latestCrawl = crawls?.[0];
  const isRunning = crawlStatus?.status === 'RUNNING' || crawlStatus?.status === 'PENDING'
    || latestCrawl?.status === 'RUNNING' || latestCrawl?.status === 'PENDING';

  const tabs: { id: Tab; label: string; icon: React.ElementType; available: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: Globe, available: true },
    { id: 'knowledge', label: 'Knowledge', icon: Brain, available: !!knowledge },
    { id: 'seo', label: 'SEO', icon: Search, available: !!seoData },
    { id: 'visual', label: 'Visual', icon: Eye, available: !!(assets?.length) },
    { id: 'creatives', label: 'Creatives', icon: Sparkles, available: !!knowledge },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <button onClick={() => router.push(`/workspaces/${workspaceId}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{project?.name}</h1>
          <a href={project?.websiteUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-violet-600 hover:underline">{project?.websiteUrl}</a>
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <Button variant="outline" disabled loading>
              <Loader2 className="w-4 h-4 animate-spin" /> Crawling…
            </Button>
          ) : (
            <Button onClick={handleStartCrawl} loading={startCrawl.isPending}>
              {latestCrawl ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {latestCrawl ? 'Re-crawl' : 'Start Crawl'}
            </Button>
          )}
        </div>
      </div>

      {/* Crawl progress banner */}
      {isRunning && (
        <div className="mb-5 p-4 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-violet-600 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-800">Crawling website…</p>
            <p className="text-xs text-violet-600">
              {crawlStatus?.pagesProcessed ?? latestCrawl?.pagesProcessed ?? 0} pages processed. AI enrichment will start automatically when complete.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {!t.available && t.id !== 'overview' && t.id !== 'creatives' && (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pages Crawled', value: latestCrawl?.pagesProcessed ?? 0, icon: Globe, color: 'violet' },
            { label: 'Knowledge', value: knowledge ? 'Ready' : 'Pending', icon: Brain, color: 'blue' },
            { label: 'SEO Keywords', value: (seoData?.keywords as any[])?.length ?? 0, icon: TrendingUp, color: 'green' },
            { label: 'Visual Assets', value: assets?.length ?? 0, icon: Image, color: 'orange' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className={`w-8 h-8 rounded-lg bg-${stat.color}-100 flex items-center justify-center mb-2`}>
                <stat.icon className={`w-4 h-4 text-${stat.color}-600`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </Card>
          ))}
          {/* Crawl history */}
          {crawls && crawls.length > 0 && (
            <div className="col-span-2 md:col-span-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Crawl History</h3>
              <div className="space-y-2">
                {crawls.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-sm">
                    {c.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                      c.status === 'FAILED' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                        <Clock className="w-4 h-4 text-gray-400" />}
                    <span className="text-gray-600 flex-1">{c.pagesProcessed} pages · {c.status}</span>
                    <span className="text-gray-400 text-xs">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'knowledge' && (
        knowledge ? <KnowledgeView data={knowledge} /> :
          <EmptyState icon={Brain} title="No knowledge base yet" description="Start a crawl to generate AI-powered business intelligence" />
      )}

      {tab === 'seo' && (
        seoData ? <SeoView data={seoData} /> :
          <EmptyState icon={Search} title="No SEO data yet" description="SEO intelligence is generated automatically after crawling" />
      )}

      {tab === 'visual' && (
        assets?.length ? <VisualView assets={assets} /> :
          <EmptyState icon={Eye} title="No visual assets yet" description="Images are analyzed by Gemini Vision after crawling" />
      )}

      {tab === 'creatives' && (
        <div>
          {/* Generator */}
          <Card className="p-5 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Generate Creatives</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={creativeType} onChange={(e) => setCreativeType(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {['PAID_ADS', 'SOCIAL_MEDIA', 'VIDEO', 'EMAIL', 'COMPETITOR_RESPONSE', 'CONTENT'].map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select value={creativePlatform} onChange={(e) => setCreativePlatform(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {['Meta/Instagram', 'TikTok', 'LinkedIn', 'Twitter/X', 'YouTube', 'Google Ads', 'Pinterest'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <textarea
              value={creativeContext}
              onChange={(e) => setCreativeContext(e.target.value)}
              rows={2}
              placeholder="Optional: add context like 'focus on holiday promotion' or 'target Gen Z'"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none mb-4"
            />
            <Button onClick={handleGenerateCreative} loading={generateCreative.isPending}>
              <Sparkles className="w-4 h-4" /> Generate 5 Creatives
            </Button>
          </Card>

          {/* Results */}
          {creatives?.length ? <CreativesView creatives={creatives} /> :
            <EmptyState icon={Sparkles} title="No creatives yet" description="Generate ad copy, social posts, video scripts, and email sequences" />}
        </div>
      )}
    </div>
  );
}

function KnowledgeView({ data }: { data: any }) {
  const bp = data.businessProfile as any;
  const strategy = data.marketingStrategy as any;
  const research = data.marketResearch as any;
  const voice = data.brandVoice as any;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Business Profile */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-gray-900">Business Profile</h3>
            <Badge variant="default">{Math.round(data.confidenceScore * 100)}% confidence</Badge>
          </div>
          <dl className="space-y-2 text-sm">
            {bp?.companyName && <div><dt className="text-gray-500">Company</dt><dd className="font-medium text-gray-900">{bp.companyName}</dd></div>}
            {bp?.industry && <div><dt className="text-gray-500">Industry</dt><dd className="font-medium text-gray-900">{bp.industry}</dd></div>}
            {bp?.businessModel && <div><dt className="text-gray-500">Model</dt><dd className="font-medium text-gray-900">{bp.businessModel}</dd></div>}
            {bp?.valueProposition && <div><dt className="text-gray-500">Value Proposition</dt><dd className="text-gray-800 mt-1 bg-violet-50 p-2 rounded-lg">{bp.valueProposition}</dd></div>}
            {bp?.targetAudience && <div><dt className="text-gray-500">Target Audience</dt><dd className="text-gray-800">{bp.targetAudience}</dd></div>}
          </dl>
        </Card>

        {/* Brand Voice */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900">Brand Voice</h3>
          </div>
          {voice?.tone && <div className="mb-3"><p className="text-xs text-gray-500 mb-1">Tone</p><Badge variant="warning">{voice.tone}</Badge></div>}
          {voice?.voiceAttributes?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Attributes</p>
              <div className="flex flex-wrap gap-1">
                {voice.voiceAttributes.map((a: string) => <Badge key={a} variant="default">{a}</Badge>)}
              </div>
            </div>
          )}
          {voice?.sampleCaptions?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Sample Captions</p>
              <div className="space-y-1.5">
                {voice.sampleCaptions.slice(0, 2).map((c: string, i: number) => (
                  <p key={i} className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg italic">"{c}"</p>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Marketing Strategy */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-gray-900">Marketing Strategy</h3>
          </div>
          {strategy?.social && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Best Platforms</p>
              <div className="flex flex-wrap gap-1">{strategy.social.bestPlatforms?.map((p: string) => <Badge key={p} variant="success">{p}</Badge>)}</div>
            </div>
          )}
          {strategy?.social?.contentPillars?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Content Pillars</p>
              <div className="flex flex-wrap gap-1">{strategy.social.contentPillars.map((p: string) => <Badge key={p} variant="default">{p}</Badge>)}</div>
            </div>
          )}
          {strategy?.social?.hooks?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Hooks</p>
              <div className="space-y-1.5">{strategy.social.hooks.slice(0, 3).map((h: string, i: number) => (
                <p key={i} className="text-xs bg-green-50 text-green-800 p-2 rounded-lg">"{h}"</p>
              ))}</div>
            </div>
          )}
        </Card>

        {/* Market Research */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Market Research</h3>
          </div>
          {research?.opportunities?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Opportunities</p>
              <ul className="space-y-1">{research.opportunities.slice(0, 3).map((o: string, i: number) => (
                <li key={i} className="text-xs text-green-700 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />{o}</li>
              ))}</ul>
            </div>
          )}
          {research?.competitors?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Competitors Detected</p>
              <div className="flex flex-wrap gap-1">{research.competitors.slice(0, 5).map((c: any) => <Badge key={c.name} variant="default">{c.name}</Badge>)}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SeoView({ data }: { data: any }) {
  const keywords = (data.keywords as any[]) ?? [];
  const clusters = (data.clusters as any[]) ?? [];
  const gaps = (data.contentGaps as any[]) ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Keywords', value: keywords.length, color: 'green' },
          { label: 'Topic Clusters', value: clusters.length, color: 'blue' },
          { label: 'Content Gaps', value: gaps.length, color: 'orange' },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Top Keywords</h3>
          <div className="space-y-2">
            {keywords.slice(0, 15).map((kw: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{kw.keyword}</span>
                <div className="flex gap-2">
                  <Badge variant={kw.priority === 'high' ? 'success' : kw.priority === 'medium' ? 'warning' : 'default'}>{kw.priority}</Badge>
                  <span className="text-gray-400 text-xs">{kw.intent}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-orange-600" /> Content Gaps</h3>
          <div className="space-y-3">
            {gaps.slice(0, 8).map((gap: any, i: number) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-gray-800">{gap.suggestedTitle ?? gap.topic}</p>
                <p className="text-xs text-gray-500 mt-0.5">{gap.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function VisualView({ assets }: { assets: any[] }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{assets.length} images analyzed by Gemini Vision</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((a: any) => {
          const va = a.visualAnalysis as any;
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {a.r2Url ? (
                  <img src={a.r2Url} alt={va?.style ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Eye className="w-8 h-8 text-gray-300" /></div>
                )}
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1 flex-wrap mb-1">
                  {a.tags?.slice(0, 3).map((t: string) => <span key={t} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{t}</span>)}
                </div>
                <p className="text-xs text-gray-500">{va?.style}</p>
                {va?.adSuitability === 'high' && <Badge variant="success" className="mt-1">Ad-ready</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreativesView({ creatives }: { creatives: any[] }) {
  return (
    <div className="space-y-4">
      {creatives.map((strategy: any) => {
        const items = (strategy.content as any)?.creatives ?? [];
        return (
          <Card key={strategy.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="warning">{strategy.type.replace(/_/g, ' ')}</Badge>
                <span className="text-sm text-gray-600">{strategy.title}</span>
              </div>
              <span className="text-xs text-gray-400">{new Date(strategy.generatedAt).toLocaleDateString()}</span>
            </div>
            <div className="space-y-3">
              {items.slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl text-sm">
                  {item.hook && <p className="font-semibold text-gray-900 mb-1">"{item.hook}"</p>}
                  {item.caption && <p className="text-gray-700 whitespace-pre-line">{item.caption.slice(0, 200)}</p>}
                  {item.headline && <p className="font-medium text-gray-900">{item.headline}</p>}
                  {item.body && <p className="text-gray-600 mt-1 text-xs">{item.body.slice(0, 150)}…</p>}
                  {item.cta && <p className="text-violet-600 font-medium mt-1 text-xs">CTA: {item.cta}</p>}
                </div>
              ))}
              {items.length > 3 && <p className="text-xs text-gray-400">+{items.length - 3} more creatives</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h3 className="text-base font-medium text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
