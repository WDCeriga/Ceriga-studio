export type GarmentType = 'tshirt' | 'hoodie' | 'sweatshirt' | 'trousers' | 'shorts' | 'jacket' | 'dress' | 'skirt';

export interface StepOption {
  id: string;
  name: string;
  icon?: string;
}

export interface BuilderStep {
  id: number;
  name: string;
  title: string;
  description: string;
  skipForGarmentTypes?: GarmentType[];
}

/**
 * Tech pack “spec only” flow: upload references first (step 9 UI), then garment specs without relying on step id order.
 * Used by Builder when `?flow=techpack-spec` or Studio → Tech pack (spec only).
 */
export const TECHPACK_SPEC_FLOW_ORDER = [
  9, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13,
] as const;

export const builderSteps: BuilderStep[] = [
  {
    id: 1,
    name: 'measurements',
    title: 'Measurement',
    description: 'View measurement guide and select fit for your garment'
  },
  {
    id: 2,
    name: 'fabric',
    title: 'Fabric & Colour',
    description: 'Select fabric type and colour options'
  },
  {
    id: 3,
    name: 'neck',
    title: 'Neck / Collar',
    description: 'Choose your neckline or collar style',
    skipForGarmentTypes: ['trousers', 'shorts', 'skirt']
  },
  {
    id: 4,
    name: 'sleeves',
    title: 'Sleeves',
    description: 'Select sleeve type and length',
    skipForGarmentTypes: ['trousers', 'shorts', 'skirt']
  },
  {
    id: 5,
    name: 'hem',
    title: 'Hem & Cuffs',
    description: 'Choose hem and cuff finishing'
  },
  {
    id: 6,
    name: 'pockets',
    title: 'Pockets & Zips',
    description: 'Add pockets and zip details'
  },
  {
    id: 7,
    name: 'fading',
    title: 'Fading',
    description: 'Configure wash, fade and garment ageing treatments'
  },
  {
    id: 8,
    name: 'stitching',
    title: 'Stitching',
    description: 'Specify stitch type, thread weight and seam construction'
  },
  {
    id: 9,
    name: 'prints',
    title: 'Prints & Design',
    description: 'Upload designs, add text, and customize prints'
  },
  {
    id: 10,
    name: 'labels',
    title: 'Labels',
    description: 'Design your product labels'
  },
  {
    id: 11,
    name: 'packaging',
    title: 'Packaging',
    description: 'Design your product packaging'
  },
  {
    id: 12,
    name: 'quantity',
    title: 'Order quantities',
    description: 'Set how many units you need per size'
  },
  {
    id: 13,
    name: 'review',
    title: 'Review & Export',
    description: 'Review your specifications and export'
  }
];

export const fadingOptions: StepOption[] = [
  { id: 'none', name: 'None' },
  { id: 'light', name: 'Light Fade' },
  { id: 'medium', name: 'Medium Fade' },
  { id: 'heavy', name: 'Heavy Vintage' },
  { id: 'acid', name: 'Acid Wash' },
  { id: 'snow', name: 'Snow Wash' },
  { id: 'ombré', name: 'Ombré' },
  { id: 'localised', name: 'Localised' }
];

export const stitchingOptions: StepOption[] = [
  { id: 'single', name: 'Single Needle' },
  { id: 'double', name: 'Double Needle' },
  { id: 'chain', name: 'Chain Stitch' },
  { id: 'overlock', name: 'Overlock' },
  { id: 'flatlock', name: 'Flatlock' },
  { id: 'cover', name: 'Cover Stitch' },
  { id: 'bartack', name: 'Bartack Reinforced' },
  { id: 'raw', name: 'Exposed / Raw' }
];

export const fitOptions: StepOption[] = [
  { id: 'custom', name: 'Custom' },
  { id: 'slim', name: 'Slim' },
  { id: 'regular', name: 'Regular' },
  { id: 'relaxed', name: 'Relaxed' },
  { id: 'oversized', name: 'Oversized' }
];

export const neckOptions: Record<GarmentType, StepOption[]> = {
  tshirt: [
    { id: 'crew', name: 'Crew Neck' },
    { id: 'vneck', name: 'V-Neck' },
    { id: 'mock', name: 'Mock Neck' },
    { id: 'scoop', name: 'Scoop Neck' }
  ],
  sweatshirt: [
    { id: 'crew', name: 'Crew Neck' },
    { id: 'vneck', name: 'V-Neck' },
    { id: 'mock', name: 'Mock Neck' }
  ],
  hoodie: [
    { id: 'hood-single', name: 'Hood (Single)' },
    { id: 'hood-double', name: 'Hood (Double)' },
    { id: 'halfzip', name: 'Half-Zip' },
    { id: 'fullzip', name: 'Full-Zip' }
  ],
  jacket: [
    { id: 'crew', name: 'Crew' },
    { id: 'mock', name: 'Mock Neck' },
    { id: 'shirt', name: 'Shirt Collar' },
    { id: 'zip', name: 'Zip Collar' }
  ],
  dress: [
    { id: 'crew', name: 'Crew' },
    { id: 'vneck', name: 'V-Neck' },
    { id: 'scoop', name: 'Scoop Neck' },
    { id: 'square', name: 'Square Neck' }
  ],
  trousers: [],
  shorts: [],
  skirt: []
};

