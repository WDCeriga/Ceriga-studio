import type { DesignElement } from '../components/builder/PrintsDesignStep';

export type TextCurvePatch = Partial<Pick<DesignElement, 'textCurveAmount' | 'textCurveShape' | 'textCurveRadius'>>;

export function textCurveRadius(element: Pick<DesignElement, 'textCurveShape' | 'textCurveRadius'>) {
  return element.textCurveShape === 'circle'
    ? Math.max(32, Math.min(160, element.textCurveRadius ?? 80))
    : Math.max(80, Math.min(500, element.textCurveRadius ?? 260));
}

export function updateTextCurve(element: DesignElement, patch: TextCurvePatch): Partial<DesignElement> {
  const shape = patch.textCurveShape ?? element.textCurveShape ?? 'arc';
  const amount = patch.textCurveAmount ?? element.textCurveAmount ?? 0;
  const wasCircle = element.textCurveShape === 'circle' && (element.textCurveAmount ?? 0) > 0;
  const isCircle = shape === 'circle' && amount > 0;
  if (!isCircle) {
    if (wasCircle && element.textCurveOriginalBox) {
      return { ...element.textCurveOriginalBox, ...patch, textCurveOriginalBox: undefined };
    }
    return patch;
  }
  const originalBox = element.textCurveOriginalBox ?? {
    width: element.width, height: element.height,
    autoWidth: element.autoWidth, autoHeight: element.autoHeight,
    aspectLocked: element.aspectLocked, textCurveRadius: element.textCurveRadius,
  };
  const radius = textCurveRadius({
    textCurveShape: shape,
    textCurveRadius: patch.textCurveRadius ?? (wasCircle ? element.textCurveRadius : element.width / 2 - (element.fontSize ?? 30)),
  });
  const size = Math.ceil((radius + (element.fontSize ?? 30)) * 2);
  return {
    ...patch,
    textCurveRadius: radius,
    textCurveOriginalBox: originalBox,
    ...(!wasCircle || patch.textCurveRadius !== undefined ? {
      width: size, height: size, autoWidth: false, autoHeight: false, aspectLocked: true,
    } : {}),
  };
}
