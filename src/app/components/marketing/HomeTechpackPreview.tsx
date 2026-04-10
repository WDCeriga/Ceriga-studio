import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { cn } from '../ui/utils';
import imgHoodie from 'figma:asset/e0dc3efd38af4977ac2c46a590f5ec2a037cce25.png';

const colours = [
  { id: 'forest', label: 'Forest', hex: '#3d4f3f' },
  { id: 'slate', label: 'Slate', hex: '#5c6b7a' },
  { id: 'sand', label: 'Sand', hex: '#c4b59d' },
  { id: 'black', label: 'Black', hex: '#1a1a1a' },
] as const;

const necks = [
  { id: 'crew', label: 'Crew' },
  { id: 'hood', label: 'Hood' },
  { id: 'zip', label: '1/4 zip' },
] as const;

const sleeves = [
  { id: 'longR', label: 'Long · Raglan' },
  { id: 'longS', label: 'Long · Set-in' },
  { id: 'short', label: 'Short' },
] as const;

const pocketsOpts = [
  { id: 'none', label: 'None' },
  { id: 'kangaroo', label: 'Kangaroo' },
  { id: 'side', label: 'Side' },
] as const;

type C = (typeof colours)[number]['id'];
type N = (typeof necks)[number]['id'];
type S = (typeof sleeves)[number]['id'];
type P = (typeof pocketsOpts)[number]['id'];

export function HomeTechpackPreview({
  className,
  compact = false,
}: {
  className?: string;
  /** Tighter layout for hero side-by-side (sm+) */
  compact?: boolean;
}) {
  const [colour, setColour] = useState<C>('forest');
  const [neck, setNeck] = useState<N>('hood');
  const [sleeve, setSleeve] = useState<S>('longR');
  const [pocket, setPocket] = useState<P>('kangaroo');

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[min(100%,380px)] min-[560px]:mx-0',
        compact
          ? 'max-w-[min(100%,360px)] min-[560px]:max-w-[min(100%,46vw)] sm:max-w-[min(100%,300px)] md:max-w-[min(100%,340px)] lg:max-w-[min(100%,400px)] xl:max-w-[min(100%,440px)]'
          : 'sm:max-w-[min(100%,440px)] lg:max-w-none',
        className,
      )}
    >
      <p
        className={cn(
          'mb-1.5 text-center text-[8px] font-bold uppercase tracking-[0.18em] text-white/40 min-[560px]:text-left sm:text-[9px]',
          compact && 'min-[560px]:mb-1',
        )}
      >
        Interactive preview
      </p>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0b] shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:rounded-[18px]',
          compact && 'sm:shadow-[0_16px_48px_rgba(0,0,0,0.45)]',
        )}
      >
        <div
          className={cn(
            'relative aspect-[4/5] w-full max-h-[min(52vh,300px)] sm:max-h-[min(56vh,380px)] md:max-h-[min(60vh,440px)] lg:aspect-[3/4] lg:max-h-[min(70vh,520px)]',
            compact &&
              'max-h-[min(44vh,220px)] sm:max-h-[min(50vh,240px)] md:max-h-[min(52vh,280px)] lg:max-h-[min(58vh,340px)] xl:max-h-[min(65vh,420px)]',
          )}
        >
          <img
            src={imgHoodie}
            alt="Hoodie preview"
            className="h-full w-full object-cover object-[center_15%]"
            width={480}
            height={600}
            loading="eager"
            decoding="async"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15"
            aria-hidden
          />
        </div>

        <div className={cn('border-t border-white/[0.06] bg-[#111113]/95 p-2.5 sm:p-3 md:p-4', compact && 'p-2 sm:p-2.5')}>
          <p className={cn('mb-1.5 text-[8px] font-bold uppercase tracking-wider text-white/35', compact && 'mb-1')}>
            Try a few choices
          </p>
          <div className={cn('space-y-2', compact && 'space-y-1.5 sm:space-y-2')}>
            <div>
              <span className={cn('mb-0.5 block text-[8px] text-white/40 sm:text-[9px]', compact && 'mb-0')}>
                Choose colour
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {colours.map(({ id, label, hex }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setColour(id)}
                    title={label}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:h-9 sm:w-9',
                      colour === id ? 'border-[#CC2D24] ring-2 ring-[#CC2D24]/35' : 'border-white/15 hover:border-white/30',
                    )}
                  >
                    <span
                      className="h-5 w-5 rounded-full sm:h-6 sm:w-6"
                      style={{ backgroundColor: hex }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={cn('mb-0.5 block text-[8px] text-white/40 sm:text-[9px]', compact && 'mb-0')}>
                Select neck / collar type
              </span>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {necks.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNeck(id)}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide transition-colors sm:rounded-lg sm:px-2 sm:py-1 sm:text-[9px]',
                      neck === id
                        ? 'border-[#CC2D24]/60 bg-[#CC2D24]/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/70',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={cn('mb-0.5 block text-[8px] text-white/40 sm:text-[9px]', compact && 'mb-0')}>
                Select sleeve
              </span>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {sleeves.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSleeve(id)}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide transition-colors sm:rounded-lg sm:px-2 sm:py-1 sm:text-[9px]',
                      sleeve === id
                        ? 'border-[#CC2D24]/60 bg-[#CC2D24]/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/70',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={cn('mb-0.5 block text-[8px] text-white/40 sm:text-[9px]', compact && 'mb-0')}>
                Pockets
              </span>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {pocketsOpts.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPocket(id)}
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide transition-colors sm:rounded-lg sm:px-2 sm:py-1 sm:text-[9px]',
                      pocket === id
                        ? 'border-[#CC2D24]/60 bg-[#CC2D24]/15 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white/70',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Link
            to="/catalog"
            className={cn(
              'mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#CC2D24] text-[9px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#CC2D24]/90 sm:mt-3 sm:h-9 sm:gap-1.5 sm:text-[10px]',
              compact && 'mt-2 h-8 text-[8px] sm:h-8 sm:text-[9px]',
            )}
          >
            Open full builder
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
