'use client';
import { useState, useEffect } from 'react';
import { Save, User, Bell, Shield, Trash2, Eye, EyeOff } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';

type Tab = 'account' | 'notifications' | 'security';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account');

  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 p-6 max-w-2xl">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {([
            { key: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
            { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
            { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
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

        {tab === 'account' && <AccountTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </>
  );
}

function AccountTab() {
  const { user, fetchMe } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '' });

  useEffect(() => {
    if (user) setForm({ name: user.name ?? '', email: user.email ?? '' });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: (data: typeof form) => api.put('/auth/profile', data).then((r) => r.data),
    onSuccess: () => fetchMe(),
  });

  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-gray-900">Account details</h2></CardHeader>
      <CardContent className="space-y-4">
        <Input
          id="name"
          label="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="email"
          label="Email address"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <div className="flex justify-end pt-2">
          <Button onClick={() => updateProfile.mutate(form)} loading={updateProfile.isPending}>
            <Save className="w-4 h-4" /> Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type NotifSettings = {
  contentPublished: boolean;
  engagementReceived: boolean;
  aiReplySuggested: boolean;
  scheduledReminder: boolean;
  weeklyReport: boolean;
};

function NotificationsTab() {
  const [settings, setSettings] = useState<NotifSettings>({
    contentPublished: true,
    engagementReceived: true,
    aiReplySuggested: true,
    scheduledReminder: true,
    weeklyReport: false,
  });

  const update = useMutation({
    mutationFn: (data: NotifSettings) => api.put('/settings/notifications', data).then((r) => r.data),
  });

  const toggle = (key: keyof NotifSettings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const ITEMS: { key: keyof NotifSettings; label: string; description: string }[] = [
    { key: 'contentPublished', label: 'Content published', description: 'When a post is published to a platform' },
    { key: 'engagementReceived', label: 'New engagement', description: 'Comments, DMs, and mentions on your posts' },
    { key: 'aiReplySuggested', label: 'AI reply suggested', description: "When Sarah suggests a reply to engagement" },
    { key: 'scheduledReminder', label: 'Scheduled post reminder', description: '30 minutes before a scheduled post goes live' },
    { key: 'weeklyReport', label: 'Weekly performance report', description: 'Summary of your analytics every Monday' },
  ];

  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-gray-900">Notification preferences</h2></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ITEMS.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${settings[item.key] ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[item.key] ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
          <Button onClick={() => update.mutate(settings)} loading={update.isPending}>
            <Save className="w-4 h-4" /> Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data).then((r) => r.data),
    onSuccess: () => {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to change password'),
  });

  const { logout } = useAuthStore();

  const handleSubmit = () => {
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    setError('');
    changePassword.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Change password</h2></CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="relative">
            <Input
              id="current-password"
              label="Current password"
              type={showCurrent ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              id="new-password"
              label="New password"
              type={showNew ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input
            id="confirm-password"
            label="Confirm new password"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} loading={changePassword.isPending}>
              <Shield className="w-4 h-4" /> Update password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader><h2 className="font-semibold text-red-700">Danger zone</h2></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Sign out</p>
              <p className="text-xs text-gray-400">Sign out of your account on this device</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>Sign out</Button>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-red-100">
            <div>
              <p className="text-sm font-medium text-red-700">Delete account</p>
              <p className="text-xs text-gray-400">Permanently delete all data. This cannot be undone.</p>
            </div>
            <Button variant="danger" size="sm">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
