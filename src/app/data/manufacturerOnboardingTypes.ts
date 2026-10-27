/**
 * Structured types and constants for Ceriga Manufacturer Onboarding,
 * Automated Order Matching, Portfolio, and Factory Verification.
 */

export type ManufacturerType =
  | 'Direct garment manufacturer'
  | 'Cut-and-sew factory'
  | 'Print-on-demand manufacturer'
  | 'Private-label manufacturer'
  | 'Sourcing agent'
  | 'Clothing production studio'
  | 'Specialist printing/embroidery facility';

export const ALL_MANUFACTURER_TYPES: ManufacturerType[] = [
  'Direct garment manufacturer',
  'Cut-and-sew factory',
  'Print-on-demand manufacturer',
  'Private-label manufacturer',
  'Sourcing agent',
  'Clothing production studio',
  'Specialist printing/embroidery facility',
];

export type GarmentCategory =
  | 'Hoodies'
  | 'T-shirts'
  | 'Sweatshirts'
  | 'Joggers'
  | 'Tracksuits'
  | 'Zip-up hoodies'
  | 'Polo shirts'
  | 'Shorts'
  | 'Jackets'
  | 'Jeans'
  | 'Trousers'
  | 'Shirts'
  | 'Dresses'
  | 'Skirts'
  | 'Activewear'
  | 'Outerwear'
  | 'Headwear'
  | 'Accessories'
  | 'Uniforms'
  | 'Other';

export const ALL_GARMENT_CATEGORIES: GarmentCategory[] = [
  'Hoodies',
  'T-shirts',
  'Sweatshirts',
  'Joggers',
  'Tracksuits',
  'Zip-up hoodies',
  'Polo shirts',
  'Shorts',
  'Jackets',
  'Jeans',
  'Trousers',
  'Shirts',
  'Dresses',
  'Skirts',
  'Activewear',
  'Outerwear',
  'Headwear',
  'Accessories',
  'Uniforms',
  'Other',
];

/** Garment-specific detailed configuration */
export type GarmentDetail = {
  category: GarmentCategory;
  styles: string[];
  minGsm?: number;
  maxGsm?: number;
  materials: string[];
  customMaterials?: string[];
  customStyles?: string[];
  constructionDetails?: string[];
  customConstructionDetails?: string[];
  /** Manufacturer-reviewed suggestions, not independently verified capabilities. */
  confirmed?: boolean;
  moqOverride?: number;
};

export const GARMENT_STYLE_PRESETS: Record<GarmentCategory, string[]> = {
  Hoodies: ['Pullover', 'Full zip', 'Oversized', 'Boxy fit', 'Cropped', 'Heavyweight', 'Lightweight', 'Custom cut-and-sew'],
  'T-shirts': ['Crewneck', 'Oversized', 'Boxy fit', 'Drop shoulder', 'Slim fit', 'Long sleeve', 'Heavyweight', 'Raw cut hem'],
  Sweatshirts: ['Crewneck', 'Raglan sleeve', 'Oversized', 'Drop shoulder', 'Heavyweight', 'Cropped'],
  Joggers: ['Tapered', 'Baggy/relaxed', 'Cuffed ankle', 'Open hem', 'Cargo pockets', 'Heavyweight fleece'],
  Tracksuits: ['Matching 2-piece', 'Zip jacket + pant', 'Velour / nylon tracksuit', 'Reflective piping'],
  'Zip-up hoodies': ['Full-zip front', 'Double zip', 'Oversized fit', 'Heavyweight fleece', 'Thermal lined'],
  'Polo shirts': ['Classic piqué', 'Knit polo', 'Zip neck', 'Button collar', 'Oversized collar'],
  Shorts: ['Sweatshorts', 'Mesh basketball shorts', 'Cargo shorts', 'Nylon swim shorts', 'Raw hem'],
  Jackets: ['Coach jacket', 'Bomber', 'Varsity jacket', 'Denim jacket', 'Workwear jacket'],
  Jeans: ['Straight leg', 'Baggy fit', 'Flared', 'Raw denim', 'Distressed denim'],
  Trousers: ['Chino', 'Pleated dress trouser', 'Workwear double-knee', 'Wide leg', 'Cargo'],
  Shirts: ['Oxford button-down', 'Flannel shirt', 'Bowling / camp collar', 'Overshirt'],
  Dresses: ['T-shirt dress', 'Slip dress', 'Bodycon', 'Maxi dress', 'Sweatshirt dress'],
  Skirts: ['Pleated skirt', 'Mini skirt', 'Midi cargo skirt', 'Denim skirt'],
  Activewear: ['Seamless leggings', 'Compression tops', 'Sports bras', 'Running shorts'],
  Outerwear: ['Puffer jacket', 'Down parka', 'Windbreaker shell', 'Trench coat', 'Fleece fleece-lined'],
  Headwear: ['Snapback', 'Dad hat / 6-panel', 'Beanie', 'Bucket hat', 'Trucker cap'],
  Accessories: ['Tote bags', 'Socks', 'Crossbody bags', 'Scarves', 'Belts'],
  Uniforms: ['Workwear sets', 'Hospitality aprons', 'Corporate embroidery uniforms'],
  Other: ['Custom silhouettes', 'Experimental cuts'],
};

