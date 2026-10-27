import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';

export function DeleteRecordButton({ label, description, onDelete, disabled = false }: {
  label: string;
  description: string;
  onDelete: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete();
      toast.success(`${label} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Deletion failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button type="button" disabled={disabled || busy} aria-label={`Delete ${label}`} title={`Delete ${label}`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={(event) => { event.preventDefault(); setOpen(true); }}>
        <Trash2 className="h-3.5 w-3.5" /> {busy ? 'Deleting…' : 'Delete'}
      </button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={`Delete ${label}?`} description={description}
        tone="danger" confirmLabel="Delete" onConfirm={() => { void remove(); }} />
    </span>
  );
}
