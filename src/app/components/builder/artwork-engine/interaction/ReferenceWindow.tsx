import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ImagePlus, Replace, X } from 'lucide-react';
import { clampReferenceFrame, getReference, setReference, useReference } from '../state/studioReference';
import './reference-window.css';

async function prepareImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const width = image.naturalWidth || 800, height = image.naturalHeight || 800, fit = Math.min(1, 1400 / Math.max(width, height)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * fit)); canvas.height = Math.max(1, Math.round(height * fit));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { image: canvas.toDataURL('image/webp', .86), aspect: width / Math.max(1, height), name: file.name };
  } finally { URL.revokeObjectURL(url); }
}

export function ReferenceToggle() {
  const reference = useReference();
  return <button type="button" className="cx-dock-toggle" aria-pressed={reference.open} title="Reference image" onClick={() => setReference({ open: !reference.open })}>Reference</button>;
}

/** Floats over the canvas area, outside the artboard, so it is never saved or printed. */
export function ReferenceWindow() {
  const reference = useReference(), host = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), [error, setError] = useState(''), [over, setOver] = useState(false);
  // The Builder UI is scaled, so pointer travel is converted to the window's own units.
  const area = () => { const parent = host.current?.parentElement; if (!parent) return undefined; return { width: parent.clientWidth, height: parent.clientHeight, scale: parent.getBoundingClientRect().width / Math.max(1, parent.offsetWidth) || 1 }; };
  useEffect(() => {
    if (!reference.open) return;
    const fit = () => { const box = area(); if (box) { const now = getReference(), next = clampReferenceFrame(now, box.width, box.height); if (next.x !== now.x || next.y !== now.y || next.width !== now.width) setReference(next); } };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [reference.open]);
  if (!reference.open) return null;
  const load = async (file?: File) => {
    if (!file) return;
    setError('');
    try { if (!setReference({ ...await prepareImage(file) })) setError('Too large to remember after reload.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'That image could not be opened.'); }
  };
  const gesture = (event: ReactPointerEvent, kind: 'move' | 'resize') => {
    if (event.button !== 0 || (event.target as Element).closest('button,input')) { if (kind === 'move') return; }
    event.preventDefault(); event.stopPropagation();
    const box = area(); if (!box) return;
    const start = { px: event.clientX, py: event.clientY, x: reference.x, y: reference.y, width: reference.width }, id = event.pointerId;
    const move = (next: PointerEvent) => { if (next.pointerId !== id) return; const dx = (next.clientX - start.px) / box.scale, dy = (next.clientY - start.py) / box.scale; setReference(clampReferenceFrame(kind === 'move' ? { x: start.x + dx, y: start.y + dy, width: start.width } : { x: start.x, y: start.y, width: start.width + dx }, box.width, box.height)); };
    const end = (next: PointerEvent) => { if (next.pointerId !== id) return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };
  const drop = (event: DragEvent) => { if (!event.dataTransfer.files.length) return; event.preventDefault(); event.stopPropagation(); setOver(false); void load(event.dataTransfer.files[0]); };
  return <div ref={host} data-editor-chrome data-reference-window className={`cx-reference${over ? ' is-over' : ''}`} role="dialog" aria-label="Reference image" style={{ left: reference.x, top: reference.y, width: reference.width }} onPointerDown={event => event.stopPropagation()} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={drop}>
    <header onPointerDown={event => gesture(event, 'move')}><strong title={reference.name || 'Reference'}>{reference.name || 'Reference'}</strong>{reference.image && <button type="button" aria-label="Replace reference image" title="Replace" onClick={() => input.current?.click()}><Replace size={14} /></button>}<button type="button" aria-label="Close reference" title="Close" onClick={() => setReference({ open: false })}><X size={15} /></button></header>
    <input ref={input} hidden type="file" accept="image/*" aria-label="Reference image file" onChange={(event: ChangeEvent<HTMLInputElement>) => { void load(event.target.files?.[0]); event.target.value = ''; }} />
    {reference.image ? <><div className="cx-reference-image" style={{ aspectRatio: String(reference.aspect) }}><img src={reference.image} alt={reference.name || 'Reference'} draggable={false} style={{ opacity: reference.opacity / 100 }} /></div><label className="cx-reference-opacity"><span>Opacity</span><input type="range" aria-label="Reference opacity" min={20} max={100} value={reference.opacity} onChange={event => setReference({ opacity: Number(event.target.value) })} /><output>{reference.opacity}%</output></label></> : <button type="button" className="cx-reference-empty" onClick={() => input.current?.click()}><ImagePlus size={20} strokeWidth={1.6} /><span>Add an image</span><small>Or drop one here</small></button>}
    {error && <p role="alert">{error}</p>}
    <span className="cx-reference-resize" role="presentation" title="Resize" onPointerDown={event => gesture(event, 'resize')} />
  </div>;
}
