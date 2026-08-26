import type { DesignElement } from '../components/builder/PrintsDesignStep';
import {
  insertPackagingLibrary,
  listPackagingLibrary,
  type PackagingLibraryRow,
  type PackagingSnapshot,
} from './packagingLibraryDb';
import { listProjects, type ProjectListItem } from './projectsDb';
import { isSupabaseConfigured } from './supabaseClient';

export type { PackagingSnapshot };

export type PackagingLibraryEntry = {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: PackagingSnapshot;
};

function rowToEntry(row: PackagingLibraryRow): PackagingLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    snapshot: row.snapshot,
  };
}

export async function savePackagingToLibrary(
  name: string,
  snapshot: PackagingSnapshot,
): Promise<PackagingLibraryEntry> {
  if (!isSupabaseConfigured) {
    throw new Error('Sign in with Supabase configured to save packaging to the library');
  }
  const row = await insertPackagingLibrary(name, snapshot);
  return rowToEntry(row);
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
  source: 'project' | 'library';
  updatedAt: string;
  snapshot: PackagingSnapshot;
};

/** Packaging projects + library entries from the database. */
export async function listReusablePackaging(opts?: {
  isAuthenticated?: boolean;
}): Promise<ReusablePackagingItem[]> {
  if (!isSupabaseConfigured || !opts?.isAuthenticated) {
    return [];
  }

  try {
    const [projects, library] = await Promise.all([listProjects(), listPackagingLibrary()]);

    const fromProjects: ReusablePackagingItem[] = projects
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

    const fromLibrary: ReusablePackagingItem[] = library.map((row) => ({
      id: row.id,
      name: row.name,
      source: 'library' as const,
      updatedAt: row.updated_at,
      snapshot: row.snapshot,
    }));

    return [...fromProjects, ...fromLibrary].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  } catch {
    return [];
  }
}
