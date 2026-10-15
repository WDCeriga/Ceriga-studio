import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { rowToUserOrder, type OrderRow } from '../lib/ordersDb';
import type { UserOrder } from './userOrders';
import type { OrderDeliveryInfo } from './orderDelivery';
import {
  getFactoryWorkspace,
  updateFactoryWorkspace,
  type FactoryMaterial,
  type FactoryMaterialKind,
  type FactoryMaterialUnit,
} from './manufacturerPortalMock';
import { getStoredInvites } from './manufacturerInvites';

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

// ---------------------------------------------------------------------------
// Manufacturer profile
// ---------------------------------------------------------------------------

export type ManufacturerProfile = {
  userId: string;
  factoryName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  addressLine: string | null;
  typicalLeadDays: number | null;
  onboardingComplete: boolean;
  garments: string[];
  capabilities: string[];
  shippingRegions: string[];
  moq: number;
  monthlyCapacity: number;
  internalNotes: string | null;
};

type ProfileRow = {
  user_id: string;
  factory_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address_line: string | null;
  typical_lead_days: number | null;
  onboarding_complete: boolean;
  garments: string[];
  capabilities: string[];
  shipping_regions: string[];
  moq: number;
  monthly_capacity: number;
  internal_notes: string | null;
};

function rowToProfile(row: ProfileRow): ManufacturerProfile {
  return {
    userId: row.user_id,
    factoryName: row.factory_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    website: row.website,
    addressLine: row.address_line,
    typicalLeadDays: row.typical_lead_days,
    onboardingComplete: row.onboarding_complete,
    garments: row.garments ?? [],
    capabilities: row.capabilities ?? [],
    shippingRegions: row.shipping_regions ?? [],
    moq: row.moq,
    monthlyCapacity: row.monthly_capacity,
    internalNotes: row.internal_notes,
  };
}

export async function fetchMyManufacturerProfile(): Promise<ManufacturerProfile | null> {
  const userWs = getFactoryWorkspace();
  const fallbackProfile: ManufacturerProfile = {
    userId: 'local-workspace',
    factoryName: userWs.factoryName,
    contactName: userWs.contactName || 'Partner',
    contactEmail: userWs.contactEmail || 'partner@ceriga.com',
    contactPhone: userWs.contactPhone || null,
    website: userWs.website || null,
    addressLine: userWs.addressLine || null,
    typicalLeadDays: userWs.typicalLeadDays ?? 14,
    onboardingComplete: userWs.onboardingComplete,
    garments: userWs.garments,
    capabilities: userWs.capabilities,
    shippingRegions: userWs.shippingRegions,
    moq: userWs.moq,
    monthlyCapacity: userWs.monthlyCapacity,
    internalNotes: userWs.internalNotes || null,
  };

  if (!isSupabaseConfigured) {
    return fallbackProfile;
  }

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('manufacturer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.warn('[manufacturerDb] manufacturer_profiles table not available, using local profile:', error.message);
      return {
        ...fallbackProfile,
        userId: user.id,
        contactEmail: user.email ?? fallbackProfile.contactEmail,
        onboardingComplete:
          localStorage.getItem(`ceriga_manufacturer_onboarded_${user.id}`) === 'true' ||
          Boolean(
            user.email &&
              localStorage.getItem(
                `ceriga_manufacturer_onboarded_${user.email.toLowerCase()}`,
              ) === 'true',
          ) ||
          Boolean(userWs.onboardingComplete),
      };
    }
    if (!data) {
      try {
        const localProfRaw =
          localStorage.getItem(`ceriga_manufacturer_profile_${user.id}`) ||
          (user.email ? localStorage.getItem(`ceriga_manufacturer_profile_${user.email.toLowerCase()}`) : null);
        if (localProfRaw) {
          return JSON.parse(localProfRaw);
        }
        const isOnboarded =
          localStorage.getItem(`ceriga_manufacturer_onboarded_${user.id}`) === 'true' ||
          Boolean(
            user.email &&
              localStorage.getItem(
                `ceriga_manufacturer_onboarded_${user.email.toLowerCase()}`,
              ) === 'true',
          ) ||
          Boolean(userWs.onboardingComplete);
        return {
          ...fallbackProfile,
          userId: user.id,
          factoryName: userWs.factoryName,
          contactName: userWs.contactName || (user.email ? user.email.split('@')[0] : 'Partner'),
          contactEmail: user.email ?? userWs.contactEmail,
          onboardingComplete: isOnboarded,
        };
      } catch {
        /* ignore */
      }
      return null;
    }
    return rowToProfile(data as ProfileRow);
  } catch {
    return fallbackProfile;
  }
}

