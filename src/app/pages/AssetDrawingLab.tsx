import { garmentAssetLabel } from '../components/builder/TshirtAssetChoiceGrid';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Anchor,
  Download,
  FolderOpen,
  Grid3x3,
  MousePointer2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Waypoints,
  Wand2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { AssetEditorCanvas } from '../components/asset-editor/AssetEditorCanvas';
import {
  getGarmentAsset,
  getGarmentAssets,
  getGarmentSvgConfig,
  type GarmentSvgGarmentType,
} from '../data/garmentSvgCatalog';
import {
  addAnchor,
  addConnection,
  addStroke,
  ANCHOR_ROLE_OPTIONS,
  ASSET_EDITOR_CANVAS,
  buildAssetFromCatalog,
  buildExportBundle,
  countStrokePoints,
  createEmptyDocument,
  defaultCategoryReferenceId,
  exportDrawableAsset,
  exportDrawableAssetWithJsonBackup,
  importDrawableAssetFromJson,
  importDrawableAssetFromSvg,
  removeAnchor,
  removeConnection,
  removeStroke,
  resolveEditorReferenceLayers,
  smoothAllStrokes,
  suggestAnchorsForCategory,
  TRACE_FIDELITY_LABELS,
  type TraceFidelityPreset,
  updateAnchor,
  updateStrokePoint,
  type AssetEditorSelection,
  type AssetEditorTool,
  type DrawableAssetDocument,
  type DrawnPoint,
} from '../lib/assetEditor';
import { Switch } from '../components/ui/switch';

const STORAGE_KEY = 'ceriga-asset-drawing-lab';

const LAB_FIELD =
  'border-white/15 bg-white/10 text-white placeholder:text-slate-500 [&_[data-slot=select-value]]:text-white';

const TOOL_OPTIONS: Array<{ id: AssetEditorTool; label: string; icon: typeof MousePointer2 }> = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'polyline', label: 'Polyline', icon: Pencil },
  { id: 'line', label: 'Line', icon: Plus },
  { id: 'anchor', label: 'Anchor', icon: Anchor },
  { id: 'connection', label: 'Connect', icon: Waypoints },
];

function loadStoredDocument(): DrawableAssetDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return importDrawableAssetFromJson(raw);
  } catch {
    return null;
  }
}

