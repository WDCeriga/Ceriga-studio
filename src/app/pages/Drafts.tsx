import { useCallback, useEffect, useId, useState } from 'react';
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
import { GarmentFlatIcon, SpecGridTexture } from '../components/studio/GarmentFlatIcon';
import { toast } from 'sonner';

function garmentLabel(garmentType: string): string {
  const map: Record<string, string> = {
    tshirt: 'T-shirt',
    hoodie: 'Hoodie',
    trousers: 'Trousers',
    sweatshirt: 'Sweatshirt',
  };
  return map[garmentType] || garmentType;
}

export function Drafts() {
  const { isAuthenticated, usingSupabase, authReady } = useAuth();
  const [drafts, setDrafts] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !isAuthenticated) {
      setDrafts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDrafts(await listProjects());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load drafts';
      toast.error(message);
      setDrafts([]);
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
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success('Draft deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete draft';
      toast.error(message);
    }
  };

  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="ceriga-page-eyebrow">Saved projects</div>
          <h1 className="ceriga-page-title">My drafts</h1>
          <p className="ceriga-page-sub">Continue working on your saved projects</p>
        </div>
        <Link to="/catalog" className="ceriga-btn-primary shrink-0">
          Create new
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
          <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">Sign in to see drafts</h3>
          <p className="mb-4 text-xs text-[#6B6B72]">Your saved projects sync to your account</p>
          <Link to="/login" className="ceriga-btn-primary">
            Sign in
          </Link>
        </div>
      ) : loading ? (
        <div className="ceriga-card py-16 text-center text-xs text-[#6B6B72]">Loading drafts…</div>
      ) : drafts.length === 0 ? (
        <div className="ceriga-card py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-[#45454B]" />
          <h3 className="mb-2 text-base font-semibold text-[#F0EEEE]">No drafts yet</h3>
          <p className="mb-4 text-xs text-[#6B6B72]">Start building and hit Save to create your first draft</p>
          <Link to="/catalog" className="ceriga-btn-primary">
            Browse catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onDelete={() => void handleDelete(draft.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  onDelete,
}: {
  draft: ProjectListItem;
  onDelete: () => void;
}) {
  const gridId = useId().replace(/:/g, '');
  const label = garmentLabel(draft.garment_type);
  const isComplete = draft.progress >= 100;

  return (
    <div className="ceriga-card flex flex-col overflow-hidden">
      <div className="relative h-[140px] border-b border-[#252528] bg-[#111113]">
        <SpecGridTexture patternId={`draft-grid-${gridId}`} />
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between">
          <span className="ceriga-mono rounded-[3px] border border-[#5A4530] bg-[#2A2218] px-1.5 py-[3px] text-[10px] uppercase tracking-[0.06em] text-[#E8A868]">
            {label}
          </span>
          <button
            type="button"
            title="Delete draft"
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#252528] bg-[#09090B]/70 text-[#8A8A90] hover:text-[#F0EEEE]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="absolute inset-0 z-[1] flex items-center justify-center p-7">
          <GarmentFlatIcon type={label} className="max-h-full max-w-[80px]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <h3 className="mb-1 truncate text-[15px] font-semibold text-[#F0EEEE]">{draft.name}</h3>
        <p className="mb-3 text-[11px] text-[#6B6B72]">
          Step {draft.current_step} · {formatRelativeTime(draft.updated_at)}
        </p>

        <div className="mb-1.5 flex justify-between text-[11px] text-[#8A8A90]">
          <span className="ceriga-mono tracking-[0.04em]">PROGRESS</span>
          <span className="ceriga-mono" style={{ color: isComplete ? '#7FA888' : '#CC2D24' }}>
            {draft.progress}%
          </span>
        </div>
        <div className="mb-3.5 h-[3px] overflow-hidden rounded-sm bg-[#252528]">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${draft.progress}%`,
              background: isComplete ? '#7FA888' : '#CC2D24',
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(0,0,0,0.25) 5px, rgba(0,0,0,0.25) 6px)',
            }}
          />
        </div>

        <Link to={builderPath(draft.product_id, draft.flow_type, draft.id)} className="mt-auto">
          <span className="ceriga-btn-ghost">
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
