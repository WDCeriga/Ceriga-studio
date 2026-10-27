import{currentFactoryId}from '../lib/factoryTeam';
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
import type { PricingStructure } from './manufacturerOnboardingTypes';
import type { Currency } from '../lib/currency';

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

// ---------------------------------------------------------------------------
// Manufacturer profile
// ---------------------------------------------------------------------------

export type ManufacturerProfile = {
  pricing?: PricingStructure;
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
  pricing?: PricingStructure | null;
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
    pricing: row.pricing ?? undefined,
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

  const {data,error}=await supabase.rpc('factory_workspace_profile');
  if(error)throw new Error('Could not load factory profile: '+error.message);
  return data?rowToProfile(data as ProfileRow):null;
}

export async function fetchMyProfileRole():Promise<string|null>{
 if(!isSupabaseConfigured)return 'manufacturer';
 const client=getSupabase();const {data:{user},error:authError}=await client.auth.getUser();
 if(authError)throw new Error(authError.message);if(!user)return null;
 const membership=await client.rpc('current_factory_id');if(membership.error)throw new Error(membership.error.message);if(membership.data)return 'manufacturer';
 const {data,error}=await client.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(error)throw new Error('Could not verify your account role: '+error.message);return data?.role??null;
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
  if (patch.pricing !== undefined) payload.pricing = patch.pricing;

  // Commit to Supabase before updating caches or reporting success.
  if(isSupabaseConfigured){
    const supabase=getSupabase();
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError)throw new Error(authError.message||'Could not verify your account');
    if(!user)throw new Error('You must be signed in');
    const savedResponse=await supabase.rpc('patch_factory_workspace',{p_patch:payload});if(savedResponse.error)throw new Error(savedResponse.error.message);
    const {data,error}=await supabase.rpc('factory_workspace_profile');
    if(error)throw new Error(error.message||'Could not save factory profile');
    if(!data)throw new Error('The database did not confirm the factory profile save');
    const saved=rowToProfile(data as ProfileRow);
    updateFactoryWorkspace({factoryName:saved.factoryName,contactName:saved.contactName??'',contactEmail:saved.contactEmail??'',contactPhone:saved.contactPhone??undefined,website:saved.website??undefined,addressLine:saved.addressLine??undefined,typicalLeadDays:saved.typicalLeadDays??undefined,onboardingComplete:saved.onboardingComplete,garments:saved.garments as any,capabilities:saved.capabilities as any,shippingRegions:saved.shippingRegions,moq:saved.moq,monthlyCapacity:saved.monthlyCapacity,internalNotes:saved.internalNotes??''});
    try{
      localStorage.setItem('ceriga_manufacturer_profile_'+user.id,JSON.stringify(saved));
      if(user.email)localStorage.setItem('ceriga_manufacturer_profile_'+user.email.toLowerCase(),JSON.stringify(saved));
      if(saved.onboardingComplete){localStorage.setItem('ceriga_manufacturer_onboarded_'+user.id,'true');if(user.email)localStorage.setItem('ceriga_manufacturer_onboarded_'+user.email.toLowerCase(),'true');}
    }catch{/* The confirmed database write remains authoritative if browser storage is unavailable. */}
    window.dispatchEvent(new Event('ceriga-manufacturer-profile-changed'));
    return saved;
  }
  const workspacePatch:Record<string,unknown>={};
  for(const [key,value]of Object.entries(patch))if(value!==undefined)workspacePatch[key]=value;
  updateFactoryWorkspace(workspacePatch);
  return (await fetchMyManufacturerProfile())!;
}

// ---------------------------------------------------------------------------
// Assigned orders
// ---------------------------------------------------------------------------

/** Order visible to the signed-in manufacturer (RLS: assigned_manufacturer_id). */
export async function fetchAssignedOrders(options:{quotations?:boolean}={}): Promise<UserOrder[]> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query=supabase.from('account_orders').select('*').eq('assigned_manufacturer_id',await currentFactoryId());
  if(options.quotations)query=query.in('status',['submitted','awaiting_payment']).or('factory_status.in.(new,reviewing,clarifying,quoted),factory_status.is.null').order('due_quote_by',{ascending:true,nullsFirst:false});
  const {data,error}=await query.order('created_at',{ascending:false});
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
    currency?: Currency;
    shippingCurrency?: Currency;
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
  const { error } = await supabase.rpc('patch_account_order',{p_order_id:id,p_patch:payload});
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
    .select('*').eq('user_id',await currentFactoryId())
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
      user_id: await currentFactoryId(),
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
  const { data, error } = await supabase.from('factory_materials').update(payload).eq('id', id).select('id').single();
  if (error) throw error;
}

export async function deleteFactoryMaterial(id: string): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase.from('factory_materials').delete().eq('id', id).select('id').single();
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
