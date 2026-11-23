import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { AdminRecordControls, AdminCreateOrder } from '../../components/superadmin/AdminRecordControls';
import { formatAccountTotal,sumConvertedMinor, displayMoney,useCurrency } from '../../lib/accountCurrency';
import { useEffect, useMemo, useState } from 'react';
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
  STATUS_LABELS,
  formatMoney,
  type SuperAdminUser,
} from '../../data/superadminMock';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { ConfirmDialog } from '../../components/ConfirmDialog';
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
import { PageLoadingFallback } from '../../components/PageLoadingFallback';

const ROLE_LABEL: Record<SuperAdminUser['role'], string> = {
  brand: 'Brand',
  manufacturer: 'Manufacturer',
  worker: 'Worker',
};

const ROLE_STYLE: Record<SuperAdminUser['role'], string> = {
  brand: 'border-sky-500/30 bg-sky-500/10 text-sky-800',
  manufacturer: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
  worker: 'border-violet-500/30 bg-violet-500/10 text-violet-800',
};

const STATUS_STYLE: Partial<Record<keyof typeof STATUS_LABELS, string>> = {
  pending_review: 'border-[#CC2D24]/30 bg-[#CC2D24]/10 text-red-800',
  submitted: 'border-blue-500/30 bg-blue-500/10 text-blue-800',
  assigned: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
  priced: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
  in_production: 'border-violet-500/30 bg-violet-500/10 text-violet-800',
  shipped: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-800',
  completed: 'border-neutral-200 bg-neutral-100 text-neutral-700',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
  const currencyState=useCurrency();
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 font-bold text-neutral-700',
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(cerigaLocale(), {
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
  useCerigaTranslation();

  const currencyState=useCurrency();
  const { id } = useParams();
  const { users, orders, loading, patchProfile, refresh } = useSuperadminData();
  const user = users.find((u) => u.id === id);

  const [credits, setCredits] = useState(0);
  const [creditDelta, setCreditDelta] = useState('');
  const [role, setRole] = useState<SuperAdminUser['role']>('brand');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'compose' | 'sent'>('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirmKind, setConfirmKind] = useState<'credits' | 'role' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCredits(user.credits);
    setRole(user.role);
  }, [user]);

  const userOrders = useMemo(
    () =>
      user
        ? orders
            .filter((o) => o.userId === user.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [user, orders],
  );

  const orderValueCents = useMemo(
    () => sumConvertedMinor(userOrders.filter(o=>o.finalPriceCents!=null).map(o=>({cents:o.finalPriceCents!,currency:o.currency}))),
    [userOrders,currencyState.currency,currencyState.rates],
  );

  if (loading) {
    return <PageLoadingFallback />;
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <UsersIconFallback />
        <h2 className="mt-4 text-lg font-semibold text-neutral-900">{cerigaTranslate("interface.text_4a1793e9900cd312")}</h2>
        <p className="mt-1 text-sm text-neutral-600">{cerigaTranslate("interface.text_1d812856c106363f")}</p>
        <Button asChild className="mt-6 bg-[#CC2D24] text-white hover:bg-[#a92720]">
          <Link to="/superadmin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_1b788094375db16a")}</Link>
        </Button>
      </div>
    );
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(user.email);
      toast.success(cerigaTranslate("interface.text_28411e5e86b6fea2"));
    } catch {
      toast.error(cerigaTranslate("interface.text_a623297fd0546ca6"));
    }
  };

  const applyCredits = () => {
    const delta = Number(creditDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error(cerigaTranslate("interface.text_f050f8eef7b8d18f"));
      return;
    }
    setConfirmKind('credits');
  };

  const saveRole = () => {
    if (role === user.role) {
      toast.message(cerigaTranslate("interface.text_c8dbb83350351ea3"));
      return;
    }
    setConfirmKind('role');
  };

  const runConfirmed = async () => {
    setSaving(true);
    try {
      if (confirmKind === 'credits') {
        const delta = Number(creditDelta);
        const next = Math.max(0, credits + delta);
        const ok = await patchProfile(user.id, { messageCredits: next });
        if (!ok) throw new Error("Could not update credits");
        setCredits(next);
        setCreditDelta('');
        toast.success(cerigaTranslate("interface.text_ff75cc1acda66304",{value0:(delta > 0 ? 'Added' : 'Removed'),value1:(Math.abs(delta))}));
      } else if (confirmKind === 'role') {
        const ok = await patchProfile(user.id, { role });
        if (!ok) throw new Error("Could not update role");
        toast.success(cerigaTranslate("interface.text_3df7ea9aba1f8cb7",{value0:(ROLE_LABEL[role])}));
        await refresh();
      }
    } catch (err) {
      toast.error(cerigaTranslateLabel(err instanceof Error ? err.message : cerigaTranslate("interface.text_e58282fd73fb8580")));
    } finally {
      setSaving(false);
      setConfirmKind(null);
    }
  };

  const sendEmail = () => {
    if (!subject.trim()) {
      toast.error(cerigaTranslate("interface.text_fec2459f9b57ff7f"));
      return;
    }
    if (!body.trim()) {
      toast.error(cerigaTranslate("interface.text_aa220fb68ca726bb"));
      return;
    }
    // Opens the user's mail client — no mock send.
    window.location.href = `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setEmailStep('sent');
  };

  const closeEmail = () => {
    setEmailOpen(false);
    setEmailStep('compose');
    setSubject('');
    setBody('');
  };

  return (
    <div className="mx-auto max-w-[1360px] space-y-5">
      <Link
        to="/superadmin/users"
        className="inline-flex items-center gap-2 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />{cerigaTranslate("nav.users")}</Link>

      {/* Profile hero */}
      <header className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <UserAvatar name={user.name} className="h-12 w-12 text-base sm:h-14 sm:w-14" />
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  {user.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-all text-sm text-neutral-600">{user.email}</span>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="rounded-md p-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                    aria-label={cerigaTranslate("interface.text_1449d5fb47172cac")}
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
                  {cerigaTranslateLabel(ROLE_LABEL[user.role])}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900"
                onClick={() => setEmailOpen(true)}
              >
                <Mail aria-hidden="true" />{cerigaTranslate("interface.text_b5d23db7ec480b9f")}</Button>
              {user.role === 'brand' && <AdminCreateOrder users={[user]} customerId={user.id} />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-neutral-200 md:grid-cols-4">
          {[
            { label: 'AI chat', value: credits, icon: Coins },
            { label: 'Orders', value: user.ordersCount, icon: ShoppingBag },
            {
              label: 'Order value',
              value: formatAccountTotal(orderValueCents),
              icon: Package,
            },
            {
              label: 'Last active',
              value: formatDate(user.lastActive),
              icon: Clock,
            },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 bg-white px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                <stat.icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {cerigaTranslateLabel(stat.label)}
              </div>
              <div className="mt-1 break-words text-base font-semibold tabular-nums text-neutral-900 sm:text-lg">{stat.value}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left column — management */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {user.role === 'brand' && <AdminRecordControls entity="customer" id={user.id} onSaved={refresh} inline />}
          <details className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-900">{cerigaTranslate("interface.text_32ff8abc29e44237")}</summary>

            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{cerigaTranslate("interface.text_988a691f049e0bc6")}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-neutral-900">{credits}</span>
                <span className="text-sm text-neutral-600">{cerigaTranslate("interface.text_7d4a892d49629531")}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[10, 25, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCreditDelta(String(n))}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-[#CC2D24]/40 hover:text-neutral-900"
                >
                  +{n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreditDelta(String(-10))}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-red-500/40 hover:text-red-800"
              >
                −10
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[120px] flex-1 space-y-1.5">
                <Label className="text-neutral-600">{cerigaTranslate("interface.text_ae9d2aa0d007ef55")}</Label>
                <Input
                  type="number"
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(e.target.value)}
                  placeholder={cerigaTranslate("interface.text_8117677df1a2089a")}
                  className="border-neutral-300 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500"
                />
              </div>
              <Button className="bg-[#CC2D24] text-white hover:bg-[#a92720]" onClick={applyCredits}>{cerigaTranslate("interface.text_31e392d1c0378bec")}</Button>
            </div>
          </details>

          <details className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-900">{cerigaTranslate("interface.text_948a1030adce45f5")}</summary>

            <div className="mt-5 space-y-3">
              <Label className="text-neutral-600">{cerigaTranslate("interface.text_bc6b67577097d191")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as SuperAdminUser['role'])}>
                <SelectTrigger className="border-neutral-300 bg-neutral-50 text-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                  <SelectItem value="brand">{cerigaTranslate("interface.text_090ed4316f1d99fd")}</SelectItem>
                  <SelectItem value="manufacturer">{cerigaTranslate("interface.text_cae717a8e4fe51e5")}</SelectItem>
                  <SelectItem value="worker">{cerigaTranslate("interface.text_4a3225747b85759d")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="w-full border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900"
                onClick={saveRole}
              >{cerigaTranslate("interface.text_961f3411a05d3124")}</Button>
            </div>
          </details>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-neutral-900">{cerigaTranslate("interface.text_17be95e1a1884ebc")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-3">
                <dt className="flex items-center gap-2 text-neutral-600">
                  <Calendar className="h-3.5 w-3.5" />{cerigaTranslate("interface.text_69318b0c6a928e7e")}</dt>
                <dd className="text-right text-neutral-900">{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-3">
                <dt className="text-neutral-600">{cerigaTranslate("interface.text_7967e089a7b94464")}</dt>
                <dd className="font-mono text-xs text-neutral-700">{user.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-neutral-600">{cerigaTranslate("interface.text_bcdf701c4dfbaee3")}</dt>
                <dd className="text-right text-neutral-900">{formatDate(user.lastActive)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Right column — orders & activity */}
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">{cerigaTranslate("interface.text_e3b5c105c826b4ed")}</h2>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {userOrders.length === 0
                    ? cerigaTranslate("interface.text_cb1988d9eba30788")
                    : cerigaTranslate("interface.plural_ee259909f74112f6",{value0:(userOrders.length),count:Number(userOrders.length)})}
                </p>
              </div>
              {userOrders.length > 0 ? (
                <Button asChild variant="outline" size="sm" className="border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900">
                  <Link to="/superadmin/orders">{cerigaTranslate("orders.all")}</Link>
                </Button>
              ) : null}
            </div>

            {userOrders.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Package className="mx-auto h-8 w-8 text-neutral-400" />
                <p className="mt-3 text-sm text-neutral-600">{cerigaTranslate("interface.text_9f32ba6d1739d0fc")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-600">
                      <th className="px-5 py-3 font-medium sm:px-6">{cerigaTranslate("adminOrders.order")}</th>
                      <th className="px-4 py-3 font-medium">{cerigaTranslate("interface.text_fb9ef894175c3274")}</th>
                      <th className="px-4 py-3 font-medium">{cerigaTranslate("orders.status")}</th>
                      <th className="px-4 py-3 font-medium">{cerigaTranslate("interface.text_8e37953d23daca5f")}</th>
                      <th className="px-5 py-3 font-medium sm:px-6">{cerigaTranslate("interface.text_99c40ab405926cb5")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="group border-b border-neutral-100 transition last:border-0 hover:bg-neutral-50"
                      >
                        <td className="px-5 py-3.5 sm:px-6">
                          <Link
                            to={`/superadmin/orders/${order.id}`}
                            className="font-mono text-xs text-[#CC2D24]/90 transition group-hover:text-[#CC2D24]"
                          >
                            {order.id}
                          </Link>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3.5 text-neutral-700">
                          {order.productName}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                              STATUS_STYLE[order.status] ?? 'border-neutral-200 bg-neutral-50 text-neutral-700',
                            )}
                          >
                            {cerigaTranslateLabel(STATUS_LABELS[order.status])}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-neutral-700">
                          {order.finalPriceCents != null ? displayMoney(order.finalPriceCents,order.currency) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-neutral-600 sm:px-6">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-neutral-900">{cerigaTranslate("interface.text_38da1505ca837328")}</h2>
            <ul className="mt-4 space-y-0">
              {[
                {
                  label: 'Signed in',
                  detail: cerigaTranslate("interface.text_95265ba0f696d685",{value0:(daysSince(user.lastActive).toLowerCase())}),
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
                  className="relative flex gap-4 border-b border-neutral-200 py-4 last:border-0"
                >
                  <span className="relative mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-[#CC2D24]/80">
                    {i < 2 ? (
                      <span className="absolute left-1/2 top-3 h-full w-px -translate-x-1/2 bg-neutral-100" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-900">{cerigaTranslateLabel(item.label)}</div>
                    <div className="mt-0.5 truncate text-xs text-neutral-600">{item.detail}</div>
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-neutral-600">
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
        <DialogContent className="border-neutral-200 bg-white p-0 text-neutral-900 sm:max-w-lg">
          {emailStep === 'compose' ? (
            <>
              <div className="border-b border-neutral-200 bg-white px-6 py-5">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="flex items-center gap-2 text-lg text-neutral-900">
                    <Mail className="h-4 w-4 text-[#CC2D24]" />{cerigaTranslate("authentication.email")}{" "}{user.name.split(/\s+/)[0]}
                  </DialogTitle>
                  <p className="text-sm text-neutral-600">{cerigaTranslate("interface.text_2b5fc5c94f64250c")}{" "}{user.email}</p>
                </DialogHeader>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <Label htmlFor="profile-email-subject" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">{cerigaTranslate("interface.text_68971283841aecdf")}</Label>
                  <Input
                    id="profile-email-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={cerigaTranslate("interface.text_dc01923f9fd5b285")}
                    className="border-neutral-300 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-email-body" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">{cerigaTranslate("interface.text_2f77668a9dfbf8d5")}</Label>
                  <Textarea
                    id="profile-email-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={cerigaTranslate("interface.text_d1ef580b6ed6ebfb")}
                    className="min-h-[160px] resize-none border-neutral-300 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500"
                  />
                </div>
              </div>
              <DialogFooter className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
                <Button variant="outline" className="border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900" onClick={closeEmail}>{cerigaTranslate("common.cancel")}</Button>
                <Button className="bg-[#CC2D24] text-white hover:bg-[#a92720]" onClick={sendEmail}>
                  <Send className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_e0622cb6890a96e7")}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="px-6 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-8 w-8 text-emerald-700" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-neutral-900">{cerigaTranslate("interface.text_a5e14a58d737e1e7")}</h2>
                <p className="mt-2 text-sm text-neutral-600">{cerigaTranslate("interface.text_d2b095cb5e0064d8")}{" "}{user.email}</p>
              </div>
              <DialogFooter className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
                <Button className="bg-[#CC2D24] text-white hover:bg-[#a92720]" onClick={closeEmail}>{cerigaTranslate("common.done")}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmKind != null}
        onOpenChange={(open) => {
          if (!open) setConfirmKind(null);
        }}
        title={confirmKind === 'role' ? cerigaTranslate("interface.text_2ab86c16ec9d0d1a") : cerigaTranslate("interface.text_9c9b21098751432d")}
        description={
          confirmKind === 'role'
            ? cerigaTranslate("interface.text_b8b8edd3e156d594",{value0:(ROLE_LABEL[role])})
            : cerigaTranslate("interface.text_035294b048ef0f5d",{value0:(Number(creditDelta) > 0 ? '+' : ''),value1:(creditDelta)})
        }
        confirmLabel={confirmKind === 'role' ? cerigaTranslate("interface.text_961f3411a05d3124") : cerigaTranslate("interface.text_ec5d76705cb1095d")}
        tone={confirmKind === 'credits' && Number(creditDelta) < 0 ? 'danger' : 'default'}
        className="border-neutral-200 bg-white text-neutral-900 shadow-lg shadow-black/10 [&_[data-slot=alert-dialog-title]]:text-neutral-900 [&_[data-slot=alert-dialog-description]]:text-neutral-600 [&_[data-slot=alert-dialog-cancel]]:border-neutral-200 [&_[data-slot=alert-dialog-cancel]]:text-neutral-900 [&_[data-slot=alert-dialog-cancel]:hover]:bg-neutral-100"
        onConfirm={runConfirmed}
      />
    </div>
  );
}

function UsersIconFallback() {
  const currencyState=useCurrency();
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
      <Shield className="h-6 w-6 text-neutral-500" />
    </div>
  );
}
