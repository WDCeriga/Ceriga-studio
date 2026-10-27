import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  Factory,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { DeleteRecordButton } from '../../components/DeleteRecordButton';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';
import { cn } from '../../components/ui/utils';
import {
  createManufacturerInvite,
  getStoredInvites,
  deleteStoredInvite,
  confirmAndActivateManufacturer,
  type StoredInvite,
} from '../../data/manufacturerInvites';

const RED = '#CC2D24';
const AMBER = '#F59E0B';

const chartTooltipStyle = {
  background: '#161618',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#fff',
};

const axisProps = {
  stroke: 'rgba(255,255,255,0.35)',
  fontSize: 11,
  tickLine: false as const,
  axisLine: false as const,
};

const STATUS_STYLE: Record<'active' | 'paused' | 'onboarding', string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  paused: 'border-white/15 bg-white/5 text-white/50',
  onboarding: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
};

function GarmentChip({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-[#252528] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/65">
      {label}
    </span>
  );
}

export function SuperAdminManufacturers() {
  const { manufacturerList, users, loading, error, refresh, patchProfile, deleteAccount } = useSuperadminData();
  const [search, setSearch] = useState('');
  const [garmentFilter, setGarmentFilter] = useState<string | 'all'>('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [issuingInvite, setIssuingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [invites, setInvites] = useState<StoredInvite[]>(() => getStoredInvites());
  const [confirmingEmail, setConfirmingEmail] = useState<string | null>(null);

  const issueInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIssuingInvite(true);
    setInviteLink('');
    setCopiedInvite(false);
    try {
      const token = await createManufacturerInvite(inviteEmail);
      const url = new URL('/manufacturer/signup', window.location.origin);
      url.searchParams.set('invite', token);
      setInviteLink(url.toString());
      setInvites(getStoredInvites());
      toast.success('Invitation link created. It expires in 7 days.');
    } catch (cause: unknown) {
      const err = cause as { message?: string } | undefined;
      const message =
        err?.message ||
        (typeof cause === 'string' ? cause : 'Could not create manufacturer invitation.');
      toast.error(message);
    } finally {
      setIssuingInvite(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      toast.success('Invitation link copied.');
    } catch {
      toast.error('Could not copy the link. Select and copy it manually.');
    }
  };

  const handleCopyInviteToken = async (token: string) => {
    try {
      const url = new URL('/manufacturer/signup', window.location.origin);
      url.searchParams.set('invite', token);
      await navigator.clipboard.writeText(url.toString());
      toast.success('Invitation link copied.');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const handleRevokeInvite = (token: string) => {
    deleteStoredInvite(token);
    setInvites(getStoredInvites());
    toast.message('Invitation removed.');
  };

  const handleConfirmPartner = async (email: string) => {
    setConfirmingEmail(email);
    try {
      confirmAndActivateManufacturer(email);
      const matchingUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (matchingUser) {
        await patchProfile(matchingUser.id, { role: 'manufacturer' });
      }
      await refresh();
      setInvites(getStoredInvites());
      toast.success(`Partner ${email} confirmed and granted manufacturer portal access.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not confirm partner.');
    } finally {
      setConfirmingEmail(null);
    }
  };

  const overview = useMemo(() => {
    const activePartners = manufacturerList.filter((p) => p.status === 'active').length;
    const totalOrdersAssigned = manufacturerList.reduce((sum, p) => sum + p.assignedOrders, 0);
    const garmentCounts = new Map<string, number>();
    for (const p of manufacturerList) {
      for (const g of p.garmentTypes) {
        garmentCounts.set(g, (garmentCounts.get(g) ?? 0) + 1);
      }
    }
    const garmentCoverage = Array.from(garmentCounts.entries())
      .map(([type, partners]) => ({ type, partners }))
      .sort((a, b) => b.partners - a.partners || a.type.localeCompare(b.type));
    const throughput = [...manufacturerList]
      .sort((a, b) => b.assignedOrders - a.assignedOrders)
      .slice(0, 8)
      .map((p) => ({
        name: p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name,
        orders: p.assignedOrders,
      }));
    return { activePartners, totalOrdersAssigned, garmentCoverage, throughput };
  }, [manufacturerList]);

  const garmentFilters = useMemo(() => {
    const set = new Set<string>();
    for (const p of manufacturerList) {
      for (const g of p.garmentTypes) set.add(g);
    }
    return Array.from(set).sort();
  }, [manufacturerList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return manufacturerList.filter((p) => {
      if (garmentFilter !== 'all' && !p.garmentTypes.includes(garmentFilter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.garmentTypes.some((g) => g.toLowerCase().includes(q))
      );
    });
  }, [manufacturerList, search, garmentFilter]);

  if (loading) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div>
        <div className="flex items-center gap-2 text-[#CC2D24]">
          <Factory className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Partners</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Manufacturers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/45">
          Control factory partners — performance, plans, portal access, and assigned work.
        </p>
      </div>

      <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-[#CC2D24]" />
          <h2 className="text-sm font-semibold text-white">Invite a manufacturer</h2>
        </div>
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/45">
          Invitations are tied to one email, expire after 7 days, and can only be used once.
        </p>
        <form onSubmit={issueInvite} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={event => setInviteEmail(event.target.value)}
            placeholder="manufacturer@example.com"
            aria-label="Manufacturer email address"
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none"
          />
          <button
            type="submit"
            disabled={issuingInvite}
            className="h-10 rounded-lg bg-[#CC2D24] px-4 text-xs font-semibold text-white hover:bg-[#CC2D24]/90 disabled:opacity-50"
          >
            {issuingInvite ? 'Creating…' : 'Create invitation'}
          </button>
        </form>
        {inviteLink ? <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={inviteLink}
            aria-label="Manufacturer invitation link"
            onFocus={event => event.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white/70"
          />
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            {copiedInvite ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiedInvite ? 'Copied' : 'Copy link'}
          </button>
        </div> : null}

        {invites.length > 0 ? (
          <div className="mt-6 border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Invitations & Partner Confirmations ({invites.length})
            </h3>
            <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-black/20">
              {invites.map((inv) => {
                const matchingUser = users.find(
                  (u) => u.email.toLowerCase() === inv.email.toLowerCase(),
                );
                const isManufacturerRole =
                  matchingUser?.role === 'manufacturer' || Boolean(inv.redeemedAt);
                const isExpired = Date.now() > inv.expiresAt;

                return (
                  <div
                    key={inv.token}
                    className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{inv.email}</span>
                        {isManufacturerRole ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            Confirmed Partner
                          </span>
                        ) : matchingUser ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                            <Clock className="h-3 w-3" />
                            Registered (Awaiting Confirmation)
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40">
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-200">
                            Invitation Sent
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">
                        Created {new Date(inv.createdAt).toLocaleDateString()} ·{' '}
                        {isExpired
                          ? 'Expired'
                          : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={confirmingEmail === inv.email}
                        onClick={() => void handleConfirmPartner(inv.email)}
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition',
                          isManufacturerRole
                            ? 'border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white'
                            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500',
                        )}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        {isManufacturerRole ? 'Re-confirm Access' : 'Confirm & Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyInviteToken(inv.token)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 px-2.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                        title="Copy invitation link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.token)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-xs text-white/40 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                        title="Revoke invitation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active partners', value: String(overview.activePartners) },
          { label: 'Orders assigned', value: String(overview.totalOrdersAssigned) },
          { label: 'Total partners', value: String(manufacturerList.length) },
          {
            label: 'Onboarding',
            value: String(manufacturerList.filter((p) => p.status === 'onboarding').length),
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[#252528] bg-[#111113] px-4 py-4"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {kpi.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">Partner throughput</h2>
          <div className="mt-4 h-[220px] w-full min-w-0">
            {overview.throughput.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-white/40">
                No assigned orders yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.throughput}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval={0} angle={-10} textAnchor="end" height={46} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="orders" fill={RED} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Garment coverage</h2>
          <p className="mt-1 text-[11px] text-white/35">How many factories cover each product type</p>
          {overview.garmentCoverage.length === 0 ? (
            <p className="mt-6 text-sm text-white/40">No garment types listed yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {overview.garmentCoverage.map((row) => (
                <li key={row.type} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/75">{row.type}</span>
                  <div className="flex min-w-[120px] items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.partners / Math.max(overview.activePartners || manufacturerList.length, 1)) * 100}%`,
                          background: AMBER,
                        }}
                      />
                    </div>
                    <span className="w-4 text-right text-[11px] tabular-nums text-white/45">
                      {row.partners}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">All manufacturers</h2>
            <p className="mt-1 text-[11px] text-white/35">
              {filtered.length} of {manufacturerList.length} partners
            </p>
          </div>
          <div className="relative max-w-md flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, location, garments…"
              className="h-9 w-full border-0 border-b border-white/15 bg-transparent pl-7 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#CC2D24]/70"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGarmentFilter('all')}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
              garmentFilter === 'all'
                ? 'border-[#CC2D24]/40 bg-[#CC2D24]/15 text-white'
                : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white/80',
            )}
          >
            All types
          </button>
          {garmentFilters.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGarmentFilter(g)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                garmentFilter === g
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                  : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white/80',
              )}
            >
              {g}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#111113] px-6 py-16 text-center">
            <p className="text-sm text-white/45">
              {manufacturerList.length === 0
                ? 'No manufacturer accounts yet.'
                : 'No manufacturers match.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((profile) => (
              <div
                key={profile.userId}
                className="group flex flex-col gap-4 rounded-2xl border border-[#252528] bg-[#111113] p-4 transition hover:border-white/[0.14] sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white"><Link to={`/superadmin/manufacturers/${profile.userId}`}>{profile.name}</Link></h3>
                    <span
                      className={cn(
                        'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        STATUS_STYLE[profile.status],
                      )}
                    >
                      {profile.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-white/40">
                    {profile.location}, {profile.country} · MOQ {profile.moq} · Lead{' '}
                    {profile.leadTimeDays}d
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.garmentTypes.map((g) => (
                      <GarmentChip key={g} label={g} />
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-6 sm:gap-8">
                  <div className="grid grid-cols-2 gap-4 text-center sm:gap-5">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">Orders</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                        {profile.assignedOrders}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">Capacity</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                        {profile.capacityUnitsPerMonth || '—'}
                      </div>
                    </div>
                  </div>
                  <DeleteRecordButton label={profile.name} description="Permanently delete this manufacturer account and profile? Assigned orders will remain and become unassigned. This cannot be undone." onDelete={() => deleteAccount(profile.userId)} />
                  <Link to={`/superadmin/manufacturers/${profile.userId}`} aria-label={`View ${profile.name}`}><ChevronRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#CC2D24]" /></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
