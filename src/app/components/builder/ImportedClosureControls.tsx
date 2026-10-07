import type { ImportedGarment, ImportedGarmentView } from '../../data/importedGarment';
import type { GarmentDetail } from '../../data/garmentDetails';
import { constructionRegionsForView } from '../../data/importedConstructionRegions';
import { importedZipClosures, isolatedZipSvg, reviewImportedZip } from '../../data/importedClosures';

export function ImportedClosureControls({ garment, view, colors, details = [], onChange, onColor, onConvert, onRestore }: {
  garment: ImportedGarment; view: ImportedGarmentView; colors?: Partial<Record<string, string>>; details?: GarmentDetail[];
  onChange: (garment: ImportedGarment) => void; onColor: (id: string, color: string) => void;
  onConvert: (id: string) => void; onRestore: (id: string) => void;
}) {
  const zips = importedZipClosures(garment, view);
  if (!zips.length) return null;
  const ink = constructionRegionsForView(garment, view)!.constructionInk;
  return <section aria-label="Imported source zips" className="my-4 space-y-4 text-xs text-white">
    <h4 className="font-semibold">Recognised zips</h4>
    {zips.map(zip => {
      const replacement = details.find(detail => detail.importedClosureId === zip.id && (detail.view ?? 'front') === view && !detail.hidden);
      const reviewed = zip.status === 'reviewed';
      const x = Math.min(zip.start.x, zip.end.x) - zip.width * 2;
      const y = Math.min(zip.start.y, zip.end.y) - zip.width * 2;
      const width = Math.max(zip.width * 4, Math.abs(zip.end.x - zip.start.x) + zip.width * 4);
      const height = Math.max(zip.width * 4, Math.abs(zip.end.y - zip.start.y) + zip.width * 4);
      return <div key={zip.id} className="space-y-2 rounded border border-white/15 p-3">
        <strong>{zip.label}</strong>
        <svg aria-label={`${zip.label} isolated source preview`} role="img" viewBox={`${x} ${y} ${width} ${height}`} className="h-36 w-full bg-white" dangerouslySetInnerHTML={{ __html: isolatedZipSvg(ink, zip) }}/>
        <label className="flex items-start gap-2"><input type="checkbox" aria-label={`Confirm ${zip.label} isolation`} checked={reviewed} disabled={Boolean(replacement)} onChange={event => onChange(reviewImportedZip(garment, view, zip.id, event.target.checked))}/>Only this zip is isolated; surrounding seams are excluded.</label>
        {!replacement && <label className="flex items-center justify-between gap-2">Original zip colour<input type="color" aria-label={`${zip.label} colour`} disabled={!reviewed} value={colors?.[zip.id] ?? '#141414'} onChange={event => onColor(zip.id, event.target.value)}/></label>}
        <button type="button" disabled={!reviewed} className="w-full rounded border border-white/20 px-2 py-2 disabled:opacity-40" onClick={() => onConvert(zip.id)}>{replacement ? 'Edit converted zip' : 'Convert to editable zip'}</button>
        {replacement ? <button type="button" className="w-full rounded border border-white/20 px-2 py-2" onClick={() => onRestore(zip.id)}>Restore original zip</button>
          : <p className="text-white/60">Colour preserves the uploaded zip. Conversion replaces only the isolated zip and enables pull styles, size and opening controls below. Restore the original at any time.</p>}
      </div>;
    })}
  </section>;
}
