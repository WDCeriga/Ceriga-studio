import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  X,
  Download,
  FileText,
  Ruler,
  Palette,
  LayoutTemplate,
  Wrench,
  Image,
  Sparkles,
  ListOrdered,
  Loader2,
} from 'lucide-react';
import type { MeasurementUnit } from '../../lib/measurements';
import type { BuilderState } from '../../pages/Builder';
import { buildTechPackData } from '../../lib/techPackData';
import { downloadTechPackPdf, type TechPackPageOptions } from '../../lib/techPackPdf';

interface DownloadTechPackModalProps {
  onClose: () => void;
  availableColors: Array<{ hex: string; pantone: string }>;
  measurementUnit: MeasurementUnit;
  /** Live builder state — the source of every value on the PDF. */
  builderState: BuilderState;
  /** Project name used on the cover + file name. */
  projectName: string;
}

const RED = '#CC2D24';

// ── tiny primitives ────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: '#252528', margin: '2px 0' }} />;
}

function RowToggle({
  icon: Icon, title, sub, enabled, onToggle,
}: {
  icon: React.ElementType; title: string; sub: string;
  enabled: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left', borderRadius: 8,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#ffffff05'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {/* icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: enabled ? `${RED}18` : '#ffffff08',
        border: `1px solid ${enabled ? `${RED}30` : '#ffffff0a'}`,
        transition: 'all 0.15s',
      }}>
        <Icon style={{ width: 12, height: 12, color: enabled ? RED : '#ffffff40' }} />
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: enabled ? '#F2F0EC' : '#ffffff60', lineHeight: 1.3, transition: 'color 0.15s' }}>{title}</div>
        <div style={{ fontSize: 10, color: '#ffffff30', marginTop: 1, lineHeight: 1.4 }}>{sub}</div>
      </div>

      {/* pill toggle */}
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: enabled ? RED : '#ffffff12',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2,
          left: enabled ? 18 : 2,
          width: 16, height: 16, borderRadius: 8,
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </button>
  );
}

