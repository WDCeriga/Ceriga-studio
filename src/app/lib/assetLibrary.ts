import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { getSupabase } from './supabaseClient';
import { cacheRemoteAssets, readStoredAssets, withAssetLock, writeStoredAsset } from './assetLibraryStorage';

export type AssetProject = {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: DesignElement[];
  preview: string;
  createdAt: string;
  updatedAt: string;
};

type AssetRow = {
  id: string;
  user_id: string;
  name: string;
  width: number;
  height: number;
  elements: DesignElement[];
  preview: string;
  created_at: string;
  updated_at: string;
};

const COLUMNS = 'id,user_id,name,width,height,elements,preview,created_at,updated_at';
const PAGE_SIZE = 100;

export class AssetSyncError extends Error {
  readonly asset: AssetProject;
  readonly cause: unknown;

  constructor(asset: AssetProject, cause: unknown) {
    super('Asset cloud save was not confirmed. A recoverable local draft is retained; retry saving it.');
    this.name = 'AssetSyncError';
    this.asset = asset;
    this.cause = cause;
  }
}

export function createAssetProjectId(): string {
  return crypto.randomUUID();
}

function scopeFor(userId: string | null): string {
  if (userId === null) return 'guest';
  if (!userId.trim()) throw new Error('A nonempty account ID or null is required.');
  return `user:${userId}`;
}

/** Local session validation also works offline; RLS and getUser enforce cloud ownership. */
async function assertOwner(userId: string | null): Promise<void> {
  if (userId === null) return;
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (data.session?.user.id !== userId) throw new Error('Asset account does not match the signed-in session.');
}

function validate(asset: AssetProject): AssetProject {
  if (!asset || typeof asset.id !== 'string' || !asset.id.trim() ||
      typeof asset.name !== 'string' || !Number.isFinite(asset.width) || asset.width <= 0 ||
      !Number.isFinite(asset.height) || asset.height <= 0 || !Array.isArray(asset.elements) ||
      typeof asset.preview !== 'string' || !/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.preview) ||
      typeof asset.createdAt !== 'string' || !Number.isFinite(Date.parse(asset.createdAt)) ||
      typeof asset.updatedAt !== 'string' || !Number.isFinite(Date.parse(asset.updatedAt))) {
    throw new Error('Invalid asset: provide an ID, positive dimensions, layers, dates and a PNG/WebP data URL preview.');
  }
  return asset;
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Snapshot all JSON fields (including future groups/children); persist transient blob URLs. */
async function snapshot(asset: AssetProject): Promise<AssetProject> {
  const urls = new Set<string>();
  const json = JSON.stringify(asset, (_key, value) => {
    if (typeof value === 'string' && value.startsWith('blob:')) urls.add(value);
    return value;
  });
  const replacements = new Map<string, string>();
  await Promise.all([...urls].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Cannot persist a missing asset image.');
    replacements.set(url, await blobDataUrl(await response.blob()));
  }));
  return validate(JSON.parse(json, (_key, value) => typeof value === 'string' ? replacements.get(value) ?? value : value));
}

function fromRow(row: AssetRow, userId: string): AssetProject {
  if (row.user_id !== userId) throw new Error('Unexpected asset account in cloud response.');
  return validate({
    id: row.id, name: row.name, width: row.width, height: row.height,
    elements: row.elements, preview: row.preview, createdAt: row.created_at, updatedAt: row.updated_at,
  });
}

function sorted(assets: AssetProject[]): AssetProject[] {
  return assets.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
}

/** Explicit offline/recovery access. Never reads another account's cache or imports guest assets. */
export async function listLocalAssetProjects(userId: string | null): Promise<AssetProject[]> {
  const scope = scopeFor(userId);
  await assertOwner(userId);
  const records = await readStoredAssets(scope);
  await assertOwner(userId);
  return sorted(records.map(record => record.asset));
}

/** Pending drafts are not cloud-confirmed; retry each through saveAssetProject. */
export async function listPendingAssetProjects(userId: string): Promise<AssetProject[]> {
  const scope = scopeFor(userId);
  await assertOwner(userId);
  const records = await readStoredAssets(scope);
  await assertOwner(userId);
  return sorted(records.filter(record => record.pending).map(record => record.asset));
}

/** Signed-in lists refresh from the cloud and overlay pending local edits. Cloud errors reject. */
export async function listAssetProjects(userId: string | null): Promise<AssetProject[]> {
  const scope = scopeFor(userId);
  return withAssetLock(scope, async () => {
    await assertOwner(userId);
    if (userId === null) return listLocalAssetProjects(null);
    const supabase = getSupabase();
    const assets: AssetProject[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.from('asset_projects').select(COLUMNS)
        .eq('user_id', userId).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data) throw new Error('Asset cloud list returned no data.');
      assets.push(...(data as AssetRow[]).map(row => fromRow(row, userId)));
      if (data.length < PAGE_SIZE) break;
    }
    await assertOwner(userId);
    const cached = await cacheRemoteAssets(scope, assets);
    await assertOwner(userId);
    return sorted(cached.map(record => record.asset));
  });
}

/** Durable local write first; signed-in success requires an acknowledged cloud upsert. */
export async function saveAssetProject(asset: AssetProject, userId: string | null): Promise<AssetProject> {
  const scope = scopeFor(userId);
  // Capture immediately, before any caller mutation or lock wait.
  const captured = snapshot(asset);
  void captured.catch(() => undefined);
  return withAssetLock(scope, async () => {
    const saved = await captured;
    await assertOwner(userId);
    await writeStoredAsset({ scope, id: saved.id, asset: saved, pending: userId !== null });
    if (userId === null) return saved;
    try {
      const supabase = getSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (auth.user?.id !== userId) throw new Error('Sign in to this asset account before syncing.');
      const row: AssetRow = {
        id: saved.id, user_id: userId, name: saved.name, width: saved.width, height: saved.height,
        elements: saved.elements, preview: saved.preview, created_at: saved.createdAt, updated_at: saved.updatedAt,
      };
      const { data, error } = await supabase.from('asset_projects').upsert(row, { onConflict: 'user_id,id' }).select(COLUMNS).single();
      if (error) throw error;
      if (!data) throw new Error('Asset cloud save returned no data.');
      const confirmed = fromRow(data as AssetRow, userId);
      await assertOwner(userId);
      await writeStoredAsset({ scope, id: confirmed.id, asset: confirmed, pending: false });
      await assertOwner(userId);
      return confirmed;
    } catch (error) {
      throw new AssetSyncError(saved, error);
    }
  });
}
