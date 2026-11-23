import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
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
  useCerigaTranslation();

  return (
    <Dialog open={props.open} onOpenChange={open => { if (!props.busy) props.onOpenChange(open); }}>
      <DialogContent className="team-dialog border-neutral-200 bg-white text-neutral-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cerigaTranslate("interface.text_279ff6cfe4906f62")}</DialogTitle>
          <DialogDescription>{cerigaTranslate("interface.text_3f10efdaaabcae21")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={props.onSubmit}>
          <label className="block text-sm">{cerigaTranslate("interface.text_f13a64ba2fea87ef")}<input required autoComplete="name" maxLength={100} disabled={props.busy} value={props.name}
              onChange={event => props.onName(event.target.value)} className={props.fieldClass} />
          </label>
          <label className="block text-sm">{cerigaTranslate("authentication.email")}<input required type="email" autoComplete="email" maxLength={254} disabled={props.busy} value={props.email}
              onChange={event => props.onEmail(event.target.value)} className={props.fieldClass} />
          </label>
          <label className="block text-sm">{cerigaTranslate("interface.text_14736a2eb9f4159f")}{props.roleControl}</label>
          <div className="rounded-md bg-neutral-100 p-3 text-xs text-neutral-700">
            <p className="mb-1 font-semibold">{cerigaTranslate("interface.text_2c8fad6e9bbaf945")}</p>
            <p>{props.permissions.length ? props.permissions.join(' · ') : cerigaTranslate("interface.text_f9a5d30de154b104")}</p>
          </div>
          {props.error && <p role="alert" className="text-sm text-red-800">{props.error}</p>}
          <button type="submit" className={props.buttonClass}
            disabled={props.busy || props.disabled || !props.name.trim()}>{props.busy ? cerigaTranslate("interface.text_04bbb6e0c246d818") : cerigaTranslate("interface.text_e7d80d8f7fda36dc")}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
