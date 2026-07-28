import type { CSSProperties } from 'react';

/** Shared layout tokens for catalog, drafts, and dashboard product tiles */
export const productGridClass =
  'grid gap-3 sm:gap-4 md:gap-5';

export const productGridStyle: CSSProperties = {
  /** One column on typical phones; 2+ from ~520px+ */
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
};

export const productCardShellClass =
  'group overflow-hidden rounded-[6px] border border-[#252528] bg-[#161618] transition-all duration-200 hover:border-[#333338]';

export const productCardImageAreaClass =
  'relative aspect-[3/2] overflow-hidden bg-[#111113]';
