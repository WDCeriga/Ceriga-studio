/**
 * Resolves tech pack data for download entry points outside the builder
 * (brand order detail, superadmin order detail). Loads the linked project's
 * saved builder state from Supabase and maps it into the PDF data model,
 * with a graceful fallback to order specifications when no project exists.
 */
import { isSupabaseConfigured, getSupabase } from './supabaseClient';
import { getProject } from './projectsDb';
import { buildFallbackTechPackData, buildTechPackData, type TechPackData } from './techPackData';
import type { BuilderState } from '../pages/Builder';

export type ResolveTechPackInput = {
  /** Linked builder project id (`orders.product_id`), when present. */
  projectId?: string | null;
  /** Blueprint product id used when only specifications exist. */
  productId?: string | null;
  productName: string;
  specifications?: Parameters<typeof buildFallbackTechPackData>[0]['specifications'];
  orderQuantities?: Parameters<typeof buildFallbackTechPackData>[0]['orderQuantities'];
};

export type ResolvedTechPack = {
  data: TechPackData;
  /** true when built from the full saved builder state. */
  fromBuilderState: boolean;
};

/**
 * Try the saved project state first; fall back to order specifications.
 * Never throws — callers always get renderable data.
 */
export async function resolveTechPackData(
  input: ResolveTechPackInput,
): Promise<ResolvedTechPack> {
  if (input.projectId && isSupabaseConfigured) {
    try {
      const row = await getProject(input.projectId);
      const saved = row?.state;
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const state = saved as unknown as BuilderState;
        if (state.productId !== undefined || state.measurements !== undefined) {
          return {
            data: buildTechPackData(state, {
              projectName: row?.name || input.productName,
            }),
            fromBuilderState: true,
          };
        }
      }
    } catch {
      /* fall through to specifications fallback (RLS or missing project) */
    }
  }

  return {
    data: buildFallbackTechPackData({
      productName: input.productName,
      garmentType: input.productId ?? undefined,
      specifications: input.specifications,
      orderQuantities: input.orderQuantities,
    }),
    fromBuilderState: false,
  };
}

/** Can the current user read the given project row (admin path)? */
export async function canReadProjectAsAdmin(projectId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .limit(1);
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
