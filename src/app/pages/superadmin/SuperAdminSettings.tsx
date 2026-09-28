import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getPlatformSetting, setPlatformSetting } from '../../lib/superadminDb';
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [notif, keys] = await Promise.all([
          getPlatformSetting<NotificationSettings>('notifications'),
          getPlatformSetting<ApiKeySettings>('api_keys'),
        ]);
        if (cancelled) return;
        if (notif) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...notif });
        if (keys?.sendgridKey) {
          setHasStoredKey(true);
          setSendgridKey('');
        }
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
    </div>
  );
}
