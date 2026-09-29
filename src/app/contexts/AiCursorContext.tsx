import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { executeAiCursorActions, type AiCursorDriver } from '../lib/aiCursor/execute';
import type {
  AiCursorAction,
  AiCursorActionResult,
  AiCursorPoint,
  AiCursorVisualState,
} from '../lib/aiCursor/types';
import { setTargetHighlighted } from '../lib/aiCursor/targets';

type AiCursorContextValue = {
  state: AiCursorVisualState;
  runActions: (actions: AiCursorAction[]) => Promise<AiCursorActionResult[]>;
  clearCursor: () => void;
};

const AiCursorContext = createContext<AiCursorContextValue | null>(null);

const INITIAL_POINT: AiCursorPoint = {
  x: typeof window !== 'undefined' ? window.innerWidth * 0.72 : 400,
  y: typeof window !== 'undefined' ? window.innerHeight * 0.55 : 320,
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function AiCursorProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [point, setPoint] = useState<AiCursorPoint>(INITIAL_POINT);
  const pointRef = useRef(point);
  const animFrameRef = useRef<number | null>(null);

  const cancelAnimation = useCallback(() => {
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const animateTo = useCallback(
    (next: AiCursorPoint, durationMs = 720) => {
      cancelAnimation();
      const from = pointRef.current;
      const start = performance.now();

      return new Promise<void>((resolve) => {
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const e = easeInOutCubic(t);
          const current = {
            x: from.x + (next.x - from.x) * e,
            y: from.y + (next.y - from.y) * e,
          };
          pointRef.current = current;
          setPoint(current);
          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(step);
          } else {
            animFrameRef.current = null;
            resolve();
          }
        };
        animFrameRef.current = requestAnimationFrame(step);
      });
    },
    [cancelAnimation],
  );

  const driver = useMemo<AiCursorDriver>(
    () => ({
      getPoint: () => pointRef.current,
      setVisible,
      setBusy,
      setHighlightTarget,
      animateTo,
    }),
    [animateTo],
  );

  const clearCursor = useCallback(() => {
    cancelAnimation();
    setTargetHighlighted(null);
    setHighlightTarget(null);
    setVisible(false);
    setBusy(false);
  }, [cancelAnimation]);

  const runActions = useCallback(
    async (actions: AiCursorAction[]) => {
      if (actions.length === 0) return [];
      return executeAiCursorActions(actions, driver);
    },
    [driver],
  );

  const value = useMemo<AiCursorContextValue>(
    () => ({
      state: { visible, point, highlightTarget, busy },
      runActions,
      clearCursor,
    }),
    [visible, point, highlightTarget, busy, runActions, clearCursor],
  );

  return <AiCursorContext.Provider value={value}>{children}</AiCursorContext.Provider>;
}

export function useAiCursor(): AiCursorContextValue {
  const ctx = useContext(AiCursorContext);
  if (!ctx) {
    throw new Error('useAiCursor must be used within AiCursorProvider');
  }
  return ctx;
}

/** Safe for components that may render outside the provider (tests / edge). */
export function useAiCursorOptional(): AiCursorContextValue | null {
  return useContext(AiCursorContext);
}
