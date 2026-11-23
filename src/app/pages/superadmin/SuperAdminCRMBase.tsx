import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import './superadmin-crm.css';
import { BuilderComponentEditor } from './crm/CrmComponentEditor';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Layers, Ruler, Shirt } from 'lucide-react';
import { toast } from 'sonner';
import {
  GARMENT_BASES,
  baseComponentsForBase,
  defaultBaseConfig,
  getBaseConfig,
  normalizeBaseConfig,
  upsertBaseConfig,
  type GarmentBaseConfig,
  type GarmentBaseId,
} from '../../data/crmCatalogMock';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

const BASE_ICONS = {
  tshirt: Shirt,
  hoodie: Layers,
  trousers: Layers,
} as const;

export function SuperAdminCRMBase() {
  useCerigaTranslation();

  const { baseId: baseIdParam } = useParams<{ baseId: string }>();
  const baseId = baseIdParam as GarmentBaseId;
  const meta = GARMENT_BASES.find((b) => b.id === baseId);

  const [config, setConfig] = useState<GarmentBaseConfig>(() => {
    const existing = getBaseConfig(baseId);
    return existing ? { ...existing } : defaultBaseConfig(baseId);
  });

  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');const saveLock=useRef(false);
  const baseComponents = useMemo(() => baseComponentsForBase(baseId), [baseId]);

  if (!meta) {
    return (
      <div className="rounded-2xl border border-[#252528] bg-[#111113] px-6 py-16 text-center">
        <p className="text-sm text-white/50">{cerigaTranslate("interface.text_c4146352220e04d2")}</p>
        <Button asChild className="mt-4 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
          <Link to="/superadmin/crm">{cerigaTranslate("interface.text_41ff86c7acbad276")}</Link>
        </Button>
      </div>
    );
  }

  const Icon = BASE_ICONS[baseId];

  const save = async () => {
    if(saveLock.current)return;saveLock.current=true;setSaving(true);setSaveError('');
    try {
    const saved = normalizeBaseConfig(config);
    await upsertBaseConfig(saved);
    setConfig(saved);
    toast.success(cerigaTranslate("interface.text_ce0983f3577f5ce9",{value0:(meta.name)}));
    }catch(cause){const message=cause instanceof Error?cause.message:"Could not save base";setSaveError(message);toast.error(cerigaTranslateLabel(message));}finally{saveLock.current=false;setSaving(false);}
  };

  const resetToCodeDefaults = () => {
    setConfig(defaultBaseConfig(baseId));
    toast.message(cerigaTranslate("interface.text_13df02b6865a3dae"));
  };

  return (
    <div className="admin-crm-editor space-y-6" aria-busy={saving}><fieldset className="crm-editor-fields" disabled={saving} aria-label={cerigaTranslate("interface.text_63e9091f61f9aa75")}>{saveError&&<p role="alert" className="crm-save-error">{cerigaTranslateLabel(saveError)}</p>}
      <Link
        to="/superadmin/crm"
        className="inline-flex items-center gap-2 text-xs font-medium text-white/45 hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_0d5d85c21cc44426")}</Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#252528] bg-black/30"
            style={{ color: meta.accent }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: meta.accent }}
            >{cerigaTranslate("interface.text_639bfd6c04877fe3")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{meta.name}</h1>
          </div>
        </div>
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={save}>
          {saving?cerigaTranslate("common.saving"):cerigaTranslate("interface.text_0d0af8684108f1ee")}
        </Button>
      </div>

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <Label className="text-white/60">{cerigaTranslate("interface.text_cb9b76c16ea20353")}</Label>
        <Textarea
          value={config.description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setConfig((c) => ({ ...c, description: e.target.value }))
          }
          className="min-h-[72px] border-white/15 bg-white/5 text-white"
        />
      </div>

      <Link
        to={`/superadmin/crm/bases/${baseId}/measurement-guides`}
        className="group flex items-center justify-between gap-4 rounded-2xl border border-[#252528] bg-[#111113] p-5 transition hover:border-[#CC2D24]/40 hover:bg-[#1C0F0F]/40 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CC2D24]/30 bg-[#CC2D24]/10 text-[#E5534A]">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_2f794813748d278e")}</h2>
            <p className="mt-1 text-xs leading-5 text-white/50">{cerigaTranslate("interface.text_a5ec692eb5025a60")}{" "}{meta.name.toLowerCase()}{" "}{cerigaTranslate("interface.text_33c95b7f3c2e6761")}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-[#E5534A]" />
      </Link>

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_4e540c30decbb3a0")}</h2>
          <button
            type="button"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
            onClick={resetToCodeDefaults}
          >{cerigaTranslate("interface.text_53f60ccc41f1d3ab")}</button>
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
    </fieldset>
    </div>
  );
}
