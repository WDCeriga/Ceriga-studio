import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  Building2,
  Factory,
  LayoutDashboard,
  Package,
  Palette,
  Rocket,
  ShoppingBag,
  Sparkles,
  Users,
  FileText,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const STORAGE_DONE = 'ceriga_onboarding_done';
const STORAGE_PERSONA = 'ceriga_persona';

type PersonaId = 'brand' | 'manufacturer' | 'agency' | 'creator';

const personas: Array<{
  id: PersonaId;
  label: string;
  hint: string;
  icon: typeof Building2;
}> = [
  {
    id: 'brand',
    label: 'Fashion brand or in-house team',
    hint: 'Seasonal drops, multi-SKU lines, factory coordination',
    icon: Building2,
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer or supplier',
    hint: 'Receiving clearer specs from clients; fewer back-and-forth samples',
    icon: Factory,
  },
  {
    id: 'agency',
    label: 'Agency or freelancer',
    hint: 'Client work, white-label deliverables, fast iterations',
    icon: Users,
  },
  {
    id: 'creator',
    label: 'Creator or DTC label',
    hint: 'Small runs, packaging-first launches, proof before you scale',
    icon: Rocket,
  },
];

const personaCopy: Record<
  PersonaId,
  { headline: string; bullets: string[]; studioTip: string }
> = {
  brand: {
    headline: 'Keep every style documented the same way',
    bullets: [
      'Use the catalog as a single source of truth for silhouettes and options.',
      'Share PDF exports that already include measurements and callouts.',
      'Split packaging work from garment specs when vendors move at different speeds.',
      'Track orders in one place so production and design stay aligned.',
      'Reuse last season’s measurements as a baseline for faster sign-off.',
    ],
    studioTip: 'Start with Dashboard → New project, or Studio → Design tech pack.',
  },
  manufacturer: {
    headline: 'Help partners send specs you can actually quote',
    bullets: [
      'Ask customers to export from Ceriga so art, dimensions, and materials align.',
      'Use Orders to mirror how brands track status on your side.',
      'Packaging-only mode reduces noise when the job is bags and labels only.',
      'Fewer “what does this mean?” threads when callouts match the flat sketch.',
      'Same file format from many clients lowers onboarding cost for your team.',
    ],
    studioTip: 'Share Studio with accounts teams — packaging skips garment selection entirely.',
  },
  agency: {
    headline: 'Deliverables that look as professional as your creative',
    bullets: [
      'Reuse garment templates across clients while keeping each spec isolated.',
      'Drafts autosave so context-switching between accounts is safe.',
      'Pro tier unlocks branding on exports when you are ready.',
      'Hand clients a link to Orders so they stop asking for status by email.',
      'Packaging and full tech packs can run in parallel for the same brand.',
    ],
    studioTip: 'Try Studio → Order from manufacturers when the client already has a tech pack.',
  },
  creator: {
    headline: 'Validate production before you commit cash',
    bullets: [
      'Build one hero style in the builder, then iterate colourways from drafts.',
      'Design packaging before your first bulk order ships.',
      'Use clear MOQ and lead-time cues from the catalog when planning drops.',
      'Export a sample pack to sanity-check with a factory before you scale.',
      'Packaging-only path is ideal when garments are stock but bags need art.',
    ],
    studioTip: 'Packaging is under Studio — open it anytime without picking a garment.',
  },
};

const workspaceRows = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Overview of projects, progress, and quick entry to anything in flight.',
  },
  {
    icon: Sparkles,
    title: 'Studio',
    body: 'Pick a workflow: full tech pack, packaging-only, or manufacturer upload.',
  },
  {
    icon: ShoppingBag,
    title: 'Catalog',
    body: 'Garment blueprints with MOQ and lead-time context before you configure.',
  },
  {
    icon: FileText,
    title: 'Drafts',
    body: 'Saved builds — continue measurements, prints, or packaging anytime.',
  },
  {
    icon: Package,
    title: 'Orders',
    body: 'Submitted jobs, statuses, and totals once you move past delivery.',
  },
];

