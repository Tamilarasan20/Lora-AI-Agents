'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Building2, Mic2, Users } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useBrandProfile, useUpdateBrand,
  useBrandVoice, useUpdateBrandVoice,
  useCompetitors, useAddCompetitor, useRemoveCompetitor,
} from '@/lib/hooks/useBrand';
import { PLATFORM_ICONS } from '@/lib/utils';

type Tab = 'profile' | 'voice' | 'competitors';

export default function BrandPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <>
      <Header title="Brand Settings" />
      <div className="flex-1 p-6 max-w-3xl">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {([
            { key: 'profile', label: 'Brand profile', icon: <Building2 className="w-4 h-4" /> },
            { key: 'voice', label: 'Brand voice', icon: <Mic2 className="w-4 h-4" /> },
            { key: 'competitors', label: 'Competitors', icon: <Users className="w-4 h-4" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
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

        {tab === 'profile' && <BrandProfileTab />}
        {tab === 'voice' && <BrandVoiceTab />}
        {tab === 'competitors' && <CompetitorsTab />}
      </div>
    </>
  );
}

function BrandProfileTab() {
  const { data, isLoading } = useBrandProfile();
  const update = useUpdateBrand();
  const [form, setForm] = useState({ name: '', website: '', industry: '', description: '', targetAudience: '' });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? '',
        website: data.website ?? '',
        industry: data.industry ?? '',
        description: data.description ?? '',
        targetAudience: data.targetAudience ?? '',
      });
    }
  }, [data]);

  const handleSave = () => update.mutate(form);

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-gray-900">Brand profile</h2></CardHeader>
      <CardContent className="space-y-4">
        <Input
          id="brand-name"
          label="Brand name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="brand-website"
          label="Website"
          placeholder="https://example.com"
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        />
        <Input
          id="brand-industry"
          label="Industry"
          placeholder="e.g. Fashion & Apparel"
          value={form.industry}
          onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
          <Button onClick={handleSave} loading={update.isPending}>
            <Save className="w-4 h-4" /> Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const TONE_OPTIONS = ['professional', 'casual', 'humorous', 'inspirational', 'educational', 'bold', 'empathetic'];

function BrandVoiceTab() {
  const { data, isLoading } = useBrandVoice();
  const update = useUpdateBrandVoice();
  const [form, setForm] = useState({
    primaryTone: 'professional',
    secondaryTone: 'casual',
    doList: [''] as string[],
    dontList: [''] as string[],
    sampleCaptions: [''] as string[],
  });

  useEffect(() => {
    if (data) {
      setForm({
        primaryTone: data.primaryTone ?? 'professional',
        secondaryTone: data.secondaryTone ?? 'casual',
        doList: data.doList?.length ? data.doList : [''],
        dontList: data.dontList?.length ? data.dontList : [''],
        sampleCaptions: data.sampleCaptions?.length ? data.sampleCaptions : [''],
      });
    }
  }, [data]);

  const updateList = (key: 'doList' | 'dontList' | 'sampleCaptions', idx: number, val: string) =>
    setForm((f) => ({ ...f, [key]: f[key].map((v, i) => (i === idx ? val : v)) }));

  const addItem = (key: 'doList' | 'dontList' | 'sampleCaptions') =>
    setForm((f) => ({ ...f, [key]: [...f[key], ''] }));

  const removeItem = (key: 'doList' | 'dontList' | 'sampleCaptions', idx: number) =>
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));

  if (isLoading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Tone of voice</h2></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary tone</label>
              <select
                value={form.primaryTone}
                onChange={(e) => setForm((f) => ({ ...f, primaryTone: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary tone</label>
              <select
                value={form.secondaryTone}
                onChange={(e) => setForm((f) => ({ ...f, secondaryTone: e.target.value }))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Do / Don't */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><h3 className="font-medium text-green-700">Always do</h3></CardHeader>
          <CardContent className="space-y-2">
            {form.doList.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={item}
                  onChange={(e) => updateList('doList', i, e.target.value)}
                  placeholder="e.g. Use first names"
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {form.doList.length > 1 && (
                  <button onClick={() => removeItem('doList', i)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addItem('doList')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="font-medium text-red-700">Never do</h3></CardHeader>
          <CardContent className="space-y-2">
            {form.dontList.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={item}
                  onChange={(e) => updateList('dontList', i, e.target.value)}
                  placeholder="e.g. Use slang"
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {form.dontList.length > 1 && (
                  <button onClick={() => removeItem('dontList', i)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addItem('dontList')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => update.mutate(form)} loading={update.isPending}>
          <Save className="w-4 h-4" /> Save voice settings
        </Button>
      </div>
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

          {/* Add form */}
          <div className="flex gap-2">
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className="pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {PLATFORMS_LIST.map((p) => (
                <option key={p} value={p}>{PLATFORM_ICONS[p]} {p}</option>
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
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>

          {/* Competitor list */}
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
              {(competitors ?? []).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
                  <span className="text-lg">{PLATFORM_ICONS[c.platform] ?? '🌐'}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">@{c.handle}</span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">{c.platform}</span>
                  </div>
                  <button
                    onClick={() => removeCompetitor.mutate(c.id)}
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
