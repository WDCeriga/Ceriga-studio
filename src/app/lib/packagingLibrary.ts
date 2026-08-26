import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { listProjects, type ProjectListItem } from './projectsDb';
import { isSupabaseConfigured } from './supabaseClient';

export type PackagingSnapshot = {
  packagingType: string;
  packagingColor: string;
  notes: string;
  elements: DesignElement[];
};

const LOCAL_KEY = 'ceriga_packaging_library_v1';

export type LocalPackagingEntry = {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: PackagingSnapshot;
};

function readLocal(): LocalPackagingEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalPackagingEntry[];
  } catch {
    return [];
  }
}

function writeLocal(entries: LocalPackagingEntry[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

export function listLocalPackaging(): LocalPackagingEntry[] {
  return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveLocalPackaging(name: string, snapshot: PackagingSnapshot): LocalPackagingEntry {
  const entry: LocalPackagingEntry = {
    id: `pkg-local-${Date.now().toString(36)}`,
    name: name.trim() || 'Packaging',
    updatedAt: new Date().toISOString(),
    snapshot: structuredClone(snapshot),
  };
  const next = [entry, ...readLocal().filter((e) => e.id !== entry.id)];
  writeLocal(next.slice(0, 40));
  return entry;
}

export function getLocalPackaging(id: string): LocalPackagingEntry | null {
  return readLocal().find((e) => e.id === id) ?? null;
}

export function deleteLocalPackaging(id: string): void {
  writeLocal(readLocal().filter((e) => e.id !== id));
}

export function packagingSnapshotFromProjectState(
  state: Record<string, unknown> | null | undefined,
): PackagingSnapshot | null {
  if (!state) return null;
  const elements = state.packaging;
  if (!Array.isArray(elements)) return null;
  return {
    packagingType: typeof state.packagingType === 'string' ? state.packagingType : 'polybag',
    packagingColor: typeof state.packagingColor === 'string' ? state.packagingColor : '#F5F5F5',
    notes:
      typeof (state.extraDetails as { packaging?: string } | undefined)?.packaging === 'string'
        ? (state.extraDetails as { packaging: string }).packaging
        : typeof state.notes === 'string'
          ? state.notes
          : '',
    elements: elements as DesignElement[],
  };
}

export type ReusablePackagingItem = {
  id: string;
  name: string;
  source: 'project' | 'local';
  updatedAt: string;
  snapshot: PackagingSnapshot;
};

/** Cloud packaging projects + local library entries for the reuse picker. */
export async function listReusablePackaging(opts?: {
  isAuthenticated?: boolean;
}): Promise<ReusablePackagingItem[]> {
  const local: ReusablePackagingItem[] = listLocalPackaging().map((e) => ({
    id: e.id,
    name: e.name,
    source: 'local' as const,
    updatedAt: e.updatedAt,
    snapshot: e.snapshot,
  }));

  if (!isSupabaseConfigured || !opts?.isAuthenticated) {
    return local;
  }

  try {
    const projects = await listProjects();
    const fromCloud: ReusablePackagingItem[] = projects
      .filter((p) => p.flow_type === 'packaging')
      .map((p: ProjectListItem) => {
        const snapshot = packagingSnapshotFromProjectState(p.state);
        return snapshot
          ? {
              id: p.id,
              name: p.name,
              source: 'project' as const,
              updatedAt: p.updated_at,
              snapshot,
            }
          : null;
      })
      .filter((x): x is ReusablePackagingItem => x !== null);
    return [...fromCloud, ...local].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return local;
  }
}
