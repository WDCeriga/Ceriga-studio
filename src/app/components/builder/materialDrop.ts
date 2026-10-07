import { useState, type DragEvent } from 'react';

export const MATERIAL_DRAG_TYPE = 'application/x-ceriga-material';
export type MaterialDrop = { kind: 'colour'; colour: string } | { kind: 'fabric'; fabricId: string };
export type MaterialDropHandler = (partId: string, material: MaterialDrop) => void;

export function readMaterialDrop(transfer: Pick<DataTransfer, 'getData'>): MaterialDrop | undefined {
  try {
    const value = JSON.parse(transfer.getData(MATERIAL_DRAG_TYPE));
    if (value?.kind === 'colour' && /^#[\da-f]{6}$/i.test(value.colour)) return { kind: 'colour', colour: value.colour };
    if (value?.kind === 'fabric' && typeof value.fabricId === 'string' && /^[a-z0-9-]+$/.test(value.fabricId)) return { kind: 'fabric', fabricId: value.fabricId };
  } catch { /* External drags are not material assignments. */ }
  return undefined;
}

export function useMaterialDrop(partId: string, onDrop?: MaterialDropHandler) {
  const [dragHovered, setDragHovered] = useState(false);
  return {
    dragHovered,
    handlers: {
      onDragOver: (event: DragEvent<Element>) => {
        if (!onDrop || !event.dataTransfer.types.includes(MATERIAL_DRAG_TYPE)) return;
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setDragHovered(true);
      },
      onDragLeave: () => setDragHovered(false),
      onDrop: (event: DragEvent<Element>) => {
        setDragHovered(false);
        if (!onDrop) return;
        const material = readMaterialDrop(event.dataTransfer);
        if (!material) return;
        event.preventDefault(); event.stopPropagation(); onDrop(partId, material);
      },
    },
  };
}
