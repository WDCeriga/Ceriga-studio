import type { GarmentSvgGarmentType } from '../../data/garmentSvgCatalog';
import type { TshirtLayerTransform } from '../../data/tshirtLayerAssets';

export const CERIGA_ASSET_VERSION = 1;
export const ASSET_EDITOR_CANVAS = 2048;

export type AssetEditorTool = 'select' | 'polyline' | 'line' | 'anchor' | 'connection';

export type AnchorRole =
  | 'sleeve-end'
  | 'hem-attach'
  | 'shoulder'
  | 'neck'
  | 'center'
  | 'edge'
  | 'custom';

export interface DrawnPoint {
  x: number;
  y: number;
}

export interface DrawnStroke {
  id: string;
  label: string;
  points: DrawnPoint[];
  closed: boolean;
  strokeWidth: number;
  /** Render and export with smooth curves instead of straight segments. */
  smooth?: boolean;
}

export interface DrawnAnchor {
  id: string;
  name: string;
  role: AnchorRole;
  x: number;
  y: number;
}

export interface DrawnConnection {
  id: string;
  label: string;
  fromAnchorId: string;
  toAnchorId: string;
}

export interface DrawableAssetMeta {
  name: string;
  garmentType: GarmentSvgGarmentType;
  category: string;
  fileName: string;
  notes?: string;
}

/**
 * Lab editing model. Canonical builder artifact is exported SVG (path geometry +
 * embedded &lt;ceriga-asset&gt; metadata). JSON is an optional editor snapshot only.
 */
export interface DrawableAssetDocument {
  version: typeof CERIGA_ASSET_VERSION;
  meta: DrawableAssetMeta;
  canvas: { width: number; height: number };
  strokes: DrawnStroke[];
  anchors: DrawnAnchor[];
  connections: DrawnConnection[];
  placement?: Partial<TshirtLayerTransform>;
}

export type SelectionKind = 'stroke' | 'point' | 'anchor' | 'connection';

export interface AssetEditorSelection {
  kind: SelectionKind;
  strokeId?: string;
  pointIndex?: number;
  anchorId?: string;
  connectionId?: string;
}

export interface CerigaAssetExportBundle {
  document: DrawableAssetDocument;
  svgRaw: string;
  importPath: string;
}
