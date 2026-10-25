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
  /** Procedural fashion patterns own their geometry and a variable-length palette. */
  fashion?: boolean;
  minColors?: number;
  maxColors?: number;
  noSpacing?: boolean;
  options?: PatternOption[];
  choices?: PatternChoice[];
  /** Pattern Amount label, because amount means repeats, shapes or contour lines per pattern. */
  amountLabel?: string;
  defaultCount?: number;
}
export interface PatternOption { key: string; label: string; min: number; max: number; value: number; step?: number; suffix?: string }
export interface PatternChoice { key: string; label: string; value: string; options: { value: string; label: string }[] }

const opt = (key: string, label: string, min: number, max: number, value: number, suffix = '%'): PatternOption =>
  ({ key, label, min, max, value, suffix });
const fashion = (id: string, label: string, extra: Partial<PatternDefinition>): PatternDefinition =>
  ({ id, label, category: 'Fashion & Camo', fashion: true, ...extra });
const shapeSize = opt('shapeSize', 'Shape size', 20, 250, 100);
const irregularity = opt('irregularity', 'Shape irregularity', 0, 100, 55);
const overlap = opt('overlap', 'Shape overlap', 0, 100, 40);
const camoColors = (labels: string[]) => ({ colors: labels, minColors: 2, maxColors: labels.length, randomise: true, noSpacing: true,
  amountLabel: 'Shape count / density', defaultCount: 6 });

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
  fashion('plaid', 'Plaid', { thickness: false, colors: ['Base', 'Primary stripe', 'Secondary stripe', 'Accent stripe'], minColors: 2, maxColors: 8,
    amountLabel: 'Repeat frequency', defaultCount: 6,
    options: [opt('hWidth', 'Horizontal stripe width', 25, 250, 100), opt('vWidth', 'Vertical stripe width', 25, 250, 100),
      opt('hSpacing', 'Horizontal repeat spacing', 40, 250, 100), opt('vSpacing', 'Vertical repeat spacing', 40, 250, 100)] }),
  fashion('gingham', 'Gingham', { colors: ['Base', 'Check colour'], minColors: 2, maxColors: 2, amountLabel: 'Repeat frequency', defaultCount: 6,
    options: [opt('checkSize', 'Check size', 20, 80, 50), opt('hSpacing', 'Horizontal repeat spacing', 40, 250, 100), opt('vSpacing', 'Vertical repeat spacing', 40, 250, 100)] }),
  fashion('windowpane', 'Windowpane', { thickness: true, colors: ['Background', 'Line'], minColors: 2, maxColors: 2, amountLabel: 'Repeat frequency', defaultCount: 6,
    options: [opt('hSpacing', 'Pane height', 40, 300, 100), opt('vSpacing', 'Pane width', 40, 300, 100)] }),
  fashion('camo-woodland', 'Woodland Camo', { ...camoColors(['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4', 'Colour 5']), options: [shapeSize, irregularity, overlap] }),
  fashion('camo-tiger', 'Tiger Stripe', { ...camoColors(['Background', 'Stripe 1', 'Stripe 2', 'Stripe 3', 'Stripe 4']), amountLabel: 'Stripe density',
    options: [opt('stripeLength', 'Stripe length', 30, 300, 120), opt('stripeWidth', 'Stripe width', 20, 300, 100),
      opt('curvature', 'Stripe curvature', 0, 100, 40), opt('direction', 'Stripe direction', -180, 180, 70, '°')] }),
  fashion('camo-desert', 'Desert Camo', { ...camoColors(['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4', 'Colour 5', 'Colour 6']),
    options: [shapeSize, irregularity, overlap, opt('accents', 'Accent markings', 0, 100, 40)] }),
  fashion('camo-urban', 'Urban Camo', { ...camoColors(['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4', 'Colour 5']),
    options: [shapeSize, opt('sharpness', 'Shape sharpness', 0, 100, 50), overlap],
    choices: [{ key: 'style', label: 'Urban style', value: 'organic', options: [{ value: 'organic', label: 'Organic Urban Camo' }, { value: 'angular', label: 'Angular Urban Camo' }] }] }),
  fashion('camo-abstract', 'Abstract Camo', { ...camoColors(['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4', 'Colour 5', 'Colour 6']),
    options: [shapeSize, opt('complexity', 'Shape complexity', 0, 100, 50), opt('stretch', 'Shape stretch', 0, 100, 40),
      opt('curvature', 'Shape curvature', 0, 100, 50), opt('distortion', 'Distortion', 0, 100, 30), overlap] }),
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
  { id: 'topographic', label: 'Topographic', category: 'Fashion & Camo', fashion: true, thickness: true, randomise: true, noSpacing: true,
    colors: ['Background', 'Line'], minColors: 2, maxColors: 2, amountLabel: 'Contour density', defaultCount: 6,
    options: [opt('terrain', 'Terrain complexity', 0, 100, 45), opt('elevation', 'Elevation variation', 0, 100, 50),
      opt('smoothness', 'Curve smoothness', 0, 100, 70), opt('spacing', 'Contour spacing', 0, 100, 50)],
    choices: [{ key: 'style', label: 'Topographic style', value: 'classic', options: [{ value: 'classic', label: 'Classic Topographic' }, { value: 'abstract', label: 'Abstract Topographic' }] }] },
  texture('organic-blob', 'Organic Blobs', 'Texture'), texture('cracked', 'Cracked', 'Texture'),
  texture('distressed', 'Distressed', 'Texture'), texture('noise', 'Noise', 'Texture'),
  texture('grain', 'Grain', 'Texture'), texture('dither', 'Dither', 'Texture'),
  geometric('pixel-grid', 'Pixel Grid'),
  { id: 'custom', label: 'Custom Pattern', category: 'Custom', randomise: true },
];

const definitions = new Map(PATTERN_CATALOG.map(definition => [definition.id, definition]));
export const patternDefinition = (id: string): PatternDefinition | undefined => definitions.get(id);

const palettes: Record<string, string[]> = {
  plaid: ['#1B2A22', '#B3202A', '#E8E2CF', '#E0B64A', '#2B4C7E', '#6B3FA0', '#2E8B57', '#D66B2D'],
  gingham: ['#FFFFFF', '#D93B3B'],
  windowpane: ['#F2EFE8', '#2B3A55'],
  'camo-woodland': ['#5B6B3A', '#6B4A2B', '#1F2619', '#A89A63', '#3E4A2A'],
  'camo-tiger': ['#8A8250', '#2D2A1B', '#4E5B2B', '#6E3F22', '#171510'],
  'camo-desert': ['#D8BE8F', '#C2A06A', '#A98254', '#E8D5AE', '#8A6540', '#6A4B30'],
  'camo-urban': ['#2B2D30', '#8A8D91', '#E4E5E7', '#505357', '#121314'],
  'camo-abstract': ['#101010', '#F2F2F2', '#FF4D2E', '#2E6BFF', '#C6F24E', '#B388FF'],
  topographic: ['#1B1B1D', '#D9D4C2'],
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
