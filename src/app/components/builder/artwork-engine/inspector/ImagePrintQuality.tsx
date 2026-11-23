import { useEffect, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { isVectorImage, printQuality, TARGET_PPI } from '../image/printQuality';
import './image-tools.css';

const LABEL = { sharp: 'Sharp', good: 'Good', soft: 'Soft', low: 'Low' };

/** Live print sharpness at the size on the garment. */
export function ImagePrintQuality({ element, unitsPerCm, update }: { element: DesignElement; unitsPerCm: number; update: (patch: Partial<DesignElement>) => void }) {
  const [natural, setNatural] = useState<{ source: string; width: number; height: number }>(), vector = isVectorImage(element.content);
  useEffect(() => {
    if (vector) return;
    let live = true; const image = new Image();
    image.onload = () => { if (live) setNatural({ source: element.content, width: image.naturalWidth, height: image.naturalHeight }); };
    image.src = element.content;
    return () => { live = false; };
  }, [element.content, vector]);
  if (vector) return <div className="cx-print-quality" data-grade="sharp"><i /><strong>Vector</strong><span>Sharp at any size</span></div>;
  if (natural?.source !== element.content || !natural.width) return null;
  const quality = printQuality(natural.width, natural.height, element.width, element.height, unitsPerCm);
  return <div className="cx-print-quality" data-grade={quality.grade} role="status">
    <i /><strong>{LABEL[quality.grade]}</strong><span>{quality.ppi} ppi at {quality.widthCm.toFixed(1)} × {quality.heightCm.toFixed(1)} cm</span>
    {quality.fitScale < 1 && !element.locked && <button type="button" title={`Resize to ${TARGET_PPI} ppi`} onClick={() => update({ width: element.width * quality.fitScale, height: element.height * quality.fitScale })}>Fix</button>}
  </div>;
}
