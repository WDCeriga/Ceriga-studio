import { type ApprovedTierPrice } from './customerQuote';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { rowToUserOrder, type OrderRow } from './ordersDb';
import type { UserOrder } from '../data/userOrders';
import {
  MOCK_SUPER_USERS,
  type OrderKind,
  type OrderStatus,
  type SuperAdminOrder,
  type SuperAdminUser,
  type ManufacturerQuoteTier,
} from '../data/superadminMock';
import type { OrderDeliveryInfo } from '../data/orderDelivery';
import { applyProductionMargin, getProductionMarginPercent } from '../data/superadminPricingMock';
import { listManufacturerProfiles } from '../data/manufacturersMock';
import { getStoredInvites } from '../data/manufacturerInvites';

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

function adminLoadError(error: unknown, fallback: string): Error {
  const details = error as { message?: string; code?: string } | null;
  if (details?.code === 'PGRST205' && details.message?.includes('profiles')) {
    return new Error('User profiles are not set up in Supabase. Run supabase/repair_user_profiles.sql in the project SQL Editor, then retry.');
  }
  return new Error(details?.message || fallback);
}

async function performadminDeleteOrder(id: string): Promise<void> {
 requireConfigured();
 const {data,error}=await getSupabase().rpc('admin_delete_order',{p_order_id:id});
 if(error)throw new Error(error.message);
 if(data!==id)throw new Error('Order was not deleted. Check permissions and whether it still exists.');
}

async function performadminDeleteAccount(userId: string): Promise<void> {
  requireConfigured();
  const { data, error } = await getSupabase().functions.invoke('admin-delete-account', { body: { userId } });
  if (error) {
    const response = (error as { context?: Response }).context;
    const details = response ? await response.json().catch(() => null) : null;
    throw new Error(details?.error || error.message);
  }
  if (!data?.deleted) throw new Error(data?.error || 'Account was not deleted');
}

/** Matches RLS `public.is_superadmin()` — full email must be in `superadmin_emails`. */
export async function fetchIsSuperadmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('is_superadmin');
  if (error) {
    console.warn('[superadmin] is_superadmin RPC failed:', error.message);
    return false;
  }
  return data === true;
}

/** DB order status → superadmin pipeline status. */
function toSuperStatus(order: UserOrder): OrderStatus {
  if(order.status==='priced') return order.priceOptions?.length ? 'sent_to_brand' : 'pending_review';
  if(['paid','processing','shipping','completed','ready'].includes(order.status)) {
    return ({paid:'paid',processing:'in_production',shipping:'shipped',completed:'completed',ready:'completed'} as const)[order.status as 'paid'|'processing'|'shipping'|'completed'|'ready'];
  }
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
    currency: tier.currency,
    leadTimeDays: tier.leadTimeDays,
    calculatedPriceCents: applyProductionMargin(tier.manufacturerQuoteCents, margin),
  }));
  if (order.status === 'priced' || order.paidAmountCents != null) {
    // Prices were sent to the brand — surface calculated values as final.
    return calculated.map(t=>{const option=order.priceOptions?.find(option=>option.id===t.id);return{...t,finalPriceCents:option?.currencySnapshot?.approvedOriginalCents??(option?.currency===t.currency?option?.priceCents:undefined),finalCurrency:t.currency,payablePriceCents:option?.priceCents,payableCurrency:option?.currency};});
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
  const manufacturerTier=order.manufacturerQuote?.find(t=>t.id===selectedOption?.id)??order.manufacturerQuote?.[0];
  return {
    id: order.id,
    currency:order.paidCurrency??selectedOption?.currency,
    currencySnapshot:selectedOption?.currencySnapshot,
    manufacturerCurrency:manufacturerTier?.currency,
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
    manufacturerQuoteCents: manufacturerTier?.manufacturerQuoteCents,
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
    requiredCapabilities: order.specifications?.requiredCapabilities,
    specifications: order.specifications,
    quoteExpiresAt: order.quoteExpiresAt,
    routingVersion: order.routingVersion,
    exportFormat: order.exportFormat,
  };
}

