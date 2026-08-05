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
  onDelete,
  onDuplicate,
  variant = 'footer',
  className,
}: ProjectActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${projectName}`}
          className={cn(
            variant === 'overlay'
              ? 'flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75'
              : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/45 transition-colors hover:bg-white/10 hover:text-white',
            className,
          )}
        >
          <MoreVertical className={variant === 'overlay' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] border-white/10 bg-[#161618] text-white shadow-xl"
      >
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-white">
          <Link to={openTo}>
            <ExternalLink className="h-3.5 w-3.5" />
            {openLabel}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() => {
            onDuplicate?.();
            toast.success(`Duplicated “${projectName}”`);
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() => toast.message(`Rename “${projectName}” — coming soon`)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={() => toast.success(`Mock: tech pack export queued for “${projectName}”`)}
        >
          <Download className="h-3.5 w-3.5" />
          Export tech pack
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className="cursor-pointer text-red-300 focus:bg-red-500/15 focus:text-red-200"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