export async function fetchMyProfileRole(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return 'manufacturer';
  }

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Check user_metadata.role
  const meta = user.user_metadata as { role?: string } | undefined;
  if (meta?.role === 'manufacturer' || meta?.role === 'worker') {
    return meta.role;
  }

  // 2. Check localStorage cached role
  try {
    const localRoleById = localStorage.getItem(`ceriga_role_${user.id}`);
    if (localRoleById === 'manufacturer' || localRoleById === 'worker') {
      return localRoleById;
    }
    if (user.email) {
      const localRoleByEmail = localStorage.getItem(`ceriga_role_${user.email.toLowerCase()}`);
      if (localRoleByEmail === 'manufacturer' || localRoleByEmail === 'worker') {
        return localRoleByEmail;
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Check if user email matches any manufacturer invite
  if (user.email) {
    const normalized = user.email.toLowerCase();
    const invites = getStoredInvites();
    if (invites.some((i) => i.email.toLowerCase() === normalized)) {
      try {
        localStorage.setItem(`ceriga_role_${normalized}`, 'manufacturer');
        localStorage.setItem(`ceriga_role_${user.id}`, 'manufacturer');
      } catch {
        /* ignore */
      }
      return 'manufacturer';
    }
  }

  // 4. Query public.profiles if table is available
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && typeof data?.role === 'string') {
      return data.role;
    }
  } catch {
    /* ignore if profiles table is not created */
  }

  return meta?.role ?? null;
}

