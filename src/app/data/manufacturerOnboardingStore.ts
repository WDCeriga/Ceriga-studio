import type {
  CompleteManufacturerProfile,
  GarmentCategory,
  CapabilitySource,
} from './manufacturerOnboardingTypes';
import { getFactoryWorkspace, updateFactoryWorkspace } from './manufacturerPortalMock';

export const COMPREHENSIVE_ONBOARDING_KEY_PREFIX = 'ceriga_mfg_full_profile_';

export function getProfileStorageKey(userEmailOrId?: string): string {
  if (typeof window === 'undefined') return 'ceriga_mfg_full_profile_default';
  let id = userEmailOrId;
  if (!id) {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        id = u?.id || u?.email;
      }
    } catch {
      /* ignore */
    }
  }
  const clean = (id || 'default').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  return `${COMPREHENSIVE_ONBOARDING_KEY_PREFIX}${clean}`;
}

export function createDefaultCompleteProfile(
  seed?: Partial<CompleteManufacturerProfile>,
): CompleteManufacturerProfile {
  const ws = getFactoryWorkspace();
  return {
    userId: seed?.userId || 'default',
    // Step 1: Profile
    factoryName: seed?.factoryName || ws.factoryName || '',
    contactName: seed?.contactName || ws.contactName || '',
    contactEmail: seed?.contactEmail || ws.contactEmail || '',
    contactPhone: seed?.contactPhone || ws.contactPhone || '',
    country: seed?.country || 'United Kingdom',
    city: seed?.city || (ws.addressLine?.split(',')[0]?.trim() || ''),
    addressLine: seed?.addressLine || ws.addressLine || '',
    manufacturerTypes: seed?.manufacturerTypes || ['Cut-and-sew factory'],
    website: seed?.website || ws.website || '',
    yearsInOperation: seed?.yearsInOperation || 5,
    factorySizeSqFt: seed?.factorySizeSqFt || 12000,
    employeeCount: seed?.employeeCount || 45,
    businessRegNumber: seed?.businessRegNumber || '',
    supportedLanguages: seed?.supportedLanguages || ['English'],
    companyDescription: seed?.companyDescription || '',

    // Step 2: Garments
    garments: seed?.garments || (ws.garments.length ? (ws.garments as GarmentCategory[]) : ['Hoodies', 'T-shirts']),
    garmentDetails: seed?.garmentDetails || {
      Hoodies: {
        category: 'Hoodies',
        styles: ['Pullover', 'Oversized', 'Heavyweight'],
        minGsm: 320,
        maxGsm: 500,
        materials: ['French Terry', 'Brushed Fleece', 'Cotton (100%)'],
      },
      'T-shirts': {
        category: 'T-shirts',
        styles: ['Crewneck', 'Oversized', 'Drop shoulder'],
        minGsm: 180,
        maxGsm: 280,
        materials: ['Single Jersey', 'Organic Cotton'],
      },
    },

    // Step 3: Capabilities
    capabilitiesMap: seed?.capabilitiesMap || {
      'Cut and sew': 'in_house',
      'Screen printing': 'in_house',
      'DTG (Direct to Garment)': 'in_house',
      'Standard / flat embroidery': 'in_house',
      '3D puff embroidery': 'in_house',
      'Garment dyeing': 'outsourced',
      'Woven labels': 'in_house',
    },
    customCapabilities: seed?.customCapabilities || [],

    // Step 4: Capacity & Timelines & Pricing
    generalMoq: seed?.generalMoq ?? ws.moq ?? 50,
    maxSingleOrderQuantity: seed?.maxSingleOrderQuantity ?? 5000,
    monthlyCapacity: seed?.monthlyCapacity ?? ws.monthlyCapacity ?? 4000,
    currentAvailableMonthlyCapacity: seed?.currentAvailableMonthlyCapacity ?? Math.round((ws.monthlyCapacity ?? 4000) * 0.7),
    sampleLeadTimeMinDays: seed?.sampleLeadTimeMinDays ?? 7,
    sampleLeadTimeMaxDays: seed?.sampleLeadTimeMaxDays ?? 14,
    bulkLeadTimeMinDays: seed?.bulkLeadTimeMinDays ?? 18,
    bulkLeadTimeMaxDays: seed?.bulkLeadTimeMaxDays ?? 28,
    repeatOrderLeadTimeDays: seed?.repeatOrderLeadTimeDays ?? 14,
    timeUnit: seed?.timeUnit || 'working_days',
    acceptingNewOrders: seed?.acceptingNewOrders ?? true,
    garmentMoqOverrides: seed?.garmentMoqOverrides || {
      Hoodies: 30,
      'T-shirts': 50,
    },
    customMethodMoqs: seed?.customMethodMoqs || [
      { method: 'Screen printing', moq: 50 },
      { method: 'Garment dyeing', moq: 100 },
    ],
    pricing: seed?.pricing || {
      preferredCurrency: 'GBP',
      samplePricingApproach: 'multiplier_2x',
      indicativePriceRanges: {
        hoodie: '£18 - £26',
        tshirt: '£7 - £12',
        sweatshirt: '£15 - £22',
        jogger: '£14 - £20',
      },
      quantityTierDiscount: true,
      requiresCustomQuotation: true,
      notes: 'Final prices depend on fabric weight, embroidery stitch count and wash treatments.',
    },

    // Step 5: Shipping & Services
    shippingDestinations: seed?.shippingDestinations || (ws.shippingRegions?.length ? ws.shippingRegions : ['UK', 'EU', 'US']),
    shippingMethods: seed?.shippingMethods || ['Standard shipping', 'Express shipping', 'Courier shipping'],
    internationalShippingAvailable: seed?.internationalShippingAvailable ?? true,
    customsDocumentationSupport: seed?.customsDocumentationSupport ?? true,
    trackingAvailability: seed?.trackingAvailability ?? true,
    directToCustomerShipping: seed?.directToCustomerShipping ?? false,
    bulkShipmentHandling: seed?.bulkShipmentHandling ?? true,
    typicalDispatchDays: seed?.typicalDispatchDays ?? 2,
    additionalServices: seed?.additionalServices || [
      'Tech pack review',
      'Fabric sourcing',
      'Sample development',
      'Quality control inspections',
      'Custom packaging',
    ],

    // Step 6 / System flags
    onboardingComplete: seed?.onboardingComplete ?? ws.onboardingComplete ?? false,
    onboardingStep: seed?.onboardingStep ?? 0,
    completedSteps: seed?.completedSteps || [],
    updatedAt: new Date().toISOString(),

    portfolio: seed?.portfolio || [],
    verification: seed?.verification || {
      status: 'not_submitted',
    },
  };
}

