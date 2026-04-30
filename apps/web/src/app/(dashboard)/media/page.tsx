'use client';
import { useState, useCallback } from 'react';
import { Upload, Image, Film, FileText, Trash2, Download, Search, Grid, List } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useMediaAssets, useUploadMedia, useDeleteMedia } from '@/lib/hooks/useMedia';

type ViewMode = 'grid' | 'list';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5" />,
  video: <Film className="w-5 h-5" />,
  document: <FileText className="w-5 h-5" />,
};

const TYPE_FILTERS = ['all', 'image', 'video', 'document'];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMediaAssets({
    type: typeFilter === 'all' ? undefined : typeFilter,
    page,
    limit: 24,
  });
  const upload = useUploadMedia();
  const deleteAsset = useDeleteMedia();

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await upload.mutateAsync(fd);
      }
    },
    [upload]
  );

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      await upload.mutateAsync(fd);
    }
    e.target.value = '';
  };

  return (
    <>
      <Header title="Media Library" />
      <div className="flex-1 p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          {/* Type filter tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${typeFilter === t ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative ml-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="Search media…"
              className="pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-white border border-gray-200 rounded-lg p-1 gap-1">
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded transition-colors ${view === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <Grid className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-1.5 rounded transition-colors ${view === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 hover:bg-brand-700 text-white cursor-pointer transition-colors">
              <input type="file" multiple className="hidden" onChange={handleFileInput} accept="image/*,video/*" />
              {upload.isPending ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload
            </label>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors ${dragging ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50/50'}`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${dragging ? 'text-brand-500' : 'text-gray-300'}`} />
          <p className="text-sm text-gray-500">
            {dragging ? 'Drop files here' : 'Drag & drop images or videos here, or click Upload above'}
          </p>
        </div>

        {/* Media grid / list */}
        {isLoading ? (
          <div className={view === 'grid' ? 'grid grid-cols-6 gap-3' : 'space-y-2'}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`bg-gray-100 rounded-xl animate-pulse ${view === 'grid' ? 'aspect-square' : 'h-14'}`} />
            ))}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No media yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload images or videos to get started</p>
            </CardContent>
          </Card>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-6 gap-3">
            {(data?.items ?? []).map((asset: any) => (
              <div key={asset.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                {asset.type === 'image' ? (
                  <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-200">
                    {TYPE_ICONS[asset.type] ?? <FileText className="w-5 h-5" />}
                    <span className="text-xs text-gray-500 px-2 truncate max-w-full">{asset.filename}</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a href={asset.url} download className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 text-white">
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => deleteAsset.mutate(asset.id)}
                    className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-500 text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.items ?? []).map((asset: any) => (
              <Card key={asset.id}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                      {TYPE_ICONS[asset.type] ?? <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{asset.filename}</p>
                      <p className="text-xs text-gray-400">
                        {asset.type} · {formatBytes(asset.size ?? 0)} · {new Date(asset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={asset.url} download className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => deleteAsset.mutate(asset.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="flex items-center text-sm text-gray-500">Page {page} of {data?.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === data?.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </>
  );
}