export async function saveMyManufacturerProfile(
  patch: Partial<Omit<ManufacturerProfile, 'userId'>>,
): Promise<ManufacturerProfile> {
  const payload: Record<string, unknown> = {};
  if (patch.factoryName !== undefined) payload.factory_name = patch.factoryName;
  if (patch.contactName !== undefined) payload.contact_name = patch.contactName;
  if (patch.contactEmail !== undefined) payload.contact_email = patch.contactEmail;
  if (patch.contactPhone !== undefined) payload.contact_phone = patch.contactPhone;
  if (patch.website !== undefined) payload.website = patch.website;
  if (patch.addressLine !== undefined) payload.address_line = patch.addressLine;
  if (patch.typicalLeadDays !== undefined) payload.typical_lead_days = patch.typicalLeadDays;
  if (patch.onboardingComplete !== undefined) {
    payload.onboarding_complete = patch.onboardingComplete;
  }
  if (patch.garments !== undefined) payload.garments = patch.garments;
  if (patch.capabilities !== undefined) payload.capabilities = patch.capabilities;
  if (patch.shippingRegions !== undefined) payload.shipping_regions = patch.shippingRegions;
  if (patch.moq !== undefined) payload.moq = patch.moq;
  if (patch.monthlyCapacity !== undefined) payload.monthly_capacity = patch.monthlyCapacity;
  if (patch.internalNotes !== undefined) payload.internal_notes = patch.internalNotes;

  updateFactoryWorkspace({
    factoryName: patch.factoryName,
    moq: patch.moq,
    monthlyCapacity: patch.monthlyCapacity,
    onboardingComplete: patch.onboardingComplete,
    garments: patch.garments as any,
    capabilities: patch.capabilities as any,
    internalNotes: patch.internalNotes,
  });

  if (!isSupabaseConfigured) {
    return (await fetchMyManufacturerProfile())!;
  }

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in');

  try {
    if (patch.onboardingComplete) {
      localStorage.setItem(`ceriga_manufacturer_onboarded_${user.id}`, 'true');
      if (user.email) {
        localStorage.setItem(`ceriga_manufacturer_onboarded_${user.email.toLowerCase()}`, 'true');
        localStorage.setItem(`ceriga_role_${user.email.toLowerCase()}`, 'manufacturer');
      }
      localStorage.setItem(`ceriga_role_${user.id}`, 'manufacturer');
    }
    const localProfileObj: ManufacturerProfile = {
      userId: user.id,
      factoryName: patch.factoryName ?? 'My factory',
      contactName: patch.contactName ?? null,
      contactEmail: patch.contactEmail ?? user.email ?? null,
      contactPhone: patch.contactPhone ?? null,
      website: patch.website ?? null,
      addressLine: patch.addressLine ?? null,
      typicalLeadDays: patch.typicalLeadDays ?? null,
      onboardingComplete: patch.onboardingComplete ?? true,
      garments: patch.garments ?? [],
      capabilities: patch.capabilities ?? [],
      shippingRegions: patch.shippingRegions ?? [],
      moq: patch.moq ?? 50,
      monthlyCapacity: patch.monthlyCapacity ?? 0,
      internalNotes: patch.internalNotes ?? null,
    };
    localStorage.setItem(`ceriga_manufacturer_profile_${user.id}`, JSON.stringify(localProfileObj));
    if (user.email) {
      localStorage.setItem(`ceriga_manufacturer_profile_${user.email.toLowerCase()}`, JSON.stringify(localProfileObj));
    }
  } catch {
    /* ignore */
  }

  try {
    const { data, error } = await supabase
      .from('manufacturer_profiles')
      .upsert({ user_id: user.id, ...payload })
      .select('*')
      .single();
    if (!error && data) {
      return rowToProfile(data as ProfileRow);
    }
  } catch (err) {
    console.warn('[manufacturerDb] Could not save to manufacturer_profiles in DB:', err);
  }

  return {
    userId: user.id,
    factoryName: patch.factoryName ?? 'My factory',
    contactName: patch.contactName ?? null,
    contactEmail: patch.contactEmail ?? user.email ?? null,
    contactPhone: patch.contactPhone ?? null,
    website: patch.website ?? null,
    addressLine: patch.addressLine ?? null,
    typicalLeadDays: patch.typicalLeadDays ?? null,
    onboardingComplete: patch.onboardingComplete ?? true,
    garments: patch.garments ?? [],
    capabilities: patch.capabilities ?? [],
    shippingRegions: patch.shippingRegions ?? [],
    moq: patch.moq ?? 50,
    monthlyCapacity: patch.monthlyCapacity ?? 0,
    internalNotes: patch.internalNotes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Assigned orders
// ---------------------------------------------------------------------------

/** Order visible to the signed-in manufacturer (RLS: assigned_manufacturer_id). */
export async function fetchAssignedOrders(): Promise<UserOrder[]> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('assigned_manufacturer_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(rowToUserOrder);
}

export type AssignedOrderPatch = {
  factoryStatus?: UserOrder['factoryStatus'];
  manufacturerQuote?: {
    id: string;
    kind: 'sample' | 'bulk';
    label: string;
    totalUnits: number;
    manufacturerQuoteCents: number;
    leadTimeDays?: number;
    deliveryOptionId?: string;
    shippingQuoteCents?: number;
  }[] | null;
  factoryRejectReason?: string | null;
  tracking?: string | null;
  status?: UserOrder['status'];
  statusLabel?: string;
};

/** Manufacturer-side patch (RLS limits rows to their assignments). */
export async function patchAssignedOrder(
  id: string,
  patch: AssignedOrderPatch,
): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.factoryStatus !== undefined) payload.factory_status = patch.factoryStatus;
  if (patch.manufacturerQuote !== undefined) {
    payload.manufacturer_quote = patch.manufacturerQuote;
    payload.quoted_at = patch.manufacturerQuote ? new Date().toISOString() : null;
  }
  if (patch.factoryRejectReason !== undefined) {
    payload.factory_reject_reason = patch.factoryRejectReason;
  }
  if (patch.tracking !== undefined) payload.tracking = patch.tracking;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.statusLabel !== undefined) payload.status_label = patch.statusLabel;
  const { error } = await supabase.from('orders').update(payload).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Factory materials