/** Load the complete profile for the active user, falling back smoothly to existing workspace */
export function loadCompleteManufacturerProfile(userEmailOrId?: string): CompleteManufacturerProfile {
  const key = getProfileStorageKey(userEmailOrId);
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...createDefaultCompleteProfile(),
          ...parsed,
        };
      }
    }
  } catch {
    /* ignore parse errors */
  }

  // Not found in custom key — bootstrap from legacy workspace
  const legacy = getFactoryWorkspace();
  const created = createDefaultCompleteProfile({
    factoryName: legacy.factoryName,
    contactName: legacy.contactName,
    contactEmail: legacy.contactEmail,
    contactPhone: legacy.contactPhone,
    addressLine: legacy.addressLine,
    website: legacy.website,
    moq: legacy.moq,
    monthlyCapacity: legacy.monthlyCapacity,
    onboardingComplete: legacy.onboardingComplete,
  });
  return created;
}

/** Save the complete profile with automatic debounce support */
export function saveCompleteManufacturerProfile(
  profile: CompleteManufacturerProfile,
  userEmailOrId?: string,
): CompleteManufacturerProfile {
  const key = getProfileStorageKey(userEmailOrId || profile.contactEmail || profile.userId);
  const updated: CompleteManufacturerProfile = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(updated));
    }
  } catch {
    /* ignore storage quota */
  }

  // Sync core fields backwards into legacy factory workspace
  try {
    updateFactoryWorkspace({
      factoryName: updated.factoryName,
      contactName: updated.contactName,
      contactEmail: updated.contactEmail,
      contactPhone: updated.contactPhone,
      addressLine: `${updated.city ? updated.city + ', ' : ''}${updated.country || ''}`,
      website: updated.website,
      garments: updated.garments as any,
      capabilities: Object.keys(updated.capabilitiesMap) as any,
      shippingRegions: updated.shippingDestinations,
      moq: updated.generalMoq,
      monthlyCapacity: updated.monthlyCapacity,
      typicalLeadDays: updated.bulkLeadTimeMinDays || 21,
      onboardingComplete: updated.onboardingComplete,
    });
  } catch {
    /* ignore */
  }

  return updated;
}

