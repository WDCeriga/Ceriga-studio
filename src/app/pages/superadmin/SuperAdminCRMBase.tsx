import { BuilderComponentEditor } from './crm/CrmComponentEditor';
import { useMemo, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Layers, Shirt } from 'lucide-react';
import { toast } from 'sonner';
import {
  GARMENT_BASES,
  baseComponentsForBase,
  defaultBaseConfig,
  garmentBaseById,
  getBaseConfig,
  normalizeBaseConfig,
  upsertBaseConfig,
  type GarmentBaseConfig,
  type GarmentBaseId,
} from '../../data/crmCatalogMock';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';

const BASE_ICONS = {
  tshirt: Shirt,
  hoodie: Layers,
  trousers: Layers,
} as const;

export function SuperAdminCRMBase() {
  const { baseId: baseIdParam } = useParams<{ baseId: string }>();
  const baseId = baseIdParam as GarmentBaseId;
  const meta = GARMENT_BASES.find((b) => b.id === baseId);

  const [config, setConfig] = useState<GarmentBaseConfig>(() => {
    const existing = getBaseConfig(baseId);
    return existing ? { ...existing } : defaultBaseConfig(baseId);
  });

  const baseComponents = useMemo(() => baseComponentsForBase(baseId), [baseId]);

  if (!meta) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-6 py-16 text-center">
        <p className="text-sm text-white/50">Base not found.</p>
        <Button asChild className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
          <Link to="/superadmin/crm">Back to CRM</Link>
        </Button>
      </div>
    );
  }

  const Icon = BASE_ICONS[baseId];

  const save = () => {
    const saved = normalizeBaseConfig(config);
    upsertBaseConfig(saved);
    setConfig(saved);
    toast.success(`Saved ${meta.name}`);
  };

  const resetToCodeDefaults = () => {
    setConfig(defaultBaseConfig(baseId));
    toast.message('Reset to coded defaults from builder');
  };

  return (
    <div className="space-y-6">
      <Link
        to="/superadmin/crm"
        className="inline-flex items-center gap-2 text-xs font-medium text-white/45 hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        CRM catalog
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/30"
            style={{ color: meta.accent }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: meta.accent }}
            >
              Garment base
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{meta.name}</h1>
          </div>
        </div>
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={save}>
          Save base
        </Button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <Label className="text-white/60">Base description</Label>
        <Textarea
          value={config.description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setConfig((c) => ({ ...c, description: e.target.value }))
          }
          className="min-h-[72px] border-white/15 bg-white/5 text-white"
        />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">Base component defaults</h2>
          <button
            type="button"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            onClick={resetToCodeDefaults}
          >
            Reset to coded defaults
          </button>
        </div>

        <div className="mt-5">
          <BuilderComponentEditor
            baseId={baseId}
            components={baseComponents}
            enabledComponentIds={config.enabledComponentIds}
            enabledOptions={config.enabledOptions}
            customOptions={config.customOptions}
            allowCustomOptions
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
          />
        </div>
      </div>
    </div>
  );
}
