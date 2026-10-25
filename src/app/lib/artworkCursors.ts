/** Keep resize arrows aligned with the handles when artwork is rotated. */
export function artworkResizeCursor(handle: string, rotation = 0) {
  const angles: Record<string, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
  const index = ((Math.round(((angles[handle] ?? 0) + rotation) / 45) % 4) + 4) % 4;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][index];
}

export const ARTWORK_ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M19 10a7 7 0 1 0-1 7M19 4v6h-6' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M19 10a7 7 0 1 0-1 7M19 4v6h-6' fill='none' stroke='%23262626' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, grab`;