/**
 * Section 8: Calculate Profile Completeness
 * Balanced calculation based on meaningful sections, avoiding rewarding fluff.
 */
export type CompletenessSection = {
  id: string;
  name: string;
  weight: number;
  completed: boolean;
  score: number;
  hint: string;
  link: string;
};

export function calculateProfileCompleteness(profile: CompleteManufacturerProfile): {
  totalPercentage: number;
  sections: CompletenessSection[];
} {
  const sections: CompletenessSection[] = [
    {
      id: 'factory_info',
      name: 'Factory Information',
      weight: 20,
      completed: Boolean(profile.factoryName && profile.contactName && profile.contactEmail && profile.country && profile.city),
      score: Boolean(profile.factoryName && profile.contactName && profile.contactEmail && profile.country && profile.city) ? 20 : 5,
      hint: 'Facility name, primary point of contact, location and business type',
      link: '/manufacturer/onboarding?step=0',
    },
    {
      id: 'garment_capabilities',
      name: 'Garment Specialisations',
      weight: 20,
      completed: profile.garments.length > 0 && Object.keys(profile.garmentDetails || {}).length > 0,
      score: profile.garments.length > 0 ? (Object.keys(profile.garmentDetails || {}).length > 0 ? 20 : 12) : 0,
      hint: 'Categories (Hoodies, T-shirts, etc.) with styles, GSM ranges and fabrics',
      link: '/manufacturer/onboarding?step=1',
    },
    {
      id: 'production_capabilities',
      name: 'Production Capabilities',
      weight: 20,
      completed: Object.keys(profile.capabilitiesMap || {}).length >= 3,
      score: Object.keys(profile.capabilitiesMap || {}).length >= 3 ? 20 : Object.keys(profile.capabilitiesMap || {}).length > 0 ? 10 : 0,
      hint: 'Printing, embroidery, washing/dyeing, and in-house vs outsourced tags',
      link: '/manufacturer/onboarding?step=2',
    },
    {
      id: 'capacity_timelines',
      name: 'Capacity & Lead Times',
      weight: 15,
      completed: Boolean(profile.generalMoq > 0 && profile.monthlyCapacity > 0 && profile.bulkLeadTimeMinDays > 0),
      score: Boolean(profile.generalMoq > 0 && profile.monthlyCapacity > 0 && profile.bulkLeadTimeMinDays > 0) ? 15 : 0,
      hint: 'MOQ, monthly capacity, available volume, and sample/bulk turnarounds',
      link: '/manufacturer/onboarding?step=3',
    },
    {
      id: 'shipping_services',
      name: 'Shipping & Value-Add Services',
      weight: 10,
      completed: profile.shippingDestinations.length > 0 && profile.shippingMethods.length > 0,
      score: profile.shippingDestinations.length > 0 && profile.shippingMethods.length > 0 ? 10 : 0,
      hint: 'Delivery destinations, freight methods, and tech pack/sourcing services',
      link: '/manufacturer/onboarding?step=4',
    },
    {
      id: 'portfolio',
      name: 'Production Portfolio',
      weight: 10,
      completed: Boolean(profile.portfolio && profile.portfolio.length > 0),
      score: Boolean(profile.portfolio && profile.portfolio.length > 0) ? 10 : 0,
      hint: 'Showcase previously produced garments with fabric and GSM details',
      link: '/manufacturer/portfolio',
    },
    {
      id: 'verification',
      name: 'Business Verification',
      weight: 5,
      completed: profile.verification?.status === 'verified',
      score: profile.verification?.status === 'verified' ? 5 : profile.verification?.status === 'pending_review' ? 3 : 0,
      hint: 'Official company registration, address verification and certifications',
      link: '/manufacturer/verification',
    },
  ];

  const totalScore = sections.reduce((acc, s) => acc + s.score, 0);

  return {
    totalPercentage: Math.min(100, totalScore),
    sections,
  };
}
