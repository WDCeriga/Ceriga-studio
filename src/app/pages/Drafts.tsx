import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { FileEdit, Clock, MoreVertical } from "lucide-react";
import imgBlueTshirt from "figma:asset/f00825900c95df312eb3b002c75207b61c243d55.png";
import { productGridClass, productGridStyle } from "../styles/productGrid";
import { builderPath, type ProjectFlowType } from "../lib/projectFlow";

const mockDrafts: Array<{
  id: string;
  productName: string;
  garmentType: string;
  lastEdited: string;
  completionPercentage: number;
  stepsCompleted: number;
  totalSteps: number;
  productId: string;
  flowType: ProjectFlowType;
  image: string;
  color: string;
}> = [
  {
    id: 'draft-1',
    productName: 'Premium Cotton T-Shirt',
    garmentType: 'T-Shirt',
    lastEdited: '2 hours ago',
    completionPercentage: 70,
    stepsCompleted: 7,
    totalSteps: 12,
    productId: 'ts-001',
    flowType: 'techpack',
    image: imgBlueTshirt,
    color: '#3B82F6',
  },
  {
    id: 'draft-2',
    productName: 'Classic Pullover Hoodie',
    garmentType: 'Hoodie',
    lastEdited: '1 day ago',
    completionPercentage: 40,
    stepsCompleted: 4,
    totalSteps: 12,
    productId: 'hd-001',
    flowType: 'packaging',
    image: imgBlueTshirt,
    color: '#8B5CF6',
  },
  {
    id: 'draft-3',
    productName: 'Performance Joggers',
    garmentType: 'Trousers',
    lastEdited: '3 days ago',
    completionPercentage: 90,
    stepsCompleted: 9,
    totalSteps: 12,
    productId: 'tr-001',
    flowType: 'manufacturer',
    image: imgBlueTshirt,
    color: '#10B981',
  },
];

export function Drafts() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0C0C0D] px-4 py-5 sm:px-5 sm:py-6 md:px-7 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#CC2D24]">
            Saved projects
          </div>
          <h1 className="mb-2 font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold uppercase leading-tight tracking-[-0.03em] text-[#F2F0EC] sm:text-2xl">
            My drafts
          </h1>
          <p className="max-w-[500px] text-xs leading-relaxed text-white/55">
            Continue working on your saved projects
          </p>
        </div>

        <Button
          asChild
          className="h-9 w-full shrink-0 bg-[#CC2D24] text-[10px] font-semibold hover:bg-[#CC2D24]/90 sm:h-8 sm:w-auto"
        >
          <Link to="/catalog">Create new</Link>
        </Button>
      </div>

      {mockDrafts.length === 0 ? (
        <div className="rounded-[14px] border border-white/10 bg-white/5 py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <h3 className="mb-2 text-base font-bold text-white">No drafts yet</h3>
          <p className="mb-4 text-xs text-white/60">Start building your first custom garment</p>
          <Button asChild className="bg-[#CC2D24] text-[10px] font-semibold hover:bg-[#CC2D24]/90">
            <Link to="/catalog">Browse catalog</Link>
          </Button>
        </div>
      ) : (
        <div className={productGridClass} style={productGridStyle}>
          {mockDrafts.map((draft) => (
            <div
              key={draft.id}
              className="group flex flex-col overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113] transition-all duration-200 hover:border-white/[0.14]"
            >
              <div
                className="relative aspect-[3/2] overflow-hidden bg-[#0D0D0F]"
                style={{
                  background:
                    'radial-gradient(circle at 50% 32%, rgba(255,255,255,0.06), transparent 32%), #0D0D0F',
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 z-10"
                  style={{
                    background: `linear-gradient(135deg, ${draft.color}22 0%, transparent 60%)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-20 bg-gradient-to-t from-[#111113]/85 to-transparent sm:h-24"
                />

                <div className="absolute inset-0 z-[1] flex items-start justify-center px-0 pb-2 pt-0">
                  <img
                    src={draft.image}
                    alt={draft.productName}
                    className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.08] sm:scale-[1.06]"
                    style={{
                      filter: `hue-rotate(${getHueForColor(draft.color)}deg) saturate(0.95)`,
                      objectPosition: 'center top',
                    }}
                  />
                </div>

                <div className="absolute left-2.5 top-2.5 z-20 flex h-6 min-w-[52px] items-center justify-center rounded-full bg-black/55 px-2.5 backdrop-blur-sm">
                  <span className="text-center text-[7px] font-bold uppercase leading-none tracking-wider text-white/90">
                    {draft.garmentType}
                  </span>
                </div>

                <div className="absolute right-2 top-2 z-20">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-colors hover:bg-black/75"
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                <h3 className="mb-1 text-[13px] font-semibold leading-snug tracking-tight text-[#F2F0EC]">
                  {draft.productName}
                </h3>
                <p className="mb-3 text-[11px] text-white/45">
                  {draft.stepsCompleted} of {draft.totalSteps} steps
                </p>

                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-white/55">
                    <span>Progress</span>
                    <span>{draft.completionPercentage}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-[#CC2D24] transition-all"
                      style={{ width: `${draft.completionPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-white/40">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{draft.lastEdited}</span>
                  </div>

                  <Button
                    asChild
                    size="sm"
                    className="h-8 bg-[#CC2D24] px-3 text-[10px] font-semibold hover:bg-[#CC2D24]/90"
                  >
                    <Link to={builderPath(draft.productId, draft.flowType)}>Continue</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