function SegmentedControl({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  useCerigaTranslation();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px' }}>
      <span style={{ fontSize: 11, color: '#ffffff55', fontWeight: 500 }}>{cerigaTranslateLabel(label)}</span>
      <div style={{ display: 'flex', background: '#111113', border: '1px solid #252528', borderRadius: 7, padding: 2, gap: 2 }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 500,
              background: value === opt ? '#1C1C1E' : 'transparent',
              border: value === opt ? '1px solid #3A3A40' : '1px solid transparent',
              color: value === opt ? '#F0EEEE' : '#6B6B72',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── main modal ─────────────────────────────────────────────────────────────────

export function DownloadTechPackModal({
  onClose,
  availableColors,
  measurementUnit,
  builderState,
  projectName,
}: DownloadTechPackModalProps) {
  useCerigaTranslation();

  const [includeDetailsImage,      setIncludeDetailsImage]      = useState(true);
  const [includeMeasurementTable,  setIncludeMeasurementTable]  = useState(true);
  const [includeMaterialCallouts,  setIncludeMaterialCallouts]  = useState(true);
  const [includeFrontBackViews,    setIncludeFrontBackViews]    = useState(true);
  const [includeConstructionNotes, setIncludeConstructionNotes] = useState(true);
  const [includeArtworkPages,      setIncludeArtworkPages]      = useState(true);
  const [includeQuantity,          setIncludeQuantity]          = useState(true);
  const [selectedTechPackColor,    setSelectedTechPackColor]    = useState('#F5F5F5');
  const [paperSize,     setPaperSize]     = useState<'A4' | 'Letter'>('A4');
  const [exportFormat,  setExportFormat]  = useState<'PDF' | 'PDF + ZIP'>('PDF');
  const [generateRealImage,        setGenerateRealImage]        = useState(false);
  const [selectedColorForImage,    setSelectedColorForImage]    = useState(availableColors[0]?.hex || '#000000');
  const [downloadPhase, setDownloadPhase] = useState<'idle' | 'working' | 'error'>('idle');

  const bgOptions = [
    { hex: '#FFFFFF', name: 'White' },
    { hex: '#F5F5F5', name: 'Off-white' },
    { hex: '#D4D4D4', name: 'Grey' },
    { hex: '#111111', name: 'Black' },
  ];

  const enabledCount = [
    includeDetailsImage,
    includeMeasurementTable,
    includeMaterialCallouts,
    includeFrontBackViews,
    includeConstructionNotes,
    includeArtworkPages,
    includeQuantity,
  ].filter(Boolean).length;

  const runDownload = useCallback(async () => {
    setDownloadPhase('working');
    try {
      // Let the button paint its working state before the (synchronous) render.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 40);
      });
      const data = buildTechPackData(builderState, { projectName });
      const options: Partial<TechPackPageOptions> = {
        detailsImage: includeDetailsImage,
        measurementTable: includeMeasurementTable,
        materialCallouts: includeMaterialCallouts,
        frontBackViews: includeFrontBackViews,
        constructionNotes: includeConstructionNotes,
        artworkPages: includeArtworkPages,
        quantities: includeQuantity,
        paperSize,
        background: selectedTechPackColor,
      };
      await downloadTechPackPdf(data, options);
      toast.success(
        cerigaTranslateLabel(includeArtworkPages && builderState.prints.some((p) => p.type === 'image')
          ? cerigaTranslate("interface.text_537050934f1f947f")
          : cerigaTranslate("interface.text_fd9b10ceead5a657")),
      );
      setDownloadPhase('idle');
      onClose();
    } catch (err) {
      console.error('Tech pack export failed', err);
      setDownloadPhase('error');
      toast.error(cerigaTranslate("interface.text_64902208f02e2ae3"));
    }
  }, [
    builderState,
    projectName,
    includeDetailsImage,
    includeMeasurementTable,
    includeMaterialCallouts,
    includeFrontBackViews,
    includeConstructionNotes,
    includeArtworkPages,
    includeQuantity,
    selectedTechPackColor,
    paperSize,
    onClose,
  ]);

  const pages = [
    { icon: FileText,      title: 'Detail annotations',     sub: 'Red callouts on construction pages',  enabled: includeDetailsImage,      toggle: () => setIncludeDetailsImage(!includeDetailsImage) },
    { icon: Ruler,         title: 'Measurement table',      sub: 'Graded size spec from your values',    enabled: includeMeasurementTable,  toggle: () => setIncludeMeasurementTable(!includeMeasurementTable) },
    { icon: Palette,       title: 'Material callouts',      sub: 'Fabric, GSM and colour callouts',      enabled: includeMaterialCallouts,  toggle: () => setIncludeMaterialCallouts(!includeMaterialCallouts) },
    { icon: LayoutTemplate,title: 'Front + back views',     sub: 'Technical drawings of both sides',     enabled: includeFrontBackViews,    toggle: () => setIncludeFrontBackViews(!includeFrontBackViews) },
    { icon: Wrench,        title: 'Construction notes',     sub: 'Your per-step notes on each card',     enabled: includeConstructionNotes, toggle: () => setIncludeConstructionNotes(!includeConstructionNotes) },
    { icon: Image,         title: 'Artwork pages',          sub: 'Prints, labels, and packaging pages',  enabled: includeArtworkPages,      toggle: () => setIncludeArtworkPages(!includeArtworkPages) },
    { icon: ListOrdered,   title: 'Order quantities',     sub: 'Per-size units and total in the pack', enabled: includeQuantity,          toggle: () => setIncludeQuantity(!includeQuantity) },
  ];

  return (
    // backdrop
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#161618', border: '1px solid #252528', borderRadius: 8,
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>

        {/* ── header ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #252528', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, marginBottom: 4 }}>{cerigaTranslate("adminOrders.export")}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#F2F0EC', letterSpacing: '-0.025em', lineHeight: 1.15 }}>{cerigaTranslate("interface.text_e88df9e45925ff28")}</div>
            <div style={{ fontSize: 11, color: '#ffffff35', marginTop: 3 }}>
              {enabledCount}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{pages.length}{" "}{cerigaTranslate("interface.text_178aefcd5017d0fb")}{" "}{paperSize}{" "}{cerigaTranslate("interface.text_9caf83aa70fcdcea")}{includeMeasurementTable ? (
                <>{" "}{cerigaTranslate("interface.text_a0cc2898c30b32e7")}{" "}{measurementUnit === 'in' ? cerigaTranslate("interface.text_56bcdb725a5710d8") : cerigaTranslate("interface.text_b5039c325d7107d6")}</>
              ) : null}
              {includeQuantity ? null : <>{" "}{cerigaTranslate("interface.text_7e79f1f606b6756a")}</>}
            </div>
            <p style={{ fontSize: 10, color: '#ffffff40', marginTop: 8, lineHeight: 1.45, maxWidth: 360 }}>{cerigaTranslate("interface.text_1eac37bd81c069ae")}</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 7, background: '#252528', border: '1px solid #252528', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff50', flexShrink: 0, marginTop: 2 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff12'; (e.currentTarget as HTMLElement).style.color = '#ffffff90'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff08'; (e.currentTarget as HTMLElement).style.color = '#ffffff50'; }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── scrollable body ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* pages section */}
          <div style={{ padding: '12px 14px 4px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ffffff30', marginBottom: 2, padding: '0 2px' }}>{cerigaTranslate("interface.text_7285576bdacf86fe")}</div>
          </div>
          <div style={{ padding: '0 6px' }}>
            {pages.map((p, i) => (
              <div key={p.title}>
                <RowToggle icon={p.icon} title={cerigaTranslateLabel(p.title)} sub={p.sub} enabled={p.enabled} onToggle={p.toggle} />
                {i < pages.length - 1 && <Divider />}
              </div>
            ))}
          </div>

          {/* separator */}
          <div style={{ height: 1, background: '#252528', margin: '8px 0' }} />

          {/* background */}
          <div style={{ padding: '4px 14px 8px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ffffff30', marginBottom: 10, padding: '4px 2px 0' }}>{cerigaTranslate("interface.text_36200244b2337453")}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {bgOptions.map(opt => (
                <button
                  key={opt.hex}
                  onClick={() => setSelectedTechPackColor(opt.hex)}
                  style={{
                    padding: '8px 6px', borderRadius: 9, cursor: 'pointer',
                    border: selectedTechPackColor === opt.hex ? `1.5px solid ${RED}` : '1px solid #252528',
                    background: selectedTechPackColor === opt.hex ? `${RED}0e` : '#0e0e10',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (selectedTechPackColor !== opt.hex) (e.currentTarget as HTMLElement).style.borderColor = '#ffffff18'; }}
                  onMouseLeave={e => { if (selectedTechPackColor !== opt.hex) (e.currentTarget as HTMLElement).style.borderColor = '#ffffff0a'; }}
                >
                  <div style={{ width: '100%', height: 28, borderRadius: 5, backgroundColor: opt.hex, border: '1px solid #00000018', marginBottom: 5 }} />
                  <div style={{ fontSize: 10, fontWeight: 500, color: selectedTechPackColor === opt.hex ? '#F2F0EC' : '#ffffff45', textAlign: 'center' }}>{cerigaTranslateLabel(opt.name)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* separator */}
          <div style={{ height: 1, background: '#252528', margin: '4px 0' }} />

          {/* format controls */}
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ffffff30', padding: '8px 16px 2px' }}>{cerigaTranslate("interface.text_2f343666aaa88c44")}</div>
            <SegmentedControl label={cerigaTranslate("interface.text_d02263b7e18d51e8")}   options={['A4', 'Letter']}              value={paperSize}    onChange={v => setPaperSize(v as 'A4' | 'Letter')} />
            <Divider />
            <SegmentedControl label={cerigaTranslate("interface.text_e3d11242200fe8f2")}  options={['Landscape']}                 value="Landscape"    onChange={() => undefined} />
            <Divider />
            <SegmentedControl label={cerigaTranslate("interface.text_1e74a176a3dd1ddb")}    options={['PDF', 'PDF + ZIP']}          value={exportFormat} onChange={v => setExportFormat(v as 'PDF' | 'PDF + ZIP')} />
          </div>

          {/* separator */}
          <div style={{ height: 1, background: '#252528', margin: '4px 0' }} />

          {/* AI render toggle */}
          <div style={{ padding: '4px 6px 8px' }}>
            <RowToggle
              icon={Sparkles}
              title={cerigaTranslate("interface.text_f414594666c81f87")}
              sub="AI photorealistic image alongside the PDF (coming soon)"
              enabled={generateRealImage}
              onToggle={() => {
                setGenerateRealImage(!generateRealImage);
                if (!generateRealImage) {
                  toast.message(cerigaTranslate("interface.text_53cfc982daeb3ba1"), {
                    description: 'The PDF download works fully today.',
                  });
                }
              }}
            />
            {generateRealImage && availableColors.length > 0 && (
              <div style={{ padding: '4px 14px 8px' }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff30', marginBottom: 8 }}>{cerigaTranslate("interface.text_dccf3b69c5314c3d")}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {availableColors.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColorForImage(c.hex)}
                      title={`${c.hex}${c.pantone ? ` (${c.pantone})` : ''}`}
                      style={{
                        width: 24, height: 24, borderRadius: 6,
                        backgroundColor: c.hex,
                        border: selectedColorForImage === c.hex ? `2px solid ${RED}` : '1px solid #ffffff18',
                        cursor: 'pointer', transition: 'border 0.15s',
                        boxShadow: selectedColorForImage === c.hex ? `0 0 0 2px ${RED}30` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── footer ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #252528', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 9,
              background: 'transparent', border: '1px solid #252528',
              color: '#ffffff60', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ffffff18'; (e.currentTarget as HTMLElement).style.color = '#ffffff90'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ffffff0e'; (e.currentTarget as HTMLElement).style.color = '#ffffff60'; }}
          >{cerigaTranslate("common.cancel")}</button>
          <button
            onClick={() => void runDownload()}
            disabled={downloadPhase === 'working'}
            style={{
              flex: 2, padding: '9px 0', borderRadius: 9,
              background: RED, border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: downloadPhase === 'working' ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'opacity 0.15s',
              opacity: downloadPhase === 'working' ? 0.75 : 1,
            }}
            onMouseEnter={e => { if (downloadPhase !== 'working') (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { if (downloadPhase !== 'working') (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            {downloadPhase === 'working' ? (
              <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download style={{ width: 13, height: 13 }} />
            )}
            {downloadPhase === 'working' ? cerigaTranslate("interface.text_d20a4476a0a85978") : downloadPhase === 'error' ? cerigaTranslate("interface.text_9e58d77649ac6f52",{value0:(exportFormat)}) : cerigaTranslate("interface.text_a4924ba426cf55bd",{value0:(exportFormat)})}
          </button>
        </div>

      </div>
    </div>
  );
}