/** Fetch every order visible to the superadmin (RLS-gated). */
async function loadfetchAllOrders(): Promise<SuperAdminOrder[]> {
  requireConfigured();
  const supabase = getSupabase();
  const {data:rows,error}=await supabase.from('account_orders').select('*').order('created_at',{ascending:false});
  if (error) throw new Error(error.message||'Could not load customer orders');

  const orderRows=(rows??[]) as OrderRow[];
  const orders = orderRows.map(rowToUserOrder);

  // Resolve manufacturer display names in one query.
  const manufacturerIds = [
    ...new Set(orders.map((o) => o.assignedManufacturerId).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (manufacturerIds.length > 0) {
    const { data: profiles,error:profileError } = await supabase
      .from('manufacturer_profiles')
      .select('user_id, factory_name')
      .in('user_id', manufacturerIds);
    if(profileError)throw new Error('Could not load manufacturer details: '+profileError.message);
    for (const p of (profiles ?? []) as { user_id: string; factory_name: string }[]) {
      names.set(p.user_id, p.factory_name);
    }
  }

  // Resolve brand display names from profiles.
  const brandIds = [...new Set(orderRows.map((r) => r.user_id))] as string[];
  const brandNames = new Map<string, string>();
  const brandEmails = new Map<string, string>();
  if (brandIds.length > 0) {
    const { data: profiles,error:profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', brandIds);
    if(profileError)throw new Error('Could not load customer details: '+profileError.message);
    for (const p of (profiles ?? []) as {
      id: string;
      email: string;
      full_name: string | null;
    }[]) {
      brandNames.set(p.id, p.full_name || p.email?.split('@')[0] || 'Brand');
      brandEmails.set(p.id, p.email);
    }
  }

  const routedIds=orderRows.filter(row=>row.routing_version===2).map(row=>row.id);
  const events=routedIds.length?await supabase.from('order_routing_events').select('order_id,manufacturer_id,event_type').in('order_id',routedIds):{data:[],error:null};
  if(events.error)throw new Error(events.error.message);
  return orderRows.map((row, i) => {
    const order = orders[i];
    return {...toSuperAdminOrder(order, {
      userId: row.user_id,
      createdAtIso: row.created_at,
      userName: brandNames.get(row.user_id),
      contactEmail: brandEmails.get(row.user_id) ?? row.contact_email,
      manufacturerName: names.get(row.assigned_manufacturer_id ?? ''),
    }), rejectedManufacturerIds:(events.data??[]).filter(event=>event.order_id===row.id&&['manufacturer_declined','admin_rejected','manufacturer_quotation_rejected'].includes(event.event_type)).map(event=>event.manufacturer_id).filter(Boolean)};
  });
}

function getLocalUsers(): SuperAdminUser[] {
  const users: SuperAdminUser[] = [...MOCK_SUPER_USERS];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ceriga_role_')) {
        const identifier = key.slice('ceriga_role_'.length).toLowerCase();
        const role = (localStorage.getItem(key) as SuperAdminUser['role']) || 'brand';
        if (identifier.includes('@')) {
          const existing = users.find((u) => u.email.toLowerCase() === identifier);
          if (existing) {
            existing.role = role;
          } else {
            const name = identifier.split('@')[0];
            users.push({
              id: `usr_${identifier.replace(/[^a-zA-Z0-9]/g, '_')}`,
              name: name.charAt(0).toUpperCase() + name.slice(1),
              email: identifier,
              credits: 100,
              role,
              createdAt: new Date().toISOString().slice(0, 10),
              lastActive: new Date().toISOString().slice(0, 10),
              ordersCount: 0,
            });
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return users;
}

function getLocalManufacturerList(): ManufacturerListItem[] {
  const list: ManufacturerListItem[] = listManufacturerProfiles().map((p) => ({
    userId: p.userId,
    entityId: p.entityId,
    name: p.name,
    email: p.email,
    location: p.location,
    country: p.country,
    status: p.status,
    garmentTypes: p.garmentTypes,
    specialties: p.specialties,
    certifications: p.certifications,
    moq: p.moq,
    leadTimeDays: p.leadTimeDays,
    capacityUnitsPerMonth: p.capacityUnitsPerMonth,
    joinedAt: p.joinedAt,
    lastActive: p.lastActive,
    internalNotes: p.internalNotes,
    onboardingComplete: true,
    assignedOrders: 0,
  }));

  // Check stored invites and local manufacturer roles
  try {
    const invites = getStoredInvites();
    for (const inv of invites) {
      const targetEmail = inv.email.toLowerCase();
      let customWs: any = null;
      try {
        const safeKey = targetEmail.replace(/[^a-z0-9]/g, '_');
        const rawWs = localStorage.getItem(`ceriga_factory_workspace_${safeKey}`);
        if (rawWs) customWs = JSON.parse(rawWs);
      } catch {
        /* ignore */
      }
      const existing = list.find((m) => m.email.toLowerCase() === targetEmail);
      if (!existing) {
        const namePart = targetEmail.split('@')[0];
        const defaultName = namePart.charAt(0).toUpperCase() + namePart.slice(1) + ' Factory';
        const isCompleted = Boolean(
          inv.redeemedAt ||
            customWs?.onboardingComplete ||
            localStorage.getItem(`ceriga_manufacturer_onboarded_${targetEmail}`) === 'true',
        );
        list.push({
          userId: `usr_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          entityId: `mfg_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: customWs?.factoryName || defaultName,
          email: targetEmail,
          location: customWs?.addressLine || 'Manchester',
          country: 'United Kingdom',
          status: isCompleted ? 'active' : 'onboarding',
          garmentTypes: customWs?.garments?.length ? customWs.garments : ['Hoodies', 'T-shirts'],
          specialties: customWs?.capabilities?.length ? customWs.capabilities : ['Cut & sew'],
          certifications: ['OEKO-TEX'],
          moq: customWs?.moq || 50,
          leadTimeDays: customWs?.typicalLeadDays || 14,
          capacityUnitsPerMonth: customWs?.monthlyCapacity || 1000,
          joinedAt: new Date(inv.createdAt).toISOString().slice(0, 10),
          lastActive: new Date(inv.redeemedAt || inv.createdAt).toISOString().slice(0, 10),
          internalNotes: customWs?.internalNotes || 'Invited manufacturer partner',
          onboardingComplete: isCompleted,
          assignedOrders: 0,
        });
      } else if (customWs) {
        if (customWs.factoryName) existing.name = customWs.factoryName;
        if (customWs.addressLine) existing.location = customWs.addressLine;
        if (customWs.garments?.length) existing.garmentTypes = customWs.garments;
        if (customWs.capabilities?.length) existing.specialties = customWs.capabilities;
        if (customWs.moq) existing.moq = customWs.moq;
        if (customWs.monthlyCapacity) existing.capacityUnitsPerMonth = customWs.monthlyCapacity;
        if (customWs.onboardingComplete) {
          existing.onboardingComplete = true;
          existing.status = 'active';
        }
      }
    }
  } catch {
    /* ignore */
  }

  return list;
}

/** Fetch platform users from profiles (RLS: superadmin sees all rows). */
async function loadfetchAllUsers(): Promise<SuperAdminUser[]> {
  const localUsers = getLocalUsers();
  if (!isSupabaseConfigured) {
    return localUsers;
  }

  try {
    const supabase = getSupabase();
    const [{ data, error }, { data: orderRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('account_orders').select('user_id'),
    ]);
    if (error) throw error;

    const orderCounts = new Map<string, number>();
    for (const row of (orderRows ?? []) as { user_id: string }[]) {
      orderCounts.set(row.user_id, (orderCounts.get(row.user_id) ?? 0) + 1);
    }

    const remoteUsers = ((data ?? []) as {
      id: string;
      email: string;
      full_name: string | null;
      role: string;
      message_credits: number | null;
      created_at: string;
      updated_at: string;
    }[]).map((row) => ({
      id: row.id,
      name: row.full_name || row.email?.split('@')[0] || 'User',
      email: row.email || '',
      credits: row.message_credits ?? 0,
      role: row.role === 'manufacturer' || row.role === 'worker' ? row.role : 'brand',
      createdAt: row.created_at?.slice(0, 10) || '',
      lastActive: row.updated_at?.slice(0, 10) || row.created_at?.slice(0, 10) || '',
      ordersCount: orderCounts.get(row.id) ?? 0,
    }));

    return remoteUsers;
  } catch (error) {
    throw adminLoadError(error, 'Could not load user accounts');
  }
}

async function performadminPatchProfile(
  id: string,
  patch: { role?: SuperAdminUser['role']; messageCredits?: number; fullName?: string },
): Promise<void> {
  requireConfigured();
  const payload:Record<string,unknown>={};
  if(patch.role!==undefined)payload.role=patch.role;
  if(patch.messageCredits!==undefined){if(!Number.isSafeInteger(patch.messageCredits)||patch.messageCredits<0)throw new Error('Credits must be a non-negative whole number');payload.message_credits=patch.messageCredits;}
  if(patch.fullName!==undefined)payload.full_name=patch.fullName;
  const {data,error}=await getSupabase().rpc('admin_update_profile',{p_user_id:id,p_patch:payload});
  if(error||data!==id)throw new Error(error?.message||'Profile update was not confirmed');
}

export type ManufacturerListItem = {
  userId: string;
  entityId: string;
  name: string;
  email: string;
  location: string;
  country: string;
  status: 'active' | 'paused' | 'onboarding';
  garmentTypes: string[];
  specialties: string[];
  certifications: string[];
  moq: number;
  leadTimeDays: number;
  capacityUnitsPerMonth: number;
  joinedAt: string;
  lastActive: string;
  internalNotes: string;
  onboardingComplete: boolean;
  assignedOrders: number;
};

async function loadfetchManufacturerList(): Promise<ManufacturerListItem[]> {
  const localList = getLocalManufacturerList();
  if (!isSupabaseConfigured) {
    return localList;
  }

  try {
    const supabase = getSupabase();
    const [{ data, error }, { data: orderRows, error: ordersError }, { data: factoryRows, error: factoriesError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'manufacturer')
        .order('created_at', { ascending: true }),
      supabase.from('account_orders').select('assigned_manufacturer_id').not('assigned_manufacturer_id','is',null),
      supabase.from('manufacturer_profiles').select('*'),
    ]);
    if (error) throw error;
    if (ordersError) throw ordersError;
    if (factoriesError) throw factoriesError;

    const assigned = new Map<string, number>();
    for (const row of (orderRows ?? []) as { assigned_manufacturer_id: string }[]) {
      assigned.set(
        row.assigned_manufacturer_id,
        (assigned.get(row.assigned_manufacturer_id) ?? 0) + 1,
      );
    }

    const remoteList = ((data ?? []) as {
      id: string;
      email: string;
      created_at: string;
      updated_at: string;
      manufacturer_profiles:
        | {
            factory_name: string;
            contact_email: string | null;
            address_line: string | null;
            city: string | null;
            country: string | null;
            status: string;
            garments: string[];
            specialties: string[];
            certifications: string[];
            moq: number;
            typical_lead_days: number | null;
            monthly_capacity: number;
            internal_notes: string | null;
            onboarding_complete: boolean;
            updated_at: string;
          }[]
        | null;
    }[]).map((row) => {
      const mp = (factoryRows || []).find((factory) => factory.user_id === row.id) as
        NonNullable<typeof row.manufacturer_profiles>[number] | undefined;
      const status =
        mp?.status === 'active' || mp?.status === 'paused' || mp?.status === 'onboarding'
          ? mp.status
          : mp?.onboarding_complete
            ? 'active'
            : 'onboarding';
      return {
        userId: row.id,
        entityId: row.id,
        name: mp?.factory_name ?? row.email,
        email: mp?.contact_email || row.email,
        location: mp?.city || mp?.address_line || '—',
        country: mp?.country || '—',
        status,
        garmentTypes: mp?.garments ?? [],
        specialties: mp?.specialties ?? [],
        certifications: mp?.certifications ?? [],
        moq: mp?.moq ?? 50,
        leadTimeDays: mp?.typical_lead_days ?? 0,
        capacityUnitsPerMonth: mp?.monthly_capacity ?? 0,
        joinedAt: row.created_at.slice(0, 10),
        lastActive: (mp?.updated_at ?? row.updated_at).slice(0, 10),
        internalNotes: mp?.internal_notes ?? '',
        onboardingComplete: mp?.onboarding_complete ?? false,
        assignedOrders: assigned.get(row.id) ?? 0,
      };
    });

    return remoteList;
  } catch (error) {
    throw adminLoadError(error, 'Could not load manufacturer accounts');
  }
}

export async function adminPatchManufacturerProfile(
  userId: string,
  patch: {
    status?: 'active' | 'paused' | 'onboarding';
    internalNotes?: string;
    garments?: string[];
    specialties?: string[];
    certifications?: string[];
    factoryName?: string;
  },
): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.internalNotes !== undefined) payload.internal_notes = patch.internalNotes;
  if (patch.garments !== undefined) payload.garments = patch.garments;
  if (patch.specialties !== undefined) payload.specialties = patch.specialties;
  if (patch.certifications !== undefined) payload.certifications = patch.certifications;
  if (patch.factoryName !== undefined) payload.factory_name = patch.factoryName;

  const { data: existing } = await supabase
    .from('manufacturer_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('manufacturer_profiles').insert({
      user_id: userId,
      factory_name: patch.factoryName ?? 'Factory',
      ...payload,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('manufacturer_profiles')
    .update(payload)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getPlatformSetting<T>(key: string): Promise<T | null> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

async function performsetPlatformSetting(key: string, value: unknown): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { error } = await supabase.from('platform_settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Manufacturer accounts for the assignment console. */
export type ManufacturerAccount = {
  acceptingNewOrders?:boolean;maxSingleOrderQuantity?:number;unavailableUntil?:string;
  status?: 'active'|'paused'|'onboarding';
  assignedOrders?:number;
  userId: string;
  factoryName: string;
  email: string;
  onboardingComplete: boolean;
  moq: number | null;
  monthlyCapacity: number | null;
  garments: string[];
  garmentDetails?: import('../data/manufacturerOnboardingTypes').CompleteManufacturerProfile['garmentDetails'];
  capabilities?: string[];
  availableCapacity?: number;
  garmentMoqOverrides?: Record<string,number>;
  methodMoqs?: {method:string;moq:number}[];
  shippingRegions?: string[];
  quoteStats?: {observed:number;onTime:number};
  calendar?: {scheduleKnown:boolean;workload:string;utilisation:number|null;unscheduled:number;closures:{start:string;end:string}[]};
};

async function loadfetchManufacturerAccounts(): Promise<ManufacturerAccount[]> {
 const supabase=getSupabase();
 const [list,profileResult,settingsResult,ordersResult,calendarResult]=await Promise.all([fetchManufacturerList(),supabase.from('manufacturer_profiles').select('*'),supabase.from('manufacturer_customisation_settings').select('user_id,settings'),supabase.from('account_orders').select('assigned_manufacturer_id,status,factory_status,due_quote_by,quoted_at'),supabase.rpc('manufacturer_calendar_signals')]);
 for(const result of [profileResult,settingsResult,ordersResult,calendarResult])if(result.error)throw new Error(result.error.message);
 return (profileResult.data??[]).map(profile=>{
  const existing=list.find(item=>item.userId===profile.user_id);const settings=settingsResult.data?.find(row=>row.user_id===profile.user_id)?.settings||{};
  const assigned=(ordersResult.data??[]).filter(row=>row.assigned_manufacturer_id===profile.user_id);
  const measured=assigned.filter(row=>row.quoted_at&&row.due_quote_by);
  return {userId:profile.user_id,factoryName:profile.factory_name,email:existing?.email||profile.contact_email||'',onboardingComplete:profile.onboarding_complete,status:profile.status|| (profile.onboarding_complete?'active':'onboarding'),moq:settings.generalMoq??profile.moq,monthlyCapacity:profile.monthly_capacity,garments:profile.garments||[],
   assignedOrders:assigned.filter(row=>!['completed','ready'].includes(row.status)&&row.factory_status!=='rejected').length,
   capabilities:settings.capabilitiesMap ? Object.entries(settings.capabilitiesMap).filter(([,source])=>source==='in_house'||source==='outsourced').map(([name])=>name) : (profile.capabilities||[]),
   garmentDetails:settings.garmentDetails,
   acceptingNewOrders:settings.acceptingNewOrders,maxSingleOrderQuantity:settings.maxSingleOrderQuantity,unavailableUntil:settings.unavailableUntil,availableCapacity:settings.currentAvailableMonthlyCapacity,garmentMoqOverrides:Object.fromEntries(Object.entries(settings.garmentMoqOverrides||{}).filter(([garment])=>(settings.confirmedGarmentMoqOverrides||[]).includes(garment))),methodMoqs:settings.customMethodMoqs,shippingRegions:settings.shippingDestinations||profile.shipping_regions,
   calendar:calendarResult.data?.find((row:{id:string})=>row.id===profile.user_id),
   quoteStats:{observed:measured.length,onTime:measured.filter(row=>new Date(row.quoted_at).getTime()<=new Date(row.due_quote_by+'T23:59:59.999Z').getTime()).length}};
 });
}

/** Admin patch onto a DB order (RLS: is_superadmin). */
async function performadminPatchOrder(
  id: string,
  patch: {
    status?: OrderStatus;
    approvedPrices?: ApprovedTierPrice[];
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
  if(patch.approvedPrices){
    const {data,error}=await supabase.rpc('publish_order_quote',{p_order_id:id,p_prices:patch.approvedPrices});
    if(error||data!==id)throw new Error(error?.message||'Quote publication was not confirmed');return;
  }
  if(patch.assignedManufacturerId){
    const {data,error}=await supabase.rpc('assign_order_manufacturer',{p_order_id:id,p_manufacturer:patch.assignedManufacturerId,p_due:patch.dueQuoteBy});
    if(error||data!==id)throw new Error(error?.message||'Assignment was not confirmed');return;
  }
  if(patch.status==='sent_to_brand')throw new Error('Approved prices are required');
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
  const {data,error}=await supabase.rpc('patch_account_order',{p_order_id:id,p_patch:payload});
  if(error)throw new Error(error.message);
  if(!data)throw new Error('Order update was not confirmed by the database');
}

const adminReads=new Map<string,{at:number;request:Promise<unknown>}>();
async function cachedAdminRead<T>(name:string,read:()=>Promise<T>):Promise<T>{
 const auth=getSupabase().auth;if(typeof auth.getSession!=='function')return read();
 const{data:{session},error}=await auth.getSession();if(error||!session)throw new Error('Sign in to load admin data');
 const key=session.user.id+':'+name;const entry=adminReads.get(key);if(entry&&Date.now()-entry.at<5000)return entry.request as Promise<T>;
 const request=read().catch(error=>{adminReads.delete(key);throw error;});if(adminReads.size>24)adminReads.clear();adminReads.set(key,{at:Date.now(),request});return request;
}

export async function fetchAllOrders(...args:Parameters<typeof loadfetchAllOrders>){return cachedAdminRead('fetchAllOrders',()=>loadfetchAllOrders(...args));}

export async function fetchAllUsers(...args:Parameters<typeof loadfetchAllUsers>){return cachedAdminRead('fetchAllUsers',()=>loadfetchAllUsers(...args));}

export async function fetchManufacturerList(...args:Parameters<typeof loadfetchManufacturerList>){return cachedAdminRead('fetchManufacturerList',()=>loadfetchManufacturerList(...args));}

export async function fetchManufacturerAccounts(...args:Parameters<typeof loadfetchManufacturerAccounts>){return cachedAdminRead('fetchManufacturerAccounts',()=>loadfetchManufacturerAccounts(...args));}

export async function adminPatchProfile(...args:Parameters<typeof performadminPatchProfile>){try{return await performadminPatchProfile(...args);}finally{adminReads.clear();}}

export async function adminPatchOrder(...args:Parameters<typeof performadminPatchOrder>){try{return await performadminPatchOrder(...args);}finally{adminReads.clear();}}

export async function adminDeleteOrder(...args:Parameters<typeof performadminDeleteOrder>){try{return await performadminDeleteOrder(...args);}finally{adminReads.clear();}}

export async function adminDeleteAccount(...args:Parameters<typeof performadminDeleteAccount>){try{return await performadminDeleteAccount(...args);}finally{adminReads.clear();}}

export async function setPlatformSetting(...args:Parameters<typeof performsetPlatformSetting>){try{return await performsetPlatformSetting(...args);}finally{adminReads.clear();}}