// ---------------------------------------------------------------------------

type MaterialRow = {
  id: string;
  user_id: string;
  name: string;
  kind: FactoryMaterialKind;
  colour: string | null;
  gsm: number | null;
  quantity: number;
  unit: FactoryMaterialUnit;
  reorder_at: number;
  supplier: string | null;
  location: string | null;
  notes: string | null;
  updated_at: string;
};

function rowToMaterial(row: MaterialRow): FactoryMaterial {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    colour: row.colour ?? undefined,
    gsm: row.gsm ?? undefined,
    quantity: Number(row.quantity),
    unit: row.unit,
    reorderAt: Number(row.reorder_at),
    supplier: row.supplier ?? undefined,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at.slice(0, 10),
  };
}

export async function fetchFactoryMaterials(): Promise<FactoryMaterial[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('factory_materials')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MaterialRow[]).map(rowToMaterial);
}

export async function insertFactoryMaterial(
  input: Omit<FactoryMaterial, 'id' | 'updatedAt'>,
): Promise<FactoryMaterial> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in');
  const { data, error } = await supabase
    .from('factory_materials')
    .insert({
      user_id: user.id,
      name: input.name,
      kind: input.kind,
      colour: input.colour ?? null,
      gsm: input.gsm ?? null,
      quantity: input.quantity,
      unit: input.unit,
      reorder_at: input.reorderAt,
      supplier: input.supplier ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToMaterial(data as MaterialRow);
}

export async function patchFactoryMaterial(
  id: string,
  patch: Partial<Omit<FactoryMaterial, 'id'>>,
): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.kind !== undefined) payload.kind = patch.kind;
  if (patch.colour !== undefined) payload.colour = patch.colour ?? null;
  if (patch.gsm !== undefined) payload.gsm = patch.gsm ?? null;
  if (patch.quantity !== undefined) payload.quantity = patch.quantity;
  if (patch.unit !== undefined) payload.unit = patch.unit;
  if (patch.reorderAt !== undefined) payload.reorder_at = patch.reorderAt;
  if (patch.supplier !== undefined) payload.supplier = patch.supplier ?? null;
  if (patch.location !== undefined) payload.location = patch.location ?? null;
  if (patch.notes !== undefined) payload.notes = patch.notes ?? null;
  const { error } = await supabase.from('factory_materials').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteFactoryMaterial(id: string): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { error } = await supabase.from('factory_materials').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Capacity blocks
// ---------------------------------------------------------------------------

export type CapacityBlock = { weekStart: string; full: boolean; note?: string };

export async function fetchCapacityBlocks(): Promise<CapacityBlock[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('factory_capacity_blocks')
    .select('week_start, full, note')
    .order('week_start', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { week_start: string; full: boolean; note: string | null }[]).map(
    (r) => ({ weekStart: r.week_start, full: r.full, note: r.note ?? undefined }),
  );
}

export async function setCapacityBlock(block: CapacityBlock): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in');
  if (!block.full && !block.note) {
    const { error } = await supabase
      .from('factory_capacity_blocks')
      .delete()
      .eq('user_id', user.id)
      .eq('week_start', block.weekStart);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('factory_capacity_blocks').upsert({
    user_id: user.id,
    week_start: block.weekStart,
    full: block.full,
    note: block.note ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useManufacturerPortal() {
  const [profile, setProfile] = useState<ManufacturerProfile | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setReady(true);
      return;
    }
    setLoading(true);
    try {
      const [p, o] = await Promise.all([fetchMyManufacturerProfile(), fetchAssignedOrders()]);
      setProfile(p);
      setOrders(o);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portal data');
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completeOnboarding = useCallback(
    async (input: {
      factoryName: string;
      garments: string[];
      capabilities: string[];
      shippingRegions: string[];
      moq: number;
      monthlyCapacity: number;
    }) => {
      const next = await saveMyManufacturerProfile({
        ...input,
        onboardingComplete: true,
      });
      setProfile(next);
      return next;
    },
    [],
  );

  return { profile, orders, loading, error, ready, refresh, completeOnboarding };
}
