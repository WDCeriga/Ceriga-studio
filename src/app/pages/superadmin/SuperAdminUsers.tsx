import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import './superadmin-users.css';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
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
import { type SuperAdminUser } from '../../data/superadminMock';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { DeleteRecordButton } from '../../components/DeleteRecordButton';
import { Button } from '../../components/ui/button';
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
  brand: 'border-[#e2e2e2] bg-[#fafafa] text-[#525252]',
  manufacturer: 'border-[#e2e2e2] bg-[#fafafa] text-[#525252]',
  worker: 'border-[#e2e2e2] bg-[#fafafa] text-[#525252]',
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
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#e2e2e2] bg-gradient-to-br from-white/10 to-white/[0.02] text-[11px] font-bold text-[#737373]',
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
  useCerigaTranslation();

  const active = sortField === field;
  return (
    <th className={className} aria-sort={active ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium transition hover:text-[#262626]',
          active ? 'text-[#262626]' : 'text-[#737373]',
        )}
      >
        {cerigaTranslateLabel(label)}
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
  useCerigaTranslation();

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [listRoleFilter, setListRoleFilter] = useState<RoleFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRoleFilter, setEmailRoleFilter] = useState<RoleFilter>('all');
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  const [customRecipients, setCustomRecipients] = useState<CustomRecipient[]>([]);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [emailUserSearch, setEmailUserSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const { users: MOCK_SUPER_USERS, loading: usersLoading, usersError, deleteAccount, refresh } = useSuperadminData({scope:'users'});

  const activeUser = useMemo(
    () => MOCK_SUPER_USERS.find((u) => u.id === activeUserId) ?? null,
    [activeUserId, MOCK_SUPER_USERS],
  );

  const roleCounts = useMemo(
    () => ({
      brand: MOCK_SUPER_USERS.filter((u) => u.role === 'brand').length,
      manufacturer: MOCK_SUPER_USERS.filter((u) => u.role === 'manufacturer').length,
      worker: MOCK_SUPER_USERS.filter((u) => u.role === 'worker').length,
    }),
    [MOCK_SUPER_USERS],
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
  }, [MOCK_SUPER_USERS, search, listRoleFilter]);

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

  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field: SortField) => {
    setPage(1);
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir(field === 'lastActive' || field === 'credits' || field === 'orders' ? 'desc' : 'asc');
  };

  const emailPool = useMemo(() => {
    return MOCK_SUPER_USERS.filter((u) => emailRoleFilter === 'all' || u.role === emailRoleFilter);
  }, [MOCK_SUPER_USERS, emailRoleFilter]);

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

  const userRecipients = useMemo(
    () => MOCK_SUPER_USERS.filter((u) => emailSelectedIds.has(u.id)),
    [MOCK_SUPER_USERS, emailSelectedIds],
  );
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
  };

  const openEmailComposer = () => {
    resetEmailForm();
    const initial =
      selectedIds.size > 0
        ? new Set(selectedIds)
        : new Set<string>();
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
      toast.success(cerigaTranslate("interface.text_28411e5e86b6fea2"));
    } catch {
      toast.error(cerigaTranslate("interface.text_a623297fd0546ca6"));
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
      toast.error(cerigaTranslate("interface.text_a57f79529f47832d"));
      return;
    }
    if (!isValidEmail(email)) {
      toast.error(cerigaTranslate("interface.text_c20ffba2f53079de"));
      return;
    }
    const duplicate =
      customRecipients.some((r) => r.email === email) ||
      MOCK_SUPER_USERS.some((u) => u.email.toLowerCase() === email);
    if (duplicate) {
      toast.error(cerigaTranslate("interface.text_d515314129a4dbaa"));
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
      toast.error(cerigaTranslate("interface.text_b2fe2976df3ce9fc"));
      return;
    }
    if (!subject.trim()) {
      toast.error(cerigaTranslate("interface.text_fec2459f9b57ff7f"));
      return;
    }
    if (!body.trim()) {
      toast.error(cerigaTranslate("interface.text_aa220fb68ca726bb"));
      return;
    }
    const sent: SentRecipient[] = [
      ...userRecipients.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      ...customRecipients.map((r) => ({ id: r.id, name: r.name, email: r.email, custom: true })),
    ];
    const recipients = [...new Set(sent.map(r => r.email.toLowerCase()))];
    const draft = 'mailto:?bcc=' + encodeURIComponent(recipients.join(',')) + '&subject=' + encodeURIComponent(subject.trim()) + '&body=' + encodeURIComponent(body.trim());
    if (draft.length > 1800) {
      toast.error(cerigaTranslate("interface.text_eb0a55518f868645"));
      return;
    }
    window.location.href = draft;
    toast.info(cerigaTranslate("interface.text_ed4198ad59c81346"));
  };

  const rolePills: { id: RoleFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: MOCK_SUPER_USERS.length },
    { id: 'brand', label: 'Brands', count: roleCounts.brand },
    { id: 'manufacturer', label: 'Manufacturers', count: roleCounts.manufacturer },
    { id: 'worker', label: 'Workers', count: roleCounts.worker },
  ];

  return (
    <div className="admin-users space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">{cerigaTranslate("interface.text_ef282d06a91fee0e")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#262626] sm:text-3xl">{cerigaTranslate("nav.users")}</h1>
          <p className="users-intro">{cerigaTranslate("interface.text_d16f1320a2c2faec")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/20 hover:bg-[#CC2D24]/90" onClick={openEmailComposer}>
            <Mail className="mr-2 h-4 w-4" />
            {selectedIds.size > 0 ? cerigaTranslate("interface.text_7a8f7b1b629a5bd7",{value0:(selectedIds.size)}) : cerigaTranslate("interface.text_6589a9896f9cc6ce")}
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
            className="rounded-md border border-[#e2e2e2] bg-gradient-to-br from-[#161618] to-[#111113] p-4"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslateLabel(s.label)}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-[#262626]">{usersLoading || usersError ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {usersError ? (
        <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-100/90">{cerigaTranslate("interface.text_eddf3fa5e25e1c36")}{" "}{cerigaTranslateLabel(usersError)}
          <button type="button" className="ml-3 underline" disabled={usersLoading} onClick={() => { void refresh(); }}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button>
        </div>
      ) : null}

      {/* Search + role pills */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
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
            aria-label={cerigaTranslate("interface.text_e4bb77af4bc57267")}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={cerigaTranslate("interface.text_a949ce5b6107fab1")}
            className="h-10 w-full border-0 border-b border-[#dedede] bg-transparent pl-7 pr-2 text-sm text-[#262626] outline-none transition-colors placeholder:text-[#737373] focus:border-[#CC2D24]/70 focus:ring-0"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {rolePills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              aria-pressed={listRoleFilter === pill.id}
              onClick={() => { setListRoleFilter(pill.id); setPage(1); }}
              className={cn(
                'rounded-md border px-3.5 py-1.5 text-xs font-medium transition',
                listRoleFilter === pill.id
                  ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-[#262626]'
                  : 'border-transparent bg-[#f7f7f7] text-[#737373] hover:bg-[#f7f7f7] hover:text-[#262626]',
              )}
            >
              {cerigaTranslateLabel(pill.label)}
              {pill.count != null ? (
                <span className="ml-1.5 tabular-nums text-[#737373]">{pill.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#CC2D24]/30 bg-gradient-to-r from-[#CC2D24]/12 to-transparent px-4 py-3">
          <UsersIcon className="h-5 w-5 text-[#CC2D24]" />
          <span className="text-sm text-[#737373]">
            <strong className="text-[#262626]">{selectedIds.size}</strong>{" "}{cerigaTranslate("interface.plural_noun_04f8996da763b7a9",{count:Number(selectedIds.size)})}{" "}{cerigaTranslate("interface.text_d7cbbb688b2e506c")}</span>
          <Button size="sm" className="h-8 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={openEmailComposer}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />{cerigaTranslate("interface.text_600f8dae7836f858")}</Button>
          <button
            type="button"
            className="ml-auto text-xs text-[#737373] hover:text-[#262626]"
            onClick={() => setSelectedIds(new Set())}
          >{cerigaTranslate("interface.text_cea4d2e010b8fd52")}</button>
        </div>
      ) : null}

      <div className="users-results"><span role="status">{usersLoading ? cerigaTranslate("interface.text_2494bdb5bc468296") : usersError ? cerigaTranslate("interface.text_3f92a9593f4f6445") : cerigaTranslate("interface.plural_da412a5922710817",{value0:(sortedUsers.length),value2:(selectedIds.size),count:Number(sortedUsers.length)})}</span>{(search || listRoleFilter !== 'all') && <button type="button" onClick={() => { setSearch(''); setListRoleFilter('all'); setPage(1); }}>{cerigaTranslate("orders.clear")}</button>}</div>
      {/* Table */}
      <div className="overflow-hidden rounded-md border border-[#e2e2e2] bg-white users-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e2e2e2] bg-[#f7f7f7] text-[11px] uppercase tracking-wider text-[#737373]">
                <th className="w-12 px-4 py-3.5">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAllFiltered}
                    aria-label={cerigaTranslate("interface.text_0d2f92d5fb03e2b3")}
                    className="border-[#dedede] data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24]"
                  />
                </th>
                <SortableHeader
                  field="name"
                  label={cerigaTranslate("interface.text_b512d97e7cbf97c2")}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="role"
                  label={cerigaTranslate("interface.text_14736a2eb9f4159f")}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="credits"
                  label={cerigaTranslate("interface.text_5a3fb0f77198d732")}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="orders"
                  label={cerigaTranslate("nav.orders")}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
                <SortableHeader
                  field="lastActive"
                  label={cerigaTranslate("interface.text_bcdf701c4dfbaee3")}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="px-4 py-3.5"
                />
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-[#737373]">{cerigaTranslate("interface.text_a53ec7ac2a7b8fb1")}</td>
                </tr>
              ) : sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <UsersIcon className="mx-auto h-8 w-8 text-[#737373]" />
                    <p className="mt-3 text-sm text-[#737373]">
                      {search.trim() || listRoleFilter !== 'all'
                        ? cerigaTranslate("interface.text_015da0267cee4939")
                        : usersError
                          ? cerigaTranslate("interface.text_96fd782eb1b61a09")
                          : cerigaTranslate("interface.text_ec64feef1a8350d4")}
                    </p>
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u) => {
                  const selected = selectedIds.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveUserId(u.id)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setActiveUserId(u.id);
                        }
                      }}
                      className={cn(
                        'group cursor-pointer border-b border-[#e2e2e2] transition last:border-0',
                        selected ? 'bg-[#CC2D24]/[0.08]' : 'hover:bg-[#f7f7f7]',
                        activeUserId === u.id && 'bg-[#f7f7f7]',
                      )}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleUser(u.id)}
                          aria-label={cerigaTranslate("interface.text_33de0e8b35aac169",{value0:(u.name)})}
                          className="border-[#dedede] data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24]"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} />
                          <div className="min-w-0">
                            <div className="font-medium text-[#262626] group-hover:text-[#CC2D24]/90">
                              {u.name}
                            </div>
                            <div className="truncate text-xs text-[#737373]">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-medium',
                            ROLE_STYLE[u.role],
                          )}
                        >
                          {cerigaTranslateLabel(ROLE_LABEL[u.role])}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-medium text-[#737373]">{u.credits}</td>
                      <td className="px-4 py-3.5 tabular-nums text-[#737373]">{u.ordersCount}</td>
                      <td className="px-4 py-3.5 text-[#737373]">
                        <span className="inline-flex items-center gap-1 text-xs text-[#737373] transition group-hover:text-[#737373]">
                          {u.lastActive}
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </span>
                        <DeleteRecordButton label={u.name} description={cerigaTranslate("interface.text_7d5817f60316cf06")}
                          onDelete={async () => {
                            await deleteAccount(u.id);
                            setSelectedIds((previous) => new Set([...previous].filter((id) => id !== u.id)));
                            setEmailSelectedIds((previous) => new Set([...previous].filter((id) => id !== u.id)));
                            if (activeUserId === u.id) setActiveUserId(null);
                          }} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <nav className="users-pagination" aria-label={cerigaTranslate("interface.text_f541722fab217e7d")}><span>{sortedUsers.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, sortedUsers.length)}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{sortedUsers.length}</span><div><button type="button" disabled={usersLoading || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{cerigaTranslate("common.previous")}</button><span>{cerigaTranslate("interface.text_0a30a815d67d7dd2")}{" "}{currentPage}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{pageCount}</span><button type="button" disabled={usersLoading || currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>{cerigaTranslate("common.next")}</button></div></nav>
      {/* User preview sheet */}
      <Sheet open={activeUserId != null} onOpenChange={(open) => !open && setActiveUserId(null)}>
        <SheetContent
          side="right"
          className="admin-users-overlay w-full border-[#e2e2e2] bg-white p-0 text-[#262626] sm:max-w-md"
        >
          {activeUser ? (
            <>
              <div className="border-b border-[#e2e2e2] bg-gradient-to-br from-[#CC2D24]/12 via-transparent to-transparent px-6 pb-6 pt-10">
                <SheetHeader className="space-y-4 p-0 text-left">
                  <div className="flex items-start gap-4">
                    <UserAvatar name={activeUser.name} className="h-14 w-14 text-sm" />
                    <div className="min-w-0 flex-1 pt-1">
                      <SheetTitle className="text-xl text-[#262626]">{activeUser.name}</SheetTitle>
                      <SheetDescription asChild>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="truncate text-sm text-[#737373]">{activeUser.email}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-md p-1 text-[#737373] transition hover:bg-[#f7f7f7] hover:text-[#262626]"
                            onClick={() => copyEmail(activeUser.email)}
                            aria-label={cerigaTranslate("interface.text_1449d5fb47172cac")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </SheetDescription>
                      <span
                        className={cn(
                          'mt-3 inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-medium',
                          ROLE_STYLE[activeUser.role],
                        )}
                      >
                        {cerigaTranslateLabel(ROLE_LABEL[activeUser.role])}
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
                      className="rounded-md border border-[#e2e2e2] bg-[#f7f7f7] px-3 py-3"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                        {cerigaTranslateLabel(stat.label)}
                      </div>
                      <div className="mt-1 text-lg font-semibold tabular-nums text-[#262626]">
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
                    <Mail className="mr-2 h-4 w-4" />{cerigaTranslate("authentication.email")}{" "}{activeUser.name.split(/\s+/)[0]}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-[#dedede] bg-[#f7f7f7] text-[#262626] hover:bg-[#f7f7f7]"
                    onClick={() => {
                      const wasSelected = selectedIds.has(activeUser.id);
                      toggleUser(activeUser.id);
                      toast.success(cerigaTranslateLabel(wasSelected ? 'Removed from selection' : 'Added to selection'));
                    }}
                  >
                    <UsersIcon className="mr-2 h-4 w-4" />
                    {selectedIds.has(activeUser.id) ? cerigaTranslate("interface.text_b9180d6696fed742") : cerigaTranslate("interface.text_35965f377cca4f5b")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-[#dedede] bg-[#f7f7f7] text-[#737373] hover:bg-[#f7f7f7] hover:text-[#262626]"
                    onClick={() => {
                      setActiveUserId(null);
                      navigate(`/superadmin/users/${activeUser.id}`);
                    }}
                  >{cerigaTranslate("interface.text_88bf0a859510fcc6")}<ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={(open) => !open && closeEmailComposer()}>
        <DialogContent className="admin-users-overlay flex max-h-[min(92vh,780px)] flex-col overflow-hidden border-[#e2e2e2] bg-white p-0 text-[#262626] sm:max-w-2xl">

            <>
              <div className="border-b border-[#e2e2e2] bg-gradient-to-r from-[#CC2D24]/15 via-[#CC2D24]/5 to-transparent px-6 py-5">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="flex items-center gap-2 text-lg text-[#262626]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#CC2D24]/20">
                      <Mail className="h-4 w-4 text-[#CC2D24]" />
                    </span>{cerigaTranslate("interface.text_c4fa0f3ea2332e37")}</DialogTitle>
                </DialogHeader>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <p className="users-email-note">{cerigaTranslate("interface.text_77880d73077a3b68")}</p>
                {/* To bar */}
                <div className="border-b border-[#e2e2e2] px-6 py-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("interface.text_02590c6edf9045d3")}{" "}{totalRecipientCount}{" "}{cerigaTranslate("interface.plural_noun_665d0698dbc8fb95",{count:Number(totalRecipientCount)})}
                    </Label>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-[#CC2D24] hover:underline"
                      onClick={toggleAllEmailPool}
                    >
                      {allEmailPoolSelected
                        ? emailUserSearch.trim()
                          ? cerigaTranslate("interface.text_be03af5c558e4dbd")
                          : cerigaTranslate("interface.text_e7aa690e61d042d0")
                        : emailUserSearch.trim()
                          ? cerigaTranslate("interface.text_8d4c2992af0eddad")
                          : cerigaTranslate("interface.text_5236895593a9448c")}
                    </button>
                  </div>
                  <div className="flex min-h-[2.5rem] flex-wrap gap-1.5">
                    {userRecipients.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 rounded-md border border-[#e2e2e2] bg-[#f7f7f7] pl-1 pr-2 py-0.5 text-[11px] text-[#737373]"
                      >
                        <UserAvatar name={u.name} className="h-5 w-5 text-[9px]" />
                        {u.email}
                        <button
                          type="button"
                          className="ml-0.5 rounded-md p-0.5 hover:bg-[#f7f7f7]"
                          onClick={() => toggleEmailUser(u.id)}
                          aria-label={cerigaTranslate("interface.text_e224cf245aada55a",{value0:(u.email)})}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {customRecipients.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-md border border-[#CC2D24]/30 bg-[#CC2D24]/10 pl-2 pr-1.5 py-0.5 text-[11px] text-[#737373]"
                      >
                        <UserPlus className="h-3 w-3 text-[#CC2D24]" />
                        {r.name} · {r.email}
                        <button
                          type="button"
                          className="rounded-md p-0.5 hover:bg-[#f7f7f7]"
                          onClick={() => removeCustomRecipient(r.id)}
                          aria-label={cerigaTranslate("interface.text_e224cf245aada55a",{value0:(r.email)})}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {totalRecipientCount === 0 ? (
                      <span className="text-xs text-[#737373]">{cerigaTranslate("interface.text_c77827d0c9f8c990")}</span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-white/[0.06]">
                  {/* Recipients panel */}
                  <div className="space-y-4 border-b border-[#e2e2e2] p-6 lg:border-b-0">
                    <div className="flex flex-wrap gap-2">
                      {rolePills.map((pill) => (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setEmailRoleFilter(pill.id)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                            emailRoleFilter === pill.id
                              ? 'border-[#CC2D24]/50 bg-[#CC2D24]/12 text-[#262626]'
                              : 'border-[#e2e2e2] text-[#737373] hover:text-[#262626]',
                          )}
                        >
                          {cerigaTranslateLabel(pill.label)}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#737373]" />
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
                        placeholder={cerigaTranslate("interface.text_81012a595286648a")}
                        className="h-9 w-full rounded-lg border border-[#e2e2e2] bg-[#fafafa] pl-9 pr-8 text-sm text-[#262626] outline-none transition placeholder:text-[#737373] focus:border-[#CC2D24]/50 focus:ring-1 focus:ring-[#CC2D24]/25"
                      />
                      {emailUserSearch ? (
                        <button
                          type="button"
                          onClick={() => setEmailUserSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#737373] hover:bg-[#f7f7f7] hover:text-[#262626]"
                          aria-label={cerigaTranslate("interface.text_3b7ea51793e9d906")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-[#e2e2e2] bg-[#fafafa] p-1.5">
                      {searchedEmailPool.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                          <Search className="mx-auto h-5 w-5 text-[#737373]" />
                          <p className="mt-2 text-xs text-[#737373]">{cerigaTranslate("interface.text_3ccbd64ae664fa67")}</p>
                        </div>
                      ) : (
                        searchedEmailPool.map((u) => (
                        <label
                          key={u.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#f7f7f7]',
                            emailSelectedIds.has(u.id) && 'bg-[#CC2D24]/[0.07]',
                          )}
                        >
                          <Checkbox
                            checked={emailSelectedIds.has(u.id)}
                            onCheckedChange={() => toggleEmailUser(u.id)}
                            className="border-[#dedede] data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24]"
                          />
                          <UserAvatar name={u.name} className="h-8 w-8 text-[10px]" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-[#262626]">{u.name}</div>
                            <div className="truncate text-[11px] text-[#737373]">{u.email}</div>
                          </div>
                        </label>
                        ))
                      )}
                    </div>

                    {/* Custom recipient */}
                    <div className="rounded-md border border-dashed border-[#dedede] bg-[#f7f7f7] p-3">
                      {!showCustomForm ? (
                        <button
                          type="button"
                          onClick={() => setShowCustomForm(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e2e2e2] bg-[#fafafa] py-2.5 text-sm font-medium text-[#737373] transition hover:border-[#CC2D24]/40 hover:text-[#262626]"
                        >
                          <Plus className="h-4 w-4 text-[#CC2D24]" />{cerigaTranslate("interface.text_9fd3758016b3e493")}</button>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("interface.text_45cc42099f1c616f")}</span>
                            <button
                              type="button"
                              className="text-[#737373] hover:text-[#262626]"
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
                            placeholder={cerigaTranslate("interface.text_5b24b61d413293d8")}
                            className="h-10 border-[#dedede] bg-[#fafafa] text-[#262626] placeholder:text-[#737373]"
                          />
                          <Input
                            type="email"
                            value={customEmail}
                            onChange={(e) => setCustomEmail(e.target.value)}
                            placeholder={cerigaTranslate("interface.text_aac7c4bbf8773552")}
                            className="h-10 border-[#dedede] bg-[#fafafa] text-[#262626] placeholder:text-[#737373]"
                            onKeyDown={(e) => e.key === 'Enter' && addCustomRecipient()}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="w-full bg-[#CC2D24] hover:bg-[#CC2D24]/90"
                            onClick={addCustomRecipient}
                          >
                            <UserPlus className="mr-1.5 h-4 w-4" />{cerigaTranslate("interface.text_6fe504d9d6c5bb14")}</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message panel */}
                  <div className="space-y-4 p-6">
                    <div>
                      <Label htmlFor="email-subject" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("interface.text_68971283841aecdf")}</Label>
                      <Input
                        id="email-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={cerigaTranslate("interface.text_dc01923f9fd5b285")}
                        className="h-11 border-[#dedede] bg-[#fafafa] text-[#262626] placeholder:text-[#737373]"
                      />
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col">
                      <Label htmlFor="email-body" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#737373]">{cerigaTranslate("interface.text_2f77668a9dfbf8d5")}</Label>
                      <Textarea
                        id="email-body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={cerigaTranslate("interface.text_021f50a375251e71")}
                        className="min-h-[200px] flex-1 resize-none border-[#dedede] bg-[#fafafa] text-[#262626] placeholder:text-[#737373] lg:min-h-[240px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-[#e2e2e2] bg-[#fafafa] px-6 py-4">
                <Button
                  variant="outline"
                  className="border-[#dedede] text-[#262626] hover:bg-[#f7f7f7]"
                  onClick={closeEmailComposer}
                >{cerigaTranslate("common.cancel")}</Button>
                <Button
                  className="min-w-[140px] bg-[#CC2D24] shadow-lg shadow-[#CC2D24]/25 hover:bg-[#CC2D24]/90"
                  disabled={totalRecipientCount === 0 || !subject.trim() || !body.trim()}
                  onClick={handleSendEmail}
                >
                  <Send className="mr-2 h-4 w-4" />{cerigaTranslate("interface.text_35f62ec1905570f5")}{totalRecipientCount})
                </Button>
              </DialogFooter>
            </>
        </DialogContent>
      </Dialog>
    </div>
  );
}
