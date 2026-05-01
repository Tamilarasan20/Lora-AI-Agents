'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateContent } from '@/lib/hooks/useContent';
import { PLATFORM_ICONS } from '@/lib/utils';

const schema = z.object({
  caption: z.string().min(10, 'Caption must be at least 10 characters'),
  hashtags: z.string().optional(),
  mediaUrl: z.string().url().optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

const PLATFORMS = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube'];

export default function NewContentPage() {
  const router = useRouter();
  const createContent = useCreateContent();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram']);
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [customisePerPlatform, setCustomisePerPlatform] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const masterCaption = watch('caption') ?? '';

  const togglePlatform = (p: string) =>
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const onSubmit = async (data: FormData) => {
    const hashtags = data.hashtags
      ? data.hashtags.split(/[\s,#]+/).filter(Boolean)
      : [];

    const platformContent: Record<string, any> = {};
    for (const p of selectedPlatforms) {
      platformContent[p] = {
        caption: customisePerPlatform && platformCaptions[p] ? platformCaptions[p] : data.caption,
        hashtags,
        mediaUrl: data.mediaUrl || undefined,
      };
    }

    const res = await createContent.mutateAsync({
      rawContent: { caption: data.caption, hashtags, mediaUrl: data.mediaUrl || undefined },
      platformContent,
      targetPlatforms: selectedPlatforms,
      hashtags,
      status: 'DRAFT',
    });

    router.push(`/content/${res.data?.id ?? ''}`);
  };

  return (
    <>
      <Header />
      <div className="flex-1 p-6 max-w-2xl">
        <Link href="/content" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to content
        </Link>

        <h1 className="text-xl font-bold text-gray-900 mb-6">Create new content</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Master caption */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-900">Master caption</h2></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <textarea
                  {...register('caption')}
                  rows={5}
                  placeholder="Write your caption here… This will be used for all selected platforms unless you customise per-platform below."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                {errors.caption && (
                  <p className="text-xs text-red-500 mt-1">{errors.caption.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1 text-right">{masterCaption.length} chars</p>
              </div>

              <Input
                id="hashtags"
                label="Hashtags"
                placeholder="fashion, summer, newcollection (comma or space separated)"
                {...register('hashtags')}
              />

              <Input
                id="mediaUrl"
                label="Media URL (optional)"
                placeholder="https://cdn.example.com/image.jpg"
                error={errors.mediaUrl?.message}
                {...register('mediaUrl')}
              />
            </CardContent>
          </Card>

          {/* Platform selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Target platforms</h2>
                <button
                  type="button"
                  onClick={() => setCustomisePerPlatform((v) => !v)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${customisePerPlatform ? 'bg-brand-600 text-white border-brand-600' : 'text-gray-500 border-gray-300 hover:border-brand-300'}`}
                >
                  Customise per platform
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${selectedPlatforms.includes(p) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'}`}
                  >
                    <span>{PLATFORM_ICONS[p]}</span>
                    <span className="capitalize">{p}</span>
                    {selectedPlatforms.includes(p) && <CheckCircle className="w-3 h-3" />}
                  </button>
                ))}
              </div>

              {/* Per-platform captions */}
              {customisePerPlatform && selectedPlatforms.length > 0 && (
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  {selectedPlatforms.map((p) => (
                    <div key={p}>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                        <span>{PLATFORM_ICONS[p]}</span>
                        <span className="capitalize">{p} caption</span>
                      </label>
                      <textarea
                        rows={3}
                        value={platformCaptions[p] ?? ''}
                        onChange={(e) => setPlatformCaptions((prev) => ({ ...prev, [p]: e.target.value }))}
                        placeholder={`Override caption for ${p}… (leave blank to use master)`}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Link href="/content" className="flex-1">
              <Button variant="outline" className="w-full" type="button">Cancel</Button>
            </Link>
            <Button
              type="submit"
              className="flex-1"
              loading={createContent.isPending}
              disabled={selectedPlatforms.length === 0}
            >
              <Plus className="w-4 h-4" /> Create draft
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
