/** Factory → Ceriga shipping carrier onboard requests. */

import type { ShippingMode } from './factoryShipping';
import { addCerigaShippingCarrier } from './factoryShipping';

const SHIP_ONBOARD_KEY = 'ceriga_shipping_onboard_requests_v1';

export type ShippingOnboardRequest = {
  id: string;
  factoryId: string;
  factoryName: string;
  name: string;
  modes: ShippingMode[];
  regions: string;
  notes?: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  reviewedAt?: string;
};

function seedShippingOnboard(): ShippingOnboardRequest[] {
  return [
    {
      id: 'sob-1',
      factoryId: 'm1',
      factoryName: 'North Mills',
      name: 'Northern Freight Collective',
      modes: ['rail', 'sea'],
      regions: 'UK, EU',
      notes: 'Prefer for bulk EU capsules',
      status: 'pending',
      requestedAt: '2026-07-12',
    },
    {
      id: 'sob-2',
      factoryId: 'm2',
      factoryName: 'Euro Stitch Co',
      name: 'Lisbon Air Cargo',
      modes: ['air', 'express'],
      regions: 'EU, UK',
      status: 'pending',
      requestedAt: '2026-07-14',
    },
  ];
}

function loadShippingOnboard(): ShippingOnboardRequest[] {
  try {
    const raw = localStorage.getItem(SHIP_ONBOARD_KEY);
    if (raw) return JSON.parse(raw) as ShippingOnboardRequest[];
  } catch {
    /* ignore */
  }
  return seedShippingOnboard();
}

let shippingOnboard: ShippingOnboardRequest[] =
  typeof window !== 'undefined' ? loadShippingOnboard() : seedShippingOnboard();

function persistShippingOnboard() {
  try {
    localStorage.setItem(SHIP_ONBOARD_KEY, JSON.stringify(shippingOnboard));
  } catch {
    /* ignore */
  }
}

export function listShippingOnboardRequests(
  status?: ShippingOnboardRequest['status'] | 'all',
): ShippingOnboardRequest[] {
  const list = [...shippingOnboard].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  if (!status || status === 'all') return list;
  return list.filter((r) => r.status === status);
}

export function submitShippingCarrierOnboardRequest(input: {
  factoryId: string;
  factoryName: string;
  name: string;
  modes: ShippingMode[];
  regions: string;
  notes?: string;
}): ShippingOnboardRequest {
  const req: ShippingOnboardRequest = {
    id: `sob-${Date.now()}`,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    name: input.name.trim(),
    modes: input.modes,
    regions: input.regions.trim(),
    notes: input.notes?.trim() || undefined,
    status: 'pending',
    requestedAt: new Date().toISOString().slice(0, 10),
  };
  shippingOnboard = [req, ...shippingOnboard];
  persistShippingOnboard();
  return req;
}

export function approveShippingOnboardRequest(id: string): ShippingOnboardRequest | undefined {
  const idx = shippingOnboard.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  const req = shippingOnboard[idx];
  addCerigaShippingCarrier({
    name: req.name,
    shortName: req.name.split(/\s+/)[0]?.slice(0, 8) ?? 'Carrier',
    supportedModes: req.modes.length ? req.modes : ['express'],
    supportedIncoterms: ['DDP', 'EXW', 'FOB'],
    regions: req.regions.split(/,\s*/).filter(Boolean),
    trackingSupported: true,
    notes: `Onboarded from ${req.factoryName} request`,
    status: 'active',
  });
  const next = {
    ...req,
    status: 'approved' as const,
    reviewedAt: new Date().toISOString().slice(0, 10),
  };
  shippingOnboard = shippingOnboard.map((r, i) => (i === idx ? next : r));
  persistShippingOnboard();
  return next;
}

export function declineShippingOnboardRequest(id: string): ShippingOnboardRequest | undefined {
  const idx = shippingOnboard.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  const next = {
    ...shippingOnboard[idx],
    status: 'declined' as const,
    reviewedAt: new Date().toISOString().slice(0, 10),
  };
  shippingOnboard = shippingOnboard.map((r, i) => (i === idx ? next : r));
  persistShippingOnboard();
  return next;
}
