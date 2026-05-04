'use client';
import { useState, useEffect } from 'react';
import { Save, User, Bell, Shield, Trash2, Eye, EyeOff, CreditCard, ExternalLink, Zap, TrendingUp, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useMutation } from '@tanstack/react-query';
import { useOpenPortal } from '@/lib/hooks/useBilling';
import { useSubscription } from '@/lib/hooks/useCredits';
import api from '@/lib/api';

type Tab = 'account' | 'billing' | 'notifications' | 'security';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account');

  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 p-6 max-w-2xl">
        <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {([
            { key: 'account',       label: 'Account',       icon: <User className="w-4 h-4" /> },
            { key: 'billing',       label: 'Billing',       icon: <CreditCard className="w-4 h-4" /> },
            { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
            { key: 'security',      label: 'Security',      icon: <Shield className="w-4 h-4" /> },
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
        {tab === 'billing' && <BillingTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'security' && <SecurityTab />}
      </div>
    </>
  );
}

function AccountTab() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '' });

  useEffect(() => {
    if (user) setForm({ name: user.name ?? '', email: user.email ?? '' });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: (data: typeof form) => api.put('/auth/profile', data).then((r) => r.data),
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

const PLAN_STYLES: Record<string, { label: string; color: string }> = {
  FREE:       { label: 'Free',       color: 'bg-gray-100 text-gray-700' },
  SOLO:       { label: 'Solo',       color: 'bg-blue-100 text-blue-700' },
  PRO:        { label: 'Pro',        color: 'bg-violet-100 text-violet-700' },
  AGENCY:     { label: 'Agency',     color: 'bg-purple-100 text-purple-700' },
  ENTERPRISE: { label: 'Enterprise', color: 'bg-fuchsia-100 text-fuchsia-700' },
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: 'bg-green-100 text-green-700' },
  trialing: { label: 'Trial',    color: 'bg-blue-100 text-blue-700' },
  past_due: { label: 'Past due', color: 'bg-red-100 text-red-700' },
  canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-500' },
  paused:   { label: 'Paused',   color: 'bg-amber-100 text-amber-700' },
  none:     { label: 'Free',     color: 'bg-gray-100 text-gray-500' },
};

function BillingTab() {
  const portal = useOpenPortal();
  const { data: sub, isLoading } = useSubscription();

  const planStyle   = PLAN_STYLES[sub?.plan ?? 'FREE'] ?? PLAN_STYLES.FREE;
  const statusStyle = STATUS_STYLES[sub?.subscriptionStatus ?? 'none'] ?? STATUS_STYLES.none;
  const credits     = sub?.credits;
  const creditPct   = credits ? Math.min(100, Math.round((credits.used / credits.limit) * 100)) : 0;
  const isLow       = creditPct >= 80;
  const isEmpty     = credits?.remaining === 0;

  const renewsAt = sub?.renewsAt ? new Date(sub.renewsAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }) : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Current plan</h2>
            {sub?.plan !== 'FREE' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portal.mutate(window.location.href)}
                loading={portal.isPending}
              >
                Manage <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${planStyle.color}`}>
              {planStyle.label}
            </span>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusStyle.color}`}>
              {statusStyle.label}
            </span>
            {renewsAt && sub?.subscriptionStatus === 'active' && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3" /> Renews {renewsAt}
              </span>
            )}
          </div>

          {/* Payment past due warning */}
          {sub?.subscriptionStatus === 'past_due' && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-red-800">Payment failed</p>
                <p className="text-xs text-red-600">Update your payment method to keep your plan.</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => portal.mutate(window.location.href)}
                loading={portal.isPending}
              >
                Fix now
              </Button>
            </div>
          )}

          {sub?.plan === 'FREE' && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
              <p className="text-sm font-medium text-violet-800 mb-1">Upgrade for AI agents</p>
              <p className="text-xs text-violet-600 mb-3">Get Sam, Clara, Steve, Sarah & Lora working for you.</p>
              <Link href="/pricing">
                <Button size="sm">View plans</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credits card */}
      {credits && credits.limit > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              <h2 className="font-semibold text-gray-900">AI Credits</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <span className={`text-3xl font-bold ${isEmpty ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                  {credits.remaining}
                </span>
                <span className="text-sm text-gray-400 ml-1">/ {credits.limit} remaining</span>
              </div>
              {isEmpty && (
                <Link href="/pricing">
                  <Button size="sm">Upgrade for more</Button>
                </Link>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-violet-500'}`}
                style={{ width: `${creditPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{credits.used} used this month</span>
              {sub?.lastCreditReset && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Last reset {new Date(sub.lastCreditReset).toLocaleDateString()}
                </span>
              )}
            </div>

            {isLow && !isEmpty && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Running low. <Link href="/pricing" className="font-semibold underline">Upgrade now</Link> to avoid interruptions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA for paid plans running low */}
      {sub?.plan !== 'FREE' && sub?.plan !== 'ENTERPRISE' && (
        <Card className="border-violet-100 bg-violet-50/30">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Need more credits?</p>
              <p className="text-xs text-gray-500 mt-0.5">Upgrade your plan to unlock more AI power.</p>
            </div>
            <Link href="/pricing">
              <Button size="sm" variant="outline">View plans</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
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
    { key: 'aiReplySuggested', label: 'AI reply suggested', description: 'When Clara suggests a reply to engagement' },
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
