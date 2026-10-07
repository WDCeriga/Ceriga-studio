import { useMemo } from 'react';
import type { ImportedGarment } from '../../data/importedGarment';
import { importedGarmentSvg } from '../../data/importedGarmentExport';
import { constructionRegionsForView } from '../../data/importedConstructionRegions';

const palette = ['#a5d8ff', '#ffc9c9', '#b2f2bb', '#ffec99', '#d0bfff', '#99e9f2', '#ffd8a8', '#eebefa', '#c0eb75'];
const image = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const percentage = (actual: number, prior: number) => prior ? `${((actual / prior - 1) * 100).toFixed(1)}%` : 'n/a';

export function EstimatedBackComparison({ value }: { value: ImportedGarment }) {
  const drawings = useMemo(() => ({ front: image(importedGarmentSvg(value, 'front', 'outline')), back: image(importedGarmentSvg(value, 'back', 'outline')) }), [value]);
  const construction = constructionRegionsForView(value, 'back');
  const report = value.manifest.backView?.inference?.structure;
  return <div className="space-y-4" aria-label="Front and estimated back comparison">
    <p className="text-sm text-amber-200">Estimated, not observed. Front proportions guide the rear template; hidden seams, pockets and closures are omitted. Both drawings use the same 2048 × 2048 coordinate system.</p>
    <div className="grid gap-4 md:grid-cols-2">
      <figure><figcaption className="mb-2 font-medium">1. Front technical drawing</figcaption><img className="aspect-square w-full rounded bg-white" src={drawings.front} alt="Original front technical drawing"/></figure>
      <figure><figcaption className="mb-2 font-medium">2. Clean estimated back</figcaption><img className="aspect-square w-full rounded bg-white" src={drawings.back} alt="Clean estimated back technical drawing"/></figure>
      <figure><figcaption className="mb-2 font-medium">3. Editable back regions</figcaption>
        <svg viewBox="0 0 2048 2048" className="aspect-square w-full rounded bg-white" role="img" aria-label="Estimated back region overlay">
          {construction?.regions.map((region, index) => <path key={region.id} d={region.path} fill={palette[index % palette.length]} fillRule="evenodd" stroke="#172033" strokeWidth="2"><title>{region.label}</title></path>)}
        </svg>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{construction?.regions.map((region, index) => <li key={region.id}><span aria-hidden="true" className="mr-1 inline-block size-2 rounded" style={{ backgroundColor: palette[index % palette.length] }}/>{region.label.replace('Estimated back ', '')}</li>)}</ul>
      </figure>
      <section aria-label="Generation proportion checks" className="space-y-3"><h3 className="font-medium">4. Front-derived proportion checks</h3>
        {report ? <>
          <p className="text-xs text-white/70">Generation-time checks against the anatomical template measured from front outlines and semantic regions (not raw-photo pixels or physical measurements). Later manual edits are not covered by these checks.</p>
          <p className="text-sm">Silhouette area difference: {(report.silhouetteDifference * 100).toFixed(2)}% · Limit: 3.5%</p>
          <p className="text-xs text-white/70">Front revision {report.frontRevision} · {report.category} · quality pass {report.attempt}</p>
          <ul className="space-y-3">{report.checks.map(check => <li key={check.label} className="rounded border border-white/15 p-2 text-xs">
            <div className="mb-1 flex justify-between gap-2"><strong className="capitalize">{check.label}</strong><span>Δ width {percentage(check.backWidth, check.frontDerivedWidth)} · height {percentage(check.backHeight, check.frontDerivedHeight)}</span></div>
            <div aria-label={`${check.label} width comparison`} className="space-y-1">
              <div className="h-1.5 rounded bg-sky-300" style={{ width: `${check.frontDerivedWidth * 100}%` }}/>
              <div className="h-1.5 rounded bg-amber-300" style={{ width: `${check.backWidth * 100}%` }}/>
            </div>
            <p className="mt-1 text-white/60">Template {(check.frontDerivedWidth * 2048).toFixed(1)} × {(check.frontDerivedHeight * 2048).toFixed(1)} → back {(check.backWidth * 2048).toFixed(1)} × {(check.backHeight * 2048).toFixed(1)} drawing units</p>
          </li>)}</ul>
          <p className="text-xs text-white/60">Blue: front-derived template width. Amber: clean back width. Rear anatomy remains an assumption, even when proportions match.</p>
        </> : <p>No structured proportion report exists for this older estimate. Upgrade the estimated back to generate one.</p>}
      </section>
    </div>
  </div>;
}
