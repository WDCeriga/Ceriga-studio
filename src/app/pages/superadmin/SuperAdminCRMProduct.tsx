import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import './superadmin-crm.css';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ExternalLink, ImageIcon, Layers, Pencil, Shirt, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { BuilderComponentEditor } from './crm/CrmComponentEditor';
import {
  GARMENT_BASES,
  baseComponentsForBase,
  defaultConfigForBase,
  garmentBaseById,
  getBaseConstraints,
  getCatalogStore,
  getProductConfig,
  normalizeProductConfig,
  setCatalogStore,
  slugFromName,
  upsertProductConfig,
  type CatalogProductConfig,
  type GarmentBaseId,
} from '../../data/crmCatalogMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';

const BASE_ICONS = {
  tshirt: Shirt,
  hoodie: Layers,
  trousers: Layers,
} as const;

type DraftProduct = CatalogProductConfig;

function emptyDraft(baseId: GarmentBaseId = 'tshirt'): DraftProduct {
  return {
    id: '',
    name: '',
    description: '',
    categories: ['All'],
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=600&fit=crop',
    moq: 50,
    startingPrice: 0,
    leadTime: '4-6 weeks',
    origin: 'Made in Portugal',
    published: false,
    ...defaultConfigForBase(baseId),
  };
}

