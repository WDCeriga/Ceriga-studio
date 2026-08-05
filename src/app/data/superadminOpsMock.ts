/** Superadmin ops queues — assignment, capacity overview, QC flags. */

import {
  getFactoryWorkspace,
  isFactoryQuoteOverdue,
  listApprovedHolidays,
  listCapacityBlocks,
  listFactoryOrders,
  listPendingTimeOffRequests,
  mondayOf,
} from './manufacturerPortalMock';
import { listManufacturerProfiles } from './manufacturersMock';
import {
  MOCK_SUPER_ORDERS,
  patchSuperAdminOrder,
  type SuperAdminOrder,
} from './superadminMock';
import {
  getProductionJobForOrder,
  listPublishedPhotosForOrder,
  type ProductionJob,
} from './productionFloor';

const CAPACITY_OVERLAY_KEY = 'ceriga_factory_capacity_overlay_v1';

export type AssignmentConsoleRow = {
  order: SuperAdminOrder;
  overdue: boolean;
  slaHoursLeft: number | null;
  needsReroute: boolean;
  productionJob?: ProductionJob;
};

function daysUntil(iso: string, today = new Date().toISOString().slice(0, 10)): number {
  const a = new Date(today + 'T12:00:00').getTime();
  const b = new Date(iso + 'T12:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function listAssignmentConsoleRows(): AssignmentConsoleRow[] {
  const factoryOrders = listFactoryOrders('all');
  const today = new Date().toISOString().slice(0, 10);

  return MOCK_SUPER_ORDERS.filter(
    (o) =>
      o.kind === 'custom_clothing' &&
      ['submitted', 'assigned', 'priced', 'pending_review'].includes(o.status),
  )
    .map((order) => {
      const fo = factoryOrders.find(
        (f) =>
          order.manufacturerId === 'm1' &&
          (f.brandName === order.userName ||
            f.productName.toLowerCase().includes(order.productName.slice(0, 12).toLowerCase())),
      );
      const dueQuoteBy = order.dueQuoteBy ?? fo?.dueQuoteBy;
      const factoryQuoteStatus =
        order.factoryQuoteStatus ??
        (fo
          ? fo.status === 'rejected'
            ? 'rejected'
            : fo.status === 'quoted'
              ? 'quoted'
              : fo.status === 'clarifying'
                ? 'clarifying'
                : fo.status === 'reviewing'
                  ? 'reviewing'
                  : 'new'
          : order.manufacturerId
            ? 'new'
            : undefined);
      const factoryRejectReason = order.factoryRejectReason ?? fo?.rejectReason;
      const enriched: SuperAdminOrder = {
        ...order,
        dueQuoteBy,
        factoryQuoteStatus,
        factoryRejectReason,
      };
      const overdue = Boolean(
        dueQuoteBy &&
          !['quoted', 'priced', 'pending_review'].includes(factoryQuoteStatus ?? '') &&
          !order.quoteTiers?.length &&
          dueQuoteBy < today,
      );
      const slaHoursLeft =
        dueQuoteBy && !order.quoteTiers?.length ? daysUntil(dueQuoteBy, today) * 24 : null;
      return {
        order: enriched,
        overdue,
        slaHoursLeft,
        needsReroute: factoryQuoteStatus === 'rejected' || Boolean(factoryRejectReason),
        productionJob: getProductionJobForOrder(order.id),
      };
    })
    .sort((a, b) => {
      if (a.needsReroute !== b.needsReroute) return a.needsReroute ? -1 : 1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const da = a.order.dueQuoteBy ?? '9999';
      const db = b.order.dueQuoteBy ?? '9999';
      return da.localeCompare(db);
    });
}

export function assignOrderToManufacturer(input: {
  orderId: string;
  manufacturerId: string;
  dueQuoteBy: string;
}): SuperAdminOrder | undefined {
  const profile = listManufacturerProfiles().find((p) => p.entityId === input.manufacturerId);
  if (!profile) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  return patchSuperAdminOrder(input.orderId, {
    status: 'assigned',
    manufacturerId: profile.entityId,
    manufacturerName: profile.name,
    assignedAt: today,
    dueQuoteBy: input.dueQuoteBy,
    factoryQuoteStatus: 'new',
    factoryRejectReason: undefined,
  });
}

export function rerouteOrderToManufacturer(input: {
  orderId: string;
  manufacturerId: string;
  dueQuoteBy: string;
}): SuperAdminOrder | undefined {
  return assignOrderToManufacturer(input);
}

export function clearManufacturerAssignment(orderId: string): SuperAdminOrder | undefined {
  return patchSuperAdminOrder(orderId, {
    status: 'submitted',
    manufacturerId: undefined,
    manufacturerName: undefined,
    assignedAt: undefined,
    dueQuoteBy: undefined,
    factoryQuoteStatus: undefined,
    factoryRejectReason: undefined,
  });
}

export type FactoryCapacityOverview = {
  factoryId: string;
  factoryName: string;
  userId: string;
  monthlyCapacity: number;
  status: string;
  blockedWeeks: number;
  pendingTimeOff: number;
  approvedCustomHolidays: number;
  loadPct: number;
  nextBlockedWeek?: string;
  live: boolean;
};

type CapacityOverlay = {
  factoryId: string;
  blockedWeeks: number;
  pendingTimeOff: number;
  approvedCustomHolidays: number;
  nextBlockedWeek?: string;
  loadPct: number;
};

function seedCapacityOverlays(): CapacityOverlay[] {
  return [
    {
      factoryId: 'm2',
      blockedWeeks: 1,
      pendingTimeOff: 1,
      approvedCustomHolidays: 2,
      nextBlockedWeek: mondayOf(new Date('2026-08-10T12:00:00')),
      loadPct: 78,
    },
    {
      factoryId: 'm3',
      blockedWeeks: 0,
      pendingTimeOff: 0,
      approvedCustomHolidays: 1,
      loadPct: 54,
    },
  ];
}

function loadCapacityOverlays(): CapacityOverlay[] {
  try {
    const raw = localStorage.getItem(CAPACITY_OVERLAY_KEY);
    if (raw) return JSON.parse(raw) as CapacityOverlay[];
  } catch {
    /* ignore */
  }
  return seedCapacityOverlays();
}

export function listFactoryCapacityOverviews(): FactoryCapacityOverview[] {
  const overlays = loadCapacityOverlays();
  const ws = getFactoryWorkspace();
  const blocks = listCapacityBlocks().filter((b) => b.full);
  const pending = listPendingTimeOffRequests();
  const approvedCustom = listApprovedHolidays().filter((h) => h.source === 'custom');
  const factoryOrders = listFactoryOrders('all');
  const capacityUsed = factoryOrders
    .filter((o) => ['quoted', 'in_production'].includes(o.status))
    .reduce((s, o) => s + o.capacityUnitsEstimate, 0);

  return listManufacturerProfiles().map((p) => {
    if (p.entityId === ws.factoryId || p.entityId === 'm1') {
      return {
        factoryId: p.entityId,
        factoryName: p.name,
        userId: p.userId,
        monthlyCapacity: p.capacityUnitsPerMonth,
        status: p.status,
        blockedWeeks: blocks.length,
        pendingTimeOff: pending.length,
        approvedCustomHolidays: approvedCustom.length,
        loadPct: Math.min(
          100,
          Math.round((capacityUsed / Math.max(ws.monthlyCapacity, 1)) * 100),
        ),
        nextBlockedWeek: blocks[0]?.weekStart,
        live: true,
      };
    }
    const ov = overlays.find((o) => o.factoryId === p.entityId);
    return {
      factoryId: p.entityId,
      factoryName: p.name,
      userId: p.userId,
      monthlyCapacity: p.capacityUnitsPerMonth,
      status: p.status,
      blockedWeeks: ov?.blockedWeeks ?? 0,
      pendingTimeOff: ov?.pendingTimeOff ?? 0,
      approvedCustomHolidays: ov?.approvedCustomHolidays ?? 0,
      loadPct: ov?.loadPct ?? 40,
      nextBlockedWeek: ov?.nextBlockedWeek,
      live: false,
    };
  });
}

export function flagQcForBrand(orderId: string, note?: string): SuperAdminOrder | undefined {
  return patchSuperAdminOrder(orderId, {
    qcFlaggedForBrand: true,
    qcFlagNote: note?.trim() || undefined,
    qcFlaggedAt: new Date().toISOString().slice(0, 10),
  });
}

export function clearQcBrandFlag(orderId: string): SuperAdminOrder | undefined {
  return patchSuperAdminOrder(orderId, {
    qcFlaggedForBrand: false,
    qcFlagNote: undefined,
    qcFlaggedAt: undefined,
  });
}

export function getProductionPulse(orderId: string) {
  const job = getProductionJobForOrder(orderId);
  const photos = listPublishedPhotosForOrder(orderId);
  const order = MOCK_SUPER_ORDERS.find((o) => o.id === orderId);
  return {
    job,
    photoCount: photos.length,
    flagged: Boolean(order?.qcFlaggedForBrand),
    flagNote: order?.qcFlagNote,
    flaggedAt: order?.qcFlaggedAt,
  };
}

export function countFactoryOverdueQuotes(): number {
  return listFactoryOrders('all').filter((o) => isFactoryQuoteOverdue(o)).length;
}

export {
  listShippingOnboardRequests,
  approveShippingOnboardRequest,
  declineShippingOnboardRequest,
  type ShippingOnboardRequest,
} from './shippingOnboardMock';
