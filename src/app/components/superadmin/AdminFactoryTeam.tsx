import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { teamRoleNames } from '../../lib/factoryTeam';
import { workerRpc } from '../../lib/platformWorkers';

type TeamRecord = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  added: string;
  lastActive?: string | null;
  delivery?: string;
  revision: number;
};
type FactoryTeam = {
  factoryName: string;
  canManage: boolean;
  roles: { id: string; name: string }[];
  members: TeamRecord[];
  invitations: TeamRecord[];
};

export function AdminFactoryTeam({ factoryId }: { factoryId: string }) {
  useCerigaTranslation();

  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<FactoryTeam | null>(null);
  const [error, setError] = useState('');
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [change, setChange] = useState<{ member: TeamRecord; role?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setTeam(null);
    setError('');
    void workerRpc('admin_factory_team', { p_factory: factoryId })
      .then(result => { if (current) setTeam(result); })
      .catch(cause => { if (current) setError((cause as Error).message); });
    return () => { current = false; };
  }, [factoryId, open, revision]);

  const roles = { ...teamRoleNames, ...Object.fromEntries((team?.roles || []).map(role => [role.id, role.name])) };
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString(cerigaLocale()) : '—';

  async function applyChange() {
    if (!change || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await workerRpc('admin_change_factory_team', {
        p_factory: factoryId, p_member: change.member.id, p_revision: change.member.revision,
        p_role: change.role ?? null, p_remove: !change.role,
      });
      setChange(null);
      refresh(value => value + 1);
    } catch (cause) {
      setChange(null);
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)}
      className="rounded-lg border border-neutral-200 bg-white p-4 text-neutral-900">
      <summary className="cursor-pointer font-semibold">{cerigaTranslate("interface.text_b1608bf933dc485b")}</summary>
      {open && !team && !error && <p role="status" className="mt-3 text-sm">{cerigaTranslate("interface.text_c28a60372eb73ed1")}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{cerigaTranslateLabel(error)} <button className="underline" onClick={() => refresh(value => value + 1)}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button></p>}
      {open && team && <>
        <p className="mt-3 text-sm text-neutral-600">{team.factoryName}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr>{['Name / email', 'Role', 'Status', 'Date added', 'Last activity', 'Actions'].map(label =>
              <th key={label} scope="col" className="p-2 text-xs text-neutral-600">{cerigaTranslateLabel(label)}</th>)}</tr></thead>
            <tbody>
              {team.members.map(member => (
                <tr key={member.id} className="border-t border-neutral-200">
                  <td className="p-2">{member.name || member.email}<p className="break-all text-xs text-neutral-600">{member.email}</p></td>
                  <td className="p-2">{team.canManage && member.role !== 'owner' && member.status === 'Active'
                    ? <select aria-label={cerigaTranslate("interface.text_2b73582609ed5f50",{value0:(member.email)})} className="rounded border border-neutral-300 p-1" disabled={busy}
                        value={member.role} onChange={event => setChange({ member, role: event.target.value })}>
                        {Object.entries(roles).filter(([key]) => key !== 'owner').map(([key, label]) => <option key={key} value={key}>{cerigaTranslateLabel(label)}</option>)}
                      </select>
                    : roles[member.role] ?? member.role}</td>
                  <td className="p-2">{cerigaTranslateLabel(member.status)}</td>
                  <td className="p-2">{date(member.added)}</td>
                  <td className="p-2">{date(member.lastActive)}</td>
                  <td className="p-2">{team.canManage && member.role !== 'owner' && member.status === 'Active' &&
                    <button className="text-red-800 underline" disabled={busy} onClick={() => setChange({ member })}>{cerigaTranslate("interface.text_c3812fc4acb861d5")}</button>}</td>
                </tr>
              ))}
              {team.invitations.filter(invite => invite.status !== 'Accepted').map(invite => (
                <tr key={invite.id} className="border-t border-neutral-200">
                  <td className="p-2">{invite.name || invite.email}{invite.name && <p className="break-all text-xs text-neutral-600">{invite.email}</p>}</td>
                  <td className="p-2">{roles[invite.role] ?? invite.role}</td>
                  <td className="p-2">{cerigaTranslateLabel(invite.status)}{invite.delivery === 'failed' && <p className="text-xs text-red-800">{cerigaTranslate("interface.text_1e75ab69d45f2176")}</p>}</td>
                  <td className="p-2">{date(invite.added)}</td><td className="p-2">—</td><td className="p-2">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!team.members.length && !team.invitations.length && <p className="mt-3 text-sm">{cerigaTranslate("interface.text_45ee1177efe62e79")}</p>}
      </>}
      <ConfirmDialog open={!!change} onOpenChange={next => { if (!next && !busy) setChange(null); }}
        title={change?.role ? cerigaTranslate("interface.text_ec0fa60caf9e6e19") : cerigaTranslate("interface.text_b641108a03d0dc8c")}
        description={change ? cerigaTranslate("interface.text_bc9bd6f8647e9250",{value0:(change.member.email)}) : ''}
        onConfirm={() => void applyChange()} />
    </details>
  );
}
