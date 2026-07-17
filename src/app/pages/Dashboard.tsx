import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router';
import { Plus, Clock, ArrowRight, Layers, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import imgBlueTshirt from 'figma:asset/f00825900c95df312eb3b002c75207b61c243d55.png';
import { productGridClass, productGridStyle } from '../styles/productGrid';
import { builderPath, type ProjectFlowType } from '../lib/projectFlow';
import { DashboardLiveChat } from '../components/DashboardLiveChat';
import { NotificationBell } from '../components/NotificationBell';
import { ProjectActionsMenu } from '../components/ProjectActionsMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';

type DashboardProject = {
  id: string;
  productId: string;
  flowType: ProjectFlowType;
  name: string;
  garmentType: string;
  status: string;
  progress: number;
  lastEdited: string;
  image: string;
  color: string;
  season: string;
};

const INITIAL_PROJECTS: DashboardProject[] = [
  {
    id: '1',
    productId: 'hd-001',
    flowType: 'techpack',
    name: 'Oversized Hoodie',
    garmentType: 'Hoodie',
    status: 'In Progress',
    progress: 65,
    lastEdited: '2 hours ago',
    image: imgBlueTshirt,
    color: '#3B82F6',
    season: 'FW25',
  },
  {
    id: '2',
    productId: 'tr-001',
    flowType: 'packaging',
    name: 'Cargo Pants',
    garmentType: 'Trousers',
    status: 'In Progress',
    progress: 40,
    lastEdited: '5 hours ago',
    image: imgBlueTshirt,
    color: '#10B981',
    season: 'FW25',
  },
  {
    id: '3',
    productId: 'sw-001',
    flowType: 'techpack',
    name: 'Crewneck Sweatshirt',
    garmentType: 'Sweatshirt',
    status: 'Completed',
    progress: 100,
    lastEdited: '1 day ago',
    image: imgBlueTshirt,
    color: '#8B5CF6',
    season: 'SS25',
  },
  {
    id: '4',
    productId: 'ts-001',
    flowType: 'manufacturer',
    name: 'Graphic Tee',
    garmentType: 'T-Shirt',
    status: 'In Progress',
    progress: 25,
    lastEdited: '3 days ago',
    image: imgBlueTshirt,
    color: '#EF4444',
    season: 'SS25',
  },
];

export function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);

  const avgProgress =
    projects.length === 0
      ? 0
      : Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length);
  const completed = projects.filter((p) => p.status === 'Completed').length;
  const inProgress = projects.filter((p) => p.status === 'In Progress').length;

  const duplicateProject = (project: DashboardProject) => {
    const copy: DashboardProject = {
      ...project,
      id: `${project.id}-copy-${Date.now()}`,
      name: `${project.name} (copy)`,
      status: 'In Progress',
      progress: Math.min(project.progress, 95),
      lastEdited: 'Just now',
    };
    setProjects((prev) => [copy, ...prev]);
  };

  return (
    <div
      className="flex min-h-dvh flex-col overflow-x-hidden p-4 sm:p-5 md:p-6"
      style={{
        background: '#0A0A0B',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: '#CC2D24' }}
          >
            <Layers className="h-3.5 w-3.5 text-white" />
          </div>
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: '#ffffff60' }}
          >
            TechPack Studio
          </span>
        </div>
        <div className="hidden lg:flex">
          <NotificationBell />
        </div>
      </div>

      <div className="mb-6">
        <p
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: '#CC2D24' }}
        >
          Overview
        </p>
        <h1
          className="text-xl font-bold tracking-tight sm:text-2xl"
          style={{ color: '#F8F8F7', lineHeight: 1.15 }}
        >
          {user?.name ? `Hey, ${user.name}.` : 'Welcome back.'}
        </h1>
        <p className="mt-1.5 max-w-md text-sm" style={{ color: '#ffffff50', lineHeight: 1.5 }}>
          Build production-ready garment tech packs—faster.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5">
        {[
          { label: 'Total Projects', value: projects.length, sub: 'All time' },
          { label: 'In Progress', value: inProgress, sub: 'Active' },
          { label: 'Completed', value: completed, sub: 'Finished' },
          { label: 'Avg. Progress', value: `${avgProgress}%`, sub: 'Across all' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl px-3.5 py-3"
            style={{ background: '#111113', border: '1px solid #ffffff0d' }}
          >
            <p
              className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.12em]"
              style={{ color: '#ffffff35' }}
            >
              {s.label}
            </p>
            <p className="text-xl font-bold tracking-tight" style={{ color: '#F8F8F7', lineHeight: 1 }}>
              {s.value}
            </p>
            <p className="mt-1 text-[10px]" style={{ color: '#ffffff30' }}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: '#F8F8F7' }}>
            Projects
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: '#ffffff40' }}>
            {projects.length} garments · {inProgress} active
          </p>
        </div>
        <Link
          to="/catalog"
          className="flex shrink-0 items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: '#CC2D24' }}
        >
          Browse catalog
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mb-4 h-px" style={{ background: '#ffffff09' }} />

      <div className={productGridClass} style={productGridStyle}>
        <Link
          to="/catalog"
          className="group flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-transparent p-4 text-center transition-all hover:border-[#CC2D24]/40 hover:bg-[#CC2D24]/[0.06] sm:min-h-[190px]"
        >
          <div
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: '#1A1A1C', border: '1px solid #ffffff10' }}
          >
            <Plus className="h-4 w-4" style={{ color: '#ffffff60' }} />
          </div>
          <p className="text-xs font-semibold" style={{ color: '#ffffff80' }}>
            New project
          </p>
          <p className="mt-1 max-w-[160px] text-[11px] leading-relaxed" style={{ color: '#ffffff35' }}>
            Start a garment and build a tech pack.
          </p>
        </Link>

        {projects.map((project) => {
          const isCompleted = project.status === 'Completed';
          const openTo = builderPath(project.productId, project.flowType);

          return (
            <div
              key={project.id}
              className="group overflow-hidden rounded-xl border border-white/[0.08] bg-[#111113] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14]"
            >
              <div
                className="relative aspect-[16/10] overflow-hidden bg-[#0D0D0F]"
                style={{
                  background:
                    'radial-gradient(circle at 50% 32%, rgba(255,255,255,0.06), transparent 32%), #0D0D0F',
                }}
              >
                <div
                  className="absolute inset-0 z-10"
                  style={{
                    background: `linear-gradient(135deg, ${project.color}22 0%, transparent 60%)`,
                  }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 z-10 h-16"
                  style={{ background: 'linear-gradient(to top, #111113 6%, transparent)' }}
                />
                <div className="absolute inset-0 flex items-start justify-center px-0 pb-1.5 pt-0">
                  <img
                    src={project.image}
                    alt={project.name}
                    className="h-full w-full scale-[1.12] object-contain transition-transform duration-500 group-hover:scale-[1.16]"
                    style={{
                      filter: `hue-rotate(${getHueForColor(project.color)}deg) saturate(0.95)`,
                      objectPosition: 'center top',
                    }}
                  />
                </div>

                <div className="absolute left-2.5 top-2.5 z-20">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={
                      isCompleted
                        ? {
                            background: '#10B98120',
                            color: '#6EE7B7',
                            border: '1px solid #10B98130',
                          }
                        : {
                            background: '#F59E0B18',
                            color: '#FCD34D',
                            border: '1px solid #F59E0B28',
                          }
                    }
                  >
                    {isCompleted ? 'Complete' : 'In progress'}
                  </span>
                </div>

                <div className="absolute right-2.5 top-2.5 z-20">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      background: '#00000050',
                      color: '#ffffff50',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {project.season}
                  </span>
                </div>
              </div>

              <div className="p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className="truncate text-[13px] font-semibold leading-tight"
                      style={{ color: '#F0F0EE' }}
                    >
                      {project.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1" style={{ color: '#ffffff35' }}>
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px]">{project.lastEdited}</span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium"
                    style={{
                      background: '#ffffff07',
                      color: '#ffffff45',
                      border: '1px solid #ffffff0a',
                    }}
                  >
                    {project.garmentType}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-medium" style={{ color: '#ffffff35' }}>
                      Progress
                    </span>
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: isCompleted ? '#6EE7B7' : '#F0F0EE' }}
                    >
                      {project.progress}%
                    </span>
                  </div>
                  <div
                    className="relative h-[3px] w-full overflow-hidden rounded-full"
                    style={{ background: '#ffffff08' }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{
                        width: `${project.progress}%`,
                        background: isCompleted ? '#10B981' : '#CC2D24',
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link to={openTo} className="flex-1">
                    <button
                      type="button"
                      className="h-8 w-full rounded-lg text-[11px] font-semibold tracking-wide text-white transition-all active:scale-[0.98]"
                      style={{ background: '#CC2D24', border: '1px solid #CC2D2460' }}
                    >
                      Open
                    </button>
                  </Link>
                  <ProjectActionsMenu
                    projectName={project.name}
                    openTo={openTo}
                    openLabel="Open in builder"
                    onDuplicate={() => duplicateProject(project)}
                    onDelete={() => setDeleteTarget(project)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between pt-8">
        <p className="text-[10px]" style={{ color: '#ffffff20' }}>
          {projects.length} projects · last updated just now
        </p>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-60"
          style={{ color: '#ffffff30' }}
        >
          <TrendingUp className="h-3 w-3" />
          Analytics
        </button>
      </div>

      <DashboardLiveChat />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this project?"
        description={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? This removes the draft from your dashboard and cannot be undone.`
            : ''
        }
        confirmLabel="Delete project"
        tone="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          toast.success(`Deleted “${deleteTarget.name}”`);
        }}
      />
    </div>
  );
}

function getHueForColor(color: string): number {
  const colorMap: Record<string, number> = {
    '#3B82F6': 0,
    '#10B981': 60,
    '#8B5CF6': -40,
    '#EF4444': 140,
  };
  return colorMap[color] || 0;
}
