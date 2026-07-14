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
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const isNew = productId === 'new';

  const existing = !isNew && productId ? getProductConfig(productId) : undefined;

  const [product, setProduct] = useState<DraftProduct>(() => {
    if (isNew) return emptyDraft('tshirt');
    if (existing) return { ...existing };
    return emptyDraft('tshirt');
  });

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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to catalog
          </Link>
        </Button>
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-6 py-16 text-center">
          <p className="text-sm text-white/50">Product not found.</p>
          <Button asChild className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/superadmin/crm">Return to CRM</Link>
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
    update(defaultConfigForBase(product.baseId));
    toast.message(`Reset to ${base.name} defaults`);
  };

  const onImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update({ image: reader.result });
        toast.success('Image added');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const save = () => {
    if (!product.name.trim()) {
      toast.error('Enter a product name');
      return;
    }
    if (isNew && !product.image.trim()) {
      toast.error('Add a catalog image');
      return;
    }
    const id = isNew ? product.id.trim() || slugFromName(product.name) : product.id;
    if (isNew && getCatalogStore().some((p) => p.id === id)) {
      toast.error('Product ID already exists');
      return;
    }

    const saved = normalizeProductConfig({ ...product, id });
    upsertProductConfig(saved);
    setCatalogStore(getCatalogStore());
    toast.success(isNew ? `Created ${saved.name}` : `Saved ${saved.name}`);
    if (isNew) {
      navigate(`/superadmin/crm/products/${id}`, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            asChild
            variant="ghost"
            className="mb-3 h-8 px-0 text-white/50 hover:bg-transparent hover:text-white"
          >
            <Link to="/superadmin/crm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Catalog
            </Link>
          </Button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            {isNew ? 'New product' : 'Edit product'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {isNew ? 'Create catalog product' : product.name}
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
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Preview in builder
              </Link>
            </Button>
          ) : null}
          <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={save}>
            {isNew ? 'Create product' : 'Save changes'}
          </Button>
        </div>
      </div>

      {isNew ? (
        <div>
          <h2 className="text-sm font-semibold text-white">Choose garment base</h2>
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
                      : 'border-white/[0.08] bg-[#111113] hover:border-white/15',
                  )}
                  style={{
                    background: active
                      ? `linear-gradient(145deg, ${b.accent}18 0%, #111113 60%)`
                      : `linear-gradient(145deg, ${b.accent}0a 0%, #111113 60%)`,
                  }}
                >
                  <button type="button" onClick={() => selectBase(b.id)} className="w-full text-left">
                    <div
                      className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30"
                      style={{ color: b.accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-white">{b.name}</p>
                    <p className="mt-2 text-[10px] text-white/30">
                      {b.allComponentIds.length} components
                    </p>
                  </button>
                  <Link
                    to={`/superadmin/crm/bases/${b.id}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-white/40 hover:text-[#CC2D24]"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit base defaults
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111113] px-3 py-1.5"
            style={{ borderColor: `${base.accent}44` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Base
            </span>
            <span className="text-xs font-medium text-white">{base.name}</span>
          </div>
          <Link
            to={`/superadmin/crm/bases/${product.baseId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111113] px-3 py-1.5 text-[10px] font-medium text-white/45 hover:border-white/20 hover:text-white/75"
          >
            <Pencil className="h-3 w-3" />
            Edit base
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Product details</h2>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:w-44">
            {product.image ? (
              <img src={product.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-white/30">
                <ImageIcon className="h-8 w-8" />
                <span className="text-[11px]">No image yet</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Label className="text-white/60">Catalog image</Label>
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
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload image
              </Button>
              {product.image ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/15 text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => update({ image: '' })}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-white/60">Display name</Label>
            <Input
              value={product.name}
              onChange={(e) => update({ name: e.target.value })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">MOQ</Label>
            <Input
              type="number"
              value={product.moq}
              onChange={(e) => update({ moq: Number(e.target.value) || 0 })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/60">Starting price (£)</Label>
            <Input
              type="number"
              step="0.01"
              value={product.startingPrice}
              onChange={(e) => update({ startingPrice: Number(e.target.value) || 0 })}
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label className="text-white/60">Description</Label>
            <Textarea
              value={product.description}
              onChange={(e) => update({ description: e.target.value })}
              className="min-h-[60px] border-white/15 bg-white/5 text-white"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-sm font-medium text-white">Published</p>
            <Switch checked={product.published} onCheckedChange={(v) => update({ published: v })} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">Builder components</h2>
          <button
            type="button"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            onClick={enableAllFromBase}
          >
            Reset to {base.name}
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
    </div>
  );
}
