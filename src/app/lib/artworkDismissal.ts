/** Portaled controls belong to the editor even when mounted outside its DOM subtree. */
export function isArtworkFloatingControl(target:EventTarget|null):boolean{
  return typeof Element!=='undefined'&&target instanceof Element&&Boolean(target.closest(
    '[data-radix-popper-content-wrapper],[data-slot="sheet-content"],[data-radix-dialog-content],[data-inline-toolbar-popover],[role="dialog"],[role="listbox"],[role="menu"],.studio-colour-panel,.clothing-font-popover'
  ));
}
