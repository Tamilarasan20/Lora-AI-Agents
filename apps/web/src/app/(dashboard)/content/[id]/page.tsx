'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Zap, Calendar, Trash2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useContentItem, useUpdateContent, useDeleteContent } from '@/lib/hooks/useContent';
import { PLATFORM_ICONS, STATUS_COLORS, formatDate } from '@/lib/utils';

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: content, isLoading } = useContentItem(id);
  const update = useUpdateContent(id);
  const remove = useDeleteContent();
  const [activeTab, setActiveTab] = useState<string>('');

  if (isLoading) return (
    <>
      <Header />
      <div className="flex-1 p-6"><div className="h-64 bg-gray-100 rounded-xl animate-pulse" /></div>
    </>
  );

  if (!content) return (
    <>
      <Header />
      <div className="flex-1 p-6 text-center text-gray-400">Content not found</div>
    </>
  );

  const platformContent = content.platformContent as Record<string, any>;
  const platforms = content.targetPlatforms;
  const currentPlatform = activeTab || platforms[0];

  const handleApprove = () => update.mutate({ status: 'APPROVED' });
  const handleDelete = async () => {
    if (!confirm('Delete this content?')) return;
    await remove.mutateAsync(id);
    router.push('/content');
  };

  return (
    <>
      <Header />
      <div className="flex-1 p-6">
        {/* Back */}
        <Link href="/content" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to content
        </Link>

        <div className="grid grid-cols-3 gap-6">
          {/* Main content */}
          <div className="col-span-2 space-y-4">
            {/* Platform tabs */}
            <Card>
              <CardHeader>
                <div className="flex gap-1">
                  {platforms.map((p) => (
                    <button key={p} onClick={() => setActiveTab(p)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPlatform === p ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:text-gray-800'}`}>
                      <span>{PLATFORM_ICONS[p] ?? '🌐'}</span>
                      <span className="capitalize">{p}</span>
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {platformContent[currentPlatform] ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {(platformContent[currentPlatform] as any)?.caption}
                    </p>
                    {(platformContent[currentPlatform] as any)?.hashtags?.length > 0 && (
                      <p className="text-sm text-brand-600">
                        {((platformContent[currentPlatform] as any)?.hashtags as string[]).map((h) => `#${h}`).join(' ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No content adapted for {currentPlatform} yet</p>
                )}
              </CardContent>
            </Card>

            {/* Raw caption */}
            <Card>
              <CardHeader><h3 className="font-medium text-gray-900">Master caption</h3></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {(content.rawContent as any)?.caption ?? 'No caption'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[content.status]}`}>
                    {content.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Platforms</span>
                  <span className="text-sm text-gray-700">{platforms.length} platforms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Created</span>
                  <span className="text-sm text-gray-700">{formatDate(content.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">AI generated</span>
                  <span className="text-sm text-gray-700">{content.agentProcessed ? 'Yes (Clara)' : 'No'}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {content.status === 'PENDING_REVIEW' && (
                <Button className="w-full" onClick={handleApprove} loading={update.isPending}>
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
              )}
              <Link href={`/calendar?contentId=${id}`}>
                <Button variant="outline" className="w-full">
                  <Calendar className="w-4 h-4" /> Schedule
                </Button>
              </Link>
              <Button variant="danger" className="w-full" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