export function AssetDrawingLab() {
  useCerigaTranslation();

  const [doc, setDoc] = useState<DrawableAssetDocument>(() => loadStoredDocument() ?? createEmptyDocument());
  const [tool, setTool] = useState<AssetEditorTool>('select');
  const [selection, setSelection] = useState<AssetEditorSelection | null>(null);
  const [draftPoints, setDraftPoints] = useState<DrawnPoint[]>([]);
  const [snapGrid, setSnapGrid] = useState(16);
  const [connectionDraftAnchorId, setConnectionDraftAnchorId] = useState<string | null>(null);
  const [importAssetId, setImportAssetId] = useState('');
  const [categoryReferenceId, setCategoryReferenceId] = useState<string | undefined>();
  const [showBaseReference, setShowBaseReference] = useState(true);
  const [showCategoryReference, setShowCategoryReference] = useState(true);
  const [showContextReference, setShowContextReference] = useState(true);
  const [showPointHandles, setShowPointHandles] = useState(false);
  const [traceFidelity, setTraceFidelity] = useState<TraceFidelityPreset>('full');
  const [status, setStatus] = useState('Quick Add: pick a catalog part → Create asset → Export SVG into src/assets.');
  const [quickAddAssetId, setQuickAddAssetId] = useState('');
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);

  const garmentConfig = useMemo(() => getGarmentSvgConfig(doc.meta.garmentType), [doc.meta.garmentType]);
  const categoryAssets = useMemo(
    () => getGarmentAssets(doc.meta.garmentType, doc.meta.category),
    [doc.meta.garmentType, doc.meta.category],
  );

  const catalogAssets = useMemo(
    () =>
      garmentConfig.categoryOrder.flatMap((category) =>
        getGarmentAssets(doc.meta.garmentType, category).map((asset) => ({
          id: asset.id,
          label: `${cerigaTranslateLabel(category)} / ${garmentAssetLabel(asset.displayName)}`,
        })),
      ),
    [doc.meta.garmentType, garmentConfig.categoryOrder],
  );

  const exportBundle = useMemo(() => buildExportBundle(doc), [doc]);

  const referenceLayers = useMemo(
    () =>
      resolveEditorReferenceLayers({
        garmentType: doc.meta.garmentType,
        category: doc.meta.category,
        categoryReferenceAssetId: categoryReferenceId,
        showBase: showBaseReference,
        showCategoryReference,
        showContext: showContextReference,
      }),
    [
      doc.meta.garmentType,
      doc.meta.category,
      categoryReferenceId,
      showBaseReference,
      showCategoryReference,
      showContextReference,
    ],
  );

  useEffect(() => {
    const config = getGarmentSvgConfig(doc.meta.garmentType);
    const categoryValid = config.categoryOrder.includes(doc.meta.category);

    if (!categoryValid) {
      setDoc((current) => ({
        ...current,
        meta: { ...current.meta, category: config.categoryOrder[0] ?? current.meta.category },
      }));
      return;
    }

    setCategoryReferenceId((current) => {
      if (current && categoryAssets.some((asset) => asset.id === current)) return current;
      return defaultCategoryReferenceId(doc.meta.garmentType, doc.meta.category);
    });
    setQuickAddAssetId((current) => {
      if (current && categoryAssets.some((asset) => asset.id === current)) return current;
      return categoryAssets[0]?.id ?? '';
    });
  }, [doc.meta.garmentType, doc.meta.category, categoryAssets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  }, [doc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (!selection) return;
      if (selection.kind === 'stroke' && selection.strokeId) {
        setDoc((current) => removeStroke(current, selection.strokeId!));
        setSelection(null);
      }
      if (selection.kind === 'anchor' && selection.anchorId) {
        setDoc((current) => removeAnchor(current, selection.anchorId!));
        setSelection(null);
      }
      if (selection.kind === 'connection' && selection.connectionId) {
        setDoc((current) => removeConnection(current, selection.connectionId!));
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection]);

  const handleFinishStroke = (points: DrawnPoint[]) => {
    if (points.length < 2) return;
    setDoc((current) =>
      addStroke(current, points, {
        closed: tool === 'polyline' && points.length > 2 && distance(points[0], points[points.length - 1]) < 24,
      }),
    );
    setStatus(`Added stroke with ${points.length} points.`);
  };

  const handlePlaceAnchor = (point: DrawnPoint) => {
    setDoc((current) => addAnchor(current, point.x, point.y));
    setStatus(`Placed anchor at (${Math.round(point.x)}, ${Math.round(point.y)}).`);
  };

  const handleConnectionPick = (anchorId: string) => {
    if (!connectionDraftAnchorId) {
      setConnectionDraftAnchorId(anchorId);
      setStatus('Pick the second anchor to connect.');
      return;
    }
    if (connectionDraftAnchorId === anchorId) {
      setConnectionDraftAnchorId(null);
      return;
    }
    setDoc((current) => addConnection(current, connectionDraftAnchorId, anchorId));
    setConnectionDraftAnchorId(null);
    setStatus('Connection created.');
  };

  const handleImportJson = async (file: File) => {
    const text = await file.text();
    setDoc(importDrawableAssetFromJson(text));
    setSelection(null);
    setStatus(`Imported ${file.name}.`);
  };

  const handleImportSvg = async (file: File) => {
    const text = await file.text();
    setDoc(importDrawableAssetFromSvg(text));
    setSelection(null);
    setStatus(`Imported SVG ${file.name}.`);
  };

  const handleImportCatalogAsset = () => {
    const asset = getGarmentAsset(importAssetId);
    if (!asset) {
      setStatus('Pick a catalog asset to import.');
      return;
    }
    setDoc(buildAssetFromCatalog(asset, traceFidelity));
    setCategoryReferenceId(asset.id);
    setImportAssetId(asset.id);
    setTool('select');
    setSelection(null);
    setStatus(`Loaded ${garmentAssetLabel(asset.displayName)} with auto-anchors.`);
  };

  const handleQuickAdd = () => {
    const asset =
      getGarmentAsset(quickAddAssetId) ??
      getGarmentAsset(categoryReferenceId ?? '') ??
      categoryAssets[0];
    if (!asset) {
      setStatus('No catalog asset in this category yet.');
      return;
    }
    const next = buildAssetFromCatalog(asset, traceFidelity);
    setDoc(next);
    setCategoryReferenceId(asset.id);
    setImportAssetId(asset.id);
    setTool('select');
    setShowPointHandles(false);
    setSelection(null);
    const pointCount = countStrokePoints(next.strokes);
    setStatus(
      `Created "${garmentAssetLabel(asset.displayName)}" (${TRACE_FIDELITY_LABELS[traceFidelity]}, ${pointCount} points, ${next.anchors.length} anchors). Drag green anchors or enable edit points.`,
    );
  };

  const handleResuggestAnchors = () => {
    setDoc((current) => ({
      ...current,
      anchors: suggestAnchorsForCategory(current.meta.category, current.strokes),
    }));
    setStatus('Replaced anchors from geometry. Drag green points to fine-tune.');
  };

  const handleTraceCategoryReference = () => {
    const asset = categoryReferenceId ? getGarmentAsset(categoryReferenceId) : undefined;
    if (!asset) {
      setStatus('Pick a category reference variant first.');
      return;
    }
    setDoc(buildAssetFromCatalog(asset, traceFidelity));
    setTool('select');
    setSelection(null);
    setStatus(`Traced ${garmentAssetLabel(asset.displayName)}. Drag anchors if needed, then Export SVG.`);
  };

  const handleSmoothAll = () => {
    setDoc((current) => smoothAllStrokes(current));
    setStatus('Smoothed all strokes with curves. Drag points to fine-tune.');
  };

  const selectedAnchor = selection?.kind === 'anchor'
    ? doc.anchors.find((anchor) => anchor.id === selection.anchorId)
    : null;

  const selectedPoint =
    selection?.kind === 'point' && selection.strokeId != null && selection.pointIndex != null
      ? {
          strokeId: selection.strokeId,
          pointIndex: selection.pointIndex,
          point: doc.strokes.find((stroke) => stroke.id === selection.strokeId)?.points[selection.pointIndex!],
        }
      : null;

  return (
    <div className="min-h-screen bg-[#090b10] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{cerigaTranslate("interface.text_8c35fe030f4f3c37")}</p>
          <h1 className="text-2xl font-semibold">{cerigaTranslate("interface.text_5f8f2d5a1f43b7a4")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{cerigaTranslate("interface.text_180ace6bc27dc675")}{' '}
            <code className="text-slate-300">src/assets/</code>{cerigaTranslate("interface.text_51c6e3332554f726")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard">{cerigaTranslate("interface.text_ab1e7085da6e0764")}</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const bundle = exportDrawableAssetWithJsonBackup(doc);
              setStatus(`Exported SVG + editor backup JSON → ${bundle.importPath}`);
            }}
          >{cerigaTranslate("interface.text_44860e21bdad68db")}</Button>
          <Button
            onClick={() => {
              const bundle = exportDrawableAsset(doc);
              setStatus(`Exported SVG → ${bundle.importPath}`);
            }}
          >
            <Download className="size-4" />{cerigaTranslate("interface.text_3b20ad4d555d9d95")}</Button>
        </div>
      </header>

      <div className="grid h-[calc(100vh-112px)] grid-cols-[280px_1fr_320px] gap-4 p-4">
        <aside className="flex flex-col gap-4 overflow-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <section className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-400" />
              <h2 className="text-sm font-medium text-emerald-200">{cerigaTranslate("interface.text_72d4a9080c596010")}</h2>
            </div>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-400">
              <li>{cerigaTranslate("interface.text_0b07b1263b0679c8")}</li>
              <li>{cerigaTranslate("interface.text_327b03c7132eeef6")}</li>
              <li>{cerigaTranslate("interface.text_ef691e708e9ee144")}</li>
            </ol>
            <Select
              value={quickAddAssetId || undefined}
              onValueChange={setQuickAddAssetId}
              disabled={categoryAssets.length === 0}
            >
              <SelectTrigger className={LAB_FIELD}>
                <SelectValue placeholder={categoryAssets.length === 0 ? cerigaTranslate("interface.text_dade82eaaf2ffc53") : cerigaTranslate("interface.text_63f68845a99db2b2")} />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                {categoryAssets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id} className="text-white focus:bg-white/10 focus:text-white">
                    {garmentAssetLabel(asset.displayName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Label>{cerigaTranslate("interface.text_dbda832ef97b9c35")}</Label>
              <Select
                value={traceFidelity}
                onValueChange={(value) => setTraceFidelity(value as TraceFidelityPreset)}
              >
                <SelectTrigger className={LAB_FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                  {(Object.keys(TRACE_FIDELITY_LABELS) as TraceFidelityPreset[]).map((preset) => (
                    <SelectItem
                      key={preset}
                      value={preset}
                      className="text-white focus:bg-white/10 focus:text-white"
                    >
                      {cerigaTranslateLabel(TRACE_FIDELITY_LABELS[preset])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{cerigaTranslate("interface.text_cba99819e4f9fcf1")}</p>
            </div>
            <Button className="w-full" onClick={handleQuickAdd} disabled={categoryAssets.length === 0}>
              <Wand2 className="size-4" />{cerigaTranslate("interface.text_218f3e1a645ece51")}</Button>
            <Button variant="outline" className="w-full" onClick={handleResuggestAnchors} disabled={doc.strokes.length === 0}>{cerigaTranslate("interface.text_a1cfcaef3acd33e6")}</Button>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">{cerigaTranslate("interface.text_591e1e3ef995cc8f")}</span>
              <Switch checked={showPointHandles} onCheckedChange={setShowPointHandles} />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_0eb6289479c4d371")}</h2>
            <div className="space-y-2">
              <Label htmlFor="asset-name">{cerigaTranslate("interface.text_dcd1d5223f73b3a9")}</Label>
              <Input
                id="asset-name"
                className={LAB_FIELD}
                value={doc.meta.name}
                onChange={(event) =>
                  setDoc((current) => ({
                    ...current,
                    meta: { ...current.meta, name: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{cerigaTranslate("adminOrders.garment")}</Label>
              <Select
                value={doc.meta.garmentType}
                onValueChange={(value) => {
                  const garmentType = value as GarmentSvgGarmentType;
                  const config = getGarmentSvgConfig(garmentType);
                  const category = config.categoryOrder[0] ?? doc.meta.category;
                  setDoc(createEmptyDocument(garmentType, category));
                  setSelection(null);
                  setStatus(`Switched to ${value}. Pick a category variant and Create asset.`);
                }}
              >
                <SelectTrigger className={LAB_FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                  <SelectItem value="tshirt" className="text-white focus:bg-white/10 focus:text-white">{cerigaTranslate("interface.text_d977e091ea89c4c4")}</SelectItem>
                  <SelectItem value="hoodie" className="text-white focus:bg-white/10 focus:text-white">{cerigaTranslate("interface.text_84e05c9a21b56e23")}</SelectItem>
                  <SelectItem value="trousers" className="text-white focus:bg-white/10 focus:text-white">{cerigaTranslate("interface.text_a1dd93fd5b3726c7")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{cerigaTranslate("interface.text_292c06f0045a45d0")}</Label>
              <Select
                value={doc.meta.category}
                onValueChange={(value) => {
                  setDoc((current) => ({
                    ...createEmptyDocument(current.meta.garmentType, value),
                    meta: { ...current.meta, category: value },
                  }));
                  setSelection(null);
                }}
              >
                <SelectTrigger className={LAB_FIELD}>
                  <SelectValue placeholder={cerigaTranslate("interface.text_37b72fffe1a9717a")} />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                  {garmentConfig.categoryOrder.map((category) => (
                    <SelectItem key={category} value={category} className="text-white focus:bg-white/10 focus:text-white">
                      {cerigaTranslateLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-name">{cerigaTranslate("interface.text_3efed3de9d4b5170")}</Label>
              <Input
                id="file-name"
                className={LAB_FIELD}
                value={doc.meta.fileName}
                onChange={(event) =>
                  setDoc((current) => ({
                    ...current,
                    meta: { ...current.meta, fileName: event.target.value },
                  }))
                }
              />
            </div>
          </section>

          <details className="rounded-lg border border-white/10 bg-black/20 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_f74530c8ac6d81ad")}</summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {TOOL_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    variant={tool === id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setTool(id);
                      setDraftPoints([]);
                      setConnectionDraftAnchorId(null);
                    }}
                  >
                    <Icon className="size-4" />
                    {cerigaTranslateLabel(label)}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant={snapGrid > 0 ? 'default' : 'outline'}
                onClick={() => setSnapGrid((value) => (value > 0 ? 0 : 16))}
              >
                <Grid3x3 className="size-4" />{cerigaTranslate("interface.text_98df9a59f0641d0c")}{" "}{snapGrid > 0 ? cerigaTranslate("interface.text_bfd8d62ce34b09e8",{value0:(snapGrid)}) : cerigaTranslate("interface.text_b4dc66dde806261b")}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleTraceCategoryReference}>{cerigaTranslate("interface.text_6a9188beb345a66e")}</Button>
              <Button variant="outline" className="w-full" onClick={handleSmoothAll} disabled={doc.strokes.length === 0}>{cerigaTranslate("interface.text_ac69effccb9ba752")}</Button>
            </div>
          </details>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_addf76487e5d1cd3")}</h2>
            <p className="text-xs text-slate-400">{cerigaTranslate("interface.text_b2cfe5389847b9ef")}</p>
            <div className="space-y-2">
              <Label>{cerigaTranslate("interface.text_53dff2a2ef5c5091")}</Label>
              <Select
                value={categoryReferenceId || undefined}
                onValueChange={setCategoryReferenceId}
                disabled={categoryAssets.length === 0}
              >
                <SelectTrigger className={LAB_FIELD}>
                  <SelectValue placeholder={cerigaTranslate("interface.text_a52e76445ae2dc02")} />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                  {categoryAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id} className="text-white focus:bg-white/10 focus:text-white">
                      {garmentAssetLabel(asset.displayName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">{cerigaTranslate("interface.text_c57beda523196acc")}</span>
              <Switch checked={showBaseReference} onCheckedChange={setShowBaseReference} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">{cerigaTranslate("interface.text_7a7c661cdb61eb71")}</span>
              <Switch checked={showCategoryReference} onCheckedChange={setShowCategoryReference} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">{cerigaTranslate("interface.text_e22aabab2e02ec37")}</span>
              <Switch checked={showContextReference} onCheckedChange={setShowContextReference} />
            </label>
            <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
              {referenceLayers.length === 0 ? (
                <p className="text-xs text-slate-500">{cerigaTranslate("interface.text_5af1d76331e44b24")}</p>
              ) : (
                referenceLayers.map((layer) => (
                  <p key={layer.id} className="text-xs text-slate-400">
                    <span
                      className={
                        layer.kind === 'base'
                          ? 'text-slate-500'
                          : layer.kind === 'context'
                            ? 'text-slate-400'
                            : 'text-sky-400'
                      }
                    >
                      {layer.kind}
                    </span>
                    {' · '}
                    {cerigaTranslateLabel(layer.label)}
                  </p>
                ))
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_2cff9baabf56ca00")}</h2>
            <input
              ref={jsonInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportJson(file);
                event.currentTarget.value = '';
              }}
            />
            <input
              ref={svgInputRef}
              type="file"
              accept="image/svg+xml,.svg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportSvg(file);
                event.currentTarget.value = '';
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => jsonInputRef.current?.click()}>
              <Upload className="size-4" />{cerigaTranslate("interface.text_e4fe1d3a957c2305")}</Button>
            <Button variant="outline" className="w-full" onClick={() => svgInputRef.current?.click()}>
              <Upload className="size-4" />{cerigaTranslate("interface.text_1b60188056d9c724")}</Button>
            <Select value={importAssetId || undefined} onValueChange={setImportAssetId}>
              <SelectTrigger className={LAB_FIELD}>
                <SelectValue placeholder={cerigaTranslate("interface.text_e281bbbceb17e798")} />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                {catalogAssets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id} className="text-white focus:bg-white/10 focus:text-white">
                    {cerigaTranslateLabel(asset.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full" onClick={handleImportCatalogAsset}>
              <FolderOpen className="size-4" />{cerigaTranslate("interface.text_047e60a286385ea0")}</Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setDoc(createEmptyDocument(doc.meta.garmentType, doc.meta.category));
                setSelection(null);
                setStatus('Started a new blank asset.');
              }}
            >
              <Trash2 className="size-4" />{cerigaTranslate("interface.text_8d9ddef855604922")}</Button>
          </section>
        </aside>

        <main className="min-h-0">
          <AssetEditorCanvas
            document={doc}
            referenceLayers={referenceLayers}
            showPointHandles={showPointHandles}
            tool={tool}
            selection={selection}
            snapGrid={snapGrid}
            draftPoints={draftPoints}
            connectionDraftAnchorId={connectionDraftAnchorId}
            onSelect={setSelection}
            onDraftPointsChange={setDraftPoints}
            onFinishStroke={handleFinishStroke}
            onPlaceAnchor={handlePlaceAnchor}
            onConnectionAnchorPick={handleConnectionPick}
            onMovePoint={(strokeId, pointIndex, point) =>
              setDoc((current) => updateStrokePoint(current, strokeId, pointIndex, point))
            }
            onMoveAnchor={(anchorId, point) =>
              setDoc((current) => updateAnchor(current, anchorId, point))
            }
          />
          <p className="mt-3 text-sm text-slate-400">{status}</p>
        </main>

        <aside className="flex flex-col gap-4 overflow-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_117c132e939b9f65")}</h2>
            {selectedPoint?.point ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>X</Label>
                  <Input
                    type="number"
                    className={LAB_FIELD}
                    value={Math.round(selectedPoint.point.x)}
                    onChange={(event) => {
                      const x = Number(event.target.value);
                      if (!Number.isFinite(x) || selectedPoint.strokeId == null) return;
                      setDoc((current) =>
                        updateStrokePoint(current, selectedPoint.strokeId, selectedPoint.pointIndex, {
                          x,
                          y: selectedPoint.point!.y,
                        }),
                      );
                    }}
                  />
                </div>
                <div>
                  <Label>Y</Label>
                  <Input
                    type="number"
                    className={LAB_FIELD}
                    value={Math.round(selectedPoint.point.y)}
                    onChange={(event) => {
                      const y = Number(event.target.value);
                      if (!Number.isFinite(y) || selectedPoint.strokeId == null) return;
                      setDoc((current) =>
                        updateStrokePoint(current, selectedPoint.strokeId, selectedPoint.pointIndex, {
                          x: selectedPoint.point!.x,
                          y,
                        }),
                      );
                    }}
                  />
                </div>
              </div>
            ) : selectedAnchor ? (
              <div className="space-y-2">
                <div>
                  <Label>{cerigaTranslate("interface.text_dcd1d5223f73b3a9")}</Label>
                  <Input
                    className={LAB_FIELD}
                    value={selectedAnchor.name}
                    onChange={(event) =>
                      setDoc((current) =>
                        updateAnchor(current, selectedAnchor.id, { name: event.target.value }),
                      )
                    }
                  />
                </div>
                <div>
                  <Label>{cerigaTranslate("interface.text_14736a2eb9f4159f")}</Label>
                  <Select
                    value={selectedAnchor.role}
                    onValueChange={(value) =>
                      setDoc((current) =>
                        updateAnchor(current, selectedAnchor.id, {
                          role: value as typeof selectedAnchor.role,
                        }),
                      )
                    }
                  >
                    <SelectTrigger className={LAB_FIELD}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/15 bg-[#1a2030] text-white">
                      {ANCHOR_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role} className="text-white focus:bg-white/10 focus:text-white">
                          {cerigaTranslateLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>X</Label>
                    <Input
                      type="number"
                      className={LAB_FIELD}
                      value={Math.round(selectedAnchor.x)}
                      onChange={(event) => {
                        const x = Number(event.target.value);
                        if (!Number.isFinite(x)) return;
                        setDoc((current) => updateAnchor(current, selectedAnchor.id, { x }));
                      }}
                    />
                  </div>
                  <div>
                    <Label>Y</Label>
                    <Input
                      type="number"
                      className={LAB_FIELD}
                      value={Math.round(selectedAnchor.y)}
                      onChange={(event) => {
                        const y = Number(event.target.value);
                        if (!Number.isFinite(y)) return;
                        setDoc((current) => updateAnchor(current, selectedAnchor.id, { y }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{cerigaTranslate("interface.text_8594fae1d1599664")}{ASSET_EDITOR_CANVAS}×
                {ASSET_EDITOR_CANVAS}{" "}{cerigaTranslate("interface.text_6a147639785b3cd3")}</p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_3f2d4725f3e652d7")}{doc.strokes.length})</h2>
            <div className="space-y-2">
              {doc.strokes.map((stroke) => (
                <button
                  key={stroke.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => setSelection({ kind: 'stroke', strokeId: stroke.id })}
                >
                  <span>{cerigaTranslateLabel(stroke.label)}</span>
                  <span className="text-slate-400">{stroke.points.length}{" "}{cerigaTranslate("interface.text_8c32e612bdc22150")}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_5988d51e00762787")}{doc.anchors.length})</h2>
            <div className="space-y-2">
              {doc.anchors.map((anchor) => (
                <button
                  key={anchor.id}
                  type="button"
                  className="flex w-full flex-col rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => setSelection({ kind: 'anchor', anchorId: anchor.id })}
                >
                  <span>{anchor.name}</span>
                  <span className="text-slate-400">
                    {anchor.role} · ({Math.round(anchor.x)}, {Math.round(anchor.y)})
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-slate-300">{cerigaTranslate("interface.text_d61edd5a5dac08d9")}</h2>
            <p className="mb-2 text-xs text-slate-400">{cerigaTranslate("interface.text_1db1d5f517d15745")}{" "}<strong className="text-slate-300">{cerigaTranslate("interface.text_51b0eb3866be4cd7")}</strong>{" "}{cerigaTranslate("interface.text_5bc8ec2adffdc7bb")}</p>
            <code className="block rounded-lg bg-black/30 p-3 text-xs text-emerald-300">
              {exportBundle.importPath}
            </code>
            <Textarea
              className="mt-3 min-h-40 font-mono text-xs"
              readOnly
              value={exportBundle.svgRaw.slice(0, 1200) + (exportBundle.svgRaw.length > 1200 ? '\n…' : '')}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

function distance(a: DrawnPoint, b: DrawnPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
