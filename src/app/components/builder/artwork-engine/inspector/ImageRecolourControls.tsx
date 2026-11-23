import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioRange } from '../../shell/StudioControls';
import { filteredImagePixels } from '../../../../lib/imageFilterRendering';
import { extractPalette, type ImageGrade } from '../image/grade';
import { revealImageTool, useImageTool } from '../state/imageTool';
import './image-tools.css';

/** Swap the colours in an image. Shading is kept and every colour stays editable. */
export function ImageRecolourControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const grade = element.imageGrade ?? {}, tool = useImageTool(), fold = useRef<HTMLDivElement>(null), [count, setCount] = useState(grade.recolour?.colours.length ?? 5), [palette, setPalette] = useState<string[]>([]), cutoutKey = JSON.stringify(grade.cutout ?? null);
  useEffect(() => {
    let live = true; const cutout = cutoutKey === 'null' ? undefined : JSON.parse(cutoutKey) as ImageGrade['cutout'];
    filteredImagePixels(element.content, { id: 'none' }, 96, cutout ? { cutout } : undefined).then(pixels => { if (live) setPalette(extractPalette(pixels.original, count)); }).catch(() => {});
    return () => { live = false; };
  }, [element.content, count, cutoutKey]);
  useEffect(() => { if (tool === 'recolour') { fold.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); revealImageTool(null); } }, [tool]);
  const saved = grade.recolour, rows = saved?.colours ?? palette.map(from => ({ from, to: from })), changed = rows.filter(row => row.from !== row.to).length;
  const write = (colours: { from: string; to: string }[]) => update({ imageGrade: { ...element.imageGrade, recolour: { colours, range: saved?.range ?? 70 } } });
  return <div ref={fold}><StudioFold title="Recolour" rowHeight={40} reveal={tool === 'recolour'} value={changed ? `${changed} changed` : 'Off'}>
    <div className="cx-recolour" role="group" aria-label="Image colours">
      {rows.map((row, index) => <div key={row.from + index} className="cx-recolour__row"><span style={{ background: row.from }} aria-hidden="true" /><ArrowRight size={13} aria-hidden="true" /><input type="color" aria-label={`New colour ${index + 1}`} value={row.to} onChange={event => write(rows.map((item, i) => i === index ? { ...item, to: event.target.value } : item))} /><code>{row.to.toUpperCase()}</code></div>)}
    </div>
    <StudioRange label="Colours found" min={2} max={8} value={count} unit="" onChange={value => { setCount(value); if (saved) update({ imageGrade: { ...element.imageGrade, recolour: undefined } }); }} />
    <StudioRange label="Colour range" min={15} max={160} value={saved?.range ?? 70} unit="" onChange={range => update({ imageGrade: { ...element.imageGrade, recolour: { colours: rows, range } } })} />
    {saved && <button type="button" className="artwork-reset" onClick={() => update({ imageGrade: { ...element.imageGrade, recolour: undefined } })}>Reset colours</button>}
  </StudioFold></div>;
}
