import body from '../../../assets/studio-tshirt/Body/Body crew.svg?raw';
import leftSleeve from '../../../assets/studio-tshirt/Left sleeve/Left sleeve.svg?raw';
import rightSleeve from '../../../assets/studio-tshirt/Right sleeve/Right sleeve.svg?raw';
import bodyHem from '../../../assets/studio-tshirt/Body hem/Body hem.svg?raw';
import leftCuff from '../../../assets/studio-tshirt/Left cuff/Left cuff.svg?raw';
import rightCuff from '../../../assets/studio-tshirt/Right cuff/Right cuff.svg?raw';
import innerNeck from '../../../assets/studio-tshirt/Inner back neck/Inner back neck crew.svg?raw';
import neck from '../../../assets/studio-tshirt/Neck/Crew neck.svg?raw';
import outline from '../../../assets/studio-tshirt/Outline/Outline crew.svg?raw';
import stitching from '../../../assets/studio-tshirt/Stitching/Cover stitch.svg?raw';

export const REGISTERED_TSHIRT_SYMMETRY_AXIS = 1024;

export const PANELLING_SURFACES = [
  { id: 'base', label: 'Body', source: 'Body / Body crew.svg' },
  { id: 'sleeveLeft', label: 'Left sleeve', source: 'Left sleeve / Left sleeve.svg' },
  { id: 'sleeveRight', label: 'Right sleeve', source: 'Right sleeve / Right sleeve.svg' },
  { id: 'neck', label: 'Neck / Collar', source: 'Neck / Crew neck.svg' },
  { id: 'bodyHem', label: 'Body hem', source: 'Body hem / Body hem.svg' },
  { id: 'sleeveHemLeft', label: 'Left cuff', source: 'Left cuff / Left cuff.svg' },
  { id: 'sleeveHemRight', label: 'Right cuff', source: 'Right cuff / Right cuff.svg' },
] as const;

type SurfaceId = typeof PANELLING_SURFACES[number]['id'];
interface GarmentLayer { id: string; raw: string; fill: string; label: string; outline?: boolean; }

const layers: GarmentLayer[] = [
  { id: 'base', raw: body, fill: '#5c84b2', label: 'Body' },
  { id: 'sleeveLeft', raw: leftSleeve, fill: '#5c84b2', label: 'Left sleeve' },
  { id: 'sleeveRight', raw: rightSleeve, fill: '#5c84b2', label: 'Right sleeve' },
  { id: 'bodyHem', raw: bodyHem, fill: '#496f9d', label: 'Body hem' },
  { id: 'sleeveHemLeft', raw: leftCuff, fill: '#496f9d', label: 'Left cuff' },
  { id: 'sleeveHemRight', raw: rightCuff, fill: '#496f9d', label: 'Right cuff' },
  { id: 'innerBackNeck', raw: innerNeck, fill: '#6e91b8', label: 'Inner back neck' },
  { id: 'neck', raw: neck, fill: '#496f9d', label: 'Neck / Collar' },
  { id: 'outline', raw: outline, fill: '#1d2424', label: 'Construction outline', outline: true },
  { id: 'stitching', raw: stitching, fill: '#474d49', label: 'Cover stitch', outline: true },
];

function layerMarkup(layer: GarmentLayer) {
  const document = new DOMParser().parseFromString(layer.raw, 'image/svg+xml');
  const svg = document.documentElement;
  svg.querySelectorAll('[fill="#000000"]').forEach(element => element.setAttribute('fill', layer.fill));
  svg.querySelectorAll('[fill="#141414"]').forEach(element => element.setAttribute('fill', layer.fill));
  const contents = Array.from(svg.childNodes).map(node => new XMLSerializer().serializeToString(node)).join('');
  return `<g data-panelling-parent="${layer.id}" data-garment-part="${layer.label}" data-technical-ink="${layer.outline ? 'true' : 'false'}">${contents}</g>`;
}

export const PANELLING_GARMENT_MARKUP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" aria-label="Slim crew-neck T-shirt">${layers.map(layerMarkup).join('')}</svg>`;

export function panellingSurfaceLabel(id: string) {
  return PANELLING_SURFACES.find(surface => surface.id === id)?.label ?? id;
}

export function panellingSurfaceSource(id: SurfaceId) {
  return PANELLING_SURFACES.find(surface => surface.id === id)?.source ?? '';
}