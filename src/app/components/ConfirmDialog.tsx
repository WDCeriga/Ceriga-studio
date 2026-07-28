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
      <AlertDialogContent className="border-[#252528] bg-[#161618] text-[#F0EEEE] shadow-2xl shadow-black/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#F0EEEE]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[#8A8A90]">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-[#3A3A40] bg-transparent text-[#F0EEEE] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              'bg-[#CC2D24] text-white hover:bg-[#E5534A]',
              tone === 'danger' && 'bg-[#CC2D24]',
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
