/** Ceriga-onboarded shipping companies + factory shipping preferences. */

export type ShippingMode = 'sea' | 'air' | 'rail' | 'express';

export type Incoterm = 'DDP' | 'FOB' | 'EXW' | 'CIF';

export type ShippingCarrierStatus = 'active' | 'pending' | 'inactive';

export type OnboardedShippingCarrier = {
  id: string;
  name: string;
  shortName: string;
  /** Modes this carrier can offer after Ceriga onboarding. */
  supportedModes: ShippingMode[];
  supportedIncoterms: Incoterm[];
  regions: string[];
  status: ShippingCarrierStatus;
  trackingSupported: boolean;
  notes?: string;
};

export type FactoryCarrierSetup = {
  carrierId: string;
  enabled: boolean;
  accountRef?: string;
  enabledModes: ShippingMode[];
  enabledIncoterms: Incoterm[];
  notes?: string;
};

export type FactoryShippingPrefs = {
  carriers: FactoryCarrierSetup[];
  defaultCarrierId?: string;
  defaultMode?: ShippingMode;
  defaultIncoterm?: Incoterm;
};

export type FactoryShipment = {
  id: string;
  orderId: string;
  brandName: string;
  carrierId: string;
  mode: ShippingMode;
  incoterm: Incoterm;
  trackingNumber?: string;
  status: 'quoted' | 'booked' | 'in_transit' | 'delivered' | 'exception';
  origin: string;
  destination: string;
  etd?: string;
  eta?: string;
  shippingQuoteCents?: number;
  updatedAt: string;
};

export const SHIPPING_MODE_LABEL: Record<ShippingMode, string> = {
  sea: 'Sea freight',
  air: 'Air freight',
  rail: 'Rail',
  express: 'Express courier',
};

export const INCOTERM_LABEL: Record<Incoterm, string> = {
  DDP: 'DDP — Delivered Duty Paid',
  FOB: 'FOB — Free On Board',
  EXW: 'EXW — Ex Works',
  CIF: 'CIF — Cost, Insurance & Freight',
};

export const INCOTERM_HELP: Record<Incoterm, string> = {
  DDP: 'You cover delivery + duties to the brand door.',
  FOB: 'Brand takes risk once goods are on the vessel / hub.',
  EXW: 'Brand collects from your factory.',
  CIF: 'You cover cost, insurance, and freight to destination port.',
};

export const ALL_SHIPPING_MODES: ShippingMode[] = ['sea', 'air', 'rail', 'express'];
export const ALL_INCOTERMS: Incoterm[] = ['DDP', 'FOB', 'EXW', 'CIF'];

/** Platform catalog — Ceriga onboards carriers; factories enable them. */
const SEED_CERIGA_SHIPPING_CARRIERS: OnboardedShippingCarrier[] = [
  {
    id: 'ship-dhl',
    name: 'DHL Express',
    shortName: 'DHL',
    supportedModes: ['express', 'air'],
    supportedIncoterms: ['DDP', 'EXW', 'CIF'],
    regions: ['UK', 'EU', 'US', 'Worldwide'],
    status: 'active',
    trackingSupported: true,
    notes: 'Best for samples and urgent capsules',
  },
  {
    id: 'ship-ups',
    name: 'UPS',
    shortName: 'UPS',
    supportedModes: ['express', 'air'],
    supportedIncoterms: ['DDP', 'EXW', 'CIF'],
    regions: ['UK', 'EU', 'US', 'CA'],
    status: 'active',
    trackingSupported: true,
  },
  {
    id: 'ship-fedex',
    name: 'FedEx',
    shortName: 'FedEx',
    supportedModes: ['express', 'air'],
    supportedIncoterms: ['DDP', 'EXW', 'CIF'],
    regions: ['UK', 'EU', 'US', 'Asia'],
    status: 'active',
    trackingSupported: true,
  },
  {
    id: 'ship-maersk',
    name: 'Maersk',
    shortName: 'Maersk',
    supportedModes: ['sea'],
    supportedIncoterms: ['FOB', 'CIF', 'DDP', 'EXW'],
    regions: ['UK', 'EU', 'US', 'Asia'],
    status: 'active',
    trackingSupported: true,
    notes: 'Ocean FCL / LCL for bulk runs',
  },
  {
    id: 'ship-cosco',
    name: 'COSCO Shipping',
    shortName: 'COSCO',
    supportedModes: ['sea'],
    supportedIncoterms: ['FOB', 'CIF', 'EXW'],
    regions: ['Asia', 'EU', 'UK'],
    status: 'active',
    trackingSupported: true,
  },
  {
    id: 'ship-schenker',
    name: 'DB Schenker',
    shortName: 'Schenker',
    supportedModes: ['rail', 'sea', 'air'],
    supportedIncoterms: ['DDP', 'CIF', 'FOB', 'EXW'],
    regions: ['EU', 'UK', 'Asia'],
    status: 'active',
    trackingSupported: true,
    notes: 'Rail + multimodal Europe / China',
  },
  {
    id: 'ship-dpd',
    name: 'DPD',
    shortName: 'DPD',
    supportedModes: ['express'],
    supportedIncoterms: ['DDP', 'EXW'],
    regions: ['UK', 'EU'],
    status: 'active',
    trackingSupported: true,
  },
  {
    id: 'ship-pending-gls',
    name: 'GLS',
    shortName: 'GLS',
    supportedModes: ['express'],
    supportedIncoterms: ['DDP', 'EXW'],
    regions: ['EU', 'UK'],
    status: 'pending',
    trackingSupported: false,
    notes: 'Onboarding with Ceriga — enable once active',
  },
];

