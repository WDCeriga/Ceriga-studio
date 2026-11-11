import type { FormEvent, ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

type AddTeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  disabled?: boolean;
  error?: string;
  fieldClass: string;
  buttonClass: string;
  name: string;
  onName: (name: string) => void;
  email: string;
  onEmail: (email: string) => void;
  roleControl: ReactNode;
  permissions: string[];
};

export function AddTeamMemberDialog(props: AddTeamMemberDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={open => { if (!props.busy) props.onOpenChange(open); }}>
      <DialogContent className="team-dialog border-neutral-200 bg-white text-neutral-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>Ceriga emails an invitation with instructions to activate access.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={props.onSubmit}>
          <label className="block text-sm">Full name
            <input required autoComplete="name" maxLength={100} disabled={props.busy} value={props.name}
              onChange={event => props.onName(event.target.value)} className={props.fieldClass} />
          </label>
          <label className="block text-sm">Email
            <input required type="email" autoComplete="email" maxLength={254} disabled={props.busy} value={props.email}
              onChange={event => props.onEmail(event.target.value)} className={props.fieldClass} />
          </label>
          <label className="block text-sm">Role{props.roleControl}</label>
          <div className="rounded-md bg-neutral-100 p-3 text-xs text-neutral-700">
            <p className="mb-1 font-semibold">Permission preview</p>
            <p>{props.permissions.length ? props.permissions.join(' · ') : 'No permissions selected'}</p>
          </div>
          {props.error && <p role="alert" className="text-sm text-red-800">{props.error}</p>}
          <button type="submit" className={props.buttonClass}
            disabled={props.busy || props.disabled || !props.name.trim()}>{props.busy ? 'Sending invitation…' : 'Add Member'}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
