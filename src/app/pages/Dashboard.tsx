import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router';
import { Plus, ArrowRight } from 'lucide-react';
import { builderPath, type ProjectFlowType } from '../lib/projectFlow';
import { DashboardLiveChat } from '../components/DashboardLiveChat';
import { NotificationBell } from '../components/NotificationBell';
import { ProjectGarmentPreview } from '../components/studio/ProjectGarmentPreview';
import {
  formatRelativeTime,
  listProjects,
  type ProjectListItem,
} from '../lib/projectsDb';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { cn } from '../components/ui/utils';

function garmentLabel(garmentType: string): string {
  const map: Record<string, string> = {
    tshirt: 'T-shirt',
    hoodie: 'Hoodie',
    trousers: 'Trousers',
    sweatshirt: 'Sweatshirt',
  };
  return map[garmentType] || garmentType;
}

function StatField({
  label,
  value,
  sub,
  last,
}: {
  label: string;
  value: string | number;
  sub: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn('min-w-0 flex-1 px-5 py-4', !last && 'border-b border-[#252528] sm:border-b-0 sm:border-r')}
    >
      <div className="ceriga-mono mb-2 text-[11px] uppercase tracking-[0.08em] text-[#8A8A90]">
        {label}
      </div>
      <div className="text-[28px] font-semibold tracking-[-0.01em] text-[#F0EEEE]">{value}</div>
      <div className="mt-1 text-xs text-[#6B6B72]">{sub}</div>
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: {
    id: string;
    productId: string;
    flowType: ProjectFlowType;
    name: string;
    garmentType: string;
    garmentTypeKey: string;
    status: string;
    progress: number;
    lastEdited: string;
    state: Record<string, unknown> | null;
  };
}) {
  const isComplete = project.status === 'Complete';
  const status = isComplete
    ? {
        bg: 'var(--ceriga-status-done-bg)',
        text: 'var(--ceriga-status-done-text)',
        border: 'var(--ceriga-status-done-border)',
      }
    : {
        bg: 'var(--ceriga-status-progress-bg)',
        text: 'var(--ceriga-status-progress-text)',
        border: 'var(--ceriga-status-progress-border)',
      };

  return (
    <div className="ceriga-card flex flex-col overflow-hidden">
      <div className="relative h-[168px] overflow-hidden border-b border-[#252528] bg-[#111113]">
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between">
          <span
            className="ceriga-mono rounded-[3px] px-1.5 py-[3px] text-[10px] uppercase tracking-[0.06em] backdrop-blur-sm"
            style={{
              color: status.text,
              background: status.bg,
              border: `1px solid ${status.border}`,
            }}
          >
            {project.status}
          </span>
          <span className="ceriga-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B72]">
            {project.garmentType}
          </span>
        </div>
        <ProjectGarmentPreview garmentType={project.garmentTypeKey} state={project.state} />
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-[#F0EEEE]">{project.name}</span>
          <span className="ceriga-mono shrink-0 text-[10px] uppercase text-[#8A8A90]">
            {project.garmentType}
          </span>
        </div>
        <div className="mb-3 text-[11px] text-[#6B6B72]">{project.lastEdited}</div>

        <div className="mb-1.5 flex justify-between text-[11px] text-[#8A8A90]">
          <span className="ceriga-mono tracking-[0.04em]">PROGRESS</span>
          <span
            className="ceriga-mono"
            style={{ color: isComplete ? '#7FA888' : '#CC2D24' }}
          >
            {project.progress}%
          </span>
        </div>
        <div className="relative mb-3.5 h-[3px] overflow-hidden rounded-sm bg-[#252528]">
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

        <Link to={builderPath(project.productId, project.flowType, project.id)} className="mt-auto">
          <span className="ceriga-btn-ghost">
            Open <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, isAuthenticated, usingSupabase, authReady } = useAuth();
  const [rows, setRows] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !isAuthenticated) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await listProjects());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load projects';
      toast.error(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, refresh]);

  const projects = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        productId: row.product_id,
        flowType: row.flow_type as ProjectFlowType,
        name: row.name,
        garmentType: garmentLabel(row.garment_type),
        garmentTypeKey: row.garment_type,
        status: row.progress >= 100 ? 'Complete' : 'In progress',
        progress: row.progress,
        lastEdited: formatRelativeTime(row.updated_at),
        state: row.state ?? null,
      })),
    [rows],
  );

  const avgProgress =
    projects.length === 0
      ? 0
      : Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length);
  const completed = projects.filter((p) => p.status === 'Complete').length;
  const inProgress = projects.filter((p) => p.status === 'In progress').length;

  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="ceriga-mono text-[12px] uppercase tracking-[0.08em] text-[#8A8A90]">
            Techpack studio
          </span>
        </div>
        <NotificationBell className="h-8 w-8 rounded-md border border-[#2E2E32] bg-transparent shadow-none backdrop-blur-0 hover:border-[#3A3A40] hover:bg-[#1C1C1E] [&_svg]:size-[15px] [&_svg]:text-[#A3A3A8]" />
      </div>

      <div className="mb-7">
        <div className="ceriga-page-eyebrow">Overview</div>
        <h1 className="ceriga-page-title">
          {user?.name ? `Hey, ${user.name}.` : 'Welcome back.'}
        </h1>
        <p className="ceriga-page-sub">Build production-ready garment tech packs, faster.</p>
      </div>

      <div className="mb-9 flex flex-col overflow-hidden rounded-[6px] border border-[#252528] sm:flex-row">
        <StatField label="Total projects" value={projects.length} sub="All time" />
        <StatField label="In progress" value={inProgress} sub="Active" />
        <StatField label="Completed" value={completed} sub="Finished" />
        <StatField label="Avg. progress" value={`${avgProgress}%`} sub="Across all" last />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="text-base font-semibold text-[#F0EEEE]">Projects</div>
          <div className="mt-0.5 text-[12.5px] text-[#6B6B72]">
            {projects.length} garments
            {inProgress > 0 ? `, ${inProgress} active` : ''}
          </div>
        </div>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-[13px] text-[#E5534A] hover:text-[#CC2D24]"
        >
          Browse catalog <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Link
          to="/catalog"
          className="flex min-h-[280px] flex-col items-center justify-center gap-2.5 rounded-[6px] border border-dashed border-[#333338] px-6 text-center transition-colors hover:border-[#3A3A40] hover:bg-[#1C1C1E]"
        >
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#3A3A40]">
            <Plus className="h-4 w-4 text-[#8A8A90]" />
          </div>
          <div className="text-[13.5px] font-medium text-[#F0EEEE]">New project</div>
          <div className="max-w-[180px] text-[11.5px] leading-relaxed text-[#6B6B72]">
            Start a garment and build a tech pack.
          </div>
        </Link>

        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {!usingSupabase ? (
        <p className="mt-6 text-xs text-[#E8A868]/90">
          Database not configured — add Supabase keys to .env (see .env.example).
        </p>
      ) : !isAuthenticated ? (
        <p className="mt-6 text-xs text-[#6B6B72]">
          <Link to="/login" className="text-[#E5534A] hover:underline">
            Sign in
          </Link>{' '}
          to sync projects across devices.
        </p>
      ) : loading ? (
        <p className="mt-6 text-xs text-[#6B6B72]">Loading projects…</p>
      ) : (
        <p className="mt-6 text-[11.5px] text-[#45454B]">
          {projects.length} projects, last updated just now
        </p>
      )}

      <DashboardLiveChat />
    </div>
  );
}
