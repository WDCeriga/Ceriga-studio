import { useRef, useState } from 'react';
import { Upload,FileUp,Download,Info } from 'lucide-react';
import type { AssetMeasurement, AssetDimension } from '../CustomAssetMeasurements';
import type { MeasurementUnit } from '../../../lib/measurements';
type Edit = (asset: AssetMeasurement, field: AssetDimension, value: number) => string | undefined;
function DimensionField({
  asset,
  field,
  label,
  unit,
  onEdit
}: {
  asset: AssetMeasurement;
  field: AssetDimension;
  label: string;
  unit: MeasurementUnit;
  onEdit: Edit;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const value = field === 'diameter' ? asset.width : field === 'count' ? asset.count ?? 1 : asset[field] ?? asset.width * 1.5;
  const factor = field === 'count' || field === 'rotation' || unit === 'cm' ? 1 : 2.54;
  const suffix = field === 'count' ? 'count' : field === 'rotation' ? 'deg' : unit;
  const commit = () => {
    if (draft === null) return;
    setError(draft.trim() === '' ? 'Enter a value.' : onEdit(asset, field, Number(draft) * factor) ?? '');
    setDraft(null);
  };
  return <label className="new-dimension-field">{label}<span className="new-measure-value"><input type="number" aria-label={`${asset.name} ${label} (${suffix})`} min={field === 'rotation' ? undefined : field === 'count' ? 1 : field === 'left' || field === 'top' ? 0 : .001} max={field === 'count' ? 12 : undefined} step={field === 'count' || field === 'rotation' ? 1 : .01} value={draft ?? Number((value / factor).toFixed(4))} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          setError('');
        }
      }} /><span>{suffix}</span></span>{error && <small role="status">{error}</small>}</label>;
}
export function NewAssetMeasurements({
  assets,
  unit,
  selectedId,
  onSelect,
  onEdit,onEditPanel
}: {
  assets: AssetMeasurement[];
  unit: MeasurementUnit;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: Edit;onEditPanel?:(id:string)=>void;
}) {
  const display = (n: number | undefined) => n === undefined ? 'Not available' : (unit === 'in' ? n / 2.54 : n).toFixed(2) + ' ' + unit;
  if (!assets.length) return null;
  const panelAssets=assets.filter(asset=>asset.kind==='seam panel'),otherAssets=assets.filter(asset=>asset.kind!=='seam panel');
  return <>{panelAssets.length>0&&<details open className="new-notes panel-measurement-section"><summary>Panel measurements <span className="builder-muted">{panelAssets.length}</span></summary><p className="panel-measurement-help">Live dimensions for this fit and view. Width and height are the panel's full bounding dimensions.</p>{panelAssets.map(asset=><section key={asset.id} className="new-asset-measurements panel-measurement-card"><button className="new-asset-select" aria-pressed={selectedId===asset.id} onClick={()=>onSelect(selectedId===asset.id?null:asset.id)}>{asset.name}<small>{asset.view==='front'?'Front':'Back'}</small></button><dl className="panel-measurement-values"><div><dt>Width</dt><dd>{display(asset.width)}</dd></div><div><dt>Height</dt><dd>{display(asset.height)}</dd></div><div><dt>Panel seam length</dt><dd>{display(asset.seamLength)}</dd></div><div><dt>Area</dt><dd>{((asset.areaCm2??0)/(unit==='in'?6.4516:1)).toFixed(2)} {unit}²</dd></div></dl>{onEditPanel&&asset.sourceId&&<button className="builder-link panel-edit-shape" onClick={()=>onEditPanel(asset.sourceId!)}>Edit panel shape</button>}</section>)}</details>}{otherAssets.length>0&&<details className="new-notes"><summary>Asset measurements <span className="builder-muted">{otherAssets.length}</span></summary>{otherAssets.map(asset => <section className="new-asset-measurements" key={asset.id}><button className="new-asset-select" aria-pressed={selectedId === asset.id} onClick={() => onSelect(selectedId === asset.id ? null : asset.id)}>{asset.name}</button><p>{asset.kind} · {asset.view}</p><div className="new-dimension-grid">{(asset.kind === 'button' ? [['diameter', 'Diameter'], ['count', 'Number of buttons'], ...(asset.count ? [['spacing', 'Centre spacing']] : [])] : [['width', 'Width'], ['height', asset.kind === 'zip' ? 'Length' : 'Height']]).map(([field, label]) => <DimensionField key={field + '-' + unit} asset={asset} field={field as AssetDimension} label={label} unit={unit} onEdit={onEdit} />)}{(asset.kind === 'patch' || asset.kind === 'Custom pocket') && ([['left', 'X centre from body left'], ['top', 'Y centre from body top'], ['rotation', 'Rotation']] as const).map(([field, label]) => <DimensionField key={field + '-' + unit} asset={asset} field={field} label={label} unit={unit} onEdit={onEdit} />)}</div><dl>{Object.entries({
          'Centre from body left': display(asset.left),
          'Centre from body top': display(asset.top),
          'Centre-line offset': display(asset.centerOffset),
          'Centre below neck opening': display(asset.neckOffset),
          'Hem clearance': display(asset.hemClearance),
          'Nearest side seam': display(asset.sideSeamClearance),
          'Rotation': asset.rotation.toFixed(1) + ' deg'
        }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>)}</details>}</>;

}
export function NewReferencePanel({
  fileNamesText,
  notes,
  onFileNamesChange,
  onNotesChange
}: {
  fileNamesText: string;
  notes: string;
  onFileNamesChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="new-reference-panel"><input ref={input} type="file" hidden multiple accept="image/*,.pdf,.ai,.eps,.svg,application/pdf" onChange={e => onFileNamesChange(Array.from(e.target.files ?? []).map(f => f.name).join(', '))} /><button className="new-reference-picker" onClick={() => input.current?.click()}><Upload size={28} /><strong>Choose reference files</strong><span>Images, PDF, AI/EPS</span></button><p>{fileNamesText || 'No files selected yet.'}</p><label>Reference notes<textarea value={notes} onChange={e => onNotesChange(e.target.value)} /></label><p>Reference names and notes are saved with this project. This does not import measurement values or store file contents.</p></div>;
}

export function ImportMeasurementsPanel(){
 return <section className="measurement-import-panel"><h3>Upload</h3><p>Import measurements from a tech pack, size chart or spreadsheet. Review the data before applying it to your garment.</p><button className="measurement-import-dropzone" disabled aria-label="Upload measurements — coming soon"><FileUp size={40} strokeWidth={1.4}/><strong>Drop a file here</strong><span>or click to upload</span><small>Excel, CSV, PDF (tech pack), or a photo of a size chart.</small></button><span className="measurement-import-soon">File import coming soon</span><button className="measurement-import-template" disabled><Download size={15}/>Download the Ceriga template<span>Coming soon</span></button><div className="measurement-import-review"><Info size={18}/><div><h4>Review</h4><p>Imported values will appear here for you to check before applying them. No measurements are changed by this preview.</p></div></div></section>
}
