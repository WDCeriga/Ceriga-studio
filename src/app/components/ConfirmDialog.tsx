import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { cn } from './ui/utils';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use for destructive / irreversible actions */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
};

/**
 * Caution dialog for high-stakes changes (plans, roles, publish, reject, etc.).
 * Prefer this over immediate mutation for anything that affects money, access, or live status.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/10 bg-[#141414] text-white shadow-2xl shadow-black/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-white/55">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              tone === 'danger'
                ? 'bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90'
                : 'bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90',
            )}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
