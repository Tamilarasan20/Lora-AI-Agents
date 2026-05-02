'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Globe, FolderOpen, ArrowRight, Loader2, Brain } from 'lucide-react';
import { useWorkspaces, useCreateWorkspace } from '@/lib/hooks/useAke';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function WorkspacesPage() {
  const router = useRouter();
  const { data: workspaces, isLoading } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const ws = await createWorkspace.mutateAsync({ name, slug, description });
      setShowForm(false);
      setName(''); setSlug(''); setDescription('');
      router.push(`/workspaces/${ws.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create workspace');
    }
  };

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Brain className="w-4 h-4 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI Knowledge Engine</h1>
          </div>
          <p className="text-sm text-gray-500">Scrape any website, generate business intelligence, SEO insights, and ad creatives</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> New Workspace
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="p-6 mb-6 border-2 border-violet-200 bg-violet-50">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create Workspace</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }}
                placeholder="Acme Corp"
                required
              />
              <Input
                label="Slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-corp"
                required
              />
            </div>
            <Input
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" loading={createWorkspace.isPending}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Workspace list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : workspaces?.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-700 mb-1">No workspaces yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create a workspace to start analyzing websites with AI</p>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /> Create Workspace</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces?.map((ws: any) => (
            <button
              key={ws.id}
              onClick={() => router.push(`/workspaces/${ws.id}`)}
              className="text-left p-5 bg-white rounded-2xl border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-violet-600" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{ws.name}</h3>
              <p className="text-xs text-gray-500 mb-3">{ws.description ?? `/${ws.slug}`}</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <FolderOpen className="w-3.5 h-3.5" />
                {ws._count?.projects ?? 0} project{ws._count?.projects !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