const CATALOG_KEY = 'ceriga_shipping_catalog_v1';

function loadCatalog(): OnboardedShippingCarrier[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardedShippingCarrier[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return SEED_CERIGA_SHIPPING_CARRIERS.map((c) => ({ ...c, regions: [...c.regions], supportedModes: [...c.supportedModes], supportedIncoterms: [...c.supportedIncoterms] }));
}

function persistCatalog(carriers: OnboardedShippingCarrier[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(carriers));
  } catch {
    /* ignore */
  }
}

/** Mutable platform catalog (session + localStorage). */
export let CERIGA_SHIPPING_CARRIERS: OnboardedShippingCarrier[] =
  typeof window !== 'undefined' ? loadCatalog() : SEED_CERIGA_SHIPPING_CARRIERS.map((c) => ({ ...c }));

export function listCerigaShippingCarriers(): OnboardedShippingCarrier[] {
  return [...CERIGA_SHIPPING_CARRIERS];
}

export function addCerigaShippingCarrier(input: {
  name: string;
  shortName?: string;
  supportedModes: ShippingMode[];
  supportedIncoterms: Incoterm[];
  regions: string[];
  trackingSupported?: boolean;
  notes?: string;
  status?: ShippingCarrierStatus;
}): OnboardedShippingCarrier {
  const carrier: OnboardedShippingCarrier = {
    id: `ship-ceriga-${Date.now()}`,
    name: input.name.trim(),
    shortName: (input.shortName ?? input.name.split(/\s+/)[0] ?? 'Carrier').slice(0, 10),
    supportedModes: input.supportedModes.length ? input.supportedModes : ['express'],
    supportedIncoterms: input.supportedIncoterms.length ? input.supportedIncoterms : ['DDP', 'EXW'],
    regions: input.regions.length ? input.regions : ['UK'],
    status: input.status ?? 'active',
    trackingSupported: input.trackingSupported ?? true,
    notes: input.notes?.trim() || undefined,
  };
  CERIGA_SHIPPING_CARRIERS = [...CERIGA_SHIPPING_CARRIERS, carrier];
  persistCatalog(CERIGA_SHIPPING_CARRIERS);
  return carrier;
}

export function updateCerigaShippingCarrier(
  id: string,
  patch: Partial<Omit<OnboardedShippingCarrier, 'id'>>,
): OnboardedShippingCarrier | undefined {
  const idx = CERIGA_SHIPPING_CARRIERS.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  const next = { ...CERIGA_SHIPPING_CARRIERS[idx], ...patch };
  CERIGA_SHIPPING_CARRIERS = CERIGA_SHIPPING_CARRIERS.map((c, i) => (i === idx ? next : c));
  persistCatalog(CERIGA_SHIPPING_CARRIERS);
  return next;
}

