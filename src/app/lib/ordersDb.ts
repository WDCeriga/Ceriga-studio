import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type {
  OrderPriceOption,
  UserOrder,
  UserOrderKind,
  UserOrderStatus,
} from '../data/userOrders';
import type { OrderQuantityPlan } from '../data/orderQuantities';

export type OrderRow = {
  id: string;
  user_id: string;
  kind: UserOrderKind;
  product_name: string;
  garment_type: string;
  product_id: string | null;
  status: UserOrderStatus;
  status_label: string;
  total: number | null;
  tracking: string | null;
  order_quantities: OrderQuantityPlan | null;
  price_options: OrderPriceOption[] | null;
  selected_price_option_id: string | null;
  paid_amount_cents: number | null;
  export_format: 'pdf' | 'pdf_bundle' | null;
  revision_used: boolean;
  download_ready: boolean;
  priced_at: string | null;
  quote_request: UserOrder['quoteRequest'] | null;
  specifications: UserOrder['specifications'] | null;
  created_at: string;
  updated_at: string;
};

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function rowToUserOrder(row: OrderRow): UserOrder {
  return {
    id: row.id,
    kind: row.kind,
    productName: row.product_name,
    garmentType: row.garment_type,
    productId: row.product_id ?? undefined,
    status: row.status,
    statusLabel: row.status_label,
    orderDate: formatOrderDate(row.created_at),
    total: row.total == null ? null : Number(row.total),
    tracking: row.tracking,
    orderQuantities: row.order_quantities ?? undefined,
    priceOptions: row.price_options ?? undefined,
    selectedPriceOptionId: row.selected_price_option_id ?? undefined,
    paidAmountCents: row.paid_amount_cents ?? undefined,
    exportFormat: row.export_format ?? undefined,
    revisionUsed: row.revision_used,
    downloadReady: row.download_ready,
    pricedAt: row.priced_at ?? undefined,
    quoteRequest: row.quote_request ?? undefined,
    specifications: row.specifications ?? undefined,
  };
}

export type CreateOrderDbInput = {
  kind: UserOrderKind;
  productName: string;
  garmentType: string;
  productId?: string;
  status: UserOrderStatus;
  statusLabel: string;
  total?: number | null;
  orderQuantities?: OrderQuantityPlan;
  priceOptions?: OrderPriceOption[];
  exportFormat?: 'pdf' | 'pdf_bundle';
  pricedAt?: string;
  quoteRequest?: UserOrder['quoteRequest'];
  specifications?: UserOrder['specifications'];
  downloadReady?: boolean;
  revisionUsed?: boolean;
};

export async function listOrders(): Promise<UserOrder[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(rowToUserOrder);
}

export async function getOrder(id: string): Promise<UserOrder | null> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToUserOrder(data as OrderRow);
}

export async function insertOrder(input: CreateOrderDbInput): Promise<UserOrder> {
  requireConfigured();
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to create an order');

  const payload = {
    user_id: user.id,
    kind: input.kind,
    product_name: input.productName,
    garment_type: input.garmentType,
    product_id: input.productId ?? null,
    status: input.status,
    status_label: input.statusLabel,
    total: input.total ?? null,
    order_quantities: input.orderQuantities ?? null,
    price_options: input.priceOptions ?? null,
    export_format: input.exportFormat ?? null,
    priced_at: input.pricedAt ?? null,
    quote_request: input.quoteRequest ?? null,
    specifications: input.specifications ?? null,
    download_ready: input.downloadReady ?? false,
    revision_used: input.revisionUsed ?? false,
  };

  const { data, error } = await supabase.from('orders').insert(payload).select('*').single();
  if (error) throw error;
  return rowToUserOrder(data as OrderRow);
}

export async function patchOrder(
  id: string,
  patch: Partial<{
    status: UserOrderStatus;
    statusLabel: string;
    total: number | null;
    tracking: string | null;
    orderQuantities: OrderQuantityPlan | null;
    priceOptions: OrderPriceOption[] | null;
    selectedPriceOptionId: string | null;
    paidAmountCents: number | null;
    exportFormat: 'pdf' | 'pdf_bundle' | null;
    revisionUsed: boolean;
    downloadReady: boolean;
    pricedAt: string | null;
    quoteRequest: UserOrder['quoteRequest'] | null;
    specifications: UserOrder['specifications'] | null;
  }>,
): Promise<UserOrder> {
  requireConfigured();
  const supabase = getSupabase();

  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.statusLabel !== undefined) payload.status_label = patch.statusLabel;
  if (patch.total !== undefined) payload.total = patch.total;
  if (patch.tracking !== undefined) payload.tracking = patch.tracking;
  if (patch.orderQuantities !== undefined) payload.order_quantities = patch.orderQuantities;
  if (patch.priceOptions !== undefined) payload.price_options = patch.priceOptions;
  if (patch.selectedPriceOptionId !== undefined) {
    payload.selected_price_option_id = patch.selectedPriceOptionId;
  }
  if (patch.paidAmountCents !== undefined) payload.paid_amount_cents = patch.paidAmountCents;
  if (patch.exportFormat !== undefined) payload.export_format = patch.exportFormat;
  if (patch.revisionUsed !== undefined) payload.revision_used = patch.revisionUsed;
  if (patch.downloadReady !== undefined) payload.download_ready = patch.downloadReady;
  if (patch.pricedAt !== undefined) payload.priced_at = patch.pricedAt;
  if (patch.quoteRequest !== undefined) payload.quote_request = patch.quoteRequest;
  if (patch.specifications !== undefined) payload.specifications = patch.specifications;

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToUserOrder(data as OrderRow);
}

/** Upload files under `{userId}/{orderId}/filename` in the order-uploads bucket. */
export async function uploadOrderFiles(
  orderId: string,
  files: File[],
): Promise<{ path: string; name: string }[]> {
  requireConfigured();
  if (files.length === 0) return [];
  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to upload files');

  const uploaded: { path: string; name: string }[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-()+ ]+/g, '_');
    const path = `${user.id}/${orderId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('order-uploads').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    uploaded.push({ path, name: file.name });
  }
  return uploaded;
}
