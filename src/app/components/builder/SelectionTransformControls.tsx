import type { PointerEvent } from 'react';
import { SelectionChrome, type SelectionHandle } from './artwork-engine/interaction';

/**
 * Compatibility wrapper — selection chrome now lives in the Artwork engine
 * (artwork-engine/interaction/SelectionChrome). Existing call sites keep this API.
 * The editor only passes `transformLabel` while a resize/rotate is in progress,
 * so a present label renders as the live (dark) chip.
 */
export function SelectionTransformControls(props: {
  onResizePointerDown: (event: PointerEvent, handle: SelectionHandle) => void;
  onRotatePointerDown: (event: PointerEvent) => void;
  uiInverseScale?: number; comfortableTouch?: boolean; hideBounds?: boolean; rotation?: number; transformLabel?: string;
}) {
  return <SelectionChrome {...props} transforming={Boolean(props.transformLabel)} />;
}
