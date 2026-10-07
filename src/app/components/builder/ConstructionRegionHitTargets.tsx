import { useState } from 'react';
import { useMaterialDrop, type MaterialDropHandler } from './materialDrop';

interface RegionTarget {
  id: string;
  label: string;
  path: string;
  editableIndependently: boolean;
  zIndex: number;
}

function ConstructionTarget({ region, selectedId, onSelect, onMaterialDrop }: {
  region: RegionTarget; selectedId?: string | null; onSelect?: (id: string) => void; onMaterialDrop?: MaterialDropHandler;
}) {
  const [hovered, setHovered] = useState(false);
  const { dragHovered, handlers } = useMaterialDrop(region.id, onMaterialDrop);
  const active = region.id === selectedId;
  return <path d={region.path} fillRule="evenodd" data-construction-region-hit={region.id}
    fill={active || hovered || dragHovered ? '#38bdf84d' : 'transparent'}
    stroke={active || hovered || dragHovered ? '#38bdf8' : 'none'} strokeWidth={2}
    pointerEvents="fill" role="button" tabIndex={0} aria-label={`Select ${region.label}`} aria-pressed={active}
    className="cursor-pointer" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    {...handlers} onPointerDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); onSelect?.(region.id); }}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect?.(region.id); }
    }}><title>{region.label}</title></path>;
}

export function ConstructionRegionHitTargets({ regions, selectedId, onSelect, onMaterialDrop }: {
  regions: RegionTarget[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMaterialDrop?: MaterialDropHandler;
}) {
  return <svg viewBox="0 0 2048 2048" aria-label="Construction region selection"
    className="pointer-events-none absolute inset-0 z-[201] h-full w-full">
    {[...regions].sort((a, b) => a.zIndex - b.zIndex).filter(region => region.editableIndependently).map(region =>
      <ConstructionTarget key={region.id} region={region} selectedId={selectedId} onSelect={onSelect} onMaterialDrop={onMaterialDrop} />)}
  </svg>;
}
