'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Zap, Search, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useContentList, useDeleteContent } from '@/lib/hooks/useContent';
import { STATUS_COLORS, PLATFORM_ICONS, formatRelative } from '@/lib/utils';
import { GenerateModal } from '@/components/content/GenerateModal';

const PLATFORMS = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube'];
const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];

export default function ContentPage() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useContentList({ status: statusFilter || undefined, page, limit: 20 });
  const deleteContent = useDeleteContent();

  return (
    <>
      <Header title="Content" />
      <div className="flex-1 p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search content…" className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setShowGenerate(true)}>
              <Zap className="w-4 h-4" /> Generate with AI
            </Button>
            <Link href="/content/new">
              <Button><Plus className="w-4 h-4" /> New content</Button>
            </Link>
          </div>
        </div>

        {/* Content grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.items?.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700 mb-2">No content yet</h3>
              <p className="text-sm text-gray-400 mb-4">Generate AI content or write your own</p>
              <Button onClick={() => setShowGenerate(true)}><Zap className="w-4 h-4" /> Generate with AI</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {data?.items?.map((c) => (
              <Link key={c.id} href={`/content/${c.id}`}>
                <Card className="h-full hover:border-brand-300 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="py-4 h-full flex flex-col">
                    {/* Platforms */}
                    <div className="flex gap-1 mb-3">
                      {c.targetPlatforms.slice(0, 4).map((p) => (
                        <span key={p} className="text-base" title={p}>{PLATFORM_ICONS[p] ?? '🌐'}</span>
                      ))}
                    </div>

                    {/* Caption preview */}
                    <p className="text-sm text-gray-800 flex-1 line-clamp-3">
                      {(c.rawContent as any)?.caption ?? 'No caption'}
                    </p>

                    {/* Hashtags */}
                    {c.hashtags?.length > 0 && (
                      <p className="text-xs text-brand-600 mt-2 truncate">
                        {c.hashtags.slice(0, 5).map((h) => `#${h}`).join(' ')}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-gray-400">{formatRelative(c.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="flex items-center text-sm text-gray-500">Page {page} of {data?.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data?.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} />}
    </>
  );
}

function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
