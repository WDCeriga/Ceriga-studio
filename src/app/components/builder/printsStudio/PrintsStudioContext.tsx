import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { BRUSH_PRESETS, DEFAULT_BRUSH_SETTINGS, type BrushSettings, type BrushPreset } from '../../../lib/drawingBrush';
import { DEFAULT_DISTRESS_SCATTER, type DistressScatterSettings } from '../../../lib/distressScatter';
import type { LayerRenderer } from '../../../lib/mergeDesignLayers';

export type PrintsStudioTool = 'select' | 'brush' | 'eraser' | 'distress' | 'distressEraser' | 'customArea' | 'customAreaEdit' | 'customAreaAddPoint' | 'shapePolygon';
export type DistressBrushType = 'holes' | 'abrasion' | 'rips';

export interface CustomAreaPointSelection {
  id: string;
  index: number;
  indices?: number[];
}

export type PrintsStudioPanel = 'brush' | 'shapes' | 'upload' | 'text' | 'patterns' | 'distress';

export interface PencilSettings {
  pencilOnly: boolean;
  tiltShading: boolean;
  doubleTapTogglesEraser: boolean;
}

export interface PrintsStudioState extends BrushSettings {
  drawingSession: number;
  distressSession: number;
  tool: PrintsStudioTool;
  panel: PrintsStudioPanel;
  color: string;
  brushSize: number;
  eraserSize: number;
  opacity: number;
  pressure: boolean;
  grain: number;
  stabilization: number;
  pencil: PencilSettings;
  distressType: DistressBrushType;
  distressScatter: DistressScatterSettings;
  customAreaPointSelection: CustomAreaPointSelection | null;
}

export const DRAWING_LAYER_ID = 'print-drawing-layer';
export const DISTRESS_LAYER_ID = 'print-distress-layer';

const DEFAULT_STATE: PrintsStudioState = {
  ...DEFAULT_BRUSH_SETTINGS,
  drawingSession: 0,
  distressSession: 0,
  tool: 'select',
  panel: 'brush',
  color: '#FFFFFF',
  brushSize: 14,
  eraserSize: 22,
  opacity: 100,
  pressure: true,
  grain: 18,
  stabilization: 28,
  pencil: {
    pencilOnly: false,
    tiltShading: true,
    doubleTapTogglesEraser: true,
  },
  distressType: 'holes',
  distressScatter: DEFAULT_DISTRESS_SCATTER,
  customAreaPointSelection: null,
};

interface PrintsStudioContextValue extends PrintsStudioState {
  layerRenderer: MutableRefObject<LayerRenderer | null>;
  cropEditingId: string | null;
  setCropEditingId: (id: string | null) => void;
  patchBrush: (patch: Partial<BrushSettings>) => void;
  setBrushPreset: (preset: BrushPreset) => void;
  newDrawingLayer: () => void;
  newDistressLayer: () => void;
  drawing: boolean;
  distortEditingId: string | null;
  setDistortEditingId: (id: string | null) => void;
  warpEditingId: string | null;
  setWarpEditingId: (id: string | null) => void;
  pathEditingId: string | null;
  setPathEditingId: (id: string | null) => void;
  setTool: (tool: PrintsStudioTool) => void;
  setPanel: (panel: PrintsStudioPanel) => void;
  setColor: (color: string) => void;
  setBrushSize: (n: number) => void;
  setEraserSize: (n: number) => void;
  setOpacity: (n: number) => void;
  setPressure: (on: boolean) => void;
  setGrain: (n: number) => void;
  setStabilization: (n: number) => void;
  patchPencil: (patch: Partial<PencilSettings>) => void;
  setDistressType: (type: DistressBrushType) => void;
  patchDistressScatter: (patch: Partial<DistressScatterSettings>) => void;
  setCustomAreaPointSelection: (selection: CustomAreaPointSelection | null) => void;
}

const PrintsStudioContext = createContext<PrintsStudioContextValue | null>(null);

