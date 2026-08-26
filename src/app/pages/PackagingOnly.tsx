import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  LabelsPackagingStep,
  PackagingPreview,
} from '../components/builder/LabelsPackagingStep';
import { PackagingReuseBar } from '../components/builder/PackagingReuseBar';
import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { getProject, upsertProject } from '../lib/projectsDb';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { saveLocalPackaging, type PackagingSnapshot } from '../lib/packagingLibrary';

export function PackagingOnly() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('projectId');
  const { isAuthenticated, authReady } = useAuth();

  const [projectId, setProjectId] = useState<string | undefined>(projectIdParam ?? undefined);
  const [projectName, setProjectName] = useState('Packaging design');
  const [packaging, setPackaging] = useState<DesignElement[]>([]);
  const [packagingType, setPackagingType] = useState('polybag');
  const [notes, setNotes] = useState('');
  const [packagingLayerSelectedId, setPackagingLayerSelectedId] = useState<string | null>(null);
  const [packagingBaseColor, setPackagingBaseColor] = useState('#F5F5F5');
  const [hydrating, setHydrating] = useState(Boolean(projectIdParam));
  const [saving, setSaving] = useState(false);

  const snapshot: PackagingSnapshot = {
    packagingType,
    packagingColor: packagingBaseColor,
    notes,
    elements: packaging,
  };

  const applySnapshot = useCallback((snap: PackagingSnapshot) => {
    setPackagingType(snap.packagingType);
    setPackagingBaseColor(snap.packagingColor);
    setNotes(snap.notes);
    setPackaging(snap.elements);
    setPackagingLayerSelectedId(null);
  }, []);

  useEffect(() => {
    if (!projectIdParam || !authReady) {
      if (!projectIdParam) setHydrating(false);
      return;
    }
    if (!isSupabaseConfigured || !isAuthenticated) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await getProject(projectIdParam);
        if (cancelled || !row) return;
        setProjectId(row.id);
        setProjectName(row.name);
        const st = row.state ?? {};
        setPackaging(Array.isArray(st.packaging) ? (st.packaging as DesignElement[]) : []);
        setPackagingType(typeof st.packagingType === 'string' ? st.packagingType : 'polybag');
        setPackagingBaseColor(typeof st.packagingColor === 'string' ? st.packagingColor : '#F5F5F5');
        const extra = st.extraDetails as { packaging?: string } | undefined;
        setNotes(typeof extra?.packaging === 'string' ? extra.packaging : '');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load packaging project');
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectIdParam, authReady, isAuthenticated]);

  const handleSaveProject = async () => {
    if (!isSupabaseConfigured) {
      saveLocalPackaging(projectName, snapshot);
      toast.success('Saved to local packaging library (database not configured)');
      return;
    }
    if (!isAuthenticated) {
      toast.error('Sign in to save packaging as a project');
      return;
    }
    setSaving(true);
    try {
      const row = await upsertProject({
        id: projectId,
        productId: 'packaging',
        name: projectName.trim() || 'Packaging design',
        garmentType: 'packaging',
        flowType: 'packaging',
        progress: packaging.length > 0 || packagingType !== 'none' ? 80 : 20,
        currentStep: 1,
        state: {
          packaging,
          packagingType,
          packagingColor: packagingBaseColor,
          extraDetails: { packaging: notes },
        },
      });
      setProjectId(row.id);
      if (searchParams.get('projectId') !== row.id) {
        setSearchParams({ projectId: row.id }, { replace: true });
      }
      saveLocalPackaging(row.name, snapshot);
      toast.success('Packaging project saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (hydrating) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#09090B] text-sm text-white/50">
        Loading packaging…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4.35rem-env(safe-area-inset-top,0px))] min-h-0 w-full flex-col overflow-hidden bg-[#09090B] lg:h-[100dvh] lg:max-h-[100dvh]">
      <div className="shrink-0 border-b border-[#252528] px-4 pb-3 pt-4 sm:px-5 md:px-7">
        <Link
          to="/create"
          className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Create
        </Link>
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
          Packaging designer
        </div>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-white sm:text-[1.65rem]">
          Packaging
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/50 sm:text-sm">
          Same packaging tools as in a full tech pack. Save to reuse in garment projects, or continue
          to order packaging on its own.
        </p>
        <div className="mt-3 max-w-sm">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Project name
          </label>
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-9 border-[#252528] bg-black/40 text-sm text-white"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-28 sm:p-5 md:px-7 md:py-6 lg:pb-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:gap-8">
          <div className="flex max-h-[min(40dvh,280px)] min-h-0 w-full shrink-0 items-center justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-[14px] border border-[#252528] bg-black/30 p-3 sm:max-h-[min(42dvh,300px)] sm:p-4 lg:max-h-none lg:min-h-0 lg:flex-1 lg:p-6">
            <PackagingPreview
              color={packagingBaseColor}
              elements={packaging}
              onElementsChange={setPackaging}
              selectedId={packagingLayerSelectedId}
              onSelectedIdChange={setPackagingLayerSelectedId}
            />
          </div>
          <aside className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-2 lg:max-h-full lg:max-w-md lg:shrink-0 lg:overflow-y-auto lg:pb-0 lg:pr-0.5">
            <div className="mb-4">
              <PackagingReuseBar snapshot={snapshot} onApply={applySnapshot} />
            </div>
            <LabelsPackagingStep
              subStep="packaging"
              elements={packaging}
              onElementsChange={setPackaging}
              notes={notes}
              onNotesChange={setNotes}
              planValue={packagingType}
              onPlanChange={(v) => {
                setPackagingType(v);
                if (v === 'none') {
                  setPackaging([]);
                  setPackagingLayerSelectedId(null);
                }
              }}
              selectedLayerId={packagingLayerSelectedId}
              onSelectedLayerIdChange={setPackagingLayerSelectedId}
              previewBaseColor={packagingBaseColor}
              onPreviewBaseColorChange={setPackagingBaseColor}
            />
          </aside>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 shrink-0 border-t border-[#252528] bg-[#09090B]/95 px-4 py-3 backdrop-blur-md lg:static lg:z-0 lg:border-t lg:border-[#252528] lg:bg-[#09090B] lg:px-4 lg:py-3 lg:backdrop-blur-0">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-3 lg:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-white/15 text-white/85 hover:bg-white/5 lg:flex-none"
            asChild
          >
            <Link to="/create">Back</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void handleSaveProject()}
            className="flex-1 border-white/15 text-white/85 hover:bg-white/5 lg:flex-none"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save project'}
          </Button>
          <Button
            type="button"
            className="flex-[2] bg-[#CC2D24] font-semibold hover:bg-[#CC2D24]/90 lg:flex-none lg:min-w-[200px]"
            onClick={() => {
              void (async () => {
                try {
                  await handleSaveProject();
                } catch {
                  /* toast already shown */
                }
                navigate('/delivery', {
                  state: {
                    from: 'packaging',
                    productId: projectId ?? 'packaging',
                    productName: projectName,
                    garmentType: 'Packaging',
                  },
                });
              })();
            }}
          >
            Order packaging
          </Button>
        </div>
      </div>
    </div>
  );
}
