import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { rowToUserOrder, type OrderRow } from './ordersDb';
import type { UserOrder } from '../data/userOrders';
import type {
  OrderKind,
  OrderStatus,
  SuperAdminOrder,
  SuperAdminUser,
  ManufacturerQuoteTier,
} from '../data/superadminMock';
import type { OrderDeliveryInfo } from '../data/orderDelivery';
import { applyProductionMargin, getProductionMarginPercent } from '../data/superadminPricingMock';

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

/** DB order status → superadmin pipeline status. */
function toSuperStatus(order: UserOrder): OrderStatus {
  if (order.factoryStatus === 'quoted') return 'pending_review';
  if (order.factoryStatus === 'rejected') return 'assigned';
  if (order.assignedManufacturerId) return 'assigned';
  switch (order.status) {
    case 'submitted':
    case 'awaiting_payment':
      return 'submitted';
    case 'priced':
      return 'sent_to_brand';
    case 'paid':
      return 'paid';
    case 'processing':
      return 'in_production';
    case 'shipping':
      return 'shipped';
    case 'completed':
    case 'ready':
      return 'completed';
    default:
      return 'submitted';
  }
}

function toQuoteTiers(order: UserOrder): ManufacturerQuoteTier[] {
  if (!order.manufacturerQuote?.length) return [];
  const margin = getProductionMarginPercent();
  const calculated = order.manufacturerQuote.map((tier) => ({
    id: tier.id,
    kind: tier.kind,
    label: tier.label,
    totalUnits: tier.totalUnits,
    manufacturerQuoteCents: tier.manufacturerQuoteCents,
    calculatedPriceCents: applyProductionMargin(tier.manufacturerQuoteCents, margin),
  }));
  if (order.status === 'priced' || order.paidAmountCents != null) {
    // Prices were sent to the brand — surface calculated values as final.
    return calculated.map((t) => ({ ...t, finalPriceCents: t.calculatedPriceCents }));
  }
  return calculated;
}

/** Adapter: DB user order (+ owner, manufacturer name) → SuperAdminOrder for the console. */
export function toSuperAdminOrder(
  order: UserOrder,
  opts: {
    userId: string;
    createdAtIso: string;
    userName?: string;
    contactEmail?: string | null;
    manufacturerName?: string;
  },
): SuperAdminOrder {
  const kind: OrderKind = order.kind === 'tech-pack' ? 'techpack' : 'custom_clothing';
  const selectedOption = order.priceOptions?.find(
    (o) => o.id === order.selectedPriceOptionId,
  );
  return {
    id: order.id,
    kind,
    userId: opts.userId,
    userName: opts.userName ?? order.contactName ?? 'Brand',
    userEmail: opts.contactEmail ?? order.contactEmail ?? '',
    productName: order.productName,
    status: toSuperStatus(order),
    createdAt: opts.createdAtIso,
    manufacturerId: order.assignedManufacturerId,
    manufacturerName: opts.manufacturerName,
    delivery: order.delivery,
    deliveryCountry: order.delivery?.country ?? '—',
    deliveryCity: order.delivery?.city ?? '—',
    orderQuantities: order.orderQuantities,
    quoteTiers: toQuoteTiers(order),
    manufacturerQuoteCents: order.manufacturerQuote?.[0]?.manufacturerQuoteCents,
    dueQuoteBy: order.dueQuoteBy,
    assignedAt: order.assignedAt?.slice(0, 10),
    factoryQuoteStatus: order.factoryStatus,
    factoryRejectReason: order.factoryRejectReason,
    cerigaMarginPercent: getProductionMarginPercent(),
    finalPriceCents:
      order.paidAmountCents ??
      (selectedOption ? selectedOption.priceCents : undefined),
    trackingNumber: order.tracking ?? undefined,
    notes: order.opsNotes,
    garmentType: order.garmentType,
    exportFormat: order.exportFormat,
  };
}

