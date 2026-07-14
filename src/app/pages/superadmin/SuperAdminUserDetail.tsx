import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Mail,
  Package,
  Send,
  Shield,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MOCK_SUPER_ORDERS,
  MOCK_SUPER_USERS,
  STATUS_LABELS,
  formatMoney,
  type SuperAdminUser,
} from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { cn } from '../../components/ui/utils';

const ROLE_LABEL: Record<SuperAdminUser['role'], string> = {
  brand: 'Brand',
  manufacturer: 'Manufacturer',
  worker: 'Worker',
};

const ROLE_STYLE: Record<SuperAdminUser['role'], string> = {
  brand: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  manufacturer: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  worker: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
};

const STATUS_STYLE: Partial<Record<keyof typeof STATUS_LABELS, string>> = {
  pending_review: 'border-[#CC2D24]/30 bg-[#CC2D24]/10 text-red-200',
  submitted: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  assigned: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  priced: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  in_production: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  shipped: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  completed: 'border-white/20 bg-white/10 text-white/80',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] font-bold text-white/85',
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

export function SuperAdminUserDetail() {
  const { id } = useParams();
  const user = MOCK_SUPER_USERS.find((u) => u.id === id);

  const [credits, setCredits] = useState(user?.credits ?? 0);
  const [creditDelta, setCreditDelta] = useState('');
  const [role, setRole] = useState<SuperAdminUser['role']>(user?.role ?? 'brand');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'compose' | 'sent'>('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const userOrders = useMemo(
    () =>
      user
        ? MOCK_SUPER_ORDERS.filter((o) => o.userId === user.id).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          )
        : [],
    [user],
  );

  const orderValueCents = useMemo(
    () => userOrders.reduce((sum, o) => sum + (o.finalPriceCents ?? 0), 0),
    [userOrders],
  );

  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <UsersIconFallback />
        <h2 className="mt-4 text-lg font-semibold text-white">User not found</h2>
        <p className="mt-1 text-sm text-white/45">This account may have been removed or the link is wrong.</p>
        <Button asChild className="mt-6 bg-[#CC2D24] hover:bg-[#CC2D24]/90">
          <Link to="/superadmin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to users
          </Link>
        </Button>
      </div>
    );
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(user.email);
      toast.success('Email copied');
    } catch {
      toast.error('Could not copy email');
    }
  };

  const applyCredits = () => {
    const delta = Number(creditDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Enter a non-zero amount');
      return;
    }
    setCredits((c) => Math.max(0, c + delta));
    setCreditDelta('');
    toast.success(`Mock: ${delta > 0 ? 'added' : 'removed'} ${Math.abs(delta)} messages`);
  };

  const saveRole = () => {
    toast.success(`Mock: role updated to ${ROLE_LABEL[role]}`);
  };

  const sendEmail = () => {
    if (!subject.trim()) {
      toast.error('Add a subject line');
      return;
    }
    if (!body.trim()) {
      toast.error('Write your message');
      return;
    }
    setEmailStep('sent');
  };

  const closeEmail = () => {
    setEmailOpen(false);
    setEmailStep('compose');
    setSubject('');
    setBody('');
  };

  return (
    <div className="space-y-6">
      <Link
        to="/superadmin/users"
        className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Users
      </Link>

      {/* Profile hero */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/[0.06] bg-gradient-to-br from-[#CC2D24]/14 via-[#CC2D24]/4 to-transparent px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-5">
              <UserAvatar name={user.name} className="h-16 w-16 text-base sm:h-20 sm:w-20 sm:text-lg" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
                  User profile
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {user.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm text-white/55">{user.email}</span>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                    aria-label="Copy email"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span
                  className={cn(
                    'mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                    ROLE_STYLE[user.role],
                  )}
                >
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                className="bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email user
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'AI chat', value: credits, icon: Coins },
            { label: 'Orders', value: user.ordersCount, icon: ShoppingBag },
            {
              label: 'Order value',
              value: orderValueCents > 0 ? formatMoney(orderValueCents) : '—',
              icon: Package,
            },
            {
              label: 'Last active',
              value: formatDate(user.lastActive),
              icon: Clock,
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#111113] px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/38">
                <stat.icon className="h-3.5 w-3.5" />
                {stat.label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-white">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column — management */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#CC2D24]/15">
                <Coins className="h-4 w-4 text-[#CC2D24]" />
              </span>
              <h2 className="text-sm font-semibold text-white">AI chat allowance</h2>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Current balance
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-white">{credits}</span>
                <span className="text-sm text-white/40">messages left</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCreditDelta(String(n))}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-[#CC2D24]/40 hover:text-white"
                >
                  +{n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreditDelta(String(-10))}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-red-500/40 hover:text-red-200"
              >
                −10
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[120px] flex-1 space-y-1.5">
                <Label className="text-white/55">Adjust by</Label>
                <Input
                  type="number"
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(e.target.value)}
                  placeholder="e.g. 50 or -10"
                  className="border-white/12 bg-black/40 text-white placeholder:text-white/30"
                />
              </div>
              <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={applyCredits}>
                Apply
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#CC2D24]/15">
                <Shield className="h-4 w-4 text-[#CC2D24]" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Role & permissions</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Label className="text-white/55">Platform role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as SuperAdminUser['role'])}>
                <SelectTrigger className="border-white/12 bg-black/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="manufacturer">Manufacturer (admin)</SelectItem>
                  <SelectItem value="worker">Internal worker</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="w-full border-white/15 text-white hover:bg-white/10"
                onClick={saveRole}
              >
                Update role
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Account details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
                <dt className="flex items-center gap-2 text-white/45">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined
                </dt>
                <dd className="text-right text-white">{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
                <dt className="text-white/45">User ID</dt>
                <dd className="font-mono text-xs text-white/70">{user.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/45">Email verified</dt>
                <dd className="text-emerald-400/90">Yes (mock)</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right column — orders & activity */}
        <div className="space-y-6 lg:col-span-3">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-white">Recent orders</h2>
                <p className="mt-0.5 text-xs text-white/45">
                  {userOrders.length === 0
                    ? 'No orders linked to this account yet'
                    : `${userOrders.length} order${userOrders.length === 1 ? '' : 's'} on record`}
                </p>
              </div>
              {userOrders.length > 0 ? (
                <Button asChild variant="outline" size="sm" className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white">
                  <Link to="/superadmin/orders">All orders</Link>
                </Button>
              ) : null}
            </div>

            {userOrders.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Package className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-3 text-sm text-white/45">This user hasn&apos;t placed any orders yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/40">
                      <th className="px-5 py-3 font-medium sm:px-6">Order</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                      <th className="px-5 py-3 font-medium sm:px-6">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="group border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-3.5 sm:px-6">
                          <Link
                            to={`/superadmin/orders/${order.id}`}
                            className="font-mono text-xs text-[#CC2D24]/90 transition group-hover:text-[#CC2D24]"
                          >
                            {order.id}
                          </Link>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3.5 text-white/80">
                          {order.productName}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                              STATUS_STYLE[order.status] ?? 'border-white/15 bg-white/5 text-white/60',
                            )}
                          >
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-white/75">
                          {order.finalPriceCents != null ? formatMoney(order.finalPriceCents) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-white/50 sm:px-6">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Activity</h2>
            <ul className="mt-4 space-y-0">
              {[
                {
                  label: 'Signed in',
                  detail: `Last seen ${daysSince(user.lastActive).toLowerCase()}`,
                  at: user.lastActive,
                },
                ...(userOrders[0]
                  ? [
                      {
                        label: 'Order placed',
                        detail: userOrders[0].productName,
                        at: userOrders[0].createdAt,
                      },
                    ]
                  : []),
                {
                  label: 'Account created',
                  detail: 'Registered on Ceriga Studio',
                  at: user.createdAt,
                },
              ].map((item, i) => (
                <li
                  key={`${item.label}-${i}`}
                  className="relative flex gap-4 border-b border-white/[0.06] py-4 last:border-0"
                >
                  <span className="relative mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-[#CC2D24]/80">
                    {i < 2 ? (
                      <span className="absolute left-1/2 top-3 h-full w-px -translate-x-1/2 bg-white/10" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="mt-0.5 truncate text-xs text-white/45">{item.detail}</div>
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-white/35">
                    {formatDate(item.at)}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={(open) => !open && closeEmail()}>
        <DialogContent className="border-white/10 bg-[#0d0d0f] p-0 text-white sm:max-w-lg">
          {emailStep === 'compose' ? (
            <>
              <div className="border-b border-white/10 bg-gradient-to-r from-[#CC2D24]/15 to-transparent px-6 py-5">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="flex items-center gap-2 text-lg text-white">
                    <Mail className="h-4 w-4 text-[#CC2D24]" />
                    Email {user.name.split(/\s+/)[0]}
                  </DialogTitle>
                  <p className="text-sm text-white/45">To: {user.email}</p>
                </DialogHeader>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <Label htmlFor="profile-email-subject" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Subject
                  </Label>
                  <Input
                    id="profile-email-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line"
                    className="border-white/12 bg-black/40 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-email-body" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Message
                  </Label>
                  <Textarea
                    id="profile-email-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message…"
                    className="min-h-[160px] resize-none border-white/12 bg-black/40 text-white placeholder:text-white/30"
                  />
                </div>
              </div>
              <DialogFooter className="border-t border-white/10 bg-black/30 px-6 py-4">
                <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={closeEmail}>
                  Cancel
                </Button>
                <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={sendEmail}>
                  <Send className="mr-2 h-4 w-4" />
                  Send email
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="px-6 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">Email sent</h2>
                <p className="mt-2 text-sm text-white/50">Delivered to {user.email}</p>
              </div>
              <DialogFooter className="border-t border-white/10 bg-black/30 px-6 py-4">
                <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={closeEmail}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersIconFallback() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
      <Shield className="h-6 w-6 text-white/30" />
    </div>
  );
}
