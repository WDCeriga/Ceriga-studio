/** Shared label helpers for the tech pack generator. */

export const FABRIC_OPTIONS_FALLBACK: { id: string; name: string }[] = [
  { id: 'jersey', name: 'Jersey' },
  { id: 'fleece', name: 'Fleece' },
  { id: 'french-terry', name: 'French Terry' },
  { id: 'twill', name: 'Twill' },
  { id: 'interlock', name: 'Interlock' },
  { id: 'piqué', name: 'Piqué' },
];

export function optionLabel(
  list: { id: string; name: string }[],
  id: string | undefined,
): string | undefined {
  if (!id) return undefined;
  return list.find((o) => o.id === id)?.name;
}

/** Human label for the label-type option stored on builder state. */
export function labelTypeLabel(value: string): string {
  if (!value || value === 'none') return 'None';
  return value.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Human label for the packaging-type option stored on builder state. */
export function packagingTypeLabel(value: string): string {
  if (!value || value === 'none') return 'None';
  return value.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