export function SuperAdminCRMProduct() {
  useCerigaTranslation();

  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const isNew = productId === 'new';

  const existing = !isNew && productId ? getProductConfig(productId) : undefined;

  const [product, setProduct] = useState<DraftProduct>(() => {
    if (isNew) return emptyDraft('tshirt');
    if (existing) return { ...existing };
    return emptyDraft('tshirt');
  });
  const [confirmKind, setConfirmKind] = useState<'publish' | 'unpublish' | 'save' | 'reset' | null>(
    null,
  );

  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const saveLock=useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const base = garmentBaseById(product.baseId);
  const baseComponents = useMemo(
    () => baseComponentsForBase(product.baseId),
    [product.baseId],
  );
  const baseConstraints = useMemo(
    () => getBaseConstraints(product.baseId),
    [product.baseId],
  );

  if (!isNew && productId && !existing) {
    return (
      <div className="space-y-4">
        <Button
          asChild
          variant="ghost"
          className="h-8 px-0 text-white/50 hover:bg-transparent hover:text-white"
        >
          <Link to="/superadmin/crm">
            <ArrowLeft className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_5945b61656beeccd")}</Link>
        </Button>
        <div className="rounded-2xl border border-[#252528] bg-[#111113] px-6 py-16 text-center">
          <p className="text-sm text-white/50">{cerigaTranslate("interface.text_8c773153201009f9")}</p>
          <Button asChild className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/superadmin/crm">{cerigaTranslate("interface.text_71cb2910fd3c5367")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const update = (patch: Partial<DraftProduct>) => {
    setProduct((p) => ({ ...p, ...patch }));
  };

  const selectBase = (baseId: GarmentBaseId) => {
    if (!isNew) return;
    setProduct((p) => ({
      ...p,
      ...defaultConfigForBase(baseId),
    }));
  };

  const enableAllFromBase = () => {
    setConfirmKind('reset');
  };

  const requestSave = () => {
    if (!product.name.trim()) {
      toast.error(cerigaTranslate("interface.text_793405c6d81a168a"));
      return;
    }
    if (isNew && !product.image.trim()) {
      toast.error(cerigaTranslate("interface.text_f6433a7988c4969f"));
      return;
    }
    void save();
  };

  const save = async () => {
    if(saveLock.current)return;saveLock.current=true;setSaving(true);setSaveError('');
    try {
    if (!product.name.trim()) {
      toast.error(cerigaTranslate("interface.text_793405c6d81a168a"));
      return;
    }
    if (isNew && !product.image.trim()) {
      toast.error(cerigaTranslate("interface.text_f6433a7988c4969f"));
      return;
    }
    const id = isNew ? product.id.trim() || slugFromName(product.name) : product.id;
    if (isNew && getCatalogStore().some((p) => p.id === id)) {
      toast.error(cerigaTranslate("interface.text_42039f304b9c69a1"));
      return;
    }

    const saved = normalizeProductConfig({ ...product, id });
    await upsertProductConfig(saved);
    setCatalogStore(getCatalogStore());
    toast.success(cerigaTranslateLabel(isNew ? cerigaTranslate("interface.text_4bc4d3b0dc4e72b5",{value0:(saved.name)}) : cerigaTranslate("interface.text_ce0983f3577f5ce9",{value0:(saved.name)})));
    if (isNew) {
      navigate(`/superadmin/crm/products/${id}`, { replace: true });
    }
    }catch(cause){const message=cause instanceof Error?cause.message:"Could not save product";setSaveError(message);toast.error(cerigaTranslateLabel(message));}finally{saveLock.current=false;setSaving(false);}
  };

  const runConfirmed = () => {
    if (confirmKind === 'publish') {
      update({ published: true });
      toast.message(cerigaTranslate("interface.text_fcf77c4f27dece9a"));
    } else if (confirmKind === 'unpublish') {
      update({ published: false });
      toast.message(cerigaTranslate("interface.text_4fb8791ec99a2356"));
    } else if (confirmKind === 'reset') {
      update(defaultConfigForBase(product.baseId));
      toast.message(cerigaTranslate("interface.text_80e645164eee6c31",{value0:(base.name)}));
    } else if (confirmKind === 'save') {
      save();
    }
    setConfirmKind(null);
  };

  const onImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(cerigaTranslate("interface.text_4db5dc1357f23e45"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(cerigaTranslate("interface.text_b0baf89bd713a20e"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update({ image: reader.result });
        toast.success(cerigaTranslate("interface.text_a46ec348ab97bf3e"));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="admin-crm-editor space-y-6" aria-busy={saving}><fieldset className="crm-editor-fields" disabled={saving} aria-label={cerigaTranslate("interface.text_3c778933f02b2b9d")}><p className="crm-editor-hint">{cerigaTranslate("interface.text_37a48b96e8240865")}</p>{saveError&&<p role="alert" className="crm-save-error">{cerigaTranslateLabel(saveError)}</p>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            asChild
            variant="ghost"
            className="mb-3 h-8 px-0 text-white/50 hover:bg-transparent hover:text-white"
          >
            <Link to="/superadmin/crm">
              <ArrowLeft className="mr-2 h-4 w-4" />{cerigaTranslate("marketing.catalog")}</Link>
          </Button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            {isNew ? cerigaTranslate("interface.text_44e14c8d21700524") : cerigaTranslate("interface.text_42b34c0a0cb046cc")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {isNew ? cerigaTranslate("interface.text_671adc32a7a1824b") : product.name}
          </h1>
          {!isNew ? (
            <p className="mt-0.5 font-mono text-xs text-white/30">{product.id}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew ? (
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white hover:bg-white/10"
              asChild
            >
              <Link to={`/builder/${product.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_d7694d682fb3c091")}</Link>
            </Button>
          ) : null}
          <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={requestSave}>
            {saving?cerigaTranslate("common.saving"):isNew?cerigaTranslate("interface.text_0add49b7da1efe52"):cerigaTranslate("common.saveChanges")}
          </Button>
        </div>
      </div>

      {isNew ? (
        <div>
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_b3b4763170b4a657")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {GARMENT_BASES.map((b) => {
              const Icon = BASE_ICONS[b.id];
              const active = product.baseId === b.id;
              return (
                <div
                  key={b.id}
                  className={cn(
                    'rounded-2xl border p-4 transition',
                    active
                      ? 'border-[#CC2D24]/50 bg-[#CC2D24]/10'
                      : 'border-[#252528] bg-[#111113] hover:border-white/15',
                  )}
                  style={{
                    background: active
                      ? `linear-gradient(145deg, ${b.accent}18 0%, #111113 60%)`
                      : `linear-gradient(145deg, ${b.accent}0a 0%, #111113 60%)`,
                  }}
                >
                  <button type="button" onClick={() => selectBase(b.id)} className="w-full text-left">
                    <div
                      className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#252528] bg-black/30"
                      style={{ color: b.accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-white">{b.name}</p>
                    <p className="mt-2 text-[10px] text-white/30">
                      {b.allComponentIds.length}{" "}{cerigaTranslate("interface.text_7b12be43febc6e18")}</p>
                  </button>
                  <Link
                    to={`/superadmin/crm/bases/${b.id}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-white/40 hover:text-[#CC2D24]"
                  >
                    <Pencil className="h-3 w-3" />{cerigaTranslate("interface.text_88e139316c84ab43")}</Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[#252528] bg-[#111113] px-3 py-1.5"
            style={{ borderColor: `${base.accent}44` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{cerigaTranslate("interface.text_7b47361aad19bb48")}</span>
            <span className="text-xs font-medium text-white">{base.name}</span>
          </div>
          <Link
            to={`/superadmin/crm/bases/${product.baseId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#252528] bg-[#111113] px-3 py-1.5 text-[10px] font-medium text-white/45 hover:border-white/20 hover:text-white/75"
          >
            <Pencil className="h-3 w-3" />{cerigaTranslate("interface.text_7d185a883d61a6a2")}</Link>
        </div>
      )}

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_fd294f8ad38350bf")}</h2>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-[#252528] bg-black/40 sm:w-44">
            {product.image ? (
              <img src={product.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-white/30">
                <ImageIcon className="h-8 w-8" />
                <span className="text-[11px]">{cerigaTranslate("interface.text_c8e2f560665cc4cc")}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Label className="text-white/60">{cerigaTranslate("interface.text_713c599863af082e")}</Label>
            <Input
              value={product.image}
              onChange={(e) => update({ image: e.target.value })}
              placeholder="https://…"
              className="border-white/15 bg-white/5 text-white"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onImageFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/15 text-white hover:bg-white/10"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_ffe4df6c7ca600c4")}</Button>
              {product.image ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/15 text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => update({ image: '' })}
                >{cerigaTranslate("interface.text_c3812fc4acb861d5")}</Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-white/60">{cerigaTranslate("interface.text_2b7f6a84de917e38")}</Label>
            <Input
              required aria-label={cerigaTranslate("interface.text_c3a5d00e3373c948")}
              value={product.name}
              onChange={(e) => update({ name: e.target.value })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">{cerigaTranslate("interface.text_f5f2441eadb60b03")}</Label>
            <Input
              type="number"
              min="0" step="1" aria-label={cerigaTranslate("interface.text_d3195c0eebb97ec4")}
              value={product.moq}
              onChange={(e) => update({ moq: Number(e.target.value) || 0 })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">{cerigaTranslate("interface.text_1b0fa8145c26c127")}</Label>
            <Input
              type="number"
              step="0.01"
              min="0" aria-label={cerigaTranslate("interface.text_209b68009a6e1077")}
              value={product.startingPrice}
              onChange={(e) => update({ startingPrice: Number(e.target.value) || 0 })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label className="text-white/60">{cerigaTranslate("interface.text_526e0087cc3f254d")}</Label>
            <Textarea
              value={product.description}
              onChange={(e) => update({ description: e.target.value })}
              className="min-h-[60px] border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-sm font-medium text-white">{cerigaTranslate("interface.text_b15dda7fbf7564e9")}</p>
            <Switch
              checked={product.published}
              onCheckedChange={(v) => setConfirmKind(v ? 'publish' : 'unpublish')}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_a02139a8a8c2f03a")}</h2>
          <button
            type="button"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            onClick={enableAllFromBase}
          >{cerigaTranslate("interface.text_014496992da43c23")}{" "}{base.name}
          </button>
        </div>

        <div className="mt-5">
          <BuilderComponentEditor
            baseId={product.baseId}
            components={baseComponents}
            enabledComponentIds={product.enabledComponentIds}
            enabledOptions={product.enabledOptions}
            customOptions={baseConstraints.customOptions}
            allowCustomOptions={false}
            allowedComponentIds={baseConstraints.allowedComponentIds}
            allowedOptionsByGroup={baseConstraints.allowedOptionsByGroup}
            onChange={(patch) => setProduct((p) => ({ ...p, ...patch }))}
          />
        </div>
      </div>

      </fieldset><ConfirmDialog className="crm-confirmation"
        open={confirmKind != null}
        onOpenChange={(open) => {
          if (!open) setConfirmKind(null);
        }}
        title={
          confirmKind === 'save'
            ? isNew
              ? cerigaTranslate("interface.text_e2f598c723c3108b")
              : cerigaTranslate("interface.text_ce99ac83c2780314")
            : confirmKind === 'reset'
              ? cerigaTranslate("interface.text_e1a68581d8e0e58f",{value0:(base.name)})
              : confirmKind === 'publish'
                ? cerigaTranslate("interface.text_76b4646647b23ec0")
                : cerigaTranslate("interface.text_ccbf9a726bee9607")
        }
        description={
          confirmKind === 'save'
            ? isNew
              ? cerigaTranslate("interface.text_19e78012d4ed9715",{value0:(product.name)})
              : cerigaTranslate("interface.text_b6a40e73d8b4c811",{value0:(product.name)})
            : confirmKind === 'reset'
              ? cerigaTranslate("interface.text_78fd0ccbeec784fd")
              : confirmKind === 'publish'
                ? cerigaTranslate("interface.text_349e02894e2004c6")
                : cerigaTranslate("interface.text_f92ed41d08720309")
        }
        confirmLabel={
          confirmKind === 'save'
            ? isNew
              ? cerigaTranslate("nav.create")
              : cerigaTranslate("common.save")
            : confirmKind === 'reset'
              ? cerigaTranslate("interface.text_daee7606b339f3c3")
              : confirmKind === 'publish'
                ? cerigaTranslate("interface.text_859390eb495b2ead")
                : cerigaTranslate("interface.text_2db04a54fa743150")
        }
        tone={confirmKind === 'unpublish' || confirmKind === 'reset' ? 'danger' : 'default'}
        onConfirm={runConfirmed}
      />
    </div>
  );
}