const TOTAL_STEPS = 5;

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<PersonaId | null>(null);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_DONE) === '1') {
        navigate('/dashboard', { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const copy = useMemo(() => (persona ? personaCopy[persona] : null), [persona]);

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_DONE, '1');
      if (persona) localStorage.setItem(STORAGE_PERSONA, persona);
    } catch {
      /* ignore */
    }
    navigate('/dashboard', { replace: true });
  };

  const toggleFocus = (key: string) => {
    setFocusAreas((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div
      className="flex min-h-dvh flex-col overflow-x-hidden bg-[#0A0A0B] text-[#F2F0EC]"
      style={{ fontFamily: "'DM Sans', sans-serif", paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#CC2D24]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/70">
            Ceriga
          </span>
        </div>
        <button
          type="button"
          onClick={finish}
          className="text-[10px] font-semibold uppercase tracking-wider text-white/40 transition-colors hover:text-white/70"
        >
          Skip
        </button>
      </header>

      <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 md:mx-auto md:max-w-[600px] md:py-12">
        {step === 0 && (
          <div className="flex flex-1 flex-col justify-center">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">Welcome</p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-[clamp(1.75rem,5vw,2.35rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
              Production specs, without the spreadsheet chaos
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/50 sm:text-base">
              Ceriga turns your garment decisions into factory-ready tech packs, optional packaging artwork, and a single
              thread from draft to order.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { t: 'Visual builder', d: 'Flat-lay updates as you choose fabrics, trims, and graphics.' },
                { t: 'Exports that match reality', d: 'Measurements, callouts, and print zones manufacturers expect.' },
                { t: 'Flexible workflows', d: 'Full styles, packaging-only, or upload-and-order paths.' },
                { t: 'Built for handoff', d: 'Drafts, orders, and delivery tie together in one studio.' },
              ].map((card) => (
                <div
                  key={card.t}
                  className="rounded-[14px] border border-white/[0.08] bg-[#111113] p-4 text-left sm:p-4"
                >
                  <p className="text-xs font-semibold text-[#F2F0EC]">{card.t}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/42">{card.d}</p>
                </div>
              ))}
            </div>
            <Button
              type="button"
              className="mt-10 h-11 w-full bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90 sm:w-auto sm:px-10"
              onClick={() => setStep(1)}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">Perspective</p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold tracking-tight sm:text-2xl">
              Who are you building for?
            </h1>
            <p className="mt-2 text-sm text-white/45">
              We will tune tips and language. You can change this later in your head — we only store it locally.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {personas.map(({ id, label, hint, icon: Icon }) => {
                const selected = persona === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPersona(id)}
                    className={`flex w-full gap-4 rounded-[14px] border p-4 text-left transition-all sm:p-5 ${
                      selected
                        ? 'border-[#CC2D24]/50 bg-[#CC2D24]/[0.08]'
                        : 'border-white/[0.08] bg-[#111113] hover:border-white/[0.14]'
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                        selected ? 'border-[#CC2D24]/40 bg-black/30 text-[#CC2D24]' : 'border-white/10 bg-black/40 text-white/50'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#F2F0EC]">{label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-white/40">{hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
                What do you want to tackle first? (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {['Tech packs', 'Packaging & labels', 'Factory orders', 'Team collaboration'].map((key) => {
                  const on = focusAreas.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFocus(key)}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        on
                          ? 'border-[#CC2D24]/50 bg-[#CC2D24]/15 text-white'
                          : 'border-white/12 bg-black/30 text-white/45 hover:border-white/20'
                      }`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-10 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="h-10 border-white/15 text-white/80 hover:bg-white/5"
                onClick={() => setStep(0)}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!persona}
                className="h-10 bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90 disabled:opacity-40"
                onClick={() => setStep(2)}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && persona && copy && (
          <div className="flex flex-1 flex-col">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">Tailored to you</p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold tracking-tight sm:text-2xl">
              {copy.headline}
            </h1>
            <ul className="mt-6 max-h-[min(52vh,420px)] space-y-3 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible">
              {copy.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-sm leading-relaxed text-white/55">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CC2D24]" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-[14px] border border-[#CC2D24]/25 bg-[#CC2D24]/[0.06] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#CC2D24]/90">Studio tip</p>
              <p className="mt-2 text-sm text-white/70">{copy.studioTip}</p>
            </div>

            <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="h-10 border-white/15 text-white/80 hover:bg-white/5"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="h-10 bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90"
                onClick={() => setStep(3)}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">Navigation</p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold tracking-tight sm:text-2xl">
              Where everything lives
            </h1>
            <p className="mt-2 text-sm text-white/45">
              The sidebar is your home base. Here is what each area is for — you can explore in any order.
            </p>
            <div className="mt-8 space-y-3">
              {workspaceRows.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-[14px] border border-white/[0.08] bg-[#111113] p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-[#CC2D24]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F2F0EC]">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/45">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[14px] border border-white/[0.08] bg-black/25 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Reminder</p>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Settings and log out live at the bottom of the sidebar. Packaging never requires choosing a garment first
                — open it straight from Studio.
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="h-10 border-white/15 text-white/80 hover:bg-white/5"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="h-10 bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90"
                onClick={() => setStep(4)}
              >
                Almost there
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-1 flex-col justify-center">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">Ready</p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold tracking-tight sm:text-2xl">
              You are set to build
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              We saved your perspective locally to improve future prompts in the app. When you are unsure what to open
              next, start from Studio — it lists every workflow in one place.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/55">
              <li className="flex gap-2">
                <span className="text-[#CC2D24]">✓</span>
                Browse the catalog or jump into packaging-only from Studio.
              </li>
              <li className="flex gap-2">
                <span className="text-[#CC2D24]">✓</span>
                Drafts autosave — close the tab anytime.
              </li>
              <li className="flex gap-2">
                <span className="text-[#CC2D24]">✓</span>
                Use Orders after delivery to track spend and status.
              </li>
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="h-10 border-white/15 text-white/80 hover:bg-white/5"
                onClick={() => setStep(3)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90 sm:max-w-xs sm:flex-none sm:px-12"
                onClick={finish}
              >
                Enter studio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-1.5 pb-6 pt-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: step === i ? 22 : 6,
              background: step === i ? '#CC2D24' : '#ffffff18',
            }}
          />
        ))}
      </div>
    </div>
  );
}
