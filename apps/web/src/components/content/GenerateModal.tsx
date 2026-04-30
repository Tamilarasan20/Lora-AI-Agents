'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGenerateContent } from '@/lib/hooks/useContent';
import { PLATFORM_ICONS } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const schema = z.object({
  topic: z.string().min(5, 'Describe the topic (min 5 chars)'),
  goal: z.string(),
  tone: z.string(),
  additionalContext: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const PLATFORMS = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube'];
const GOALS = ['AWARENESS', 'ENGAGEMENT', 'LEAD_GENERATION', 'SALES', 'COMMUNITY'];
const TONES = ['professional', 'casual', 'humorous', 'inspirational', 'educational'];

export function GenerateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'twitter']);
  const generate = useGenerateContent();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { goal: 'ENGAGEMENT', tone: 'professional' },
  });

  const togglePlatform = (p: string) =>
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const onSubmit = async (data: FormData) => {
    const res = await generate.mutateAsync({ ...data, targetPlatforms: selectedPlatforms });
    onClose();
    router.push(`/content/${res.data.content.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="font-semibold text-gray-900">Generate with Clara AI</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input id="topic" label="Topic / brief" placeholder="e.g. Launch of our new summer collection"
            error={errors.topic?.message} {...register('topic')} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
              <select {...register('goal')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {GOALS.map((g) => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select {...register('tone')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${selectedPlatforms.includes(p) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}>
                  <span>{PLATFORM_ICONS[p]}</span>
                  <span className="capitalize">{p}</span>
                  {selectedPlatforms.includes(p) && <CheckCircle className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          <Input id="context" label="Additional context (optional)" placeholder="Brand tone, recent campaigns, key messages…" {...register('additionalContext')} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={generate.isPending}
              disabled={selectedPlatforms.length === 0}>
              <Zap className="w-4 h-4" /> Generate content
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
