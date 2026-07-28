import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Copy,
  Mail,
  Plus,
  Search,
  Send,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SUPER_USERS, type SuperAdminUser } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { cn } from '../../components/ui/utils';

type RoleFilter = 'all' | SuperAdminUser['role'];

type SortField = 'name' | 'role' | 'credits' | 'orders' | 'lastActive';
type SortDir = 'asc' | 'desc';

type CustomRecipient = {
  id: string;
  name: string;
  email: string;
};

type SentRecipient = {
  id: string;
  name: string;
  email: string;
  custom?: boolean;
};

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

const ROLE_ORDER: Record<SuperAdminUser['role'], number> = {
  brand: 0,
  manufacturer: 1,
  worker: 2,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] text-[11px] font-bold text-white/85',
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

function SortableHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium transition hover:text-white',
          active ? 'text-white' : 'text-white/45',
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-[#CC2D24]" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-[#CC2D24]" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-35" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function SuperAdminUsers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [listRoleFilter, setListRoleFilter] = useState<RoleFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'compose' | 'sent'>('compose');
  const [emailRoleFilter, setEmailRoleFilter] = useState<RoleFilter>('all');
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  const [customRecipients, setCustomRecipients] = useState<CustomRecipient[]>([]);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [emailUserSearch, setEmailUserSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sentRecipients, setSentRecipients] = useState<SentRecipient[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const activeUser = useMemo(
    () => MOCK_SUPER_USERS.find((u) => u.id === activeUserId) ?? null,
    [activeUserId],
  );

  const roleCounts = useMemo(
    () => ({
      brand: MOCK_SUPER_USERS.filter((u) => u.role === 'brand').length,
      manufacturer: MOCK_SUPER_USERS.filter((u) => u.role === 'manufacturer').length,
      worker: MOCK_SUPER_USERS.filter((u) => u.role === 'worker').length,
    }),
    [],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_SUPER_USERS.filter((u) => {
      if (listRoleFilter !== 'all' && u.role !== listRoleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [search, listRoleFilter]);

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'role':
          cmp = ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name);
          break;
        case 'credits':
          cmp = a.credits - b.credits || a.name.localeCompare(b.name);
          break;
        case 'orders':
          cmp = a.ordersCount - b.ordersCount || a.name.localeCompare(b.name);
          break;
        case 'lastActive':
          cmp = a.lastActive.localeCompare(b.lastActive) || a.name.localeCompare(b.name);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredUsers, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir(field === 'lastActive' || field === 'credits' || field === 'orders' ? 'desc' : 'asc');
  };

  const emailPool = useMemo(() => {
    return MOCK_SUPER_USERS.filter((u) => emailRoleFilter === 'all' || u.role === emailRoleFilter);
  }, [emailRoleFilter]);

  const searchedEmailPool = useMemo(() => {
    const q = emailUserSearch.trim().toLowerCase();
    if (!q) return emailPool;
    return emailPool.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        ROLE_LABEL[u.role].toLowerCase().includes(q),
    );
  }, [emailPool, emailUserSearch]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));
  const someFilteredSelected = filteredUsers.some((u) => selectedIds.has(u.id));
  const allEmailPoolSelected =
    searchedEmailPool.length > 0 && searchedEmailPool.every((u) => emailSelectedIds.has(u.id));

  const userRecipients = MOCK_SUPER_USERS.filter((u) => emailSelectedIds.has(u.id));
  const totalRecipientCount = userRecipients.length + customRecipients.length;

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEmailUser = (id: string) => {
    setEmailSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredUsers.forEach((u) => next.delete(u.id));
      else filteredUsers.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const toggleAllEmailPool = () => {
    setEmailSelectedIds((prev) => {
      const next = new Set(prev);
      if (allEmailPoolSelected) searchedEmailPool.forEach((u) => next.delete(u.id));
      else searchedEmailPool.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const resetEmailForm = () => {
    setEmailRoleFilter('all');
    setEmailSelectedIds(new Set());
    setEmailUserSearch('');
    setCustomRecipients([]);
    setCustomName('');
    setCustomEmail('');
    setShowCustomForm(false);
    setSubject('');
    setBody('');
    setSentRecipients([]);
    setEmailStep('compose');
  };

  const openEmailComposer = () => {
    resetEmailForm();
    const initial =
      selectedIds.size > 0
        ? new Set(selectedIds)
        : new Set(MOCK_SUPER_USERS.map((u) => u.id));
    setEmailSelectedIds(initial);
    setEmailOpen(true);
  };

  const openEmailForUser = (userId: string) => {
    resetEmailForm();
    setEmailSelectedIds(new Set([userId]));
    setEmailOpen(true);
    setActiveUserId(null);
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copied');
    } catch {
      toast.error('Could not copy email');
    }
  };

  const closeEmailComposer = () => {
    setEmailOpen(false);
    resetEmailForm();
  };

  const addCustomRecipient = () => {
    const name = customName.trim();
    const email = customEmail.trim().toLowerCase();
    if (!name) {
      toast.error('Enter a name for this recipient');
      return;
    }
    if (!isValidEmail(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    const duplicate =
      customRecipients.some((r) => r.email === email) ||
      MOCK_SUPER_USERS.some((u) => u.email.toLowerCase() === email);
    if (duplicate) {
      toast.error('That email is already in the list');
      return;
    }
    setCustomRecipients((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, name, email },
    ]);
    setCustomName('');
    setCustomEmail('');
    setShowCustomForm(false);
  };

  const removeCustomRecipient = (id: string) => {
    setCustomRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSendEmail = () => {
    if (totalRecipientCount === 0) {
      toast.error('Select at least one recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Add a subject line');
      return;
    }
    if (!body.trim()) {
      toast.error('Write your message');
      return;
    }
    const sent: SentRecipient[] = [
      ...userRecipients.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      ...customRecipients.map((r) => ({ id: r.id, name: r.name, email: r.email, custom: true })),
    ];
    setSentRecipients(sent);
    setEmailStep('sent');
  };

  const rolePills: { id: RoleFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: MOCK_SUPER_USERS.length },
    { id: 'brand', label: 'Brands', count: roleCounts.brand },
    { id: 'manufacturer', label: 'Manufacturers', count: roleCounts.manufacturer },
    { id: 'worker', label: 'Workers', count: roleCounts.worker },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            Accounts
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Users</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90" onClick={openEmailComposer}>
            <Mail className="mr-2 h-4 w-4" />
            {selectedIds.size > 0 ? `Email selected (${selectedIds.size})` : 'Compose email'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total users', value: MOCK_SUPER_USERS.length },
          { label: 'Brands', value: roleCounts.brand },
          { label: 'Manufacturers', value: roleCounts.manufacturer },
          { label: 'Workers', value: roleCounts.worker },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#141416] to-[#111113] p-4"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/38">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search + role pills */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="search"
            name="platform-user-filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-10 w-full border-0 border-b border-white/15 bg-transparent pl-7 pr-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#CC2D24]/70 focus:ring-0"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {rolePills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setListRoleFilter(pill.id)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                listRoleFilter === pill.id
                  ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white'
                  : 'border-transparent bg-white/[0.04] text-white/55 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              {pill.label}
              {pill.count != null ? (
                <span className="ml-1.5 tabular-nums text-white/40">{pill.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#CC2D24]/30 bg-gradient-to-r from-[#CC2D24]/12 to-transparent px-4 py-3">
          <UsersIcon className="h-5 w-5 text-[#CC2D24]" />
          <span className="text-sm text-white/85">
            <strong className="text-white">{selectedIds.size}</strong> user
            {selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <Button size="sm" className="h-8 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={openEmailComposer}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email them
          </Button>
          <button
            type="button"
            className="ml-auto text-xs text-white/45 hover:text-white"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-white/45">
                <th className="w-12 px-4 py-3.5">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAllFiltered}
                    aria-label="Select all visible users"
                    className="border-white/25 data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24]"
                  />
                </th>
                <SortableHeader
                  field="name"
                  label="User"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="role"
                  label="Role"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="credits"
                  label="AI chat"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="orders"
                  label="Orders"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="lastActive"
                  label="Last active"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <UsersIcon className="mx-auto h-8 w-8 text-white/20" />
                    <p className="mt-3 text-sm text-white/45">No users match your filters.</p>
                  </td>
                </tr>
              ) : (
                sortedUsers.map((u) => {
                  const selected = selectedIds.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveUserId(u.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveUserId(u.id);
                        }
                      }}
                      className={cn(
                        'group cursor-pointer border-b border-white/[0.06] transition last:border-0',
                        selected ? 'bg-[#CC2D24]/[0.08]' : 'hover:bg-white/[0.04]',
                        activeUserId === u.id && 'bg-white/[0.06]',
                      )}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleUser(u.id)}
                          aria-label={`Select ${u.name}`}
                          className="border-white/25 data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24]"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} />
                          <div className="min-w-0">
                            <div className="font-medium text-white group-hover:text-[#CC2D24]/90">
                              {u.name}
                            </div>
                            <div className="truncate text-xs text-white/45">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                            ROLE_STYLE[u.role],
                          )}
                        >
                          {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-medium text-white/85">{u.credits}</td>
                      <td className="px-4 py-3.5 tabular-nums text-white/75">{u.ordersCount}</td>
                      <td className="px-4 py-3.5 text-white/50">
                        <span className="inline-flex items-center gap-1 text-xs text-white/35 transition group-hover:text-white/60">
                          {u.lastActive}
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User preview sheet */}
      <Sheet open={activeUserId != null} onOpenChange={(open) => !open && setActiveUserId(null)}>
        <SheetContent
          side="right"
          className="w-full border-white/10 bg-[#0d0d0f] p-0 text-white sm:max-w-md"
        >
          {activeUser ? (
            <>
              <div className="border-b border-white/10 bg-gradient-to-br from-[#CC2D24]/12 via-transparent to-transparent px-6 pb-6 pt-10">
                <SheetHeader className="space-y-4 p-0 text-left">
                  <div className="flex items-start gap-4">
                    <UserAvatar name={activeUser.name} className="h-14 w-14 text-sm" />
                    <div className="min-w-0 flex-1 pt-1">
                      <SheetTitle className="text-xl text-white">{activeUser.name}</SheetTitle>
                      <SheetDescription asChild>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="truncate text-sm text-white/55">{activeUser.email}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                            onClick={() => copyEmail(activeUser.email)}
                            aria-label="Copy email"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </SheetDescription>
                      <span
                        className={cn(
                          'mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                          ROLE_STYLE[activeUser.role],
                        )}
                      >
                        {ROLE_LABEL[activeUser.role]}
                      </span>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              <div className="space-y-6 px-6 py-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'AI chat', value: activeUser.credits },
                    { label: 'Orders', value: activeUser.ordersCount },
                    { label: 'Joined', value: activeUser.createdAt },
                    { label: 'Last active', value: activeUser.lastActive },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                        {stat.label}
                      </div>
                      <div className="mt-1 text-lg font-semibold tabular-nums text-white">
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90"
                    onClick={() => openEmailForUser(activeUser.id)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email {activeUser.name.split(/\s+/)[0]}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
                    onClick={() => {
                      const wasSelected = selectedIds.has(activeUser.id);
                      toggleUser(activeUser.id);
                      toast.success(wasSelected ? 'Removed from selection' : 'Added to selection');
                    }}
                  >
                    <UsersIcon className="mr-2 h-4 w-4" />
                    {selectedIds.has(activeUser.id) ? 'Remove from selection' : 'Select for bulk email'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setActiveUserId(null);
                      navigate(`/superadmin/users/${activeUser.id}`);
                    }}
                  >
                    View full profile
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={(open) => !open && closeEmailComposer()}>
        <DialogContent className="flex max-h-[min(92vh,780px)] flex-col overflow-hidden border-white/10 bg-[#0d0d0f] p-0 text-white sm:max-w-2xl">
          {emailStep === 'compose' ? (
            <>
              <div className="border-b border-white/10 bg-gradient-to-r from-[#CC2D24]/15 via-[#CC2D24]/5 to-transparent px-6 py-5">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="flex items-center gap-2 text-lg text-white">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2D24]/20">
                      <Mail className="h-4 w-4 text-[#CC2D24]" />
                    </span>
                    Compose email
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {/* To bar */}
                <div className="border-b border-white/[0.06] px-6 py-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                      To · {totalRecipientCount} recipient{totalRecipientCount === 1 ? '' : 's'}
                    </Label>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                      onClick={toggleAllEmailPool}
                    >
                      {allEmailPoolSelected
                        ? emailUserSearch.trim()
                          ? 'Deselect shown'
                          : 'Deselect users'
                        : emailUserSearch.trim()
                          ? 'Select shown'
                          : 'Select all users'}
                    </button>
                  </div>
                  <div className="flex min-h-[2.5rem] flex-wrap gap-1.5">
                    {userRecipients.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 pl-1 pr-2 py-0.5 text-[11px] text-white/80"
                      >
                        <UserAvatar name={u.name} className="h-5 w-5 text-[9px]" />
                        {u.email}
                        <button
                          type="button"
                          className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
                          onClick={() => toggleEmailUser(u.id)}
                          aria-label={`Remove ${u.email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {customRecipients.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-full border border-[#CC2D24]/30 bg-[#CC2D24]/10 pl-2 pr-1.5 py-0.5 text-[11px] text-white/90"
                      >
                        <UserPlus className="h-3 w-3 text-[#CC2D24]" />
                        {r.name} · {r.email}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-white/10"
                          onClick={() => removeCustomRecipient(r.id)}
                          aria-label={`Remove ${r.email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {totalRecipientCount === 0 ? (
                      <span className="text-xs text-white/35">No recipients yet</span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-white/[0.06]">
                  {/* Recipients panel */}
                  <div className="space-y-4 border-b border-white/[0.06] p-6 lg:border-b-0">
                    <div className="flex flex-wrap gap-2">
                      {rolePills.map((pill) => (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setEmailRoleFilter(pill.id)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                            emailRoleFilter === pill.id
                              ? 'border-[#CC2D24]/50 bg-[#CC2D24]/12 text-white'
                              : 'border-white/10 text-white/50 hover:text-white',
                          )}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
                      <input
                        type="search"
                        name="compose-recipient-filter"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-1p-ignore
                        data-lpignore="true"
                        value={emailUserSearch}
                        onChange={(e) => setEmailUserSearch(e.target.value)}
                        placeholder="Search users by name or email…"
                        className="h-9 w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-8 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#CC2D24]/50 focus:ring-1 focus:ring-[#CC2D24]/25"
                      />
                      {emailUserSearch ? (
                        <button
                          type="button"
                          onClick={() => setEmailUserSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
                          aria-label="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-1.5">
                      {searchedEmailPool.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                          <Search className="mx-auto h-5 w-5 text-white/20" />
                          <p className="mt-2 text-xs text-white/45">No users match your search.</p>
                        </div>
                      ) : (
                        searchedEmailPool.map((u) => (
                        <label
                          key={u.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]',
                            emailSelectedIds.has(u.id) && 'bg-[#CC2D24]/[0.07]',
                          )}
                        >
                          <Checkbox
                            checked={emailSelectedIds.has(u.id)}
                            onCheckedChange={() => toggleEmailUser(u.id)}
                            className="border-white/25 data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24]"
                          />
                          <UserAvatar name={u.name} className="h-8 w-8 text-[10px]" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-white">{u.name}</div>
                            <div className="truncate text-[11px] text-white/45">{u.email}</div>
                          </div>
                        </label>
                        ))
                      )}
                    </div>

                    {/* Custom recipient */}
                    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
                      {!showCustomForm ? (
                        <button
                          type="button"
                          onClick={() => setShowCustomForm(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/30 py-2.5 text-sm font-medium text-white/70 transition hover:border-[#CC2D24]/40 hover:text-white"
                        >
                          <Plus className="h-4 w-4 text-[#CC2D24]" />
                          Add custom email
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
                              New recipient
                            </span>
                            <button
                              type="button"
                              className="text-white/40 hover:text-white"
                              onClick={() => {
                                setShowCustomForm(false);
                                setCustomName('');
                                setCustomEmail('');
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <Input
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Name (e.g. Partner contact)"
                            className="h-10 border-white/12 bg-black/40 text-white placeholder:text-white/30"
                          />
                          <Input
                            type="email"
                            value={customEmail}
                            onChange={(e) => setCustomEmail(e.target.value)}
                            placeholder="email@company.com"
                            className="h-10 border-white/12 bg-black/40 text-white placeholder:text-white/30"
                            onKeyDown={(e) => e.key === 'Enter' && addCustomRecipient()}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="w-full bg-[#CC2D24] hover:bg-[#CC2D24]/90"
                            onClick={addCustomRecipient}
                          >
                            <UserPlus className="mr-1.5 h-4 w-4" />
                            Add to recipients
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message panel */}
                  <div className="space-y-4 p-6">
                    <div>
                      <Label htmlFor="email-subject" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                        Subject
                      </Label>
                      <Input
                        id="email-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject line"
                        className="h-11 border-white/12 bg-black/40 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col">
                      <Label htmlFor="email-body" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                        Message
                      </Label>
                      <Textarea
                        id="email-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Hi team,&#10;&#10;Write your message here…"
                        className="min-h-[200px] flex-1 resize-none border-white/12 bg-black/40 text-white placeholder:text-white/30 lg:min-h-[240px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-white/10 bg-black/30 px-6 py-4">
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/10"
                  onClick={closeEmailComposer}
                >
                  Cancel
                </Button>
                <Button
                  className="min-w-[140px] bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/25 hover:bg-[#CC2D24]/90"
                  onClick={handleSendEmail}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send to {totalRecipientCount || '…'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="border-b border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent px-6 py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/10">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-white">Email sent</h2>
                <p className="mt-2 text-sm text-white/50">
                  Delivered to{' '}
                  <strong className="text-white">{sentRecipients.length}</strong> recipient
                  {sentRecipients.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                {subject ? (
                  <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Subject</div>
                    <div className="mt-1 text-sm font-medium text-white">{subject}</div>
                  </div>
                ) : null}
                {body ? (
                  <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Message</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{body}</p>
                  </div>
                ) : null}
                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Recipients
                  </div>
                  <ul className="max-h-40 space-y-2 overflow-y-auto">
                    {sentRecipients.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {r.custom ? (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CC2D24]/15">
                              <UserPlus className="h-3.5 w-3.5 text-[#CC2D24]" />
                            </span>
                          ) : (
                            <UserAvatar name={r.name} className="h-7 w-7 text-[10px]" />
                          )}
                          <span className="truncate text-sm text-white">{r.name}</span>
                          {r.custom ? (
                            <Badge variant="outline" className="shrink-0 border-[#CC2D24]/30 text-[10px] text-[#CC2D24]">
                              Custom
                            </Badge>
                          ) : null}
                        </div>
                        <span className="shrink-0 truncate text-xs text-white/45">{r.email}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <DialogFooter className="border-t border-white/10 bg-black/30 px-6 py-4">
                <Button
                  variant="outline"
                  className="border-white/15 text-white hover:bg-white/10"
                  onClick={() => {
                    setEmailStep('compose');
                    setSentRecipients([]);
                  }}
                >
                  Send another
                </Button>
                <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={closeEmailComposer}>
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
