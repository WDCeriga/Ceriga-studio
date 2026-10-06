import React from 'react';
import '../../src/styles/index.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { GarmentDetailsPanel, GarmentDetailsOverlay, type DetailEditorState } from '../../src/app/components/builder/GarmentDetails';
import { createOpening } from '../../src/app/data/garmentOpenings';
import { createGarmentDetail, type DetailBounds, type GarmentDetail } from '../../src/app/data/garmentDetails';

export function verifyOpeningControls(bounds: DetailBounds) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;width:360px';
  document.body.append(host);
  const root = createRoot(host);
  const checks: string[] = [];
  let details: GarmentDetail[] = [{ ...createGarmentDetail('zip', [], '#514980', 'zip-01'), view: 'front' }];
  const original = JSON.stringify(details);
  let selectedId: string | null = details[0].id;
  let stage: DetailEditorState['openingStage'] = 'final';
  let openingSnap = false;
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); checks.push(message); };
  const render = () => flushSync(() => root.render(<GarmentDetailsPanel details={details} selectedId={selectedId} color="#514980" bounds={bounds} referenceWidthCm={50}
    onSelect={id => { selectedId = id; render(); }} onChange={next => { details = next; render(); }}
    editor={{ part: 'zip', closeUp: false, onPartChange: () => {}, onCloseUpChange: () => {}, openingStage: stage,
      onOpeningStageChange: next => { stage = next; render(); }, openingSnap,
      onOpeningSnapChange: next => { openingSnap = next; render(); } }} />));
  const click = (text: string) => {
    const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === text);
    if (!button) throw new Error(`Missing button: ${text}`);
    flushSync(() => button.click());
  };
  try {
    render();
    check(JSON.stringify(details) === original && !details[0].opening, 'Legacy zip is unchanged when panel opens');
    click('Convert to constructed opening');
    check(Boolean(details[0].opening), 'Explicit conversion creates saved construction');
    check(details[0].fill === '#514980' && details[0].view === 'front', 'Conversion preserves tape colour and view');
    check(host.querySelectorAll('input[aria-label^="Opening start"],input[aria-label^="Opening end"]').length === 4, 'Both endpoints expose independent coordinate controls');
    check(Boolean(host.querySelector('[data-opening-status]')), 'Construction status is visible');
    const snap = host.querySelector<HTMLInputElement>('input[aria-label="Snap opening to guides"]');
    check(snap && !snap.checked, 'Constructed openings start with guide snapping off');
    const beforeSnap = JSON.stringify(details);
    flushSync(() => snap!.click());
    check(openingSnap && JSON.stringify(details) === beforeSnap, 'Guide snapping is opt-in editor state, not a garment edit');
    click('Open zip fully');
    check(details[0].zipSliderPosition === 1 && host.querySelector('input[aria-label="Zip opening"]')?.getAttribute('aria-valuetext') === '100% open', 'Open fully updates the same slider state as pull dragging');
    check(!host.querySelector('input[aria-label="Zip pull position"]'), 'Constructed zips expose one unified opening control');
    check(JSON.parse(JSON.stringify(details))[0].zipSliderPosition === 1, 'Open amount survives project serialization');
    click('Slightly open');
    check(details[0].zipSliderPosition === .22, 'Slightly open uses the shared slider position');
    click('More open');
    check(details[0].zipSliderPosition === .55, 'More open uses the shared slider position');
    click('Close zip');
    check(details[0].zipSliderPosition === 0, 'Close zip restores the closed slider position');
    const saved = JSON.stringify(details);
    for (const label of ['Before', 'Opening path', 'Reconstructed', 'Final zip']) click(label);
    check(stage === 'final' && JSON.stringify(details) === saved, 'Stage inspection never changes saved garment state');
    const restored = JSON.parse(saved) as GarmentDetail[];
    details = restored;
    render();
    check(JSON.stringify(details) === saved, 'JSON project round trip preserves construction');
    click('Reset opening');
    check(Boolean(details[0].opening), 'Reset retains a constructed opening');
    click('Remove opening; keep overlay');
    check(!details[0].opening && details[0].id === restored[0].id, 'Removing the modifier preserves the original trim identity');
    const add = host.querySelector<HTMLButtonElement>('button[aria-label="Add Zip 02: Slim pull"]');
    if (!add) throw new Error('Missing new zip option');
    flushSync(() => add.click());
    check(details.length === 2 && Boolean(details[1].opening), 'New zips use construction without migrating older overlays');
    return { passed: checks.length, checks };
  } finally {
    flushSync(() => root.unmount());
    host.remove();
  }
}