export const sleeveTypeOptions: StepOption[] = [
  { id: 'set-in', name: 'Set-In' },
  { id: 'raglan', name: 'Raglan' },
  { id: 'dropped', name: 'Dropped Shoulder' },
  { id: 'sleeveless', name: 'Sleeveless' }
];

export const sleeveLengthOptions: StepOption[] = [
  { id: 'short', name: 'Short' },
  { id: 'three-quarter', name: '¾' },
  { id: 'long', name: 'Long' }
];

export const hemOptions: StepOption[] = [
  { id: 'straight', name: 'Straight' },
  { id: 'curved', name: 'Curved' },
  { id: 'split', name: 'Split' },
  { id: 'ribbed', name: 'Ribbed' },
  { id: 'raw', name: 'Raw Edge' }
];

export const cuffOptions: StepOption[] = [
  { id: 'ribbed', name: 'Ribbed' },
  { id: 'banded', name: 'Banded' },
  { id: 'raw', name: 'Raw' },
  { id: 'elasticated', name: 'Elasticated' }
];

export const pocketOptions: StepOption[] = [
  { id: 'none', name: 'None' },
  { id: 'patch', name: 'Patch' },
  { id: 'kangaroo', name: 'Kangaroo' },
  { id: 'welt', name: 'Welt' },
  { id: 'side-seam', name: 'Side Seam' }
];

export const zipOptions: StepOption[] = [
  { id: 'none', name: 'None' },
  { id: 'full', name: 'Full-Length' },
  { id: 'half', name: 'Half-Zip' },
  { id: 'concealed', name: 'Concealed' },
  { id: 'chest', name: 'Chest Zip' }
];

export const printMethodOptions: StepOption[] = [
  { id: 'dtg', name: 'DTG' },
  { id: 'dtf', name: 'DTF' },
  { id: 'screen', name: 'Screen Print' },
  { id: 'embroidery', name: 'Embroidery' },
  { id: 'heat', name: 'Heat Transfer' },
  { id: 'none', name: 'No Print' }
];

