import { activeLocale as cerigaLocale } from '../../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
import{isSupabaseConfigured}from '../../../lib/supabaseClient';
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
  return new Date(iso).toLocaleDateString(cerigaLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SuperAdminCRMAccessProfilePreview() {
  useCerigaTranslation();

  const { audience: audienceParam, userId } = useParams<{ audience: string; userId: string }>();
  const { users, loading } = useSuperadminData({scope:'users'});

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
        <p className="text-sm text-white/50">{cerigaTranslate("interface.text_142330085bae7e86")}</p>
        <Button asChild className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
          <Link to="/superadmin/crm/access">{cerigaTranslate("interface.text_7d0efcbbb9aea813")}</Link>
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
      toast.message(cerigaTranslate("interface.text_c3db41a13ba44d13",{value0:(role?.name ?? 'role')}));
      setConfirmKind(null);
      return;
    }
    if (confirmKind === 'save') {
      setSaving(true);
      try {
        upsertProfileAccess(config);
        await setPlatformSetting(`crm_access_${config.userId}`, config);
        toast.success(cerigaTranslate("interface.text_62b606e6c17b9a93",{value0:(user.name)}));
      } catch (err) {
        toast.error(cerigaTranslateLabel(err instanceof Error ? err.message : cerigaTranslate("interface.text_53ad6f999b1f062f")));
      } finally {
        setSaving(false);
        setConfirmKind(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <AccessBreadcrumb audience={audience} profileName={user.name} />
      <BackLink to={`/superadmin/crm/access/${audience}`} label={cerigaTranslate("interface.text_b2899a619eb1f4bb",{value0:(meta.title.toLowerCase())})} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ProfileAvatar name={user.name} accent={meta.accent} className="h-14 w-14 text-base" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{user.name}</h1>
            <p className="mt-0.5 text-sm text-white/45">{user.email}</p>
          </div>
        </div>
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" disabled={saving} onClick={save}>{cerigaTranslate("interface.text_0f586dd30b7a8725")}</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("common.profile")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-white/50">
                <Mail className="h-3.5 w-3.5" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <Calendar className="h-3.5 w-3.5" />
                <span>{cerigaTranslate("interface.text_69318b0c6a928e7e")}{" "}{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <Shield className="h-3.5 w-3.5" />
                <span>{cerigaTranslate("interface.text_bcdf701c4dfbaee3")}{" "}{formatDate(user.lastActive)}</span>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
            <Label className="text-white/60">{cerigaTranslate("interface.text_e014a04ee002fe7d")}</Label>
            <Input
              value={config.roleLabel}
              onChange={(e) => setConfig({ ...config, roleLabel: e.target.value })}
              className="mt-2 border-white/15 bg-white/5 text-white"
            />
          </div>

          {audience === 'workers' ? (
            <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
              <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_240855550dbda22f")}</h2>
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
                <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_432ee4d8dd923e74")}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                  onClick={() => setConfirmKind('pages-all')}
                >{cerigaTranslate("interface.text_06f08e7c2f8a8c00")}</button>
                <span className="text-white/20">·</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-white/40 hover:text-white/70"
                  onClick={() => setConfirmKind('pages-none')}
                >{cerigaTranslate("interface.text_29a390f9237e3c84")}</button>
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
                      <p className="text-sm font-medium text-white">{cerigaTranslateLabel(page.label)}</p>
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
            ? cerigaTranslate("interface.text_e35b00b6c4948b39")
            : confirmKind === 'pages-all'
              ? cerigaTranslate("interface.text_02f8e6a43bc05e35")
              : confirmKind === 'pages-none'
                ? cerigaTranslate("interface.text_cb70b6291890ae23")
                : cerigaTranslate("interface.text_cdc98f4223ffb3b1")
        }
        description={
          confirmKind === 'save'
            ? cerigaTranslate("interface.text_05e25fedc7d8a8ad",{value0:(user.name)})
            : confirmKind === 'pages-all'
              ? cerigaTranslate("interface.text_a9497b3f804b14ec")
              : confirmKind === 'pages-none'
                ? cerigaTranslate("interface.text_18f03955ae9f8abd")
                : cerigaTranslate("interface.text_f345a2df8d8e3cf0")
        }
        confirmLabel={confirmKind === 'save' ? cerigaTranslate("common.save") : cerigaTranslate("common.confirm")}
        tone={confirmKind === 'pages-none' ? 'danger' : 'default'}
        onConfirm={() => void runConfirmed()}
      />
    </div>
  );
}

export function SuperAdminCRMAccessProfile(){
  useCerigaTranslation();
const{userId,audience}=useParams();if(audience==='workers')return <Navigate to={userId?`/superadmin/workers/${userId}`:'/superadmin/workers'} replace/>;return isSupabaseConfigured?<div className="space-y-4 text-white"><h1 className="text-2xl font-semibold">{cerigaTranslate("interface.text_3386f588f0c29420")}</h1><p className="text-sm text-white/60">{cerigaTranslate("interface.text_0a2e232ac10a5bdb")}</p><p className="text-sm text-white/60">{cerigaTranslate("interface.text_e58d56102478c530")}</p><Link className="inline-block text-red-300 underline" to={userId?`/superadmin/users/${userId}`:"/superadmin/users"}>{cerigaTranslate("interface.text_760eed521078e27d")}</Link></div>:<SuperAdminCRMAccessProfilePreview/>;}
