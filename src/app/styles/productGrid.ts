import type { CSSProperties } from 'react';

/** Shared layout tokens for catalog, drafts, and dashboard product tiles */
export const productGridClass =
  'grid gap-3 sm:gap-4 md:gap-5';

export const productGridStyle: CSSProperties = {
  /** One column on typical phones; 2+ from ~560px+ */
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
};

export const productCardShellClass =
  'group overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113] transition-all duration-200 hover:border-white/[0.14]';

export const productCardImageAreaClass =
  'relative aspect-[3/2] overflow-hidden bg-[#0a0a0b]';