export async function verifyOpeningDragCommit(bounds: DetailBounds) {
  const fixture = mountOpeningDragFixture(bounds);
  const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    await tick();
    const button = document.querySelector<HTMLButtonElement>('[data-opening-drag-fixture] button[aria-label$="on garment"]')!;
    button.setPointerCapture = () => {};
    const box = button.getBoundingClientRect();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const event = (type: string, dx: number, dy: number) => button.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 17, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x + dx, clientY: y + dy,
    }));
    const before = fixture.getState();
    event('pointerdown', 0, 0);
    event('pointermove', 60, 30);
    await tick();
    const during = fixture.getState();
    if (!during.draft || during.commits.length) throw new Error('Drag preview did not remain an uncommitted draft');
    event('pointerup', 60, 30);
    await tick();
    const after = fixture.getState();
    if (after.commits.length !== 1 || after.draft !== null || JSON.stringify(after.details[0].opening) !== JSON.stringify(during.draft.opening)
      || JSON.stringify(after.details[0].opening) === JSON.stringify(before.details[0].opening)) throw new Error('Live draft props prevented the drag from committing');
    return { draftFeedbackCommit: true, commits: after.commits.length };
  } finally { fixture.unmount(); }
}

export function mountOpeningDragFixture(bounds: DetailBounds) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#202023;overflow:auto';
  document.body.append(host);
  const root = createRoot(host);
  let details = [createOpening({ ...createGarmentDetail('zip', [], '#514980', 'zip-01'), view: 'front' }, bounds, 'neckline')];
  let selectedId: string | null = details[0].id;
  let draft: GarmentDetail | null = null;
  let part: DetailEditorState['part'] = 'zip';
  let openingSnap = false;
  let draftUpdates = 0;
  const commits: GarmentDetail[][] = [];
  const render = () => {
    const editor: DetailEditorState = {
      part, closeUp: false, onPartChange: next => { part = next; render(); }, onCloseUpChange: () => {},
      draft, onDraftChange: next => { draft = next; if (next) draftUpdates++; render(); },
      openingSnap, onOpeningSnapChange: next => { openingSnap = next; render(); },
    };
    const onChange = (next: GarmentDetail[]) => { details = next; commits.push(structuredClone(next)); render(); };
    const onSelect = (next: string | null) => { selectedId = next; render(); };
    root.render(<div style={{ display: 'flex', gap: 20, padding: 60, minWidth: 1000, height: '100%', boxSizing: 'border-box' }}>
      <div data-opening-drag-fixture="" style={{ width: 640, height: 640, position: 'relative', flexShrink: 0, background: '#eeeeee' }}>
        <GarmentDetailsOverlay details={details.map(detail => draft?.id === detail.id ? draft : detail)} bounds={bounds} selectedId={selectedId} onSelect={onSelect} onChange={onChange} editor={editor} />
      </div>
      <div style={{ width: 320, overflow: 'auto' }}><GarmentDetailsPanel details={details} bounds={bounds} selectedId={selectedId} onSelect={onSelect} onChange={onChange} editor={editor} color="#514980" referenceWidthCm={50} /></div>
    </div>);
  };
  flushSync(render);
  return {
    getState: () => structuredClone({ details, draft, draftUpdates, commits, openingSnap }),
    unmount: () => { flushSync(() => root.unmount()); host.remove(); },
  };
}
