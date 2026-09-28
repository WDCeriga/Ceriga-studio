import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Calendar, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  AUDIENCE_META,
  PAGE_ACCESS,
  WORKER_ROLE_TEMPLATES,
  applyWorkerRoleTemplate,
  ensureProfileAccess,
  upsertProfileAccess,
  type AccessAudience,
  type ProfileAccessConfig,
} from '../../../data/crmAccessMock';
import { getPlatformSetting, setPlatformSetting } from '../../../lib/superadminDb';
import { useSuperadminData } from '../../../hooks/useSuperadminData';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { PageLoadingFallback } from '../../../components/PageLoadingFallback';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { AccessBreadcrumb, BackLink, ProfileAvatar } from './accessShared';
import { cn } from '../../../components/ui/utils';

const VALID_AUDIENCES = new Set<string>(['users', 'workers']);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SuperAdminCRMAccessProfile() {
  const { audience: audienceParam, userId } = useParams<{ audience: string; userId: string }>();
  const { users, loading } = useSuperadminData();

  const audience =
    audienceParam && VALID_AUDIENCES.has(audienceParam)
      ? (audienceParam as AccessAudience)
      : null;

  const user = userId ? users.find((u) => u.id === userId) : undefined;
  const [config, setConfig] = useState<ProfileAccessConfig | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [confirmKind, setConfirmKind] = useState<
    'save' | 'pages-all' | 'pages-none' | { template: string } | null
  >(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !audience) {
      setConfig(null);
      setHydrated(true);
      return;
    }
    let cancelled = false;
    setHydrated(false);
    void (async () => {
      let access = ensureProfileAccess(user, audience);
      try {
        const remote = await getPlatformSetting<ProfileAccessConfig>(`crm_access_${user.id}`);
        if (remote?.userId === user.id) access = remote;
      } catch {
        /* use local/default */
      }
      if (cancelled) return;
      setConfig({ ...access });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, audience]);

  const meta = audience ? AUDIENCE_META[audience] : null;
  const pages = audience ? PAGE_ACCESS[audience] : [];

  const enabledSet = useMemo(
    () => new Set(config?.enabledPages ?? []),
    [config?.enabledPages],
  );

  if (audienceParam === 'manufacturers' && userId) {
    return <Navigate to={`/superadmin/manufacturers/${userId}`} replace />;
  }
  if (audienceParam === 'manufacturers') {
    return <Navigate to="/superadmin/manufacturers" replace />;
  }

  if (loading || !hydrated) {
    return <PageLoadingFallback />;
  }

  if (!audience || !meta || !user || !config) {
    return (
      <div className="rounded-2xl border border-[#252528] bg-[#111113] px-6 py-16 text-center">
        <p className="text-sm text-white/50">Profile not found.</p>
        <Button asChild className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
          <Link to="/superadmin/crm/access">Back to roles & access</Link>
        </Button>
      </div>
    );
  }

  const togglePage = (pageId: string, on: boolean) => {
    setConfig((c) => {
      if (!c) return c;
      const next = on
        ? [...new Set([...c.enabledPages, pageId])]
        : c.enabledPages.filter((id) => id !== pageId);
      return { ...c, enabledPages: next };
    });
  };

  const applyWorkerTemplate = (roleId: string) => {
    setConfirmKind({ template: roleId });
  };

  const save = () => {
    setConfirmKind('save');
  };

  const runConfirmed = async () => {
    if (!config) return;
    if (confirmKind === 'pages-all') {
      setConfig({ ...config, enabledPages: pages.map((p) => p.id) });
      setConfirmKind(null);
      return;
    }
    if (confirmKind === 'pages-none') {
      setConfig({ ...config, enabledPages: [] });
      setConfirmKind(null);
      return;
    }
    if (confirmKind && typeof confirmKind === 'object' && 'template' in confirmKind) {
      const roleId = confirmKind.template;
      const nextPages = applyWorkerRoleTemplate(roleId);
      const role = WORKER_ROLE_TEMPLATES.find((r) => r.id === roleId);
      setConfig({
        ...config,
        workerRoleId: roleId,
        roleLabel: role?.name ?? config.roleLabel,
        enabledPages: nextPages,
      });
      toast.message(`Applied ${role?.name ?? 'role'} template`);
      setConfirmKind(null);
      return;
    }
    if (confirmKind === 'save') {
      setSaving(true);
      try {
        upsertProfileAccess(config);
        await setPlatformSetting(`crm_access_${config.userId}`, config);
        toast.success(`Saved access for ${user.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
        setConfirmKind(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <AccessBreadcrumb audience={audience} profileName={user.name} />
      <BackLink to={`/superadmin/crm/access/${audience}`} label={`All ${meta.title.toLowerCase()}`} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ProfileAvatar name={user.name} accent={meta.accent} className="h-14 w-14 text-base" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{user.name}</h1>
            <p className="mt-0.5 text-sm text-white/45">{user.email}</p>
          </div>
        </div>
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" disabled={saving} onClick={save}>
          Save access
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-white/50">
                <Mail className="h-3.5 w-3.5" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                <span>Joined {formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <Shield className="h-3.5 w-3.5" />
                <span>Last active {formatDate(user.lastActive)}</span>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <Label className="text-white/60">Role label</Label>
            <Input
              value={config.roleLabel}
              onChange={(e) => setConfig({ ...config, roleLabel: e.target.value })}
              className="mt-2 border-white/15 bg-white/5 text-white"
            />
          </div>

          {audience === 'workers' ? (
            <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">Role template</h2>
              <div className="mt-4 grid gap-2">
                {WORKER_ROLE_TEMPLATES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => applyWorkerTemplate(role.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition',
                      config.workerRoleId === role.id
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-[#252528] bg-black/20 hover:border-white/15',
                    )}
                  >
                    <p className="text-sm font-medium text-white">{role.name}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Page access</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={() => setConfirmKind('pages-all')}
                >
                  Enable all
                </button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-white/40 hover:text-white/70"
                  onClick={() => setConfirmKind('pages-none')}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {pages.map((page) => {
                const on = enabledSet.has(page.id);
                return (
                  <label
                    key={page.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#252528] bg-black/20 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{page.label}</p>
                      <p className="text-[11px] text-white/40">{page.description}</p>
                    </div>
                    <Switch checked={on} onCheckedChange={(checked) => togglePage(page.id, checked)} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmKind != null}
        onOpenChange={(open) => {
          if (!open) setConfirmKind(null);
        }}
        title={
          confirmKind === 'save'
            ? 'Save access changes?'
            : confirmKind === 'pages-all'
              ? 'Enable all pages?'
              : confirmKind === 'pages-none'
                ? 'Clear all page access?'
                : 'Apply role template?'
        }
        description={
          confirmKind === 'save'
            ? `Update portal access for ${user.name}.`
            : confirmKind === 'pages-all'
              ? 'All pages for this audience will be enabled.'
              : confirmKind === 'pages-none'
                ? 'This account will lose access to every page until you re-enable some.'
                : 'Page permissions will be replaced by the selected template.'
        }
        confirmLabel={confirmKind === 'save' ? 'Save' : 'Confirm'}
        tone={confirmKind === 'pages-none' ? 'danger' : 'default'}
        onConfirm={() => void runConfirmed()}
      />
    </div>
  );
}
