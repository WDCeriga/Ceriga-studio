import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { Link } from 'react-router';
import {
  Copy,
  Download,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from './ui/utils';

type ProjectActionsMenuProps = {
  projectName: string;
  openTo: string;
  openLabel?: string;
  /** Builder URL used by “Export tech pack” (opens the review step where the real PDF export lives). */
  exportTo?: string;
  onDelete: () => void;
  onDuplicate?: () => void;
  /** Visual variant for trigger placement */
  variant?: 'footer' | 'overlay';
  className?: string;
};

export function ProjectActionsMenu({
  projectName,
  openTo,
  openLabel = 'Open',
  exportTo,
  onDelete,
  onDuplicate,
  variant = 'footer',
  className,
}: ProjectActionsMenuProps) {
  useCerigaTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={cerigaTranslate("interface.text_7025f2de2cf460e7",{value0:(projectName)})}
          className={cn(
            variant === 'overlay'
              ? 'flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75'
              : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#252528] bg-white/[0.04] text-white/45 transition-colors hover:bg-white/10 hover:text-white',
            className,
          )}
        >
          <MoreVertical className={variant === 'overlay' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] border-[#252528] bg-[#161618] text-white shadow-xl"
      >
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-white">
          <Link to={openTo}>
            <ExternalLink className="h-3.5 w-3.5" />
            {cerigaTranslateLabel(openLabel)}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() => {
            onDuplicate?.();
            toast.success(cerigaTranslate("interface.text_e07815049c8e79c6",{value0:(projectName)}));
          }}
        >
          <Copy className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_02cdaabfca805d6a")}</DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() => toast.message(cerigaTranslate("interface.text_bb855ff38ce57f18",{value0:(projectName)}))}
        >
          <Pencil className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_3064d79a295cefe4")}</DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-white">
          <Link
            to={exportTo ?? `${openTo.replace(/\/$/, '')}${openTo.includes('?') ? '&' : '?'}step=13`}
          >
            <Download className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_3a644098e973d323")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className="cursor-pointer text-red-300 focus:bg-red-500/15 focus:text-red-200"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />{cerigaTranslate("common.delete")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
