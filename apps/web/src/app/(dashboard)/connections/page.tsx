'use client';
import { useState } from 'react';
import { ExternalLink, RefreshCw, Trash2, CheckCircle, AlertCircle, Clock, Link2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useConnections, useOAuthUrl, useDisconnect, useRefreshConnection } from '@/lib/hooks/useConnections';
import { PLATFORM_ICONS } from '@/lib/utils';

const PLATFORMS = [
  { key: 'instagram', name: 'Instagram', description: 'Photos, Reels, Stories' },
  { key: 'twitter', name: 'X (Twitter)', description: 'Tweets, threads, analytics' },
  { key: 'linkedin', name: 'LinkedIn', description: 'Posts, articles, company page' },
  { key: 'tiktok', name: 'TikTok', description: 'Videos, trends, analytics' },
  { key: 'facebook', name: 'Facebook', description: 'Posts, pages, ads' },
  { key: 'youtube', name: 'YouTube', description: 'Videos, shorts, analytics' },
];

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  ACTIVE: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Connected',
    color: 'text-green-600 bg-green-50',
  },
  EXPIRED: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Token expired',
    color: 'text-amber-600 bg-amber-50',
  },
  PENDING: {
    icon: <Clock className="w-4 h-4" />,
    label: 'Pending',
    color: 'text-gray-500 bg-gray-100',
  },
  ERROR: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Error',
    color: 'text-red-600 bg-red-50',
  },
};

export default function ConnectionsPage() {
  const { data: connections, isLoading } = useConnections();
  const getOAuthUrl = useOAuthUrl();
  const disconnect = useDisconnect();
  const refresh = useRefreshConnection();
  const [connecting, setConnecting] = useState<string | null>(null);

  const connectionMap = new Map(((connections as any[]) ?? []).map((c) => [c.platform, c]));

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await getOAuthUrl.mutateAsync(platform);
      window.location.href = res.data.url;
    } finally {
      setConnecting(null);
    }
  };

  return (
    <>
      <Header title="Connections" />
      <div className="flex-1 p-6 max-w-3xl">
        <p className="text-sm text-gray-500 mb-6">
          Connect your social media accounts so Loraloop can publish content and pull analytics on your behalf.
        </p>

        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const conn = connectionMap.get(platform.key) as any;
            const status = conn?.connectionStatus ?? null;
            const statusConfig = status ? STATUS_CONFIG[status] : null;

            return (
              <Card key={platform.key}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Platform icon */}
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                      {PLATFORM_ICONS[platform.key] ?? '🌐'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                        {statusConfig && (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.color}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">{platform.description}</p>
                      {conn?.platformUsername && (
                        <p className="text-xs text-gray-500 mt-1">
                          @{conn.platformUsername}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!conn ? (
                        <Button
                          size="sm"
                          onClick={() => handleConnect(platform.key)}
                          loading={connecting === platform.key}
                        >
                          <Link2 className="w-3.5 h-3.5" /> Connect
                        </Button>
                      ) : (
                        <>
                          {(status === 'EXPIRED' || status === 'ERROR') && (
                            <Button
                              size="sm"
                              onClick={() => refresh.mutate(conn.id)}
                              loading={refresh.isPending}
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Refresh
                            </Button>
                          )}
                          {status === 'ACTIVE' && (
                            <Button size="sm" variant="outline" onClick={() => handleConnect(platform.key)}>
                              <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (confirm(`Disconnect ${platform.name}?`)) disconnect.mutate(conn.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex gap-3">
            <ExternalLink className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">OAuth permissions</p>
              <p className="text-xs text-blue-600 mt-1">
                Loraloop requests publish and analytics permissions only. We never post without your approval unless auto-publish is enabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
