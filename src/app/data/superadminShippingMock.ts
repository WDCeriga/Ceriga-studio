/** Superadmin shipping network — factory options, catalog, shipment stats. */

import { listManufacturerProfiles } from './manufacturersMock';
import {
  getShippingCarrier,
  INCOTERM_LABEL,
  listCerigaShippingCarriers,
  SHIPMENT_STATUS_LABEL,
  SHIPPING_MODE_LABEL,
  type FactoryShipment,
  type FactoryShippingPrefs,
  type Incoterm,
  type ShippingMode,
} from './factoryShipping';
import {
  getFactoryShippingPrefs,
  listFactoryShipments,
} from './manufacturerPortalMock';
import { listShippingOnboardRequests } from './shippingOnboardMock';

export type FactoryCarrierOptionView = {
  carrierId: string;
  carrierName: string;
  enabled: boolean;
  modes: ShippingMode[];
  incoterms: Incoterm[];
  accountRef?: string;
  notes?: string;
};

export type FactoryShippingNetworkRow = {
  factoryId: string;
  factoryName: string;
  userId: string;
  location: string;
  live: boolean;
  defaultCarrierName?: string;
  defaultMode?: ShippingMode;
  defaultIncoterm?: Incoterm;
  options: FactoryCarrierOptionView[];
  enabledCount: number;
  shipmentCount: number;
  inTransit: number;
  delivered: number;
  avgTransitDays: number | null;
  onTimePct: number | null;
  avgQuoteCents: number | null;
};

export type NetworkShipmentRow = FactoryShipment & {
  factoryId: string;
  factoryName: string;
  carrierName: string;
  transitDays: number | null;
  onTime: boolean | null;
};

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime();
  return Math.round(ms / 86400000);
}

function transitDays(s: FactoryShipment): number | null {
  if (!s.etd || !s.eta) return null;
  return daysBetween(s.etd, s.eta);
}

function onTimeFlag(s: FactoryShipment): boolean | null {
  if (s.status !== 'delivered' || !s.eta || !s.updatedAt) return null;
  return s.updatedAt <= s.eta;
}

function prefsToOptions(prefs: FactoryShippingPrefs): FactoryCarrierOptionView[] {
  return prefs.carriers.map((c) => {
    const cat = getShippingCarrier(c.carrierId);
    return {
      carrierId: c.carrierId,
      carrierName: cat?.name ?? c.carrierId,
      enabled: c.enabled,
      modes: c.enabledModes,
      incoterms: c.enabledIncoterms,
      accountRef: c.accountRef,
      notes: c.notes,
    };
  });
}

function seedEuroStitchPrefs(): FactoryShippingPrefs {
  return {
    defaultCarrierId: 'ship-schenker',
    defaultMode: 'rail',
    defaultIncoterm: 'DDP',
    carriers: [
      {
        carrierId: 'ship-schenker',
        enabled: true,
        accountRef: 'DBS-PT-441',
        enabledModes: ['rail', 'air'],
        enabledIncoterms: ['DDP', 'CIF'],
      },
      {
        carrierId: 'ship-dhl',
        enabled: true,
        enabledModes: ['express'],
        enabledIncoterms: ['DDP', 'EXW'],
      },
      {
        carrierId: 'ship-maersk',
        enabled: true,
        enabledModes: ['sea'],
        enabledIncoterms: ['FOB', 'CIF'],
      },
      {
        carrierId: 'ship-fedex',
        enabled: false,
        enabledModes: ['express', 'air'],
        enabledIncoterms: ['DDP'],
      },
    ],
  };
}

function seedPortoPrefs(): FactoryShippingPrefs {
  return {
    defaultCarrierId: 'ship-ups',
    defaultMode: 'express',
    defaultIncoterm: 'DDP',
    carriers: [
      {
        carrierId: 'ship-ups',
        enabled: true,
        accountRef: 'UPS-BRAGA-19',
        enabledModes: ['express', 'air'],
        enabledIncoterms: ['DDP', 'EXW'],
      },
      {
        carrierId: 'ship-cosco',
        enabled: true,
        enabledModes: ['sea'],
        enabledIncoterms: ['FOB', 'CIF', 'EXW'],
      },
      {
        carrierId: 'ship-dpd',
        enabled: true,
        enabledModes: ['express'],
        enabledIncoterms: ['DDP'],
      },
    ],
  };
}