export const DEFAULT_MATERIALS = [
  'Cotton (100%)',
  'Organic Cotton',
  'Polyester',
  'Cotton / Poly blends',
  'French Terry',
  'Brushed Fleece',
  'Piqué',
  'Single Jersey',
  'Nylon',
  'Denim',
  'Spandex / Elastane',
  'Canvas / Twill',
  'Ribbed knit',
  'Linen',
  'Modal / Bamboo',
];

/** Production Capability Categories & Items */
export type CapabilitySource = 'in_house' | 'outsourced';

export type CapabilityItem = {
  id: string;
  category: 'printing' | 'embroidery' | 'washing' | 'distressing' | 'construction' | 'branding';
  name: string;
};

export const CAPABILITY_GROUPS: {
  category: 'printing' | 'embroidery' | 'washing' | 'distressing' | 'construction' | 'branding';
  title: string;
  description: string;
  items: string[];
}[] = [
  {
    category: 'printing',
    title: 'A. Printing',
    description: 'Screen print, DTG, transfer and specialised textile printing',
    items: [
      'Screen printing',
      'DTG (Direct to Garment)',
      'DTF (Direct to Film)',
      'Sublimation',
      'Heat transfer',
      'Puff printing',
      'Discharge printing',
      'Reflective printing',
      'Vinyl printing',
      'Foil printing',
      'All-over printing',
    ],
  },
  {
    category: 'embroidery',
    title: 'B. Embroidery',
    description: 'Flat, 3D puff, chenille, and specialty stitch embroidery',
    items: [
      'Standard / flat embroidery',
      '3D puff embroidery',
      'Chenille embroidery',
      'Appliqué embroidery',
      'Chain stitch embroidery',
      'Patch embroidery',
    ],
  },
  {
    category: 'washing',
    title: 'C. Washing & Dyeing',
    description: 'Garment dyeing, acid wash, stone wash and vintage treatments',
    items: [
      'Acid wash',
      'Stone wash',
      'Enzyme wash',
      'Garment dyeing',
      'Pigment dyeing',
      'Tie-dye',
      'Vintage wash',
      'Bleaching',
      'Fading / sun fading',
    ],
  },
  {
    category: 'distressing',
    title: 'D. Distressing & Finishing',
    description: 'Hand distressing, laser wear, raw edges, and custom abrasion',
    items: [
      'Fabric distressing',
      'Ripped / distressed garments',
      'Frayed edges',
      'Abrasion effects',
      'Laser distressing',
      'Custom finishing',
    ],
  },
  {
    category: 'construction',
    title: 'E. Construction',
    description: 'Pattern development, cutting, sewing and sample sampling',
    items: [
      'Cut and sew',
      'Pattern making',
      'Pattern grading',
      'Custom stitching',
      'Fabric sourcing',
      'Custom garment construction',
      'Sample development',
    ],
  },
  {
    category: 'branding',
    title: 'F. Branding & Packaging',
    description: 'Labels, tags, polybags, and retail-ready packaging',
    items: [
      'Woven labels',
      'Printed neck labels',
      'Care labels',
      'Hangtags',
      'Custom polybags',
      'Branded packaging',
      'Private-label production',
    ],
  },
];

export type CapabilityEntry = {
  name: string;
  source: CapabilitySource;
};

export type CapabilityCategory = CapabilityItem['category'] | 'custom';
export type CapabilityDefinition = {
  id: string;
  name: string;
  category: CapabilityCategory;
  custom: boolean;
};

/** Step 4: Capacity & Pricing Types */
export type CustomMethodMoq = {
  /** Optional only for older name-based records that have not been linked yet. */
  capabilityId?: string;
  method: string;
  moq: number;
};