export function getShippingCarrier(id: string): OnboardedShippingCarrier | undefined {
  return CERIGA_SHIPPING_CARRIERS.find((c) => c.id === id);
}

export function seedFactoryShippingPrefs(): FactoryShippingPrefs {
  return {
    defaultCarrierId: 'ship-dhl',
    defaultMode: 'express',
    defaultIncoterm: 'DDP',
    carriers: [
      {
        carrierId: 'ship-dhl',
        enabled: true,
        accountRef: 'DHL-NM-88421',
        enabledModes: ['express', 'air'],
        enabledIncoterms: ['DDP', 'EXW'],
        notes: 'Preferred for samples',
      },
      {
        carrierId: 'ship-maersk',
        enabled: true,
        accountRef: 'MAE-UK-2201',
        enabledModes: ['sea'],
        enabledIncoterms: ['FOB', 'CIF', 'DDP'],
        notes: 'Bulk ocean',
      },
      {
        carrierId: 'ship-schenker',
        enabled: true,
        enabledModes: ['rail', 'air'],
        enabledIncoterms: ['DDP', 'CIF'],
      },
      {
        carrierId: 'ship-ups',
        enabled: false,
        enabledModes: ['express'],
        enabledIncoterms: ['DDP'],
      },
    ],
  };
}

export function seedFactoryShipments(): FactoryShipment[] {
  return [
    {
      id: 'shp-901',
      orderId: 'ord-m-210',
      brandName: 'Acme Clothing',
      carrierId: 'ship-dhl',
      mode: 'express',
      incoterm: 'DDP',
      trackingNumber: 'JD0144288991',
      status: 'in_transit',
      origin: 'Manchester, UK',
      destination: 'London, UK',
      etd: '2026-04-08',
      eta: '2026-04-11',
      shippingQuoteCents: 18600,
      updatedAt: '2026-04-10',
    },
    {
      id: 'shp-880',
      orderId: 'ord-m-204',
      brandName: 'Blank Collective',
      carrierId: 'ship-maersk',
      mode: 'sea',
      incoterm: 'CIF',
      trackingNumber: 'MAEU38291022',
      status: 'booked',
      origin: 'Felixstowe, UK',
      destination: 'Hamburg, DE',
      etd: '2026-04-18',
      eta: '2026-05-02',
      shippingQuoteCents: 94200,
      updatedAt: '2026-04-09',
    },
    {
      id: 'shp-712',
      orderId: 'ord-m-172',
      brandName: 'Urban Layer Ltd',
      carrierId: 'ship-dpd',
      mode: 'express',
      incoterm: 'DDP',
      trackingNumber: '1550238492',
      status: 'delivered',
      origin: 'Manchester, UK',
      destination: 'Leeds, UK',
      etd: '2026-02-01',
      eta: '2026-02-03',
      shippingQuoteCents: 6400,
      updatedAt: '2026-02-03',
    },
  ];
}

export type ShippingQuoteEstimateInput = {
  mode: ShippingMode;
  incoterm: Incoterm;
  units: number;
  destinationRegion?: string;
};

/** Rough mock shipping quotation for quoting UI / shipping page. */
export function estimateShippingQuoteCents(input: ShippingQuoteEstimateInput): number {
  const baseByMode: Record<ShippingMode, number> = {
    sea: 42000,
    rail: 38000,
    air: 28000,
    express: 12000,
  };
  const incotermBump: Record<Incoterm, number> = {
    EXW: 0,
    FOB: 0.08,
    CIF: 0.18,
    DDP: 0.28,
  };
  const perUnit = input.mode === 'express' ? 18 : input.mode === 'air' ? 12 : 4;
  const raw =
    baseByMode[input.mode] * (1 + incotermBump[input.incoterm]) + input.units * perUnit * 100;
  return Math.round(raw / 100) * 100;
}

export const SHIPMENT_STATUS_LABEL: Record<FactoryShipment['status'], string> = {
  quoted: 'Quoted',
  booked: 'Booked',
  in_transit: 'In transit',
  delivered: 'Delivered',
  exception: 'Exception',
};
