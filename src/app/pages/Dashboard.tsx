import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router";
import {
  Plus,
  MoreVertical,
  Clock,
  ArrowRight,
  Layers,
  TrendingUp,
} from "lucide-react";
import imgBlueTshirt from "figma:asset/f00825900c95df312eb3b002c75207b61c243d55.png";
import { productGridClass, productGridStyle } from "../styles/productGrid";
import { builderPath, type ProjectFlowType } from "../lib/projectFlow";
import { DashboardLiveChat } from "../components/DashboardLiveChat";
import { NotificationBell } from "../components/NotificationBell";

export function Dashboard() {
  const { user } = useAuth();

  const projects: Array<{
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
  }> = [
    {
      id: "1",
      productId: "hd-001",
      flowType: "techpack",
      name: "Oversized Hoodie",
      garmentType: "Hoodie",
      status: "In Progress",
      progress: 65,
      lastEdited: "2 hours ago",
      image: imgBlueTshirt,
      color: "#3B82F6",
      season: "FW25",
    },
    {
      id: "2",
      productId: "tr-001",
      flowType: "packaging",
      name: "Cargo Pants",
      garmentType: "Trousers",
      status: "In Progress",
      progress: 40,
      lastEdited: "5 hours ago",
      image: imgBlueTshirt,
      color: "#10B981",
      season: "FW25",
    },
    {
      id: "3",
      productId: "sw-001",
      flowType: "techpack",
      name: "Crewneck Sweatshirt",
      garmentType: "Sweatshirt",
      status: "Completed",
      progress: 100,
      lastEdited: "1 day ago",
      image: imgBlueTshirt,
      color: "#8B5CF6",
      season: "SS25",
    },
    {
      id: "4",
      productId: "ts-001",
      flowType: "manufacturer",
      name: "Graphic Tee",
      garmentType: "T-Shirt",
      status: "In Progress",
      progress: 25,
      lastEdited: "3 days ago",
      image: imgBlueTshirt,
      color: "#EF4444",
      season: "SS25",
    },
  ];

  const avgProgress = Math.round(
    projects.reduce((acc, p) => acc + p.progress, 0) /
      projects.length,
  );
  const completed = projects.filter(
    (p) => p.status === "Completed",
  ).length;
  const inProgress = projects.filter(
    (p) => p.status === "In Progress",
  ).length;

  return (
    <div
      className="min-h-dvh overflow-x-hidden p-4 sm:p-6 md:p-8"
      style={{
        background: "#0A0A0B",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Top Bar — notifications aligned with title row (desktop) */}
      <div className="mb-8 flex flex-col gap-4 sm:mb-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "#CC2D24" }}
            >
              <Layers className="h-4 w-4 text-white" />
            </div>
            <span
              className="text-sm font-semibold tracking-widest uppercase"
              style={{
                color: "#ffffff60",
                letterSpacing: "0.16em",
              }}
            >
              TechPack Studio
            </span>
          </div>
          <div className="hidden lg:flex">
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Hero Welcome */}
      <div className="mb-10">
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-[0.22em]"
          style={{ color: "#CC2D24" }}
        >
          Overview
        </p>
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          style={{
            color: "#F8F8F7",
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.08,
          }}
        >
          {user?.name ? `Hey, ${user.name}.` : "Welcome back."}
        </h1>
        <p
          className="mt-3 text-base"
          style={{
            color: "#ffffff50",
            maxWidth: 480,
            lineHeight: 1.65,
          }}
        >
          Build production-ready garment tech packs—faster.
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Total Projects",
            value: projects.length,
            sub: "All time",
          },
          {
            label: "In Progress",
            value: inProgress,
            sub: "Active",
          },
          {
            label: "Completed",
            value: completed,
            sub: "Finished",
          },
          {
            label: "Avg. Progress",
            value: `${avgProgress}%`,
            sub: "Across all",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-5 transition-all"
            style={{
              background: "#111113",
              border: "1px solid #ffffff0d",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-widest mb-3"
              style={{
                color: "#ffffff35",
                letterSpacing: "0.14em",
              }}
            >
              {s.label}
            </p>
            <p
              className="text-3xl font-bold tracking-tight"
              style={{ color: "#F8F8F7", lineHeight: 1 }}
            >
              {s.value}
            </p>
            <p
              className="mt-2 text-xs"
              style={{ color: "#ffffff30" }}
            >
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Section Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ color: "#F8F8F7" }}
          >
            Projects
          </h2>
          <p
            className="mt-0.5 text-sm"
            style={{ color: "#ffffff40" }}
          >
            {projects.length} garments · {inProgress} active
          </p>
        </div>
        <Link
          to="/catalog"
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "#CC2D24" }}
        >
          Browse catalog
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div
        className="mb-6"
        style={{ height: "1px", background: "#ffffff09" }}
      />

      {/* Projects Grid */}
      <div className={productGridClass} style={productGridStyle}>
        {/* New Project Tile */}
        <Link
          to="/catalog"
          className="group flex min-h-[220px] flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.12] bg-transparent p-6 text-center transition-all hover:border-[#CC2D24]/40 hover:bg-[#CC2D24]/[0.06] sm:min-h-[240px]"
        >
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-all"
            style={{
              background: "#1A1A1C",
              border: "1px solid #ffffff10",
            }}
          >
            <Plus
              className="h-5 w-5"
              style={{ color: "#ffffff60" }}
            />
          </div>
          <p
            className="text-sm font-semibold"
            style={{ color: "#ffffff80" }}
          >
            New project
          </p>
          <p
            className="mt-1.5 text-xs leading-relaxed"
            style={{ color: "#ffffff35", maxWidth: 180 }}
          >
            Start a garment and build a tech pack from scratch.
          </p>
        </Link>

        {/* Project Cards */}
        {projects.map((project) => {
          const isCompleted = project.status === "Completed";

          return (
            <div
              key={project.id}
              className="group overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14]"
            >
              {/* Image Area */}
              <div
                className="relative aspect-[3/2] overflow-hidden bg-[#0D0D0F]"
                style={{
                  background:
                    "radial-gradient(circle at 50% 32%, rgba(255,255,255,0.06), transparent 32%), #0D0D0F",
                }}
              >
                <div
                  className="absolute inset-0 z-10"
                  style={{
                    background: `linear-gradient(135deg, ${project.color}22 0%, transparent 60%)`,
                  }}
                />

                <div
                  className="absolute bottom-0 left-0 right-0 z-10 h-24"
                  style={{
                    background:
                      "linear-gradient(to top, #111113 6%, transparent)",
                  }}
                />

                <div className="absolute inset-0 flex items-start justify-center px-0 pt-0 pb-2">
                  <img
                    src={project.image}
                    alt={project.name}
                    className="h-full w-full object-contain scale-[1.18] transition-transform duration-500 group-hover:scale-[1.22]"
                    style={{
                      filter: `hue-rotate(${getHueForColor(project.color)}deg) saturate(0.95)`,
                      objectPosition: "center top",
                    }}
                  />
                </div>

                <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
                  <span
                    className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={
                      isCompleted
                        ? {
                            background: "#10B98120",
                            color: "#6EE7B7",
                            border: "1px solid #10B98130",
                          }
                        : {
                            background: "#F59E0B18",
                            color: "#FCD34D",
                            border: "1px solid #F59E0B28",
                          }
                    }
                  >
                    {isCompleted ? "Complete" : "In progress"}
                  </span>
                </div>

                <div className="absolute right-3 top-3 z-20">
                  <span
                    className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: "#00000050",
                      color: "#ffffff50",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {project.season}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3
                      className="text-sm font-semibold leading-tight"
                      style={{ color: "#F0F0EE" }}
                    >
                      {project.name}
                    </h3>
                    <div
                      className="mt-1 flex items-center gap-1"
                      style={{ color: "#ffffff35" }}
                    >
                      <Clock className="h-3 w-3" />
                      <span className="text-[11px]">
                        {project.lastEdited}
                      </span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium"
                    style={{
                      background: "#ffffff07",
                      color: "#ffffff45",
                      border: "1px solid #ffffff0a",
                    }}
                  >
                    {project.garmentType}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: "#ffffff35" }}
                    >
                      Progress
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{
                        color: isCompleted
                          ? "#6EE7B7"
                          : "#F0F0EE",
                      }}
                    >
                      {project.progress}%
                    </span>
                  </div>
                  <div
                    className="relative h-[3px] w-full overflow-hidden rounded-full"
                    style={{ background: "#ffffff08" }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${project.progress}%`,
                        background: isCompleted
                          ? "#10B981"
                          : "#CC2D24",
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={builderPath(project.productId, project.flowType)}
                    className="flex-1"
                  >
                    <button
                      className="h-9 w-full rounded-xl text-xs font-semibold tracking-wide text-white transition-all active:scale-95"
                      style={{
                        background: "#CC2D24",
                        border: "1px solid #CC2D2460",
                      }}
                    >
                      Open
                    </button>
                  </Link>

                  <button
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all hover:text-white"
                    style={{
                      background: "#ffffff05",
                      border: "1px solid #ffffff0a",
                      color: "#ffffff35",
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 flex items-center justify-between">
        <p className="text-xs" style={{ color: "#ffffff20" }}>
          {projects.length} projects · last updated just now
        </p>
        <button
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-60"
          style={{ color: "#ffffff30" }}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Analytics
        </button>
      </div>

      <DashboardLiveChat />
    </div>
  );
}

function getHueForColor(color: string): number {
  const colorMap: Record<string, number> = {
    "#3B82F6": 0,
    "#10B981": 60,
    "#8B5CF6": -40,
    "#EF4444": 140,
  };
  return colorMap[color] || 0;
}