import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { getDefaultGarmentSelection } from '../../src/app/data/garmentSvgCatalog';

const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const pointer = (element: Element, type: string, pointerType = 'mouse') => {
  flushSync(() => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType, pointerId: 1, button: 0 })));
};
const key = (element: Element | Window, value: string) => {
  flushSync(() => element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: value })));
};

/** Run in a browser served by Vite; no DOM emulation or additional test packages needed. */
export async function verifyTshirtPreviewSelection() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;height:600px';
  document.body.append(host);
  const root = createRoot(host);
  let checks = 0;
  const check = (value: unknown, message: string) => { if (!value) throw new Error(message); checks++; };
  let changeContext: () => void = () => {};
  let showHemEditor: () => void = () => {};
  function Harness() {
    const [selected, setSelected] = useState<string | null>(null);
    const [context, setContext] = useState(0);
    const [hem, setHem] = useState(false);
    changeContext = () => setContext(value => value + 1);
    showHemEditor = () => setHem(true);
    return <TshirtSvgPreview garmentType="tshirt" fit="regular" detailView="front"
      color="#d7b594" selection={getDefaultGarmentSelection('tshirt', 'regular')}
      selectedLayerId={selected} onSelectedLayerChange={setSelected} selectionContext={String(context)}
      hemEditor={hem ? { regions: [], region: '', closeUp: false, onSelect: () => {} } : undefined} />;
  }
  try {
    flushSync(() => root.render(<Harness />));
    await settle();
    const targets = () => [...host.querySelectorAll<HTMLElement>('[data-tshirt-hit-target]')];
    const hit = (index: number) => targets()[index].querySelector('path, polygon, rect')!;
    const highlighted = () => targets().filter(target => target.hasAttribute('data-selection-highlight'));
    const selected = () => targets().filter(target => target.getAttribute('aria-pressed') === 'true');
    const clear = (message: string) => {
      check(!highlighted().length && !selected().length, message);
      check(targets().every(target => !target.innerHTML.includes('#38bdf84d')), `${message}: no residual blue SVG fill`);
    };
    check(targets().length > 1, 'Standard T-shirt exposes multiple selectable parts');
    clear('Initially no selection or hover');
    pointer(hit(0), 'pointermove');
    check(highlighted().length === 1, 'Pointer movement highlights one part');
    pointer(hit(0), 'pointerout');
    clear('Hover clears when leaving a part');
    pointer(hit(0), 'pointerdown');
    await settle();
    check(selected().length === 1 && selected()[0] === targets()[0], 'Click selects one part');
    pointer(hit(1), 'pointermove');
    check(highlighted().length === 1, 'Hover cannot leave a second blue selection');
    key(targets()[1], 'Enter');
    await settle();
    check(selected().length === 1 && selected()[0] === targets()[1], 'Keyboard selection replaces the prior part');
    check(!targets()[0].hasAttribute('data-selection-highlight'), 'Previous part loses its tint');
    key(window, 'Escape');
    await settle();
    clear('Escape clears selection and hover');
    pointer(hit(0), 'pointermove', 'touch');
    clear('Touch movement does not create persistent hover');
    pointer(hit(0), 'pointermove');
    pointer(host.querySelector('[data-tshirt-preview]')!, 'pointerdown');
    clear('Empty canvas clears hover even without a selected part');
    pointer(hit(0), 'pointerdown');
    pointer(host.querySelector('[data-tshirt-preview]')!, 'pointerdown');
    await settle();
    clear('Empty canvas clears selection');
    pointer(hit(0), 'pointermove');
    flushSync(changeContext);
    await settle();
    clear('Changing sections clears transient hover');
    pointer(hit(0), 'pointermove');
    flushSync(() => window.dispatchEvent(new Event('blur')));
    clear('Leaving the window clears hover');
    pointer(hit(0), 'pointermove');
    pointer(hit(0), 'pointercancel');
    clear('Pointer cancellation clears hover');
    flushSync(showHemEditor);
    pointer(hit(0), 'pointerdown');
    pointer(host.querySelector('[data-tshirt-preview]')!, 'pointerdown');
    await settle();
    clear('Hem editor empty canvas also clears selection');
    return { checks };
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Run on /builder/ts-001 in a fresh local project. Exercises the real step-navigation lifecycle. */
export async function verifyBuilderSelection() {
  let checks = 0;
  const check = (value: unknown, message: string) => { if (!value) throw new Error(message); checks++; };
  const hit = (id: string) => document.querySelector<HTMLElement>(`[data-tshirt-hit-target="${id}"]`);
  const selected = () => [...document.querySelectorAll('[data-tshirt-hit-target][aria-pressed="true"]')];
  const choose = async (id: string) => {
    const target = hit(id);
    check(target, `Visible ${id} target`);
    key(target!, 'Enter');
    await settle();
    check(selected().length === 1 && selected()[0].getAttribute('data-tshirt-hit-target') === id, `Only ${id} remains selected after navigation`);
  };
  await choose('neck');
  await choose('sleeveLeft');
  await choose('sleeveRight');
  const next = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Continue');
  check(next, 'Continue navigation is available');
  flushSync(() => next!.click());
  await settle();
  check(!selected().length, 'Same-step part selection does not exempt the next explicit section change');
  await choose('neck');
  key(window, 'Escape');
  await settle();
  check(!selected().length && !document.querySelector('[data-selection-highlight]'), 'Builder Escape clears selection and highlight');
  return { checks };
}
