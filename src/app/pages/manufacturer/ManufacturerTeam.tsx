import { useState } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_FACTORY_PERMISSIONS,
  FACTORY_PERMISSION_LABEL,
  ROLE_PERMISSIONS,
  factoryRoleLabel,
  getActingFactoryMember,
  getFactoryWorkspace,
  inviteTeamMember,
  memberHasPermission,
  memberPermissions,
  resetTeamMemberPermissions,
  updateTeamMemberPermissions,
  updateTeamMemberRole,
  type FactoryPermission,
  type FactoryTeamMember,
  type FactoryTeamRole,
} from '../../data/manufacturerPortalMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

const ROLES: FactoryTeamRole[] = ['admin', 'quoter', 'production', 'viewer'];

const ROLE_HELP: Record<FactoryTeamRole, string> = {
  admin: 'All actions — quote, decline, shipping, materials, team, capacity',
  quoter: 'Quote & decline orders; view stats',
  production: 'Edit shipping & materials; manage capacity; view stats',
  viewer: 'View statistics only',
};

const ACTION_PERMS: FactoryPermission[] = [
  'quote',
  'decline',
  'edit_shipping',
  'edit_materials',
  'manage_capacity',
  'manage_team',
  'edit_profile',
  'view_stats',
];

function PermissionMatrix({
  member,
  canEdit,
  onToggle,
  onReset,
}: {
  member: FactoryTeamMember;
  canEdit: boolean;
  onToggle: (perm: FactoryPermission) => void;
  onReset: () => void;
}) {
  const perms = memberPermissions(member);
  const isCustom = member.permissions != null && member.permissions.length > 0;
  const roleDefaults = ROLE_PERMISSIONS[member.role];

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-white/50">
          Actions {isCustom ? '(custom)' : '(from role)'}
        </p>
        {isCustom && canEdit ? (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Reset to role defaults
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ACTION_PERMS.map((perm) => {
          const on = perms.includes(perm);
          const roleHas = roleDefaults.includes(perm);
          return (
            <button
              key={perm}
              type="button"
              disabled={!canEdit}
              onClick={() => onToggle(perm)}
              title={roleHas ? 'Included in role by default' : 'Not in role by default'}
              className={cn(
                'rounded-lg border px-2 py-1 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                on
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-100'
                  : 'border-white/10 text-white/35',
              )}
            >
              {FACTORY_PERMISSION_LABEL[perm]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ManufacturerTeam() {
  const [tick, setTick] = useState(0);
  const ws = getFactoryWorkspace();
  const acting = getActingFactoryMember();
  const canManage = memberHasPermission(acting, 'manage_team');
  void tick;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FactoryTeamRole>('quoter');
  const [pendingRole, setPendingRole] = useState<{
    memberId: string;
    memberName: string;
    next: FactoryTeamRole;
  } | null>(null);
  const [inviteConfirmOpen, setInviteConfirmOpen] = useState(false);

  const invite = () => {
    if (!canManage) {
      toast.error('You need Manage team permission');
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email required');
      return;
    }
    setInviteConfirmOpen(true);
  };

  const commitInvite = () => {
    inviteTeamMember({ name, email, role });
    setName('');
    setEmail('');
    setTick((n) => n + 1);
    toast.success('Invite sent (mock)');
  };

  const togglePerm = (member: FactoryTeamMember, perm: FactoryPermission) => {
    if (!canManage) {
      toast.error('You need Manage team permission');
      return;
    }
    const current = new Set(memberPermissions(member));
    if (current.has(perm)) current.delete(perm);
    else current.add(perm);
    updateTeamMemberPermissions(member.id, [...current] as FactoryPermission[]);
    setTick((n) => n + 1);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <Users className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Access</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Team & roles
        </h1>
        <p className="mt-1 text-sm text-white/45">
          Permissions map to real actions (quote, decline, shipping, materials) — not just role
          labels. Acting as {acting.name} ({factoryRoleLabel(acting.role)}).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4">
            <p className="text-sm font-semibold text-white">{factoryRoleLabel(r)}</p>
            <p className="mt-1 text-[11px] text-white/40">{ROLE_HELP[r]}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {ROLE_PERMISSIONS[r].slice(0, 4).map((p) => (
                <span
                  key={p}
                  className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/45"
                >
                  {FACTORY_PERMISSION_LABEL[p]}
                </span>
              ))}
              {ROLE_PERMISSIONS[r].length > 4 ? (
                <span className="text-[9px] text-white/30">+{ROLE_PERMISSIONS[r].length - 4}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
        <h2 className="text-sm font-semibold text-white">People</h2>
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {ws.team.map((member) => (
            <li key={member.id} className="py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {member.name}
                    {member.id === acting.id ? (
                      <span className="ml-2 text-[10px] font-normal text-[#CC2D24]">you</span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-white/40">
                    {member.email} · {member.status}
                  </p>
                </div>
                <Select
                  value={member.role}
                  disabled={!canManage}
                  onValueChange={(v) => {
                    const next = v as FactoryTeamRole;
                    if (next === member.role) return;
                    setPendingRole({
                      memberId: member.id,
                      memberName: member.name,
                      next,
                    });
                  }}
                >
                  <SelectTrigger className="w-full border-white/15 bg-white/5 text-white sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {factoryRoleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PermissionMatrix
                member={member}
                canEdit={canManage}
                onToggle={(perm) => togglePerm(member, perm)}
                onReset={() => {
                  resetTeamMemberPermissions(member.id);
                  setTick((n) => n + 1);
                  toast.success('Permissions reset to role');
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5">
        <h2 className="text-sm font-semibold text-white">Invite teammate</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-white/45">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label className="text-white/45">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 border-white/15 bg-white/5 text-white"
            />
          </div>
          <div>
            <Label className="text-white/45">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as FactoryTeamRole)}>
              <SelectTrigger className="mt-1 border-white/15 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {factoryRoleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-4 bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90"
          onClick={invite}
          disabled={!canManage}
        >
          Send invite
        </Button>
      </section>

      <p className="text-[11px] text-white/30">
        All permissions: {ALL_FACTORY_PERMISSIONS.map((p) => FACTORY_PERMISSION_LABEL[p]).join(' · ')}
      </p>

      <ConfirmDialog
        open={pendingRole != null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
        title="Change team role?"
        description={
          pendingRole
            ? `Set ${pendingRole.memberName} to ${factoryRoleLabel(pendingRole.next)}. Custom action overrides will reset to that role’s defaults.`
            : ''
        }
        confirmLabel="Confirm role"
        onConfirm={() => {
          if (!pendingRole) return;
          updateTeamMemberRole(pendingRole.memberId, pendingRole.next);
          setTick((n) => n + 1);
          toast.success('Role updated');
        }}
      />

      <ConfirmDialog
        open={inviteConfirmOpen}
        onOpenChange={setInviteConfirmOpen}
        title="Send team invite?"
        description={`Invite ${name.trim() || 'this person'} as ${factoryRoleLabel(role)} (${email.trim() || 'no email'}).`}
        confirmLabel="Send invite"
        onConfirm={commitInvite}
      />
    </div>
  );
}
