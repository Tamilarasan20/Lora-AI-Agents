'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Globe, Loader2, ArrowRight, Clock, CheckCircle2, ChevronLeft, Zap } from 'lucide-react';
import { useWorkspace, useProjects, useCreateProject } from '@/lib/hooks/useAke';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
  DELETED: { label: 'Deleted', variant: 'default' },
};

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { data: workspace, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: projects, isLoading: projLoading } = useProjects(workspaceId);
  const createProject = useCreateProject(workspaceId);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [depth, setDepth] = useState(3);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const project = await createProject.mutateAsync({ name, websiteUrl, description, crawlDepth: depth });
      setShowForm(false);
      router.push(`/workspaces/${workspaceId}/projects/${project.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create project');
    }
  };

  if (wsLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <button onClick={() => router.push('/workspaces')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> All Workspaces
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{workspace?.description ?? `Workspace · ${projects?.length ?? 0} projects`}</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Project</Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="p-6 mb-6 border-2 border-violet-200 bg-violet-50">
          <h2 className="text-base font-semibold text-gray-900 mb-4">New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Project Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Competitor Analysis" required />
              <Input label="Website URL" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://competitor.com" type="url" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you analyzing?" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Crawl Depth (1–10)</label>
                <input type="range" min={1} max={10} value={depth} onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Shallow ({depth} pages deep)</span>
                  <span className="font-medium text-gray-700">{depth}</span>
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" loading={createProject.isPending}>Create &amp; Continue</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Projects */}
      {projLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-700 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add a website URL to start crawling and generating intelligence</p>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> Add Project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects?.map((p: any) => (
            <button
              key={p.id}
              onClick={() => router.push(`/workspaces/${workspaceId}/projects/${p.id}`)}
              className="text-left p-5 bg-white rounded-2xl border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                    <Badge variant={STATUS_MAP[p.status]?.variant ?? 'default'}>{STATUS_MAP[p.status]?.label}</Badge>
                  </div>
                  <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-violet-600 hover:underline truncate block">{p.websiteUrl}</a>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors ml-3 flex-shrink-0" />
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                {p.knowledgeBase ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Knowledge ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Ready to crawl
                  </span>
                )}
                {p.lastCrawledAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(p.lastCrawledAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