function seedEuroShipments(): FactoryShipment[] {
  return [
    {
      id: 'shp-es-1',
      orderId: 'ord-es-88',
      brandName: 'Threadline Apparel',
      carrierId: 'ship-schenker',
      mode: 'rail',
      incoterm: 'DDP',
      trackingNumber: 'DBS992001',
      status: 'delivered',
      origin: 'Porto, PT',
      destination: 'Bristol, UK',
      etd: '2026-03-01',
      eta: '2026-03-08',
      shippingQuoteCents: 41200,
      updatedAt: '2026-03-07',
    },
    {
      id: 'shp-es-2',
      orderId: 'ord-es-91',
      brandName: 'Blank Collective',
      carrierId: 'ship-dhl',
      mode: 'express',
      incoterm: 'DDP',
      trackingNumber: 'JD99112233',
      status: 'in_transit',
      origin: 'Porto, PT',
      destination: 'Berlin, DE',
      etd: '2026-04-10',
      eta: '2026-04-13',
      shippingQuoteCents: 15800,
      updatedAt: '2026-04-11',
    },
    {
      id: 'shp-es-3',
      orderId: 'ord-es-70',
      brandName: 'Acme Clothing',
      carrierId: 'ship-maersk',
      mode: 'sea',
      incoterm: 'CIF',
      status: 'booked',
      origin: 'Leixões, PT',
      destination: 'Felixstowe, UK',
      etd: '2026-04-20',
      eta: '2026-04-28',
      shippingQuoteCents: 76500,
      updatedAt: '2026-04-12',
    },
  ];
}

function seedPortoShipments(): FactoryShipment[] {
  return [
    {
      id: 'shp-pg-1',
      orderId: 'ord-pg-12',
      brandName: 'Studio Guest',
      carrierId: 'ship-ups',
      mode: 'express',
      incoterm: 'DDP',
      trackingNumber: '1Z999AA101',
      status: 'delivered',
      origin: 'Braga, PT',
      destination: 'Paris, FR',
      etd: '2026-02-10',
      eta: '2026-02-12',
      shippingQuoteCents: 22100,
      updatedAt: '2026-02-13',
    },
    {
      id: 'shp-pg-2',
      orderId: 'ord-pg-18',
      brandName: 'Urban Layer Ltd',
      carrierId: 'ship-cosco',
      mode: 'sea',
      incoterm: 'FOB',
      trackingNumber: 'COSU884422',
      status: 'in_transit',
      origin: 'Leixões, PT',
      destination: 'Shanghai, CN',
      etd: '2026-03-15',
      eta: '2026-04-20',
      shippingQuoteCents: 128000,
      updatedAt: '2026-04-01',
    },
  ];
}

function statsFromShipments(shipments: FactoryShipment[]) {
  const delivered = shipments.filter((s) => s.status === 'delivered');
  const transitVals = delivered
    .map((s) => transitDays(s))
    .filter((d): d is number => d != null);
  const onTimeVals = delivered
    .map((s) => onTimeFlag(s))
    .filter((v): v is boolean => v != null);
  const quotes = shipments
    .map((s) => s.shippingQuoteCents)
    .filter((c): c is number => c != null);
  return {
    shipmentCount: shipments.length,
    inTransit: shipments.filter((s) => s.status === 'in_transit').length,
    delivered: delivered.length,
    avgTransitDays:
      transitVals.length > 0
        ? Math.round((transitVals.reduce((a, b) => a + b, 0) / transitVals.length) * 10) / 10
        : null,
    onTimePct:
      onTimeVals.length > 0
        ? Math.round((onTimeVals.filter(Boolean).length / onTimeVals.length) * 100)
        : null,
    avgQuoteCents:
      quotes.length > 0
        ? Math.round(quotes.reduce((a, b) => a + b, 0) / quotes.length)
        : null,
  };
}