/** Fetch every order visible to the superadmin (RLS-gated). */
export async function fetchAllOrders(): Promise<SuperAdminOrder[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const orders = ((rows ?? []) as OrderRow[]).map(rowToUserOrder);

  // Resolve manufacturer display names in one query.
  const manufacturerIds = [
    ...new Set(orders.map((o) => o.assignedManufacturerId).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (manufacturerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('manufacturer_profiles')
      .select('user_id, factory_name')
      .in('user_id', manufacturerIds);
    for (const p of (profiles ?? []) as { user_id: string; factory_name: string }[]) {
      names.set(p.user_id, p.factory_name);
    }
  }

  // Resolve brand display names from profiles.
  const brandIds = [...new Set(rows!.map((r) => r.user_id))] as string[];
  const brandNames = new Map<string, string>();
  const brandEmails = new Map<string, string>();
  if (brandIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', brandIds);
    for (const p of (profiles ?? []) as {
      id: string;
      email: string;
      full_name: string | null;
    }[]) {
      brandNames.set(p.id, p.full_name || p.email.split('@')[0] || 'Brand');
      brandEmails.set(p.id, p.email);
    }
  }

  return rows!.map((row, i) => {
    const order = orders[i];
    return toSuperAdminOrder(order, {
      userId: row.user_id,
      createdAtIso: row.created_at,
      userName: brandNames.get(row.user_id),
      contactEmail: brandEmails.get(row.user_id) ?? row.contact_email,
      manufacturerName: names.get(row.assigned_manufacturer_id ?? ''),
    });
  });
}

/** Fetch platform users from profiles (RLS: superadmin sees all rows). */
export async function fetchAllUsers(): Promise<SuperAdminUser[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at: string;
    updated_at: string;
  }[]).map((row) => ({
    id: row.id,
    name: row.full_name || row.email.split('@')[0] || 'User',
    email: row.email,
    credits: 0,
    role: row.role === 'manufacturer' || row.role === 'worker' ? row.role : 'brand',
    createdAt: row.created_at.slice(0, 10),
    lastActive: row.updated_at.slice(0, 10),
    ordersCount: 0,
  }));
}

/** Manufacturer accounts for the assignment console. */
export type ManufacturerAccount = {
  userId: string;
  factoryName: string;
  email: string;
  onboardingComplete: boolean;
  moq: number | null;
  monthlyCapacity: number | null;
  garments: string[];
};

export async function fetchManufacturerAccounts(): Promise<ManufacturerAccount[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, manufacturer_profiles ( factory_name, onboarding_complete, moq, monthly_capacity, garments )',
    )
    .eq('role', 'manufacturer')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    email: string;
    manufacturer_profiles:
      | {
          factory_name: string;
          onboarding_complete: boolean;
          moq: number;
          monthly_capacity: number;
          garments: string[];
        }[]
      | null;
  }[]).map((row) => ({
    userId: row.id,
    factoryName: row.manufacturer_profiles?.[0]?.factory_name ?? row.email,
    email: row.email,
    onboardingComplete: row.manufacturer_profiles?.[0]?.onboarding_complete ?? false,
    moq: row.manufacturer_profiles?.[0]?.moq ?? null,
    monthlyCapacity: row.manufacturer_profiles?.[0]?.monthly_capacity ?? null,
    garments: row.manufacturer_profiles?.[0]?.garments ?? [],
  }));
}

/** Admin patch onto a DB order (RLS: is_superadmin). */
export async function adminPatchOrder(
  id: string,
  patch: {
    status?: OrderStatus;
    assignedManufacturerId?: string | null;
    dueQuoteBy?: string | null;
    tracking?: string | null;
    opsNotes?: string | null;
    statusLabel?: string;
  },
): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.assignedManufacturerId !== undefined) {
    payload.assigned_manufacturer_id = patch.assignedManufacturerId;
    payload.assigned_at = patch.assignedManufacturerId ? new Date().toISOString() : null;
    payload.factory_status = patch.assignedManufacturerId ? 'new' : null;
    payload.factory_reject_reason = null;
  }
  if (patch.dueQuoteBy !== undefined) payload.due_quote_by = patch.dueQuoteBy;
  if (patch.tracking !== undefined) payload.tracking = patch.tracking;
  if (patch.opsNotes !== undefined) payload.ops_notes = patch.opsNotes;
  if (patch.status !== undefined) {
    // Map back to the brand-facing status enum where applicable.
    switch (patch.status) {
      case 'paid':
        payload.status = 'paid';
        break;
      case 'in_production':
        payload.status = 'processing';
        break;
      case 'shipped':
        payload.status = 'shipping';
        break;
      case 'completed':
        payload.status = 'completed';
        break;
      case 'sent_to_brand':
        payload.status = 'priced';
        break;
      case 'submitted':
        payload.status = 'submitted';
        break;
      case 'assigned':
      case 'priced':
      case 'pending_review':
      case 'draft':
        // Pipeline-internal states live in factory_status / assignment columns.
        break;
    }
  }
  if (patch.statusLabel !== undefined) payload.status_label = patch.statusLabel;
  const { error } = await supabase.from('orders').update(payload).eq('id', id);
  if (error) throw error;
}
