import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { FileEdit, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { productGridClass, productGridStyle } from '../styles/productGrid';
import { builderPath } from '../lib/projectFlow';
import {
  deleteProject,
  formatRelativeTime,
  listProjects,
  type ProjectListItem,
} from '../lib/projectsDb';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

function garmentLabel(garmentType: string): string {
  const map: Record<string, string> = {
    tshirt: 'T-Shirt',
    hoodie: 'Hoodie',
    trousers: 'Trousers',
    sweatshirt: 'Sweatshirt',
  };
  return map[garmentType] || garmentType;
}

function accentForGarment(garmentType: string): string {
  const map: Record<string, string> = {
    tshirt: '#3B82F6',
    hoodie: '#8B5CF6',
    trousers: '#10B981',
    sweatshirt: '#EF4444',
  };
  return map[garmentType] || '#CC2D24';
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

      {!usingSupabase ? (
        <div className="rounded-[14px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          Cloud database is not configured. Add <code className="text-amber-50">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-amber-50">VITE_SUPABASE_ANON_KEY</code> to <code className="text-amber-50">.env</code>, then
          run <code className="text-amber-50">supabase/schema.sql</code> in the Supabase SQL editor.
        </div>
      ) : !isAuthenticated ? (
        <div className="rounded-[14px] border border-white/10 bg-white/5 py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <h3 className="mb-2 text-base font-bold text-white">Sign in to see drafts</h3>
          <p className="mb-4 text-xs text-white/60">Your saved projects sync to your account</p>
          <Button asChild className="bg-[#CC2D24] text-[10px] font-semibold hover:bg-[#CC2D24]/90">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : loading ? (
        <div className="rounded-[14px] border border-white/10 bg-white/5 py-16 text-center text-xs text-white/50">
          Loading drafts…
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-[14px] border border-white/10 bg-white/5 py-16 text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <h3 className="mb-2 text-base font-bold text-white">No drafts yet</h3>
          <p className="mb-4 text-xs text-white/60">Start building and hit Save to create your first draft</p>
          <Button asChild className="bg-[#CC2D24] text-[10px] font-semibold hover:bg-[#CC2D24]/90">
            <Link to="/catalog">Browse catalog</Link>
          </Button>
        </div>
      ) : (
        <div className={productGridClass} style={productGridStyle}>
          {drafts.map((draft) => {
            const color = accentForGarment(draft.garment_type);
            const stepsGuess = Math.max(1, Math.round((draft.progress / 100) * 12));
            return (
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
                      background: `linear-gradient(135deg, ${color}33 0%, transparent 60%)`,
                    }}
                  />
                  <div className="absolute left-2.5 top-2.5 z-20 flex h-6 min-w-[52px] items-center justify-center rounded-full bg-black/55 px-2.5 backdrop-blur-sm">
                    <span className="text-center text-[7px] font-bold uppercase leading-none tracking-wider text-white/90">
                      {garmentLabel(draft.garment_type)}
                    </span>
                  </div>
                  <div className="absolute right-2 top-2 z-20">
                    <button
                      type="button"
                      title="Delete draft"
                      onClick={() => void handleDelete(draft.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-colors hover:bg-black/75"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-white/80" />
                    </button>
                  </div>
                  <div className="absolute inset-0 z-[1] flex items-center justify-center">
                    <MoreVertical className="h-8 w-8 text-white/10" aria-hidden />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                  <h3 className="mb-1 text-[13px] font-semibold leading-snug tracking-tight text-[#F2F0EC]">
                    {draft.name}
                  </h3>
                  <p className="mb-3 text-[11px] text-white/45">
                    Step {draft.current_step} · ~{stepsGuess} of 12 steps
                  </p>

                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-white/55">
                      <span>Progress</span>
                      <span>{draft.progress}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-[#CC2D24] transition-all"
                        style={{ width: `${draft.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-white/40">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{formatRelativeTime(draft.updated_at)}</span>
                    </div>

                    <Button
                      asChild
                      size="sm"
                      className="h-8 bg-[#CC2D24] px-3 text-[10px] font-semibold hover:bg-[#CC2D24]/90"
                    >
                      <Link to={builderPath(draft.product_id, draft.flow_type, draft.id)}>
                        Continue
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
