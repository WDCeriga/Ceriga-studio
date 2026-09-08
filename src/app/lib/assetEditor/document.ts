import type { GarmentSvgGarmentType } from '../../data/garmentSvgCatalog';
import { getGarmentSvgConfig } from '../../data/garmentSvgCatalog';
import {
  ASSET_EDITOR_CANVAS,
  CERIGA_ASSET_VERSION,
  type AnchorRole,
  type DrawableAssetDocument,
  type DrawnAnchor,
  type DrawnConnection,
  type DrawnPoint,
  type DrawnStroke,
} from './types';

let idCounter = 0;

export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function createEmptyDocument(
  garmentType: GarmentSvgGarmentType = 'tshirt',
  category?: string,
): DrawableAssetDocument {
  const config = getGarmentSvgConfig(garmentType);
  const resolvedCategory = category ?? config.categoryOrder[0] ?? 'T-shirt Base';

  return {
    version: CERIGA_ASSET_VERSION,
    meta: {
      name: 'New asset',
      garmentType,
      category: resolvedCategory,
      fileName: 'Untitled_Artwork-custom',
    },
    canvas: { width: ASSET_EDITOR_CANVAS, height: ASSET_EDITOR_CANVAS },
    strokes: [],
    anchors: [],
    connections: [],
    placement: { x: 0, y: 0, scale: 1, rotation: 0 },
  };
}

export function addStroke(
  doc: DrawableAssetDocument,
  points: DrawnPoint[],
  options?: Partial<Pick<DrawnStroke, 'label' | 'closed' | 'strokeWidth'>>,
): DrawableAssetDocument {
  const stroke: DrawnStroke = {
    id: createId('stroke'),
    label: options?.label ?? `Stroke ${doc.strokes.length + 1}`,
    points,
    closed: options?.closed ?? false,
    strokeWidth: options?.strokeWidth ?? 12,
  };
  return { ...doc, strokes: [...doc.strokes, stroke] };
}

export function addAnchor(
  doc: DrawableAssetDocument,
  x: number,
  y: number,
  options?: Partial<Pick<DrawnAnchor, 'name' | 'role'>>,
): DrawableAssetDocument {
  const anchor: DrawnAnchor = {
    id: createId('anchor'),
    name: options?.name ?? `anchor-${doc.anchors.length + 1}`,
    role: options?.role ?? 'custom',
    x,
    y,
  };
  return { ...doc, anchors: [...doc.anchors, anchor] };
}

export function addConnection(
  doc: DrawableAssetDocument,
  fromAnchorId: string,
  toAnchorId: string,
  label = 'connect',
): DrawableAssetDocument {
  const connection: DrawnConnection = {
    id: createId('connection'),
    label,
    fromAnchorId,
    toAnchorId,
  };
  return { ...doc, connections: [...doc.connections, connection] };
}

export function updateStrokePoint(
  doc: DrawableAssetDocument,
  strokeId: string,
  pointIndex: number,
  point: DrawnPoint,
): DrawableAssetDocument {
  return {
    ...doc,
    strokes: doc.strokes.map((stroke) => {
      if (stroke.id !== strokeId) return stroke;
      const points = [...stroke.points];
      points[pointIndex] = point;
      return { ...stroke, points };
    }),
  };
}

export function updateAnchor(
  doc: DrawableAssetDocument,
  anchorId: string,
  patch: Partial<Pick<DrawnAnchor, 'name' | 'role' | 'x' | 'y'>>,
): DrawableAssetDocument {
  return {
    ...doc,
    anchors: doc.anchors.map((anchor) =>
      anchor.id === anchorId ? { ...anchor, ...patch } : anchor,
    ),
  };
}

export function removeStroke(doc: DrawableAssetDocument, strokeId: string): DrawableAssetDocument {
  return { ...doc, strokes: doc.strokes.filter((stroke) => stroke.id !== strokeId) };
}

export function removeAnchor(doc: DrawableAssetDocument, anchorId: string): DrawableAssetDocument {
  return {
    ...doc,
    anchors: doc.anchors.filter((anchor) => anchor.id !== anchorId),
    connections: doc.connections.filter(
      (connection) => connection.fromAnchorId !== anchorId && connection.toAnchorId !== anchorId,
    ),
  };
}

export function removeConnection(
  doc: DrawableAssetDocument,
  connectionId: string,
): DrawableAssetDocument {
  return {
    ...doc,
    connections: doc.connections.filter((connection) => connection.id !== connectionId),
  };
}

export function snapPoint(point: DrawnPoint, gridSize: number): DrawnPoint {
  if (gridSize <= 0) return point;
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export const ANCHOR_ROLE_OPTIONS: AnchorRole[] = [
  'sleeve-end',
  'hem-attach',
  'shoulder',
  'neck',
  'center',
  'edge',
  'custom',
];
