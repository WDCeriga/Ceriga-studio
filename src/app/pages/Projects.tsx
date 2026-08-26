import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FileEdit, ArrowRight, Trash2 } from 'lucide-react';
import { builderPath } from '../lib/projectFlow';
import {
  deleteProject,
  formatRelativeTime,
  listProjects,
  type ProjectListItem,
} from '../lib/projectsDb';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { ProjectGarmentPreview } from '../components/studio/ProjectGarmentPreview';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from 'sonner';

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

/** Full project list — continue / delete saved work (replaces Drafts). */
export function Projects() {
  const { isAuthenticated, usingSupabase, authReady } = useAuth();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null);

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

  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="ceriga-page-eyebrow">Your work</div>
          <h1 className="ceriga-page-title">Projects</h1>
          <p className="ceriga-page-sub">Open a saved tech pack, packaging job, or production draft</p>
        </div>
        <Link to="/create" className="ceriga-btn-primary shrink-0">
          New project
        </Link>
      </div>

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
          <p className="mb-4 text-xs text-[#6B6B72]">
            Create a tech pack or packaging job, then save to see it here
          </p>
          <Link to="/create" className="ceriga-btn-primary">
            Create
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => setPendingDelete(project)}
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
}: {
  project: ProjectListItem;
  onDelete: () => void;
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
          <button
            type="button"
            title="Delete project"
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#252528] bg-[#09090B]/70 text-[#8A8A90] hover:text-[#F0EEEE]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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