export function listFactoryShippingNetwork(): FactoryShippingNetworkRow[] {
  return listManufacturerProfiles().map((p) => {
    const live = p.entityId === 'm1';
    const prefs = live
      ? getFactoryShippingPrefs()
      : p.entityId === 'm2'
        ? seedEuroStitchPrefs()
        : seedPortoPrefs();
    const shipments = live
      ? listFactoryShipments()
      : p.entityId === 'm2'
        ? seedEuroShipments()
        : seedPortoShipments();
    const options = prefsToOptions(prefs);
    const stats = statsFromShipments(shipments);
    const defaultCarrier = prefs.defaultCarrierId
      ? getShippingCarrier(prefs.defaultCarrierId)
      : undefined;
    return {
      factoryId: p.entityId,
      factoryName: p.name,
      userId: p.userId,
      location: `${p.location}, ${p.country}`,
      live,
      defaultCarrierName: defaultCarrier?.name,
      defaultMode: prefs.defaultMode,
      defaultIncoterm: prefs.defaultIncoterm,
      options,
      enabledCount: options.filter((o) => o.enabled).length,
      ...stats,
    };
  });
}

export function listNetworkShipments(): NetworkShipmentRow[] {
  const rows: NetworkShipmentRow[] = [];
  for (const p of listManufacturerProfiles()) {
    const live = p.entityId === 'm1';
    const shipments = live
      ? listFactoryShipments()
      : p.entityId === 'm2'
        ? seedEuroShipments()
        : seedPortoShipments();
    for (const s of shipments) {
      rows.push({
        ...s,
        factoryId: p.entityId,
        factoryName: p.name,
        carrierName: getShippingCarrier(s.carrierId)?.name ?? s.carrierId,
        transitDays: transitDays(s),
        onTime: onTimeFlag(s),
      });
    }
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getShippingNetworkStats() {
  const shipments = listNetworkShipments();
  const factories = listFactoryShippingNetwork();
  const catalog = listCerigaShippingCarriers();
  const pendingOnboard = listShippingOnboardRequests('pending').length;
  const modeMix = ALL_MODE_KEYS.map((mode) => ({
    mode,
    label: SHIPPING_MODE_LABEL[mode],
    count: shipments.filter((s) => s.mode === mode).length,
  })).filter((m) => m.count > 0);
  const carrierUsage = catalog
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: shipments.filter((s) => s.carrierId === c.id).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const transit = shipments
    .map((s) => s.transitDays)
    .filter((d): d is number => d != null);
  const onTime = shipments.map((s) => s.onTime).filter((v): v is boolean => v != null);
  const quotes = shipments
    .map((s) => s.shippingQuoteCents)
    .filter((c): c is number => c != null);

  return {
    totalShipments: shipments.length,
    inTransit: shipments.filter((s) => s.status === 'in_transit').length,
    delivered: shipments.filter((s) => s.status === 'delivered').length,
    booked: shipments.filter((s) => s.status === 'booked').length,
    avgTransitDays:
      transit.length > 0
        ? Math.round((transit.reduce((a, b) => a + b, 0) / transit.length) * 10) / 10
        : null,
    onTimePct:
      onTime.length > 0
        ? Math.round((onTime.filter(Boolean).length / onTime.length) * 100)
        : null,
    avgQuoteCents:
      quotes.length > 0 ? Math.round(quotes.reduce((a, b) => a + b, 0) / quotes.length) : null,
    activeCatalog: catalog.filter((c) => c.status === 'active').length,
    pendingCatalog: catalog.filter((c) => c.status === 'pending').length,
    pendingOnboard,
    factoriesEnabledOptions: factories.reduce((s, f) => s + f.enabledCount, 0),
    modeMix,
    carrierUsage: carrierUsage.slice(0, 6),
  };
}

const ALL_MODE_KEYS: ShippingMode[] = ['express', 'air', 'rail', 'sea'];

export { SHIPPING_MODE_LABEL, INCOTERM_LABEL, SHIPMENT_STATUS_LABEL };
