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
      toast.error(message);
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
      toast.success('Project deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete project';
      toast.error(message);
    }
  };

  const handleDuplicate = async (project: ProjectListItem) => {
    setDuplicatingId(project.id);
    try {
      const row = await duplicateProject(project.id);
      toast.success('Project duplicated');
      await refresh();
      // Keep filter; new copy matches same flow_type
      void row;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not duplicate');
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="ceriga-page-eyebrow">Your work</div>
          <h1 className="ceriga-page-title">Projects</h1>
          <p className="ceriga-page-sub">
            Tech packs, packaging, and quote drafts — open, duplicate, or delete
          </p>
        </div>
        <Link to="/create" className="ceriga-btn-primary shrink-0">
          New project
        </Link>
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
                {f.label}
                <span className="ml-1.5 tabular-nums text-[#6B6B72]">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!usingSupabase ? (
        <div className="rounded-[6px] border border-[#5A4530] bg-[#2A2218]/40 px-4 py-3 text-xs text-[#E8A868]">
          Cloud database is not configured. Add <code className="text-[#F0EEEE]">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-[#F0EEEE]">VITE_SUPABASE_ANON_KEY</code> to <code className="text-[#F0EEEE]">.env</code>
          , then run <code className="text-[#F0EEEE]">supabase/schema.sql</code>.
        </div>
      ) : !isAuthenticated ? (
        <div className="ceriga-card py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-[#45454B]" />
          <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">Sign in to see projects</h3>
          <p className="mb-4 text-xs text-[#6B6B72]">Your saved work syncs to your account</p>
          <Link to="/login" className="ceriga-btn-primary">
            Sign in
          </Link>
        </div>
      ) : loading ? (
        <div className="ceriga-card py-16 text-center text-xs text-[#6B6B72]">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="ceriga-card py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-[#45454B]" />
          <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">No projects yet</h3>
          <p className="mb-5 max-w-sm mx-auto text-xs text-[#6B6B72]">
            Design a tech pack, packaging-only job, or upload a pack for a quote — then save to see
            it here.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/create" className="ceriga-btn-primary">
              Create
            </Link>
            <Link
              to="/catalog"
              className="inline-flex h-9 items-center rounded-[4px] border border-[#3A3A40] px-4 text-[12px] font-medium text-[#F0EEEE] hover:bg-white/[0.03]"
            >
              Browse templates
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ceriga-card py-12 text-center">
          <p className="text-sm text-[#8A8A90]">No projects in this filter.</p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-3 text-[12px] text-[#E5534A] hover:underline"
          >
            Show all
          </button>
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
        title="Delete project?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be permanently deleted. This can’t be undone.`
            : 'This project will be permanently deleted. This can’t be undone.'
        }
        confirmLabel="Delete"
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
  const label = garmentLabel(project.garment_type);
  const isComplete = project.progress >= 100;

  return (
    <div className="ceriga-card flex flex-col overflow-hidden">
      <div className="relative h-[168px] overflow-hidden border-b border-[#252528] bg-[#111113]">
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between">
          <span className="ceriga-mono rounded-[3px] border border-[#5A4530] bg-[#2A2218]/90 px-1.5 py-[3px] text-[10px] uppercase tracking-[0.06em] text-[#E8A868] backdrop-blur-sm">
            {flowLabel(project.flow_type)}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Duplicate project"
              disabled={duplicating}
              onClick={onDuplicate}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#252528] bg-[#09090B]/70 text-[#8A8A90] hover:text-[#F0EEEE] disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Delete project"
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
          {label} · Step {project.current_step} · {formatRelativeTime(project.updated_at)}
        </p>

        <div className="mb-1.5 flex justify-between text-[11px] text-[#8A8A90]">
          <span className="ceriga-mono tracking-[0.04em]">PROGRESS</span>
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
          <span className="ceriga-btn-ghost">
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
