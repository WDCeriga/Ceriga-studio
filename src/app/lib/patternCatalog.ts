export interface PatternDefinition {
  id: string;
  label: string;
  category: string;
  /** Palette labels; slot zero is the artwork's primary color. */
  colors?: string[];
  thickness?: boolean;
  randomise?: boolean;
  roughness?: boolean;
  variation?: boolean;
}

const classic = (id: string, label: string): PatternDefinition => ({ id, label, category: 'Classic', thickness: true });
const geometric = (id: string, label: string, thickness = true): PatternDefinition => ({ id, label, category: 'Geometric', thickness });
const texture = (id: string, label: string, category: string, colors?: string[]): PatternDefinition =>
  ({ id, label, category, colors, randomise: true, roughness: true, variation: true });

export const PATTERN_CATALOG: readonly PatternDefinition[] = [
  classic('stripes', 'Stripes'), classic('stripes-h', 'Horizontal Stripes'), classic('diagonal', 'Diagonal'),
  { ...classic('checks', 'Checks'), thickness: false }, { ...classic('dots', 'Dots'), randomise: true },
  geometric('pinstripes', 'Pinstripes'), geometric('grid', 'Grid'), geometric('diamonds', 'Diamonds'),
  geometric('triangles', 'Triangles'), geometric('honeycomb', 'Honeycomb'), geometric('crosses', 'Crosses'),
  geometric('stars', 'Stars'), geometric('waves', 'Waves'), geometric('chevron', 'Chevron'),
  geometric('spiral', 'Spiral'), geometric('concentric', 'Concentric'), geometric('sunburst', 'Sunburst'),
  geometric('halftone', 'Halftone'),
  { id: 'tartan', label: 'Tartan', category: 'Textile & Animal', thickness: true, colors: ['Primary stripe', 'Ground', 'Secondary stripe', 'Fine stripe'] },
  { id: 'houndstooth', label: 'Houndstooth', category: 'Textile & Animal' },
  { id: 'argyle', label: 'Argyle', category: 'Textile & Animal', thickness: true, colors: ['Primary diamond', 'Ground', 'Alternate diamond', 'Stitch'] },
  texture('camo', 'Camouflage', 'Textile & Animal', ['Primary patch', 'Ground', 'Light patch', 'Dark patch']),
  texture('digital-camo', 'Digital Camo', 'Textile & Animal', ['Primary pixel', 'Ground', 'Light pixel', 'Dark pixel']),
  texture('cow', 'Cow', 'Textile & Animal', ['Primary patch', 'Ground']),
  texture('leopard', 'Leopard', 'Textile & Animal', ['Rosette', 'Ground', 'Rosette center']),
  texture('zebra', 'Zebra', 'Textile & Animal', ['Primary stripe', 'Ground']),
  texture('snake', 'Snake', 'Textile & Animal', ['Scale edge', 'Ground', 'Scale center']),
  texture('flames', 'Flames', 'Expressive', ['Outer flame', 'Inner flame']),
  texture('lightning', 'Lightning', 'Expressive'),
  { id: 'barbed-wire', label: 'Barbed Wire', category: 'Expressive', thickness: true },
  { id: 'chain', label: 'Chain', category: 'Expressive', thickness: true },
  texture('tribal', 'Tribal', 'Expressive'),
  texture('graffiti', 'Graffiti', 'Expressive', ['Primary mark', 'Accent', 'Highlight']),
  texture('topographic', 'Topographic', 'Expressive'),
  texture('organic-blob', 'Organic Blobs', 'Texture'), texture('cracked', 'Cracked', 'Texture'),
  texture('distressed', 'Distressed', 'Texture'), texture('noise', 'Noise', 'Texture'),
  texture('grain', 'Grain', 'Texture'), texture('dither', 'Dither', 'Texture'),
  geometric('pixel-grid', 'Pixel Grid'),
  { id: 'custom', label: 'Custom Pattern', category: 'Custom', randomise: true },
];

const definitions = new Map(PATTERN_CATALOG.map(definition => [definition.id, definition]));
export const patternDefinition = (id: string): PatternDefinition | undefined => definitions.get(id);

const palettes: Record<string, string[]> = {
  tartan: ['#CE333F', '#16382F', '#234877', '#EBCB83'],
  argyle: ['#D85C65', '#EFE4CE', '#31465B', '#FFFFFF'],
  camo: ['#617049', '#A9A17B', '#8A8D57', '#343D30'],
  'digital-camo': ['#617049', '#B9B293', '#888B64', '#343D30'],
  cow: ['#252525', '#F8F4E9'], leopard: ['#302119', '#D9B16E', '#AB703C'],
  zebra: ['#202020', '#F5F0E3'], snake: ['#424D33', '#B5B687', '#7C8960'],
  flames: ['#F45B27', '#FFD35C'], graffiti: ['#EE438B', '#38C5DA', '#F6D456'],
};

/** Returns a fresh array so UI palette edits never mutate catalog defaults. */
export function patternDefaultColors(id: string): string[] {
  return [...(palettes[id] ?? ['#FFFFFF'])];
}
