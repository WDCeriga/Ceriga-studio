import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type PrintsStudioTool = 'select' | 'brush' | 'eraser' | 'distress' | 'distressEraser';
export type DistressBrushType = 'holes' | 'abrasion' | 'rips';

export type PrintsStudioPanel = 'brush' | 'shapes' | 'upload' | 'text' | 'patterns' | 'distress';

export interface PencilSettings {
  pencilOnly: boolean;
  tiltShading: boolean;
  doubleTapTogglesEraser: boolean;
}

export interface PrintsStudioState {
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
}

export const DRAWING_LAYER_ID = 'print-drawing-layer';
export const DISTRESS_LAYER_ID = 'print-distress-layer';

const DEFAULT_STATE: PrintsStudioState = {
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
};

interface PrintsStudioContextValue extends PrintsStudioState {
  drawing: boolean;
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
}

const PrintsStudioContext = createContext<PrintsStudioContextValue | null>(null);

export function PrintsStudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrintsStudioState>(DEFAULT_STATE);

  const setTool = useCallback((tool: PrintsStudioTool) => {
    setState((prev) => ({ ...prev, tool }));
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
      return { ...prev, panel, tool };
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
  const patchPencil = useCallback((patch: Partial<PencilSettings>) => {
    setState((prev) => ({ ...prev, pencil: { ...prev.pencil, ...patch } }));
  }, []);
  const setDistressType = useCallback((distressType: DistressBrushType) => {
    setState((prev) => ({ ...prev, distressType }));
  }, []);

  const value = useMemo<PrintsStudioContextValue>(
    () => ({
      ...state,
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
      patchPencil,
      setDistressType,
    }),
    [state, setTool, setPanel, setColor, setBrushSize, setEraserSize, setOpacity, setPressure, setGrain, setStabilization, patchPencil, setDistressType],
  );

  return <PrintsStudioContext.Provider value={value}>{children}</PrintsStudioContext.Provider>;
}

const IDLE: PrintsStudioContextValue = {
  ...DEFAULT_STATE,
  drawing: false,
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
};

export function usePrintsStudio() {
  return useContext(PrintsStudioContext) ?? IDLE;
}
