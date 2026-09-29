import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getPlatformSetting, setPlatformSetting } from '../../lib/superadminDb';
import {
  getAlibabaConnectionStatus,
  type AlibabaConnectionStatus,
} from '../../lib/alibabaChat';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';

type NotificationSettings = {
  emailNewOrders: boolean;
  slackWebhook: boolean;
};

type ApiKeySettings = {
  sendgridKey: string;
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailNewOrders: true,
  slackWebhook: false,
};

export function SuperAdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [sendgridKey, setSendgridKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [alibabaStatus, setAlibabaStatus] = useState<AlibabaConnectionStatus | null>(null);
  const [checkingAlibaba, setCheckingAlibaba] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [notif, keys, alibaba] = await Promise.all([
          getPlatformSetting<NotificationSettings>('notifications'),
          getPlatformSetting<ApiKeySettings>('api_keys'),
          getAlibabaConnectionStatus(),
        ]);
        if (cancelled) return;
        if (notif) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...notif });
        if (keys?.sendgridKey) {
          setHasStoredKey(true);
          setSendgridKey('');
        }
        setAlibabaStatus(alibaba);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await setPlatformSetting('notifications', notifications);
      toast.success('Notification settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveApiKeys = async () => {
    if (!sendgridKey.trim() && !hasStoredKey) {
      toast.error('Enter an API key');
      return;
    }
    setSaving(true);
    try {
      if (sendgridKey.trim()) {
        await setPlatformSetting('api_keys', { sendgridKey: sendgridKey.trim() });
        setHasStoredKey(true);
        setSendgridKey('');
      }
      toast.success('API keys saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const refreshAlibaba = async () => {
    setCheckingAlibaba(true);
    try {
      const status = await getAlibabaConnectionStatus();
      setAlibabaStatus(status);
      if (status.configured) {
        toast.success(`Alibaba connected (account ${status.accountId})`);
      } else {
        toast.message(status.message || 'Alibaba secrets are not configured yet');
      }
    } finally {
      setCheckingAlibaba(false);
    }
  };

  if (loading) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Settings</h1>
      </div>

      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Notifications</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-[#252528] px-3 py-3">
            <div>
              <div className="text-sm text-white">Email for new orders</div>
            </div>
            <Switch
              checked={notifications.emailNewOrders}
              onCheckedChange={(emailNewOrders) =>
                setNotifications((prev) => ({ ...prev, emailNewOrders }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-[#252528] px-3 py-3">
            <div>
              <div className="text-sm text-white">Slack webhook</div>
            </div>
            <Switch
              checked={notifications.slackWebhook}
              onCheckedChange={(slackWebhook) =>
                setNotifications((prev) => ({ ...prev, slackWebhook }))
              }
            />
          </label>
        </div>
        <Button
          className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90"
          disabled={saving}
          onClick={() => void saveNotifications()}
        >
          Save notifications
        </Button>
      </section>

      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">API keys</h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-white/55">SendGrid / email provider</Label>
            <Input
              type="password"
              value={sendgridKey}
              onChange={(e) => setSendgridKey(e.target.value)}
              placeholder={hasStoredKey ? '•••••••• (saved — enter new to replace)' : '••••••••'}
              className="border-white/15 bg-white/5 font-mono text-sm text-white"
            />
          </div>
          <Button
            variant="outline"
            className="border-white/15 text-white"
            disabled={saving}
            onClick={() => void saveApiKeys()}
          >
            Save
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-orange-500/20 bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Alibaba.com messages</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Buyer inbox sync uses Alibaba Open Platform IM APIs via Supabase Edge Functions. Do not put
          App Secret or session tokens in <code className="text-white/70">VITE_*</code> env vars.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-white/55">
          <li>
            Create an app at{' '}
            <a
              href="https://developer.alibaba.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-300 underline-offset-2 hover:underline"
            >
              developer.alibaba.com
            </a>{' '}
            and apply for IM message APIs.
          </li>
          <li>OAuth-authorize your Alibaba.com buyer account to obtain a session token.</li>
          <li>
            Set Edge Function secrets:{' '}
            <code className="text-white/70">ALIBABA_APP_KEY</code>,{' '}
            <code className="text-white/70">ALIBABA_APP_SECRET</code>,{' '}
            <code className="text-white/70">ALIBABA_SESSION</code>,{' '}
            <code className="text-white/70">ALIBABA_ACCOUNT_ID</code>.
          </li>
          <li>
            Deploy <code className="text-white/70">alibaba-status</code>,{' '}
            <code className="text-white/70">alibaba-sync</code>, and{' '}
            <code className="text-white/70">alibaba-send</code>, then sync from Messages.
          </li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              alibabaStatus?.configured
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-white/15 bg-white/[0.04] text-white/55'
            }`}
          >
            {alibabaStatus?.configured
              ? `Connected · account ${alibabaStatus.accountId}`
              : alibabaStatus && 'message' in alibabaStatus && alibabaStatus.message
                ? alibabaStatus.message
                : 'Not connected'}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 text-orange-100"
            disabled={checkingAlibaba}
            onClick={() => void refreshAlibaba()}
          >
            {checkingAlibaba ? 'Checking…' : 'Check connection'}
          </Button>
        </div>
      </section>
    </div>
  );
}
