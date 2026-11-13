import crew_front_neck from '../../assets/tshirt-necks/regular.crew.front.ribbed.neck.svg?raw';
import crew_front_inner from '../../assets/tshirt-necks/regular.crew.front.ribbed.inner.svg?raw';
import crew_back_neck from '../../assets/tshirt-necks/regular.crew.back.ribbed.neck.svg?raw';
import crew_front_outline from '../../assets/tshirt-necks/regular.crew.front.ribbed.outline.svg?raw';
import crew_back_outline from '../../assets/tshirt-necks/regular.crew.back.ribbed.outline.svg?raw';
import thin_crew_front_neck from '../../assets/tshirt-necks/regular.thincrew.front.ribbed.neck.svg?raw';
import thin_crew_front_inner from '../../assets/tshirt-necks/regular.thincrew.front.ribbed.inner.svg?raw';
import thin_crew_back_neck from '../../assets/tshirt-necks/regular.thincrew.back.ribbed.neck.svg?raw';
import thin_crew_front_outline from '../../assets/tshirt-necks/regular.thincrew.front.ribbed.outline.svg?raw';
import thin_crew_back_outline from '../../assets/tshirt-necks/regular.thincrew.back.ribbed.outline.svg?raw';
import v_front_neck from '../../assets/tshirt-necks/regular.vneck.front.ribbed.neck.svg?raw';
import v_front_inner from '../../assets/tshirt-necks/regular.vneck.front.ribbed.inner.svg?raw';
import v_back_neck from '../../assets/tshirt-necks/regular.vneck.back.ribbed.neck.svg?raw';
import v_front_outline from '../../assets/tshirt-necks/regular.vneck.front.ribbed.outline.svg?raw';
import v_back_outline from '../../assets/tshirt-necks/regular.vneck.back.ribbed.outline.svg?raw';
import deep_v_front_neck from '../../assets/tshirt-necks/regular.deep-vneck.front.ribbed.neck.svg?raw';
import deep_v_front_inner from '../../assets/tshirt-necks/regular.deep-vneck.front.ribbed.inner.svg?raw';
import deep_v_back_neck from '../../assets/tshirt-necks/regular.deep-vneck.back.ribbed.neck.svg?raw';
import deep_v_front_outline from '../../assets/tshirt-necks/regular.deep-vneck.front.ribbed.outline.svg?raw';
import deep_v_back_outline from '../../assets/tshirt-necks/regular.deep-vneck.back.ribbed.outline.svg?raw';
import scoop_front_neck from '../../assets/tshirt-necks/regular.scoop.front.ribbed.neck.svg?raw';
import scoop_front_inner from '../../assets/tshirt-necks/regular.scoop.front.ribbed.inner.svg?raw';
import scoop_back_neck from '../../assets/tshirt-necks/regular.scoop.back.ribbed.neck.svg?raw';
import scoop_front_outline from '../../assets/tshirt-necks/regular.scoop.front.ribbed.outline.svg?raw';
import scoop_back_outline from '../../assets/tshirt-necks/regular.scoop.back.ribbed.outline.svg?raw';
import polo_front_neck from '../../assets/tshirt-necks/regular.polo.front.ribbed.neck.svg?raw';
import polo_front_inner from '../../assets/tshirt-necks/regular.polo.front.ribbed.inner.svg?raw';
import polo_back_neck from '../../assets/tshirt-necks/regular.polo.back.ribbed.neck.svg?raw';
import polo_front_outline from '../../assets/tshirt-necks/regular.polo.front.ribbed.outline.svg?raw';
import polo_back_outline from '../../assets/tshirt-necks/regular.polo.back.ribbed.outline.svg?raw';

export const HOODIE_NECKLINES = {
  crew: { asset: { front: crew_front_neck, back: crew_back_neck, inside: crew_front_inner, frontInk: crew_front_outline, backInk: crew_back_outline }, label: 'Crew neck', depth: 700, band: 40, pointed: false },
  'thin-crew': { asset: { front: thin_crew_front_neck, back: thin_crew_back_neck, inside: thin_crew_front_inner, frontInk: thin_crew_front_outline, backInk: thin_crew_back_outline }, label: 'Thin crew neck', depth: 692, band: 18, pointed: false },
  v: { asset: { front: v_front_neck, back: v_back_neck, inside: v_front_inner, frontInk: v_front_outline, backInk: v_back_outline }, label: 'V-neck', depth: 746, band: 36, pointed: true },
  'deep-v': { asset: { front: deep_v_front_neck, back: deep_v_back_neck, inside: deep_v_front_inner, frontInk: deep_v_front_outline, backInk: deep_v_back_outline }, label: 'Deep V-neck', depth: 817, band: 38, pointed: true },
  scoop: { asset: { front: scoop_front_neck, back: scoop_back_neck, inside: scoop_front_inner, frontInk: scoop_front_outline, backInk: scoop_back_outline }, label: 'Scoop neck', depth: 800, band: 30, pointed: false },
  polo: { asset: { front: polo_front_neck, back: polo_back_neck, inside: polo_front_inner, frontInk: polo_front_outline, backInk: polo_back_outline }, label: 'Polo collar', depth: 731, band: 36, pointed: false },
} as const;

export const HOODIE_PROFILES = [
  ['standard', 'Center seam'],
  ['seamless', 'Seamless hood'],
  ['three-panel', 'Three-panel'],
] as const;

export const HOODIE_POSITIONS = [['raised', 'Raised'], ['relaxed', 'Relaxed']] as const;

export const HOODIE_TYPES = [
  ['regular', 'Regular'],
  ['oversized', 'Oversized'],
  ['scuba', 'Scuba'],
] as const;

export function hoodieTypeOption(value?: string) {
  return HOODIE_TYPES.find(([id]) => id === value) ?? HOODIE_TYPES[0];
}

export function hoodiePositionOption(value?: string, legacyProfile?: string) {
  return HOODIE_POSITIONS.find(([id]) => id === value)
    ?? HOODIE_POSITIONS[legacyProfile === 'low' || legacyProfile === 'relaxed' ? 1 : 0];
}

export function hoodieProfileOption(value?: string) {
  return HOODIE_PROFILES.find(([id]) => id === value) ?? HOODIE_PROFILES[0];
}

export function hoodieNeckline(value?: string) {
  return HOODIE_NECKLINES[value as keyof typeof HOODIE_NECKLINES] ?? HOODIE_NECKLINES.crew;
}

export const HOODLESS_NECK_OFFSET = 14;
export const HOODLESS_NECK_Y = 605 + HOODLESS_NECK_OFFSET;

export function hoodieNeckCurve(depth: number, pointed: boolean, to: string) {
  return pointed ? `L 1024 ${depth} L ${to}` : `Q 1024 ${2 * depth - HOODLESS_NECK_Y} ${to}`;
}
