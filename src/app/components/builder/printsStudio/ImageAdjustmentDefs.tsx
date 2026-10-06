import {
  hasAdvancedImageAdjustments,
  highlightMaskTable,
  imageAdjustmentValues,
  imageTextureSeed,
  type ImageAdjustmentValues,
} from '../../../lib/imageAdjustments';

export function ImageAdjustmentDefs({ element }: { element: ImageAdjustmentValues & { id: string } }) {
  if (!hasAdvancedImageAdjustments(element)) return null;
  const settings = imageAdjustmentValues(element);
  const exposure = 2 ** settings.filterExposure;
  const temperature = settings.filterTemperature / 100;
  const tint = settings.filterTint / 100;
  const highlightGain = 1 + settings.filterHighlights / 100 * 0.75;
  const sharpen = settings.filterSharpen / 100 * 1.5;
  const seed = imageTextureSeed(element.id);
  let result = 'balanced';
  const highlightsInput = result;
  if (settings.filterHighlights !== 0) result = 'highlightAdjusted';
  const hueInput = result;
  if (settings.filterHue !== 0) result = 'hueAdjusted';
  const sharpenInput = result;
  if (sharpen > 0) result = 'sharpened';
  const noiseInput = result;
  if (settings.filterNoise > 0) result = 'noisy';
  const grainInput = result;
  if (settings.filterGrain > 0) result = 'grainy';

  return (
    <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
      <defs>
        <filter id={`adjust-${element.id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feComponentTransfer in="SourceGraphic" result="balanced">
            <feFuncR type="linear" slope={exposure * 2 ** (temperature * 0.3 + tint * 0.125)} />
            <feFuncG type="linear" slope={exposure * 2 ** (-tint * 0.25)} />
            <feFuncB type="linear" slope={exposure * 2 ** (-temperature * 0.3 + tint * 0.125)} />
            <feFuncA type="table" tableValues="1 1" />
          </feComponentTransfer>
          {settings.filterHighlights !== 0 && <>
            <feColorMatrix in={highlightsInput} type="luminanceToAlpha" result="luminance" />
            <feComponentTransfer in="luminance" result="highlightMask">
              <feFuncA type="table" tableValues={highlightMaskTable()} />
            </feComponentTransfer>
            <feComponentTransfer in={highlightsInput} result="highlightTone">
              <feFuncR type="linear" slope={highlightGain} />
              <feFuncG type="linear" slope={highlightGain} />
              <feFuncB type="linear" slope={highlightGain} />
            </feComponentTransfer>
            <feComposite in="highlightTone" in2="highlightMask" operator="in" result="lightAreas" />
            <feComposite in={highlightsInput} in2="highlightMask" operator="out" result="darkAreas" />
            <feComposite in="lightAreas" in2="darkAreas" operator="arithmetic" k2={1} k3={1} result="highlightAdjusted" />
          </>}
          {settings.filterHue !== 0 && <feColorMatrix in={hueInput} type="hueRotate" values={String(settings.filterHue)} result="hueAdjusted" />}
          {sharpen > 0 && <feConvolveMatrix in={sharpenInput} order="3" kernelMatrix={`0 ${-sharpen} 0 ${-sharpen} ${1 + 4 * sharpen} ${-sharpen} 0 ${-sharpen} 0`} divisor={1} edgeMode="duplicate" preserveAlpha result="sharpened" />}
          {settings.filterNoise > 0 && <>
            <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={1} seed={seed} result="noiseField" />
            <feComponentTransfer in="noiseField" result="noiseOverlay">
              <feFuncA type="table" tableValues={`${settings.filterNoise / 100 * 0.8} ${settings.filterNoise / 100 * 0.8}`} />
            </feComponentTransfer>
            <feBlend in={noiseInput} in2="noiseOverlay" mode="soft-light" result="noisy" />
          </>}
          {settings.filterGrain > 0 && <>
            <feTurbulence type="fractalNoise" baseFrequency={0.28} numOctaves={3} seed={seed + 11} result="grainField" />
            <feColorMatrix in="grainField" type="saturate" values="0" result="monoGrain" />
            <feComponentTransfer in="monoGrain" result="grainOverlay">
              <feFuncA type="table" tableValues={`${settings.filterGrain / 100} ${settings.filterGrain / 100}`} />
            </feComponentTransfer>
            <feBlend in={grainInput} in2="grainOverlay" mode="soft-light" result="grainy" />
          </>}
          <feComposite in={result} in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}