export type GarmentPriceKey = 'hoodie' | 'tshirt' | 'sweatshirt' | 'jogger';
export type GarmentPriceRange = { minCents?: number; maxCents?: number; currency: import('../lib/currency').Currency };
export type PricingStructure = {
  preferredCurrency: import('../lib/currency').Currency;
  priceBooks?: Partial<Record<import('../lib/currency').Currency, Partial<Record<GarmentPriceKey, GarmentPriceRange>>>>;
  flatSampleFeeByCurrency?: Partial<Record<import('../lib/currency').Currency, number>>;
  updatedAt?: string;
  samplePricingApproach: 'flat_fee' | 'multiplier_2x' | 'multiplier_3x' | 'custom_quote';
  indicativePriceRanges?: {
    hoodie?: string;
    tshirt?: string;
    sweatshirt?: string;
    jogger?: string;
  };
  quantityTierDiscount: boolean;
  requiresCustomQuotation: boolean;
  notes?: string;
};

/** Step 5: Shipping & Services Types */
export type ShippingMethod =
  | 'Standard shipping'
  | 'Express shipping'
  | 'Air freight'
  | 'Sea freight'
  | 'Courier shipping';

export const ALL_SHIPPING_METHODS: ShippingMethod[] = [
  'Standard shipping',
  'Express shipping',
  'Air freight',
  'Sea freight',
  'Courier shipping',
];

export type AdditionalService =
  | 'Tech pack review'
  | 'Tech pack development'
  | 'Fabric sourcing'
  | 'Pattern development'
  | 'Sample development'
  | 'Sample revisions'
  | 'Quality control inspections'
  | 'Product photography'
  | 'Custom packaging'
  | 'Warehousing'
  | 'Order fulfilment';

export const ALL_ADDITIONAL_SERVICES: AdditionalService[] = [
  'Tech pack review',
  'Tech pack development',
  'Fabric sourcing',
  'Pattern development',
  'Sample development',
  'Sample revisions',
  'Quality control inspections',
  'Product photography',
  'Custom packaging',
  'Warehousing',
  'Order fulfilment',
];

/** Production Portfolio Model */
export type PortfolioItem = {
  id: string;
  productName: string;
  garmentCategory: GarmentCategory;
  images: string[];
  materials: string;
  gsm?: number;
  productionMethods: string[];
  customisationTechniques?: string[];
  description: string;
  createdAt: string;
};

/** Factory Verification Model */
export type VerificationStatus = 'not_submitted' | 'pending_review' | 'verified' | 'rejected';

export type FactoryVerificationData = {
  status: VerificationStatus;
  registrationNumber?: string;
  taxId?: string;
  registeredAddress?: string;
  documentUrls?: string[];
  certifications?: string[];
  factoryPhotos?: string[];
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

/** Comprehensive Onboarding Profile Shape */
export type CompleteManufacturerProfile = {
  userId: string;
  // Step 1: Profile
  factoryName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  city: string;
  addressLine?: string;
  manufacturerTypes: ManufacturerType[];
  website?: string;
  yearsInOperation?: number;
  factorySizeSqFt?: number;
  employeeCount?: number;
  businessRegNumber?: string;
  supportedLanguages: string[];
  companyDescription?: string;

  // Step 2: Garments
  garments: GarmentCategory[];
  garmentDetails: Record<string, GarmentDetail>;

  // Step 3: Capabilities
  capabilitiesMap: Record<string, CapabilitySource>;
  customCapabilities?: string[];

  // Step 4: Capacity & Timelines & Pricing
  generalMoq: number;
  maxSingleOrderQuantity?: number;
  monthlyCapacity: number;
  currentAvailableMonthlyCapacity?: number;
  sampleLeadTimeMinDays: number;
  sampleLeadTimeMaxDays: number;
  bulkLeadTimeMinDays: number;
  bulkLeadTimeMaxDays: number;
  repeatOrderLeadTimeDays?: number;
  timeUnit: 'working_days' | 'calendar_days';
  acceptingNewOrders: boolean;
  garmentMoqOverrides?: Record<string, number>;
  /** Categories explicitly edited/confirmed under the inheritance-aware UI. */
  confirmedGarmentMoqOverrides?: string[];
  customMethodMoqs?: CustomMethodMoq[];
  capabilityCatalog?: CapabilityDefinition[];
  customisationUpdatedAt?: string;
  pricing?: PricingStructure;

  // Step 5: Shipping & Services
  shippingDestinations: string[]; // countries, regions, or 'Worldwide'
  shippingMethods: ShippingMethod[];
  internationalShippingAvailable: boolean;
  customsDocumentationSupport: boolean;
  trackingAvailability: boolean;
  directToCustomerShipping: boolean;
  bulkShipmentHandling: boolean;
  typicalDispatchDays: number;
  additionalServices: AdditionalService[];

  // Step 6 / System flags
  onboardingComplete: boolean;
  onboardingStep: number;
  completedSteps: number[];
  updatedAt: string;

  // Optional extensions (sections 8, 9, 10)
  portfolio?: PortfolioItem[];
  verification?: FactoryVerificationData;
};
