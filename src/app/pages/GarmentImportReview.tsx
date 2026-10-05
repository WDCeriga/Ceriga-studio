import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ImportedGarmentEditor, ImportedMeasurementOverlay } from '../components/builder/ImportedGarmentEditor';
import { garmentRegressionFixture } from '../data/garmentRegressionFixtures';
import { createPanelledHoodieFixture } from '../data/panelledHoodieRegressionFixture';
import { importedBuilderCategories, importedControlGroups, importedGarmentLayers, mergeImportedGarmentView, recolorImportedParts } from '../data/importedGarment';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';
import { GarmentLabelsPanel } from '../components/builder/GarmentLabelsPanel';
import { GarmentLabelsPreview } from '../components/builder/GarmentLabelsPreview';
import type { GarmentLabel } from '../data/garmentLabels';
import { resolveProductSvgType } from '../data/garmentSvgCatalog';

export function GarmentImportReview() {
  const [params] = useSearchParams();
  const type = params.get('garment') === 'tshirt' ? 'tshirt' : params.get('garment') === 'hoodie' ? 'hoodie' : 'shorts';
  const panelled = type === 'hoodie' && params.get('construction') === 'panelled';
  const frontFixture = () => panelled ? createPanelledHoodieFixture() : garmentRegressionFixture(type, false);
  const [garment, setGarment] = useState(frontFixture);
  const [view, setView] = useState<'front' | 'back'>('front');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [colors, setColors] = useState<Partial<Record<string, string>>>({});
  const [step, setStep] = useState(1);
  const [labels, setLabels] = useState<GarmentLabel[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [tagView, setTagView] = useState<'front' | 'back'>('front');
  const hasBack = garment.parts.some(part => part.view === 'back');
  const categories = [...new Set(importedControlGroups(garment).map(group => group.category))];
  return <main className="min-h-screen bg-[#09090b] p-4 text-white md:p-8">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold">Whole Garment Import · review</h1><p className="mt-1 text-xs text-amber-200">{panelled ? 'Captured front-outline regression — no observed back or live analysis.' : 'Synthetic SVG regression fixtures — not a live photo-analysis result.'}</p></div>
      <nav className="flex flex-wrap gap-4 text-sm" aria-label="Regression garment">{(['shorts', 'tshirt', 'hoodie'] as const).map(item => <a className={type === item && !panelled ? 'text-red-400' : 'text-white/70'} key={item} href={`?garment=${item}`}>{item === 'tshirt' ? 'T-shirt' : item === 'shorts' ? 'Denim shorts' : 'Hoodie'}</a>)}<a className={panelled ? 'text-red-400' : 'text-white/70'} href="?garment=hoodie&construction=panelled">Panelled hoodie</a></nav>
    </header>
    <div className="grid gap-5 lg:grid-cols-[440px_1fr]">
      <aside className="space-y-4 rounded-xl border border-white/15 p-4">
        <nav className="flex flex-wrap gap-2" aria-label="Detected builder sections">
          <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => setStep(1)}>Measurement</button>
          {categories.map(category => <button key={category} className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => setStep(importedBuilderCategories[category].step)}>{importedBuilderCategories[category].title}</button>)}
          <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => setStep(8)}>Stitching</button>
          <button className="rounded border border-white/20 px-2 py-1 text-xs" onClick={() => setStep(10)}>Labels &amp; Branding</button>
        </nav>
        <ImportedGarmentEditor value={garment} view={view} step={step} onChange={setGarment} onReplace={() => { setColors({}); setView('front'); setLabels([]); setSelectedLabel(null); setTagView('front'); }} selectedId={selected} onSelect={setSelected}
          colors={colors} onColor={(id, color, scope) => setColors(previous => recolorImportedParts(garment, id, color, scope, previous))} onResetColors={() => setColors({})}
          highlightedMeasurementId={highlight} onHighlightMeasurement={setHighlight}/>
        {step === 10 && <GarmentLabelsPanel labels={labels} selectedId={selectedLabel} onSelect={setSelectedLabel} onChange={setLabels} manualPlacement tagView={tagView} onTagViewChange={setTagView}/>}
      </aside>
      <section className="min-w-0 space-y-3" aria-label="Garment preview">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['front', 'back'] as const).map(side => <button key={side} className={`rounded border border-white/20 px-4 py-2 uppercase disabled:opacity-35 ${view === side ? 'bg-[#cc2d24]' : ''}`} aria-pressed={view === side} disabled={!garment.parts.some(part => part.view === side)} onClick={() => { setView(side); setHighlight(null); setSelected(null); }}>{side}</button>)}
          {!hasBack && <span className="text-amber-200">Back reference required · Upload back reference</span>}
          {view === 'back' && garment.manifest.backView?.inference && <span className="text-amber-200">Estimated back · not observed</span>}
          {!panelled && garment.manifest.backView?.inference && <button className="rounded border border-white/20 px-3 py-2" onClick={() => setGarment(mergeImportedGarmentView(garment, garmentRegressionFixture(type, true), 'back'))}>Replace estimate with back fixture</button>}
          {(!panelled || hasBack) && <button className="ml-auto rounded border border-white/20 px-3 py-2" onClick={() => {
            if (hasBack) { setGarment(frontFixture()); setColors({}); setView('front'); setLabels([]); setSelectedLabel(null); setTagView('front'); }
            else setGarment(mergeImportedGarmentView(garment, garmentRegressionFixture(type, true), 'back'));
          }}>{hasBack ? 'Reset to front-only fixture' : 'Load paired back fixture'}</button>}
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
          {step === 10 ? <GarmentLabelsPreview labels={labels} selectedId={selectedLabel} onSelect={setSelectedLabel} onChange={setLabels}
            tagView={tagView} onTagViewChange={setTagView} garmentProps={{ garmentType: resolveProductSvgType(garment.manifest.garmentType) ?? 'tshirt', color: '#86a9a2',
              detailView: view, customAssetState: { importedGarment: garment, importedPartColors: colors }, className: 'h-full w-full' }}/>
            : <svg viewBox="0 0 2048 2048" className="absolute inset-0 h-full w-full" aria-label={`${garment.manifest.garmentType} ${view} geometry`}>
            {importedGarmentLayers(garment, view, colors).map(layer => <g key={layer.id} data-view-part={layer.id}>
              <g dangerouslySetInnerHTML={{ __html: tintPotraceSvg(layer.svgRaw, layer.tint ?? '#647785') }}/>
              {layer.constructionSvg && <g dangerouslySetInnerHTML={{ __html: layer.constructionSvg }}/>}
              {layer.stitchSvg && <g dangerouslySetInnerHTML={{ __html: tintPotraceSvg(layer.stitchSvg, layer.stitchColor ?? '#b09c72') }}/>}
            </g>)}
          </svg>}
          {step === 1 && <ImportedMeasurementOverlay value={garment} view={view} highlightedId={highlight}/>}
        </div>
        <p className="text-xs text-white/55">Independent front/back outlines. One known dimension calibrates only its source view. Hover a measurement row to highlight its guide.</p>
      </section>
    </div>
  </main>;
}
