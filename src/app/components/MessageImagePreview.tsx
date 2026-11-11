import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';

type MessageImagePreviewProps = {
  url: string;
  name: string;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
};

export function MessageImagePreview({ url, name, className, imageClassName, children }: MessageImagePreviewProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={['cursor-zoom-in text-left', className].filter(Boolean).join(' ')}
          aria-label={`Expand image ${name}`}
        >
          <img src={url} alt={name} loading="lazy" className={imageClassName} />
          {children}
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[calc(100vw-1.5rem)] gap-3 border-neutral-700 bg-neutral-950 p-3 text-white sm:max-w-[min(72rem,calc(100vw-3rem))] sm:p-4 [&>button]:bg-neutral-800 [&>button]:p-2 [&>button]:text-white"
      >
        <DialogTitle className="min-h-9 break-all pr-12 text-sm leading-normal">{name}</DialogTitle>
        <img src={url} alt={name} className="mx-auto max-h-[75dvh] max-w-full rounded object-contain" />
      </DialogContent>
    </Dialog>
  );
}
