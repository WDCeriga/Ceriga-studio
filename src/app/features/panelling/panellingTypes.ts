export type PanellingPoint = { x: number; y: number };

export interface SeamAnchor extends PanellingPoint {
  id: string;
  handleMode?: 'corner' | 'smooth' | 'independent';
  incoming?: PanellingPoint;
  outgoing?: PanellingPoint;
  boundaryId?: string;
}

export interface PanellingSeam {
  id: string;
  label: string;
  parentSurfaceId?: string;
  anchors: SeamAnchor[];
  construction: 'standard';
  mirrorGroupId?: string;
  mirrorLinked?: boolean;
}

export interface BoundaryLoop {
  id: string;
  role: 'outer' | 'hole';
  points: PanellingPoint[];
}

export interface PanelRegion {
  id: string;
  label: string;
  parentId: string;
  path: string;
  points: PanellingPoint[];
  area: number;
  seamIds: string[];
  fillOverride?: string;
}

export interface GraphNode extends PanellingPoint {
  id: string;
  kind: 'anchor' | 'boundary' | 'intersection';
  seamIds: string[];
}

export interface PanellingTopology {
  nodes: GraphNode[];
  edges: { id: string; from: string; to: string; kind: 'boundary' | 'seam'; seamId?: string }[];
  panels: PanelRegion[];
}