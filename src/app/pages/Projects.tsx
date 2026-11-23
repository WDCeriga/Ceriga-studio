import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { FileEdit, ArrowRight, Trash2, Copy } from 'lucide-react';
import { builderPath } from '../lib/projectFlow';
import type { ProjectFlowType } from '../lib/projectFlow';
import {
  deleteProject,
  duplicateProject,
  formatRelativeTime,
  listProjects,
  type ProjectListItem,
} from '../lib/projectsDb';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { ProjectGarmentPreview } from '../components/studio/ProjectGarmentPreview';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '../components/ui/utils';

type FlowFilter = 'all' | ProjectFlowType;

const FILTERS: { id: FlowFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'techpack', label: 'Tech packs' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'manufacturer', label: 'Quotes' },
];

function garmentLabel(garmentType: string): string {
  const map: Record<string, string> = {
    tshirt: 'T-shirt',
    hoodie: 'Hoodie',
    trousers: 'Trousers',
    sweatshirt: 'Sweatshirt',
    packaging: 'Packaging',
  };
  return map[garmentType] || garmentType;
}

function flowLabel(flow: string): string {
  if (flow === 'packaging') return 'Packaging';
  if (flow === 'manufacturer') return 'Quote';
  return 'Tech pack';
}

/** Full project list — continue / duplicate / delete saved work. */
export function Projects() {
  useCerigaTranslation();

  const { isAuthenticated, usingSupabase, authReady } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FlowFilter>('all');
  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !isAuthenticated) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load projects';
      toast.error(cerigaTranslateLabel(message));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, refresh]);

  const filtered = useMemo(
    () => (filter === 'all' ? projects : projects.filter((p) => p.flow_type === filter)),
    [projects, filter],
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success(cerigaTranslate("interface.text_afadfc5cdcf1b231"));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete project';
      toast.error(cerigaTranslateLabel(message));
    }
  };

  const handleDuplicate = async (project: ProjectListItem) => {
    setDuplicatingId(project.id);
    try {
      const row = await duplicateProject(project.id);
      toast.success(cerigaTranslate("interface.text_398d88da61c2117f"));
      await refresh();
      // Keep filter; new copy matches same flow_type
      void row;
    } catch (err) {
      toast.error(cerigaTranslateLabel(err instanceof Error ? err.message : cerigaTranslate("interface.text_552d5a1a94aca9e4")));
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="ceriga-page-eyebrow">{cerigaTranslate("interface.text_ef14cf0d34ed4bd6")}</div>
          <h1 className="ceriga-page-title">{cerigaTranslate("nav.projects")}</h1>
          <p className="ceriga-page-sub">{cerigaTranslate("interface.text_fcff6c51112e25ff")}</p>
        </div>
        <Link to="/create" className="ceriga-btn-primary shrink-0">{cerigaTranslate("interface.text_a41eb2bf7245d3bc")}</Link>
      </div>

      {usingSupabase && isAuthenticated && !loading && projects.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count =
              f.id === 'all' ? projects.length : projects.filter((p) => p.flow_type === f.id).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'ceriga-mono rounded-[4px] border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
                  filter === f.id
                    ? 'border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
                    : 'border-[#252528] text-[#8A8A90] hover:border-[#333338] hover:text-[#A3A3A8]',
                )}
              >
                {cerigaTranslateLabel(f.label)}
                <span className="ml-1.5 tabular-nums text-[#6B6B72]">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!usingSupabase ? (
        <div className="rounded-[6px] border border-[#5A4530] bg-[#2A2218]/40 px-4 py-3 text-xs text-[#E8A868]">{cerigaTranslate("interface.text_8c9e134422f0a6e5")}{" "}<code className="text-[#F0EEEE]">VITE_SUPABASE_URL</code>{" "}{cerigaTranslate("interface.text_6201111b83a0cb5b")}{' '}
          <code className="text-[#F0EEEE]">VITE_SUPABASE_ANON_KEY</code>{" "}{cerigaTranslate("interface.text_663ea1bfffe5038f")}{" "}<code className="text-[#F0EEEE]">.env</code>{cerigaTranslate("interface.text_d98432b1256e0075")}{" "}<code className="text-[#F0EEEE]">supabase/schema.sql</code>.
        </div>
      ) : !isAuthenticated ? (
        <div className="ceriga-card py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-[#45454B]" />
          <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_ff7f7936f9913ffb")}</h3>
          <p className="mb-4 text-xs text-[#6B6B72]">{cerigaTranslate("interface.text_c52fc51eb3c0793e")}</p>
          <Link to="/login" className="ceriga-btn-primary">{cerigaTranslate("interface.text_bfd402b2f6f38125")}</Link>
        </div>
      ) : loading ? (
        <div className="ceriga-card py-16 text-center text-xs text-[#6B6B72]">{cerigaTranslate("interface.text_6970a1ced73ddb58")}</div>
      ) : projects.length === 0 ? (
        <div className="ceriga-card py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-[#45454B]" />
          <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_f83c806522865605")}</h3>
          <p className="mb-5 max-w-sm mx-auto text-xs text-[#6B6B72]">{cerigaTranslate("interface.text_2145bcacc0ddf2fb")}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/create" className="ceriga-btn-primary">{cerigaTranslate("nav.create")}</Link>
            <Link
              to="/catalog"
              className="inline-flex h-9 items-center rounded-[4px] border border-[#3A3A40] px-4 text-[12px] font-medium text-[#F0EEEE] hover:bg-white/[0.03]"
            >{cerigaTranslate("interface.text_ce7653fa644628d9")}</Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ceriga-card py-12 text-center">
          <p className="text-sm text-[#8A8A90]">{cerigaTranslate("interface.text_007be05c8e4291e9")}</p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-3 text-[12px] text-[#E5534A] hover:underline"
          >{cerigaTranslate("interface.text_2150d8df37e48957")}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              duplicating={duplicatingId === project.id}
              onDelete={() => setPendingDelete(project)}
              onDuplicate={() => void handleDuplicate(project)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={cerigaTranslate("interface.text_493a274349f6ee70")}
        description={
          pendingDelete
            ? cerigaTranslate("interface.text_4affd5e1993db1f0",{value0:(pendingDelete.name)})
            : cerigaTranslate("interface.text_b5e8fdbe5e78c362")
        }
        confirmLabel={cerigaTranslate("common.delete")}
        tone="danger"
        onConfirm={() => {
          if (!pendingDelete) return;
          void handleDelete(pendingDelete.id);
        }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
  onDuplicate,
  duplicating,
}: {
  project: ProjectListItem;
  onDelete: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
}) {
  useCerigaTranslation();

  const label = garmentLabel(project.garment_type);
  const isComplete = project.progress >= 100;

  return (
    <div className="ceriga-card flex flex-col overflow-hidden">
      <div className="relative h-[168px] overflow-hidden border-b border-[#252528] bg-[#111113]">
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between">
          <span className="ceriga-mono rounded-[3px] border border-[#5A4530] bg-[#2A2218]/90 px-1.5 py-[3px] text-[10px] uppercase tracking-[0.06em] text-[#E8A868] backdrop-blur-sm">
            {cerigaTranslateLabel(flowLabel(project.flow_type))}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={cerigaTranslate("interface.text_f8725da98b5aba5c")}
              disabled={duplicating}
              onClick={onDuplicate}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#252528] bg-[#09090B]/70 text-[#8A8A90] hover:text-[#F0EEEE] disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={cerigaTranslate("interface.text_9c0b617e79e94dac")}
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#252528] bg-[#09090B]/70 text-[#8A8A90] hover:text-[#F0EEEE]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ProjectGarmentPreview garmentType={project.garment_type} state={project.state} />
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <h3 className="mb-1 truncate text-[15px] font-semibold text-[#F0EEEE]">{project.name}</h3>
        <p className="mb-3 text-[11px] text-[#6B6B72]">
          {cerigaTranslateLabel(label)}{" "}{cerigaTranslate("interface.text_8f93522f82865fef")}{" "}{project.current_step} · {formatRelativeTime(project.updated_at)}
        </p>

        <div className="mb-1.5 flex justify-between text-[11px] text-[#8A8A90]">
          <span className="ceriga-mono tracking-[0.04em]">{cerigaTranslate("interface.text_e0d0adc74c8be52a")}</span>
          <span className="ceriga-mono" style={{ color: isComplete ? '#7FA888' : '#CC2D24' }}>
            {project.progress}%
          </span>
        </div>
        <div className="mb-3.5 h-[3px] overflow-hidden rounded-sm bg-[#252528]">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${project.progress}%`,
              background: isComplete ? '#7FA888' : '#CC2D24',
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(0,0,0,0.25) 5px, rgba(0,0,0,0.25) 6px)',
            }}
          />
        </div>

        <Link to={builderPath(project.product_id, project.flow_type, project.id)} className="mt-auto">
          <span className="ceriga-btn-ghost">{cerigaTranslate("interface.text_31fbef162594de01")}{" "}<ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
