export type PackagingCategory = 'polybag' | 'mailer' | 'box' | 'none';
export type PackagingPanel = 'front' | 'back' | 'top' | 'left' | 'right' | 'interior-lid' | 'interior-base';
export type PackagingView = 'front' | 'back' | 'closed' | 'open' | 'reverse' | 'panel';
export interface PackagingTemplate {
  id: string;
  category: PackagingCategory;
  name: string;
  material: string;
  color: string;
  transparency?: 'clear' | 'frosted';
  closure: 'heat' | 'zip' | 'adhesive' | 'handle' | 'fold' | 'lift' | 'magnet' | 'drawer' | 'tape';
  panels: PackagingPanel[];
  topExclusion: number;
}
const bagPanels: PackagingPanel[] = ['front', 'back'];
const boxPanels: PackagingPanel[] = ['top', 'front', 'back', 'left', 'right', 'interior-lid', 'interior-base'];
export const PACKAGING_CATEGORIES: Record<PackagingCategory, string> = { polybag: 'Polybag', mailer: 'Mailer', box: 'Box', none: 'No Custom Packaging' };
export const PACKAGING_TEMPLATES: PackagingTemplate[] = [
  { id: 'clear', category: 'polybag', name: 'Clear polybag', material: 'Clear polyethylene', color: '#ffffff', transparency: 'clear', closure: 'heat', panels: bagPanels, topExclusion: 18 },
  { id: 'frosted', category: 'polybag', name: 'Frosted polybag', material: 'Frosted polyethylene', color: '#e4e9eb', transparency: 'frosted', closure: 'heat', panels: bagPanels, topExclusion: 18 },
  { id: 'white', category: 'polybag', name: 'Opaque white polybag', material: 'Opaque polyethylene', color: '#ffffff', closure: 'heat', panels: bagPanels, topExclusion: 18 },
  { id: 'black', category: 'polybag', name: 'Opaque black polybag', material: 'Opaque polyethylene', color: '#202225', closure: 'heat', panels: bagPanels, topExclusion: 18 },
  { id: 'zip', category: 'polybag', name: 'Zip-lock polybag', material: 'Frosted polyethylene', color: '#e4e9eb', transparency: 'frosted', closure: 'zip', panels: bagPanels, topExclusion: 35 },
  { id: 'adhesive', category: 'polybag', name: 'Adhesive-seal polybag', material: 'Clear polyethylene', color: '#ffffff', transparency: 'clear', closure: 'adhesive', panels: bagPanels, topExclusion: 42 },
  { id: 'handle', category: 'polybag', name: 'Handle polybag', material: 'Frosted polyethylene', color: '#e4e9eb', transparency: 'frosted', closure: 'handle', panels: bagPanels, topExclusion: 65 },
  { id: 'kraft-mailer', category: 'mailer', name: 'Kraft paper mailer', material: 'Kraft paper', color: '#bd9561', closure: 'adhesive', panels: bagPanels, topExclusion: 45 },
  { id: 'white-mailer', category: 'mailer', name: 'White poly mailer', material: 'Opaque polyethylene', color: '#ffffff', closure: 'adhesive', panels: bagPanels, topExclusion: 45 },
  { id: 'black-mailer', category: 'mailer', name: 'Black poly mailer', material: 'Opaque polyethylene', color: '#202225', closure: 'adhesive', panels: bagPanels, topExclusion: 45 },
  { id: 'frosted-mailer', category: 'mailer', name: 'Frosted mailer', material: 'Frosted polyethylene', color: '#e4e9eb', transparency: 'frosted', closure: 'adhesive', panels: bagPanels, topExclusion: 45 },
  { id: 'padded', category: 'mailer', name: 'Padded paper mailer', material: 'Cushioned kraft paper', color: '#c9a572', closure: 'adhesive', panels: bagPanels, topExclusion: 50 },
  { id: 'folding', category: 'box', name: 'Folding mailer box', material: 'Corrugated board', color: '#d3b184', closure: 'fold', panels: boxPanels, topExclusion: 12 },
  { id: 'rigid', category: 'box', name: 'Rigid gift box', material: 'Wrapped rigid board', color: '#f4f3ee', closure: 'lift', panels: boxPanels, topExclusion: 18 },
  { id: 'magnetic', category: 'box', name: 'Magnetic-closure box', material: 'Wrapped rigid board', color: '#303537', closure: 'magnet', panels: boxPanels, topExclusion: 18 },
  { id: 'drawer', category: 'box', name: 'Drawer box', material: 'Board sleeve and tray', color: '#cbd4d0', closure: 'drawer', panels: ['top', 'front', 'back', 'left', 'right', 'interior-base'], topExclusion: 32 },
  { id: 'carton', category: 'box', name: 'Standard kraft carton', material: 'Corrugated kraft board', color: '#bd9561', closure: 'tape', panels: ['front', 'back', 'left', 'right', 'interior-base'], topExclusion: 14 },
  { id: 'bulk', category: 'none', name: 'Standard unbranded bulk shipping carton', material: 'Standard bulk shipping carton', color: '#bd9561', closure: 'tape', panels: [], topExclusion: 0 },
];
export const PANEL_NAMES: Record<PackagingPanel, string> = { front: 'Front', back: 'Back', top: 'Top / lid', left: 'Left side', right: 'Right side', 'interior-lid': 'Interior lid', 'interior-base': 'Interior base' };
export interface PackagingElement {
  id: string;
  kind: 'logo' | 'artwork' | 'text';
  panel: PackagingPanel;
  content: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  font: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  pixelWidth?: number;
  pixelHeight?: number;
}
export interface PackagingDesign {
  templateId: string;
  category: PackagingCategory;
  material: string;
  exterior: string;
  interior: string;
  opacity: number;
  dimensions: { width: number; height: number; depth: number };
  dimensionsConfirmed: boolean;
  selectedPanel: PackagingPanel;
  view: PackagingView;
  shippingLabel: boolean;
  elements: PackagingElement[];
  notes: string;
}
export interface PackagingState {
  version: 1;
  active: string;
  designs: Record<string, PackagingDesign>;
  presets: { id: string; name: string; design: PackagingDesign }[];
}
export interface PrintRect { x: number; y: number; width: number; height: number }
export function packagingTemplate(id: string) { return PACKAGING_TEMPLATES.find(template => template.id === id) ?? PACKAGING_TEMPLATES[0]; }
export function createPackagingDesign(id = 'clear'): PackagingDesign {
  const template = packagingTemplate(id);
  return { templateId: template.id, category: template.category, material: template.material, exterior: template.color, interior: '#e2c49d', opacity: template.transparency === 'clear' ? 0.18 : 0.56, dimensions: { width: 300, height: 380, depth: 80 }, dimensionsConfirmed: false, selectedPanel: template.panels[0] ?? 'front', view: template.category === 'box' || template.category === 'none' ? 'closed' : 'front', shippingLabel: template.category === 'mailer', elements: [], notes: '' };
}
export function createPackagingState(id = 'clear'): PackagingState { return { version: 1, active: id, designs: { [id]: createPackagingDesign(id) }, presets: [] }; }
export function migrateLegacyPackaging(type?: string, color?: string, notes?: string, elements: { type: string; content: string; width: number; height: number; rotation: number; fontFamily?: string; fontSize?: number; color?: string }[] = []): PackagingState {
  const id = type === 'none' ? 'bulk' : type === 'box' ? 'folding' : type === 'mailer' ? 'kraft-mailer' : 'clear';
  const state = createPackagingState(id);
  const design = state.designs[id];
  design.exterior = color || design.exterior;
  design.notes = notes || '';
  design.elements = elements.map((element, index) => fitPackagingElement({ id: `legacy-packaging-${index}`, kind: element.type === 'text' ? 'text' : 'artwork', panel: design.selectedPanel, content: element.content, name: element.type === 'text' ? 'Legacy text' : 'Legacy artwork', x: 0, y: 0, width: element.width || 100, height: element.height || 30, rotation: element.rotation || 0, font: element.fontFamily || 'Arial', fontSize: element.fontSize || 12, color: element.color || '#111111', align: 'center' }, printRegion(design, design.selectedPanel)));
  return state;
}
export function switchPackaging(state: PackagingState, id: string): PackagingState {
  return { ...state, active: id, designs: { ...state.designs, [id]: state.designs[id] ?? createPackagingDesign(id) } };
}
export function panelSize(design: PackagingDesign, panel: PackagingPanel) {
  const { width, height, depth } = design.dimensions;
  if (design.category !== 'box' || ['top', 'interior-lid', 'interior-base'].includes(panel)) return { width, height };
  return { width: panel === 'left' || panel === 'right' ? height : width, height: depth };
}
export function printRegion(design: PackagingDesign, panel: PackagingPanel): PrintRect {
  const template = packagingTemplate(design.templateId);
  const size = panelSize(design, panel);
  const margin = Math.min(design.templateId === 'padded' ? 18 : 10, size.width * 0.12, size.height * 0.12);
  const top = design.category === 'box' ? Math.max(margin, Math.min(template.topExclusion, size.height * 0.45)) : Math.max(margin, template.topExclusion);
  const width = design.category === 'mailer' && design.shippingLabel && panel === 'front' ? size.width * 0.45 - margin * 2 : size.width - margin * 2;
  return { x: margin, y: top, width: Math.max(1, width), height: Math.max(1, size.height - top - margin) };
}
export function rotatedExtents(element: PackagingElement) {
  const radians = element.rotation * Math.PI / 180;
  return { width: Math.abs(Math.cos(radians)) * element.width + Math.abs(Math.sin(radians)) * element.height, height: Math.abs(Math.sin(radians)) * element.width + Math.abs(Math.cos(radians)) * element.height };
}
export function constrainPackagingElement(element: PackagingElement, region: PrintRect): PackagingElement {
  const clean = { ...element, width: Math.max(0.1, element.width), height: Math.max(0.1, element.height) };
  const bounds = rotatedExtents(clean);
  const factor = Math.min(1, region.width / bounds.width, region.height / bounds.height);
  clean.width *= factor;
  clean.height *= factor;
  clean.fontSize *= factor;
  const fitted = rotatedExtents(clean);
  clean.x = Math.min(region.x + region.width - fitted.width / 2, Math.max(region.x + fitted.width / 2, clean.x));
  clean.y = Math.min(region.y + region.height - fitted.height / 2, Math.max(region.y + fitted.height / 2, clean.y));
  return clean;
}
export function fitPackagingElement(element: PackagingElement, region: PrintRect): PackagingElement {
  const factor = Math.min(region.width * 0.62 / element.width, region.height * 0.35 / element.height);
  return constrainPackagingElement({ ...element, x: region.x + region.width / 2, y: region.y + region.height / 2, width: element.width * factor, height: element.height * factor, fontSize: element.fontSize * factor }, region);
}
export function normalizePackagingDesign(design: PackagingDesign): PackagingDesign {
  return { ...design, elements: design.elements.map(element => constrainPackagingElement(element, printRegion(design, element.panel))) };
}
export function packagingDimensionError(dimensions: PackagingDesign['dimensions'], category: PackagingCategory): string | undefined {
  if (![dimensions.width, dimensions.height].every(value => Number.isFinite(value) && value >= 100 && value <= 1000)) return 'Width and length must be between 100 and 1000 mm.';
  if (category === 'box' && (!Number.isFinite(dimensions.depth) || dimensions.depth < 20 || dimensions.depth > 500)) return 'Box depth must be between 20 and 500 mm.';
}
export function packagingWarnings(design: PackagingDesign): string[] {
  if (design.category === 'none') return [];
  const warnings: string[] = [];
  if (!design.dimensionsConfirmed) warnings.push('Dimensions are an illustrative starting point, not a selected production size.');
  for (const element of design.elements) {
    if (Math.min(element.width, element.height) < 5 || element.kind === 'text' && element.fontSize < 2.5) warnings.push(`${element.name}: small artwork; confirm minimum printable detail.`);
    if (element.pixelWidth && element.pixelWidth / (element.width / 25.4) < 150) warnings.push(`${element.name}: below 150 ppi at the selected size; request a higher-resolution original.`);
  }
  return warnings;
}
export function packagingSummary(design: PackagingDesign): [string, string][] {
  if (design.category === 'none') return [['Packaging', 'Standard unbranded bulk shipping carton.']];
  const rows: [string, string][] = [['Category', PACKAGING_CATEGORIES[design.category]], ['Variation', packagingTemplate(design.templateId).name], ['Material request', design.material], ['Exterior colour', design.exterior]];
  if (design.category === 'box') rows.push(['Interior colour', design.interior]);
  if (packagingTemplate(design.templateId).transparency) rows.push(['Material opacity', `${Math.round(design.opacity * 100)}% (visual target)`]);
  rows.push(['Dimensions', design.dimensionsConfirmed ? `${design.dimensions.width} x ${design.dimensions.height}${design.category === 'box' ? ` x ${design.dimensions.depth}` : ''} mm (requested)` : 'Not selected; manufacturer to confirm']);
  if (design.category === 'mailer') rows.push(['Shipping-label reservation', design.shippingLabel ? 'Front right; reserved' : 'Disabled']);
  rows.push(['Printed surfaces', [...new Set(design.elements.map(element => PANEL_NAMES[element.panel]))].join(', ') || 'None']);
  for (const element of design.elements) rows.push([`${PANEL_NAMES[element.panel]} / ${element.name}`, `${element.kind === 'text' ? element.content : element.kind}; ${element.width.toFixed(1)} x ${element.height.toFixed(1)} mm; centre ${element.x.toFixed(1)}, ${element.y.toFixed(1)} mm; ${element.rotation} deg${element.kind === 'text' ? `; ${element.font}; ${element.color}` : ''}`]);
  if (design.notes.trim()) rows.push(['Manufacturing request', design.notes.trim()]);
  rows.push(['Production status', 'Concept only. Confirm dieline, material, colour, dimensions and print compatibility with manufacturer.']);
  return rows;
}
export function mapPackagingImages(state: PackagingState | undefined, mapper: (content: string) => string): PackagingState | undefined {
  if (!state) return state;
  const mapDesign = (design: PackagingDesign): PackagingDesign => ({ ...design, elements: design.elements.map(element => element.kind === 'text' ? element : { ...element, content: mapper(element.content) }) });
  return { ...state, designs: Object.fromEntries(Object.entries(state.designs).map(([key, design]) => [key, mapDesign(design)])), presets: state.presets.map(preset => ({ ...preset, design: mapDesign(preset.design) })) };
}