export function PrintsStudioProvider({ children, workspaceId = 'garment' }: { children: ReactNode; workspaceId?: string }) {
  const savedTools = useRef(new Map<string, PrintsStudioState>());
  const remember = useCallback((state: PrintsStudioState) => { savedTools.current.set(workspaceId, state); }, [workspaceId]);
  const initial = savedTools.current.get(workspaceId) ?? (workspaceId === 'garment' ? DEFAULT_STATE : { ...(savedTools.current.get('garment') ?? DEFAULT_STATE), panel: 'shapes' as const, tool: 'select' as const, drawingSession: 0, distressSession: 0 });
  return <PrintsStudioDocumentProvider key={workspaceId} initialState={initial} onStateChange={remember}>{children}</PrintsStudioDocumentProvider>;
}

function PrintsStudioDocumentProvider({ children, initialState, onStateChange }: { children: ReactNode; initialState: PrintsStudioState; onStateChange: (state: PrintsStudioState) => void }) {
  const [state, setState] = useState<PrintsStudioState>(initialState);
  useLayoutEffect(() => onStateChange(state), [state, onStateChange]);
  const layerRenderer = useRef<LayerRenderer | null>(null);
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);
  const [distortEditingId, setDistortEditingId] = useState<string | null>(null);
  const [warpEditingId, setWarpEditingId] = useState<string | null>(null);
  const [pathEditingId, setPathEditingId] = useState<string | null>(null);
  useEffect(() => {
    if (state.tool !== 'select' || cropEditingId || warpEditingId || distortEditingId) setPathEditingId(null);
  }, [state.tool, cropEditingId, warpEditingId, distortEditingId]);
  const [customAreaPointSelection, setCustomAreaPointSelection] = useState<CustomAreaPointSelection | null>(null);
  useEffect(() => {
    const sampled = (event: Event) => setState(previous => ({ ...previous, color: (event as CustomEvent<string>).detail }));
    window.addEventListener('studio-color-sampled', sampled);
    return () => window.removeEventListener('studio-color-sampled', sampled);
  }, []);

  const setTool = useCallback((tool: PrintsStudioTool) => {
    setState((prev) => ({ ...prev, tool, drawingSession: prev.drawingSession + (tool === 'select' && prev.tool !== 'select' ? 1 : 0) }));
  }, []);
  const setPanel = useCallback((panel: PrintsStudioPanel) => {
    setState((prev) => {
      const tool: PrintsStudioTool =
        panel === 'brush'
          ? prev.tool === 'brush' || prev.tool === 'eraser'
            ? prev.tool
            : 'select'
          : panel === 'distress'
            ? prev.tool === 'distress' || prev.tool === 'distressEraser'
              ? prev.tool
              : 'select'
            : 'select';
      return { ...prev, panel, tool, drawingSession: prev.drawingSession + (panel !== prev.panel ? 1 : 0) };
    });
  }, []);
  const setColor = useCallback((color: string) => {
    setState((prev) => ({ ...prev, color }));
  }, []);
  const setBrushSize = useCallback((brushSize: number) => {
    setState((prev) => ({ ...prev, brushSize }));
  }, []);
  const setEraserSize = useCallback((eraserSize: number) => {
    setState((prev) => ({ ...prev, eraserSize }));
  }, []);
  const setOpacity = useCallback((opacity: number) => {
    setState((prev) => ({ ...prev, opacity }));
  }, []);
  const setPressure = useCallback((pressure: boolean) => {
    setState((prev) => ({ ...prev, pressure }));
  }, []);
  const setGrain = useCallback((grain: number) => {
    setState((prev) => ({ ...prev, grain }));
  }, []);
  const setStabilization = useCallback((stabilization: number) => {
    setState((prev) => ({ ...prev, stabilization }));
  }, []);
  const patchBrush = useCallback((patch: Partial<BrushSettings>) => {
    setState(previous => ({ ...previous, ...patch }));
  }, []);
  const setBrushPreset = useCallback((brushPreset: BrushPreset) => {
    const preset = BRUSH_PRESETS.find(item => item.id === brushPreset);
    if (!preset) return;
    setState(previous => ({
      ...previous, ...DEFAULT_BRUSH_SETTINGS, ...preset.settings, brushPreset,
      brushSize: preset.size, grain: preset.grain, tool: 'brush',
      smoothing: previous.smoothing, symmetry: previous.symmetry,
      texture: previous.texture, textureScale: previous.textureScale,
      textureStrength: previous.textureStrength, textureDensity: previous.textureDensity,
      textureRotation: previous.textureRotation, textureContrast: previous.textureContrast,
      textureInvert: previous.textureInvert, customTextureSource: previous.customTextureSource,
    }));
  }, []);
  const newDrawingLayer = useCallback(() => {
    setState(previous => ({ ...previous, tool: 'brush', drawingSession: previous.drawingSession + 1 }));
  }, []);
  const newDistressLayer = useCallback(() => {
    setState(previous => ({ ...previous, tool: 'distress', distressSession: previous.distressSession + 1 }));
  }, []);
  const patchPencil = useCallback((patch: Partial<PencilSettings>) => {
    setState((prev) => ({ ...prev, pencil: { ...prev.pencil, ...patch } }));
  }, []);
  const setDistressType = useCallback((distressType: DistressBrushType) => {
    setState((prev) => ({ ...prev, distressType }));
  }, []);
  const patchDistressScatter = useCallback((patch: Partial<DistressScatterSettings>) => {
    setState((prev) => ({ ...prev, distressScatter: { ...prev.distressScatter, ...patch } }));
  }, []);

  const value = useMemo<PrintsStudioContextValue>(
    () => ({
      ...state,
      layerRenderer,
      cropEditingId,
      setCropEditingId,
      distortEditingId,
      setDistortEditingId,
      warpEditingId,
      setWarpEditingId,
      pathEditingId,
      setPathEditingId,
      customAreaPointSelection,
      setCustomAreaPointSelection,
      drawing:
        state.tool === 'brush' ||
        state.tool === 'eraser' ||
        state.tool === 'distress' ||
        state.tool === 'distressEraser',
      setTool,
      setPanel,
      setColor,
      setBrushSize,
      setEraserSize,
      setOpacity,
      setPressure,
      setGrain,
      setStabilization,
      patchBrush,
      setBrushPreset,
      newDrawingLayer,
      newDistressLayer,
      patchPencil,
      setDistressType,
      patchDistressScatter,
    }),
    [state, cropEditingId, distortEditingId, warpEditingId, pathEditingId, customAreaPointSelection, setCustomAreaPointSelection, setTool, setPanel, setColor, setBrushSize, setEraserSize, setOpacity, setPressure, setGrain, setStabilization, patchBrush, setBrushPreset, newDrawingLayer, newDistressLayer, patchPencil, setDistressType, patchDistressScatter],
  );

  return <PrintsStudioContext.Provider value={value}>{children}</PrintsStudioContext.Provider>;
}

const IDLE: PrintsStudioContextValue = {
  ...DEFAULT_STATE,
  layerRenderer: { current: null },
  cropEditingId: null,
  setCropEditingId: () => {},
  patchBrush: () => {},
  setBrushPreset: () => {},
  newDrawingLayer: () => {},
  newDistressLayer: () => {},
  drawing: false,
  distortEditingId: null,
  setDistortEditingId: () => {},
  warpEditingId: null,
  setWarpEditingId: () => {},
  pathEditingId: null,
  setPathEditingId: () => {},
  setTool: () => {},
  setPanel: () => {},
  setColor: () => {},
  setBrushSize: () => {},
  setEraserSize: () => {},
  setOpacity: () => {},
  setPressure: () => {},
  setGrain: () => {},
  setStabilization: () => {},
  patchPencil: () => {},
  setDistressType: () => {},
  patchDistressScatter: () => {},
  setCustomAreaPointSelection: () => {},
  customAreaPointSelection: null,
};

export function usePrintsStudio() {
  return useContext(PrintsStudioContext) ?? IDLE;
}
