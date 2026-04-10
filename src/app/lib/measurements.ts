export type MeasurementUnit = 'cm' | 'in';

const CM_PER_IN = 2.54;

function trimNumberString(s: string): string {
  const t = s.replace(/\.?0+$/, '');
  return t === '' || t === '-' ? '0' : t;
}

/** Round-trip friendly formatting for stored cm values. */
export function formatCmForStorage(cm: number): string {
  if (!Number.isFinite(cm)) return '';
  const s = cm.toFixed(4);
  return trimNumberString(s);
}

/** Display stored cm string in the chosen unit (values in state are always cm). */
export function formatMeasurementDisplay(cmStored: string, unit: MeasurementUnit): string {
  const raw = String(cmStored ?? '').trim().replace(',', '.');
  if (raw === '') return '';
  const cm = parseFloat(raw);
  if (Number.isNaN(cm)) return String(cmStored);
  if (unit === 'cm') return formatCmForStorage(cm);
  const inches = cm / CM_PER_IN;
  return formatCmForStorage(inches);
}

/** Parse a cell input in the current display unit to canonical cm string. */
export function parseMeasurementInput(display: string, unit: MeasurementUnit): string {
  const raw = display.trim().replace(',', '.');
  if (raw === '') return '';
  const v = parseFloat(raw);
  if (Number.isNaN(v)) return display;
  const cm = unit === 'cm' ? v : v * CM_PER_IN;
  return formatCmForStorage(cm);
}

export function measurementUnitLabel(unit: MeasurementUnit): string {
  return unit === 'in' ? 'in' : 'cm';
}