export const fabricColors = [
  // Neutrals
  { hex: '#FFFFFF', name: 'White', pantone: '' },
  { hex: '#F5F5F5', name: 'Off White', pantone: '11-0602' },
  { hex: '#E8E8E8', name: 'Light Gray', pantone: 'Cool Gray 1C' },
  { hex: '#D3D3D3', name: 'Silver', pantone: 'Cool Gray 3C' },
  { hex: '#A8A8A8', name: 'Medium Gray', pantone: 'Cool Gray 6C' },
  { hex: '#6B6B6B', name: 'Dark Gray', pantone: 'Cool Gray 9C' },
  { hex: '#3A3A3A', name: 'Charcoal', pantone: 'Black 6C' },
  { hex: '#000000', name: 'Black', pantone: 'Black C' },

  // Reds
  { hex: '#FEE2E2', name: 'Light Pink', pantone: '169C' },
  { hex: '#FECACA', name: 'Pink', pantone: '176C' },
  { hex: '#FCA5A5', name: 'Rose', pantone: '183C' },
  { hex: '#F87171', name: 'Coral', pantone: '805C' },
  { hex: '#EF4444', name: 'Red', pantone: '185C' },
  { hex: '#DC2626', name: 'Dark Red', pantone: '186C' },
  { hex: '#B91C1C', name: 'Crimson', pantone: '187C' },
  { hex: '#7F1D1D', name: 'Burgundy', pantone: '188C' },

  // Oranges
  { hex: '#FFEDD5', name: 'Peach', pantone: '712C' },
  { hex: '#FED7AA', name: 'Light Orange', pantone: '713C' },
  { hex: '#FDBA74', name: 'Tangerine', pantone: '1485C' },
  { hex: '#FB923C', name: 'Orange', pantone: '1505C' },
  { hex: '#F97316', name: 'Burnt Orange', pantone: '1655C' },
  { hex: '#EA580C', name: 'Dark Orange', pantone: '166C' },
  { hex: '#C2410C', name: 'Rust', pantone: '167C' },
  { hex: '#7C2D12', name: 'Brown', pantone: '168C' },

  // Yellows & Golds
  { hex: '#FEF3C7', name: 'Cream', pantone: '7499C' },
  { hex: '#FDE68A', name: 'Light Yellow', pantone: '121C' },
  { hex: '#FCD34D', name: 'Yellow', pantone: '109C' },
  { hex: '#FBBF24', name: 'Gold', pantone: '130C' },
  { hex: '#F59E0B', name: 'Amber', pantone: '1235C' },
  { hex: '#D97706', name: 'Dark Gold', pantone: '138C' },
  { hex: '#B45309', name: 'Bronze', pantone: '139C' },
  { hex: '#78350F', name: 'Ochre', pantone: '140C' },

  // Greens
  { hex: '#D1FAE5', name: 'Mint', pantone: '351C' },
  { hex: '#A7F3D0', name: 'Light Green', pantone: '352C' },
  { hex: '#6EE7B7', name: 'Seafoam', pantone: '353C' },
  { hex: '#34D399', name: 'Green', pantone: '354C' },
  { hex: '#10B981', name: 'Emerald', pantone: '3268C' },
  { hex: '#059669', name: 'Forest Green', pantone: '348C' },
  { hex: '#047857', name: 'Dark Green', pantone: '349C' },
  { hex: '#064E3B', name: 'Hunter', pantone: '350C' },

  // Blues
  { hex: '#DBEAFE', name: 'Sky', pantone: '2905C' },
  { hex: '#BFDBFE', name: 'Light Blue', pantone: '2915C' },
  { hex: '#93C5FD', name: 'Powder Blue', pantone: '284C' },
  { hex: '#60A5FA', name: 'Blue', pantone: '2727C' },
  { hex: '#3B82F6', name: 'Royal Blue', pantone: '2728C' },
  { hex: '#2563EB', name: 'Cobalt', pantone: '2935C' },
  { hex: '#1D4ED8', name: 'Navy', pantone: '282C' },
  { hex: '#1E3A8A', name: 'Dark Navy', pantone: '2766C' },

  // Purples
  { hex: '#EDE9FE', name: 'Lavender', pantone: '2645C' },
  { hex: '#DDD6FE', name: 'Light Purple', pantone: '2655C' },
  { hex: '#C4B5FD', name: 'Lilac', pantone: '2665C' },
  { hex: '#A78BFA', name: 'Purple', pantone: '2655C' },
  { hex: '#8B5CF6', name: 'Violet', pantone: '2665C' },
  { hex: '#7C3AED', name: 'Deep Purple', pantone: '2685C' },
  { hex: '#6D28D9', name: 'Indigo', pantone: '2685C' },
  { hex: '#5B21B6', name: 'Dark Purple', pantone: '2695C' },

  // Pinks
  { hex: '#FCE7F3', name: 'Blush', pantone: '196C' },
  { hex: '#FBCFE8', name: 'Baby Pink', pantone: '203C' },
  { hex: '#F9A8D4', name: 'Light Pink', pantone: '210C' },
  { hex: '#F472B6', name: 'Hot Pink', pantone: '211C' },
  { hex: '#EC4899', name: 'Pink', pantone: '212C' },
  { hex: '#DB2777', name: 'Magenta', pantone: '213C' },
  { hex: '#BE185D', name: 'Fuchsia', pantone: '214C' },
  { hex: '#9F1239', name: 'Berry', pantone: '215C' },
];

export type FabricColorSwatch = (typeof fabricColors)[number];

/** Grouped palettes — same structure as Fabric & Colour step and trim pickers */
export const FABRIC_COLOR_FAMILIES: {
  name: string;
  colors: FabricColorSwatch[];
  baseColor: FabricColorSwatch;
}[] = [
  { name: 'Neutrals', colors: fabricColors.slice(0, 8), baseColor: fabricColors[3] },
  { name: 'Reds', colors: fabricColors.slice(8, 16), baseColor: fabricColors[12] },
  { name: 'Oranges', colors: fabricColors.slice(16, 24), baseColor: fabricColors[19] },
  { name: 'Yellows', colors: fabricColors.slice(24, 32), baseColor: fabricColors[28] },
  { name: 'Greens', colors: fabricColors.slice(32, 40), baseColor: fabricColors[36] },
  { name: 'Blues', colors: fabricColors.slice(40, 48), baseColor: fabricColors[44] },
  { name: 'Purples', colors: fabricColors.slice(48, 56), baseColor: fabricColors[51] },
  { name: 'Pinks', colors: fabricColors.slice(56, 64), baseColor: fabricColors[60] },
];

export const ORDER_SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl', 'xxl'] as const;
export type OrderSizeKey = (typeof ORDER_SIZE_KEYS)[number];
