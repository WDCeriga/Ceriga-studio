/**
 * Artwork workspace states (plan §4.2). The UI shows only what belongs to the current state.
 * Pure and React-free so it can be unit tested; `useArtworkWorkspaceState` adapts the studio context.
 */
export type ArtworkWorkspaceState =
  | 'browse'        // nothing selected, no creation tool — choosing what to create
  | 'create'        // a creation tool is active (brush, pen, shape, text placement…)
  | 'select'        // exactly one object selected
  | 'direct-edit'   // editing points, text, crop, warp, distortion, custom-area geometry
  | 'multi-select'  // two or more objects selected
  | 'effect-edit'   // an effect is being adjusted on canvas
  | 'pattern-edit'; // a repeat's structure is being manipulated

export type ArtworkWorkspaceInputs = {
  tool: string;
  selectionCount: number;
  directEditing: boolean;
  effectEditing?: boolean;
  patternEditing?: boolean;
};

/** Creation tools: anything other than plain selection starts something new. */
const CREATE_TOOLS = new Set(['brush', 'eraser', 'distress', 'distressEraser', 'customArea', 'shapePolygon', 'shapePencil', 'shapeLive', 'textPlace']);
/** Tools that are really direct edits of an existing object. */
const DIRECT_TOOLS = new Set(['customAreaEdit', 'customAreaAddPoint', 'textTracking']);

export function deriveWorkspaceState(input: ArtworkWorkspaceInputs): ArtworkWorkspaceState {
  if (input.directEditing || DIRECT_TOOLS.has(input.tool)) return 'direct-edit';
  if (CREATE_TOOLS.has(input.tool)) return 'create';
  if (input.patternEditing) return 'pattern-edit';
  if (input.effectEditing) return 'effect-edit';
  if (input.selectionCount > 1) return 'multi-select';
  if (input.selectionCount === 1) return 'select';
  return 'browse';
}
