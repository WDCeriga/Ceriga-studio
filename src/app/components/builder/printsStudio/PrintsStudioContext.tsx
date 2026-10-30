import type {DesignElement} from '../PrintStudioEditor';
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

export type PrintsStudioTool = 'select' | 'brush' | 'eraser' | 'distress' | 'distressEraser' | 'customArea' | 'customAreaEdit' | 'customAreaAddPoint' | 'shapePolygon' | 'shapePencil'|'shapeLive'|'textPlace'|'textTracking';
export type DistressBrushType = 'holes' | 'abrasion' | 'rips';

export interface CustomAreaPointSelection {
  id: string;
  index: number;
  indices?: number[];
}

export type PrintsStudioPanel = 'library'|'brush' | 'shapes' | 'upload' | 'text' | 'patterns' | 'distress';

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
  panelRequest: number;
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
  panel: 'shapes',
  panelRequest: 0,
  color: '#171717',
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
  textEditRequest: string | null;
  setTextEditRequest: (id: string | null) => void;
  layerRenderer: MutableRefObject<LayerRenderer | null>;
  imageUploader: MutableRefObject<(() => void) | null>;
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
  liveShape:'rect'|'ellipse'|'polygon'|'star'|'line';
  setLiveShape:(kind:'rect'|'ellipse'|'polygon'|'star'|'line')=>void;
  textSelection:{id:string;start:number;end:number}|null;
  setTextSelection:(selection:{id:string;start:number;end:number}|null)=>void;
  printArea:{x:number;y:number;width:number;height:number};
  setPrintArea:(area:{x:number;y:number;width:number;height:number})=>void;
  unitsPerCm:number;
  setUnitsPerCm:(value:number)=>void;
  booleanPreview:DesignElement[];
  setBooleanPreview:(elements:DesignElement[])=>void;
  selectionAdditive: boolean;
  setSelectionAdditive: (enabled: boolean) => void;
  selectionIds: string[];
  setSelectionIds: (ids: string[] | ((previous: string[]) => string[])) => void;
  penTargetId: string | null;
  setPenTargetId: (id: string | null) => void;
  penOperation: 'subtract' | 'join' | 'continue';
  setPenOperation: (operation: 'subtract' | 'join' | 'continue') => void;
  outlineRequest:{id:string;serial:number}|null;requestOutline:(id:string)=>void;
  logoRegionEditing:{rootId:string;regionId:string}|null;setLogoRegionEditing:(value:{rootId:string;regionId:string}|null)=>void;
  penCurvature:boolean;setPenCurvature:(value:boolean|((previous:boolean)=>boolean))=>void;
  referenceTask:{id:string;mode:'calibrate'|'region';distance:number;tolerance:number}|null;setReferenceTask:(task:{id:string;mode:'calibrate'|'region';distance:number;tolerance:number}|null)=>void;
  adjustLettersId:string|null;setAdjustLettersId:(id:string|null)=>void;
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
  const imageUploader = useRef<(() => void) | null>(null);
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);
  const [textEditRequest, setTextEditRequest] = useState<string | null>(null);
  const [distortEditingId, setDistortEditingId] = useState<string | null>(null);
  const [warpEditingId, setWarpEditingId] = useState<string | null>(null);
  const [outlineRequest,setOutlineRequest]=useState<{id:string;serial:number}|null>(null);const requestOutline=useCallback((id:string)=>setOutlineRequest(value=>({id,serial:(value?.serial??0)+1})),[]);
  const [logoRegionEditing,setLogoRegionEditing]=useState<{rootId:string;regionId:string}|null>(null);
  const [penCurvature,setPenCurvature]=useState(false);
  const [referenceTask,setReferenceTask]=useState<{id:string;mode:'calibrate'|'region';distance:number;tolerance:number}|null>(null);
  const [adjustLettersId,setAdjustLettersId]=useState<string|null>(null);
  const [pathEditingId,setPathEditingId]=useState<string|null>(null);
  const [selectionAdditive,setSelectionAdditive] = useState(false);
  const [liveShape,setLiveShape]=useState<'rect'|'ellipse'|'polygon'|'star'|'line'>('rect');
  const [textSelection,setTextSelection]=useState<{id:string;start:number;end:number}|null>(null);
  const [printArea,setPrintArea]=useState({x:0,y:0,width:800,height:700});
  const [unitsPerCm,setUnitsPerCm]=useState(10);
  const [booleanPreview,setBooleanPreview]=useState<DesignElement[]>([]);
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  useEffect(()=>setBooleanPreview([]),[state.tool,selectionIds.join('|')]);
  const [penTargetId, setPenTargetId] = useState<string | null>(null);
  const [penOperation, setPenOperation] = useState<'subtract' | 'join' | 'continue'>('subtract');
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
      return { ...prev, panel, panelRequest:(prev.panelRequest??0)+1, tool, drawingSession: prev.drawingSession + (panel !== prev.panel ? 1 : 0) };
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
      imageUploader,
      textEditRequest,
      setTextEditRequest,
      cropEditingId,
      setCropEditingId,
      distortEditingId,
      setDistortEditingId,
      warpEditingId,
      setWarpEditingId,
      outlineRequest,requestOutline,logoRegionEditing,setLogoRegionEditing,penCurvature,setPenCurvature,referenceTask,setReferenceTask,adjustLettersId,setAdjustLettersId,pathEditingId,
      setPathEditingId,printArea,setPrintArea,textSelection,setTextSelection,liveShape,setLiveShape,unitsPerCm,setUnitsPerCm, booleanPreview,setBooleanPreview,selectionAdditive, setSelectionAdditive, selectionIds, setSelectionIds, penTargetId, setPenTargetId, penOperation, setPenOperation,
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
    [outlineRequest,logoRegionEditing,penCurvature,referenceTask,adjustLettersId,selectionAdditive,printArea,textSelection, liveShape,unitsPerCm,booleanPreview,selectionIds, penTargetId, penOperation, state, textEditRequest, cropEditingId, distortEditingId, warpEditingId, pathEditingId, customAreaPointSelection, setCustomAreaPointSelection, setTool, setPanel, setColor, setBrushSize, setEraserSize, setOpacity, setPressure, setGrain, setStabilization, patchBrush, setBrushPreset, newDrawingLayer, newDistressLayer, patchPencil, setDistressType, patchDistressScatter],
  );

  return <PrintsStudioContext.Provider value={value}>{children}</PrintsStudioContext.Provider>;
}

const IDLE: PrintsStudioContextValue = {
  textEditRequest: null,
  setTextEditRequest: () => {},
  ...DEFAULT_STATE,
  layerRenderer: { current: null },
  imageUploader: { current: null },
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
  printArea:{x:0,y:0,width:800,height:700},setPrintArea:()=>{},textSelection:null,setTextSelection:()=>{},liveShape:'rect',setLiveShape:()=>{},unitsPerCm:10,setUnitsPerCm:()=>{},booleanPreview:[],setBooleanPreview:()=>{},selectionAdditive: false, setSelectionAdditive: () => {}, selectionIds: [], setSelectionIds: () => {}, penTargetId: null, setPenTargetId: () => {}, penOperation: 'subtract', setPenOperation: () => {},
  outlineRequest:null,requestOutline:()=>{},logoRegionEditing:null,setLogoRegionEditing:()=>{},penCurvature:false,setPenCurvature:()=>{},referenceTask:null,setReferenceTask:()=>{},adjustLettersId:null,setAdjustLettersId:()=>{},pathEditingId: null,
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
