import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router';
import { Plus, ArrowRight } from 'lucide-react';
import { builderPath, type ProjectFlowType } from '../lib/projectFlow';
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
  useCerigaTranslation();

  return (
    <div
      className={cn('min-w-0 flex-1 px-5 py-4', !last && 'border-b border-[#252528] sm:border-b-0 sm:border-r')}
    >
      <div className="ceriga-mono mb-2 text-[11px] uppercase tracking-[0.08em] text-[#8A8A90]">
        {cerigaTranslateLabel(label)}
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
  useCerigaTranslation();

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
            {cerigaTranslateLabel(project.status)}
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
          <span className="ceriga-mono tracking-[0.04em]">{cerigaTranslate("interface.text_e0d0adc74c8be52a")}</span>
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
          <span className="ceriga-btn-ghost">{cerigaTranslate("interface.text_ed077f3d8125d60d")}{" "}<ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function Dashboard() {
  useCerigaTranslation();

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
      toast.error(cerigaTranslateLabel(message));
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
          <span className="ceriga-mono text-[12px] uppercase tracking-[0.08em] text-[#8A8A90]">{cerigaTranslate("nav.home")}</span>
        </div>
        <NotificationBell className="h-8 w-8 rounded-md border border-[#2E2E32] bg-transparent shadow-none backdrop-blur-0 hover:border-[#3A3A40] hover:bg-[#1C1C1E] [&_svg]:size-[15px] [&_svg]:text-[#A3A3A8]" />
      </div>

      <div className="mb-7">
        <div className="ceriga-page-eyebrow">{cerigaTranslate("nav.overview")}</div>
        <h1 className="ceriga-page-title">
          {user?.name ? cerigaTranslate("interface.text_228a061f5d460541",{value0:(user.name)}) : cerigaTranslate("interface.text_dfdbca16342fc231")}
        </h1>
        <p className="ceriga-page-sub">{cerigaTranslate("interface.text_1ffa7aa5e1c0791a")}</p>
      </div>

      <div className="mb-9 flex flex-col overflow-hidden rounded-[6px] border border-[#252528] sm:flex-row">
        <StatField label={cerigaTranslate("interface.text_93e95ffeaa7c76af")} value={projects.length} sub="All time" />
        <StatField label={cerigaTranslate("interface.text_c1f88e9d6c4145cf")} value={inProgress} sub="Active" />
        <StatField label={cerigaTranslate("orders.completed")} value={completed} sub="Finished" />
        <StatField label={cerigaTranslate("interface.text_c14dd0abe0f56ea0")} value={`${avgProgress}%`} sub="Across all" last />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="text-base font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_1c564b3ce9f0c801")}</div>
          <div className="mt-0.5 text-[12.5px] text-[#6B6B72]">
            {projects.length === 0
              ? cerigaTranslate("interface.text_96e97dcf07caf68c")
              : cerigaTranslate("interface.text_fac1e30a7eacd86b",{value0:(Math.min(4, projects.length)),value1:(projects.length)})}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-[13px] text-[#A3A3A8] hover:text-[#F0EEEE]"
            data-ai-target="dashboard-view-all-projects"
            data-ai-label="View all projects"
          >{cerigaTranslate("interface.text_30a64216eaeac5d3")}{" "}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/create"
            className="inline-flex items-center gap-1 text-[13px] text-[#E5534A] hover:text-[#CC2D24]"
            data-ai-target="dashboard-new-project-link"
            data-ai-label="New project link"
          >{cerigaTranslate("interface.text_a41eb2bf7245d3bc")}{" "}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Link
          to="/create"
          className="flex min-h-[280px] flex-col items-center justify-center gap-2.5 rounded-[6px] border border-dashed border-[#333338] px-6 text-center transition-colors hover:border-[#3A3A40] hover:bg-[#1C1C1E]"
          data-ai-target="start-project-button"
          data-ai-label="Start a new project"
        >
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#3A3A40]">
            <Plus className="h-4 w-4 text-[#8A8A90]" />
          </div>
          <div className="text-[13.5px] font-medium text-[#F0EEEE]">{cerigaTranslate("interface.text_a41eb2bf7245d3bc")}</div>
          <div className="max-w-[200px] text-[11.5px] leading-relaxed text-[#6B6B72]">{cerigaTranslate("interface.text_fd007d9889e89fb1")}</div>
        </Link>

        {projects.slice(0, 4).map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {!usingSupabase ? (
        <p className="mt-6 text-xs text-[#E8A868]/90">{cerigaTranslate("interface.text_0d2cbb15ba281f9d")}</p>
      ) : !isAuthenticated ? (
        <p className="mt-6 text-xs text-[#6B6B72]">
          <Link to="/login" className="text-[#E5534A] hover:underline">{cerigaTranslate("interface.text_bfd402b2f6f38125")}</Link>{' '}{cerigaTranslate("interface.text_1e50eb997de42322")}</p>
      ) : loading ? (
        <p className="mt-6 text-xs text-[#6B6B72]">{cerigaTranslate("interface.text_6970a1ced73ddb58")}</p>
      ) : projects.length === 0 ? (
        <p className="mt-6 text-[12px] text-[#6B6B72]">{cerigaTranslate("interface.text_4171fb38ece5ea64")}{' '}
          <Link to="/create" className="text-[#E5534A] hover:underline">{cerigaTranslate("interface.text_2acb54256c17fd61")}</Link>{' '}{cerigaTranslate("interface.text_305f69df00e9d424")}</p>
      ) : (
        <p className="mt-6 text-[11.5px] text-[#45454B]">
          {projects.length}{" "}{cerigaTranslate("interface.plural_noun_244210e48437b655",{count:Number(projects.length)})} ·{' '}
          <Link to="/projects" className="text-[#8A8A90] hover:text-[#F0EEEE]">{cerigaTranslate("interface.text_30a64216eaeac5d3")}</Link>
        </p>
      )}
    </div>
  );
}
