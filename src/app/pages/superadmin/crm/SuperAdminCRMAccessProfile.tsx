import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Calendar, Mail, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SUPER_USERS } from '../../../data/superadminMock';
import {
  AUDIENCE_META,
  MANUFACTURER_PLANS,
  PAGE_ACCESS,
  WORKER_ROLE_TEMPLATES,
  applyWorkerRoleTemplate,
  getProfileAccess,
  upsertProfileAccess,
  type AccessAudience,
  type ProfileAccessConfig,
} from '../../../data/crmAccessMock';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { AccessBreadcrumb, BackLink, ProfileAvatar } from './accessShared';
import { cn } from '../../../components/ui/utils';

const VALID_AUDIENCES = new Set<string>(['users', 'manufacturers', 'workers']);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SuperAdminCRMAccessProfile() {
  const { audience: audienceParam, userId } = useParams<{ audience: string; userId: string }>();

  const user = MOCK_SUPER_USERS.find((u) => u.id === userId);
  const existing = userId ? getProfileAccess(userId) : undefined;

  const audience =
    audienceParam && VALID_AUDIENCES.has(audienceParam)
      ? (audienceParam as AccessAudience)
      : null;

  const [config, setConfig] = useState<ProfileAccessConfig | null>(() => {
    if (!user || !audience || !existing) return null;
    return { ...existing };
  });

  const meta = audience ? AUDIENCE_META[audience] : null;
  const pages = audience ? PAGE_ACCESS[audience] : [];

  const enabledSet = useMemo(
    () => new Set(config?.enabledPages ?? []),
    [config?.enabledPages],
  );

  if (!audience || !meta || !user || !config) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-6 py-16 text-center">
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
    const pages = applyWorkerRoleTemplate(roleId);
    const role = WORKER_ROLE_TEMPLATES.find((r) => r.id === roleId);
    setConfig((c) =>
      c
        ? {
            ...c,
            workerRoleId: roleId,
            roleLabel: role?.name ?? c.roleLabel,
            enabledPages: pages,
          }
        : c,
    );
    toast.message(`Applied ${role?.name ?? 'role'} template`);
  };

  const save = () => {
    upsertProfileAccess(config);
    toast.success(`Saved access for ${user.name}`);
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
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={save}>
          Save access
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
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

          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
            <Label className="text-white/60">Role label</Label>
            <Input
              value={config.roleLabel}
              onChange={(e) => setConfig({ ...config, roleLabel: e.target.value })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>

          {audience === 'manufacturers' ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">Manufacturer plan</h2>
              <div className="mt-4 space-y-2">
                {MANUFACTURER_PLANS.map((plan) => {
                  const active = config.manufacturerPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        setConfig({ ...config, manufacturerPlanId: plan.id })
                      }
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-left transition',
                        active
                          ? 'border-amber-500/40 bg-amber-500/10'
                          : 'border-white/10 bg-black/20 hover:border-white/15',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{plan.name}</span>
                        <span className="text-[10px] text-white/40">{plan.monthlyFee}</span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-amber-200/80">
                        {plan.commission}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {audience === 'workers' ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
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
                        : 'border-white/10 bg-black/20 hover:border-white/15',
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
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Page access</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={() =>
                    setConfig({ ...config, enabledPages: pages.map((p) => p.id) })
                  }
                >
                  Enable all
                </button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-white/40 hover:text-white/70"
                  onClick={() => setConfig({ ...config, enabledPages: [] })}
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
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition',
                      on
                        ? 'border-[#CC2D24]/25 bg-[#CC2D24]/8'
                        : 'border-white/[0.06] bg-black/20',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{page.label}</p>
                    </div>
                    <Switch checked={on} onCheckedChange={(v) => togglePage(page.id, v)} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
