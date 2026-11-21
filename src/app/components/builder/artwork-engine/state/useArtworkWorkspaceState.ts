import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { deriveWorkspaceState, type ArtworkWorkspaceState } from './workspaceState';

/** Adapts the existing studio context to the engine's workspace state. */
export function useArtworkWorkspaceState(selectedId: string | null): ArtworkWorkspaceState {
  const studio = usePrintsStudio();
  const selectionCount = Math.max(studio.selectionIds.length, selectedId ? 1 : 0);
  const directEditing = Boolean(studio.pathEditingId || studio.cropEditingId || studio.warpEditingId || studio.distortEditingId || studio.textSelection);
  return deriveWorkspaceState({ tool: studio.tool, selectionCount, directEditing });
}
