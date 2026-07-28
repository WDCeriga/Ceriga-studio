import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Lock, PartyPopper, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  actingHasPermission,
  formatFactoryDate,
  getFactoryWorkspace,
  getHolidaysForWeek,
  getHolidaysOnDate,
  holidayEndDate,
  isCapacityWeekFull,
  isHolidayWeek,
  listFactoryHolidays,
  mondayOf,
  removeFactoryHoliday,
  requestFactoryTimeOff,
  setCapacityWeekBlock,
  updateCapacityWeekNote,
  type FactoryHoliday,
} from '../../data/manufacturerPortalMock';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../components/ui/utils';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 12, 0, 0, 0);
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

type CalDay = {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  weekStart: string;
};

function buildMonthGrid(year: number, month: number, todayIso: string): CalDay[][] {
  const first = startOfMonth(year, month);
  const gridStart = new Date(mondayOf(first) + 'T12:00:00');
  const weeks: CalDay[][] = [];
  const cursor = new Date(gridStart);

  for (let w = 0; w < 6; w++) {
    const row: CalDay[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = isoDate(cursor);
      row.push({
        iso,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        isToday: iso === todayIso,
        weekStart: mondayOf(cursor),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (w > 0 && row.every((c) => !c.inMonth)) break;
    weeks.push(row);
  }
  return weeks;
}

function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function weekRangeLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', {
    ...opts,
    year: 'numeric',
  })}`;
}

function shortHolidayName(name: string): string {
  if (name.length <= 14) return name;
  return `${name.slice(0, 12)}…`;
}

function holidayScopeLabel(h: FactoryHoliday): string {
  if (h.scope === 'week') return 'Whole week';
  if (h.scope === 'range') return `${h.days ?? 1} days`;
  return 'Day';
}

function rangePreview(startIso: string, days: number): string {
  const start = new Date(startIso + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + (days - 1));
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

const RANGE_DAY_OPTIONS = [2, 3, 4, 5, 7, 10, 14] as const;

export function ManufacturerCapacity() {
  const [tick, setTick] = useState(0);
  const canManage = actingHasPermission('manage_capacity');
  const ws = getFactoryWorkspace();
  void tick;

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selectedWeek, setSelectedWeek] = useState<string | null>(() => mondayOf(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(() => todayIso);
  const [pendingBlock, setPendingBlock] = useState<{
    weekStart: string;
    makeFull: boolean;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [holidayName, setHolidayName] = useState('');
  const [holidayScope, setHolidayScope] = useState<'day' | 'week' | 'range'>('week');
  const [rangeDays, setRangeDays] = useState(3);
  const [removeHolidayId, setRemoveHolidayId] = useState<string | null>(null);
  const [requestConfirmOpen, setRequestConfirmOpen] = useState(false);

  const weeks = useMemo(
    () => buildMonthGrid(view.year, view.month, todayIso),
    [view.year, view.month, todayIso],
  );

  const allHolidays = useMemo(() => listFactoryHolidays(), [tick]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, FactoryHoliday[]>();
    const push = (iso: string, h: FactoryHoliday) => {
      const list = map.get(iso) ?? [];
      list.push(h);
      map.set(iso, list);
    };
    for (const h of allHolidays) {
      if (h.status === 'declined') continue;
      if (h.scope === 'day') {
        push(h.date, h);
        continue;
      }
      const span = h.scope === 'week' ? 7 : Math.max(1, h.days ?? 1);
      for (let i = 0; i < span; i++) {
        const d = new Date(h.date + 'T12:00:00');
        d.setDate(d.getDate() + i);
        push(d.toISOString().slice(0, 10), h);
      }
    }
    return map;
  }, [allHolidays]);

  const blocksByWeek = useMemo(() => {
    const map = new Map(ws.capacityBlocks.map((b) => [b.weekStart, b]));
    return map;
  }, [ws.capacityBlocks, tick]);

  const fullCount = ws.capacityBlocks.filter((b) => b.full).length;
  const selectedFull = selectedWeek ? isCapacityWeekFull(selectedWeek) : false;
  const selectedBlock = selectedWeek ? blocksByWeek.get(selectedWeek) : undefined;
  const dayHolidays = selectedDay
    ? getHolidaysOnDate(selectedDay, { includePending: true })
    : [];
  const weekHolidays = selectedWeek
    ? getHolidaysForWeek(selectedWeek, { includePending: true })
    : [];
  const monthHolidays = allHolidays.filter((h) => {
    if (h.status === 'declined') return false;
    const d = new Date(h.date + 'T12:00:00');
    return d.getFullYear() === view.year && d.getMonth() === view.month;
  });
  const pendingRequests = allHolidays.filter((h) => h.status === 'pending');

  const monthBlocked = weeks.filter((row) => isCapacityWeekFull(row[0].weekStart)).length;

  const selectDay = (iso: string, weekStart: string) => {
    setSelectedDay(iso);
    setSelectedWeek(weekStart);
    setHolidayName('');
  };

  const selectWeek = (weekStart: string) => {
    setSelectedWeek(weekStart);
    setSelectedDay(weekStart);
    setHolidayScope('week');
    setHolidayName('');
  };

  const requestToggle = (weekStart: string) => {
    if (!canManage) {
      toast.error('You need Manage capacity calendar permission');
      return;
    }
    setSelectedWeek(weekStart);
    setPendingBlock({ weekStart, makeFull: !isCapacityWeekFull(weekStart) });
  };

  const commitToggle = () => {
    if (!pendingBlock) return;
    const note = noteDraft[pendingBlock.weekStart]?.trim();
    setCapacityWeekBlock(
      pendingBlock.weekStart,
      pendingBlock.makeFull,
      pendingBlock.makeFull ? note : undefined,
    );
    setTick((n) => n + 1);
    toast.success(
      pendingBlock.makeFull
        ? 'Week blocked as full — Ceriga won’t over-assign'
        : 'Week opened for assignment',
    );
  };

  const addHoliday = () => {
    if (!canManage) {
      toast.error('You need Manage capacity calendar permission');
      return;
    }
    const date = holidayScope === 'week' ? selectedWeek : selectedDay;
    if (!date) {
      toast.error('Select a day or week first');
      return;
    }
    if (!holidayName.trim()) {
      toast.error('Enter a reason / name for the request');
      return;
    }
    if (holidayScope === 'range' && rangeDays < 2) {
      toast.error('Pick at least 2 days for a custom range');
      return;
    }
    setRequestConfirmOpen(true);
  };

  const commitTimeOffRequest = () => {
    const date = holidayScope === 'week' ? selectedWeek : selectedDay;
    if (!date) return;
    requestFactoryTimeOff({
      date,
      name: holidayName,
      scope: holidayScope,
      days: holidayScope === 'range' ? rangeDays : undefined,
    });
    setHolidayName('');
    setTick((n) => n + 1);
    toast.success('Time-off request sent to Ceriga for approval');
  };

  const commitRemoveHoliday = () => {
    if (!removeHolidayId) return;
    removeFactoryHoliday(removeHolidayId);
    setRemoveHolidayId(null);
    setTick((n) => n + 1);
    toast.success('Holiday removed');
  };

  const goToday = () => {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedWeek(mondayOf(today));
    setSelectedDay(todayIso);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <CalendarDays className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Floor load</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Capacity calendar
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Block capacity weeks yourself, and request time off from Ceriga. Standard UK bank
            holidays are already approved. Custom days/weeks need superadmin approval before they
            block assignment. Monthly capacity: {ws.monthlyCapacity.toLocaleString()} units ·{' '}
            {fullCount} week{fullCount === 1 ? '' : 's'} blocked · {pendingRequests.length} pending
            request{pendingRequests.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/15 bg-white/[0.03] text-white/80 hover:bg-white/5 hover:text-white"
          onClick={goToday}
        >
          Today
        </Button>
      </div>

      {!canManage ? (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100/90">
          View only — your role can’t change capacity or holidays.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-[11px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-400/80" /> Approved holiday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-400/80" /> Pending request
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/80" /> Capacity full
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#CC2D24]" /> Today
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v.year, v.month, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/5 hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {monthTitle(view.year, view.month)}
              </h2>
              <p className="text-[11px] text-white/40">
                {monthBlocked} weeks blocked · {monthHolidays.length} holidays
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView((v) => addMonths(v.year, v.month, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/5 hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] border-b border-white/[0.06] bg-black/25 sm:grid-cols-[48px_repeat(7,minmax(0,1fr))]">
            <div className="px-1 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-white/25 sm:text-[10px]">
              Wk
            </div>
            {DOW.map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white/40 sm:text-[11px]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/[0.06]">
            {weeks.map((row, weekIndex) => {
              const weekStart = row[0].weekStart;
              const full = isCapacityWeekFull(weekStart);
              const holidayWeek = isHolidayWeek(weekStart);
              const weekSelected = selectedWeek === weekStart && !selectedDay;
              return (
                <div
                  key={weekStart}
                  className={cn(
                    'grid grid-cols-[40px_repeat(7,minmax(0,1fr))] sm:grid-cols-[48px_repeat(7,minmax(0,1fr))]',
                    full && 'bg-amber-500/[0.1]',
                    holidayWeek && !full && 'bg-sky-500/[0.08]',
                    weekSelected && 'bg-[#CC2D24]/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectWeek(weekStart)}
                    onDoubleClick={() => requestToggle(weekStart)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 border-r border-white/[0.06] py-2 transition hover:bg-white/[0.04]',
                      full ? 'text-amber-200' : holidayWeek ? 'text-sky-200' : 'text-white/35',
                    )}
                    title="Select week"
                  >
                    {full ? <Lock className="h-3 w-3" /> : holidayWeek ? <PartyPopper className="h-3 w-3" /> : null}
                    <span className="text-[10px] font-medium tabular-nums">{weekIndex + 1}</span>
                  </button>
                  {row.map((cell) => {
                    const dayHs = holidaysByDate.get(cell.iso) ?? [];
                    const approvedHs = dayHs.filter((h) => h.status === 'approved');
                    const pendingHs = dayHs.filter((h) => h.status === 'pending');
                    const onHoliday = approvedHs.length > 0 || (holidayWeek && cell.inMonth);
                    const onPending = pendingHs.length > 0;
                    const daySelected = selectedDay === cell.iso;
                    const label =
                      approvedHs[0]?.name ??
                      pendingHs[0]?.name ??
                      (holidayWeek ? 'Holiday week' : null);
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => selectDay(cell.iso, cell.weekStart)}
                        className={cn(
                          'relative min-h-[68px] border-r border-white/[0.04] p-1.5 text-left last:border-r-0 transition hover:bg-white/[0.04] sm:min-h-[80px] sm:p-2',
                          daySelected && 'bg-white/[0.06] ring-1 ring-inset ring-[#CC2D24]/45',
                          onHoliday && cell.inMonth && !full && 'bg-sky-500/[0.06]',
                          onPending && !onHoliday && cell.inMonth && 'bg-violet-500/[0.08]',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] tabular-nums sm:h-8 sm:w-8 sm:text-[13px]',
                            !cell.inMonth && 'text-white/20',
                            cell.inMonth && !cell.isToday && !full && !onHoliday && !onPending && 'text-white/80',
                            cell.inMonth && onHoliday && !cell.isToday && 'text-sky-100',
                            cell.inMonth && onPending && !onHoliday && !cell.isToday && 'text-violet-100',
                            cell.inMonth && full && !cell.isToday && 'text-amber-50',
                            cell.isToday &&
                              'bg-[#CC2D24] font-semibold text-white shadow-[0_0_0_1px_rgba(204,45,36,0.5)]',
                          )}
                        >
                          {cell.day}
                        </span>
                        {label && cell.inMonth ? (
                          <span
                            className={cn(
                              'mt-1 block truncate text-[9px] font-medium sm:text-[10px]',
                              onPending && !onHoliday ? 'text-violet-200/90' : 'text-sky-200/90',
                            )}
                          >
                            {onPending && !onHoliday ? 'Pending · ' : ''}
                            {shortHolidayName(label)}
                          </span>
                        ) : full && cell.inMonth ? (
                          <span className="mt-1 block truncate text-[9px] font-medium uppercase tracking-wide text-amber-200/80 sm:text-[10px]">
                            Full
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <p className="border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-white/35 sm:px-5">
            Click a day for holidays · click the week number to manage capacity · double-click week
            number to toggle full.
          </p>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Selected day
            </p>
            {selectedDay ? (
              <>
                <p className="mt-2 text-base font-semibold text-white">
                  {formatFactoryDate(selectedDay)}
                </p>

                {dayHolidays.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {dayHolidays.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-start justify-between gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-sky-50">{h.name}</p>
                          <p className="text-[10px] text-sky-100/50">
                            {holidayScopeLabel(h)}
                            {h.scope === 'range'
                              ? ` · ${formatFactoryDate(h.date)} – ${formatFactoryDate(holidayEndDate(h))}`
                              : ''}{' '}
                            ·{' '}
                            {h.source === 'fixed'
                              ? 'Standard'
                              : h.status === 'pending'
                                ? 'Awaiting Ceriga'
                                : h.status === 'declined'
                                  ? 'Declined'
                                  : 'Approved'}
                          </p>
                        </div>
                        {h.source === 'custom' &&
                        canManage &&
                        (h.status === 'pending' || h.status === 'declined') ? (
                          <button
                            type="button"
                            onClick={() => setRemoveHolidayId(h.id)}
                            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                            aria-label="Withdraw request"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[12px] text-white/40">No holiday on this day.</p>
                )}

                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Request time off
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Sent to Ceriga superadmin — only approved requests block the calendar.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'week' as const, label: 'Week off' },
                        { id: 'range' as const, label: 'Custom days' },
                        { id: 'day' as const, label: '1 day' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setHolidayScope(opt.id)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-[11px] font-medium',
                          holidayScope === opt.id
                            ? 'border-violet-500/40 bg-violet-500/15 text-violet-100'
                            : 'border-white/10 text-white/45',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {holidayScope === 'range' && selectedDay ? (
                    <div className="mt-3">
                      <p className="text-[11px] text-white/40">
                        From {formatFactoryDate(selectedDay)} · how many days?
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {RANGE_DAY_OPTIONS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRangeDays(n)}
                            className={cn(
                              'min-w-[2.25rem] rounded-lg border px-2 py-1 text-[11px] font-medium tabular-nums',
                              rangeDays === n
                                ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                                : 'border-white/10 text-white/45 hover:text-white/70',
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-[11px] text-white/40">Or enter</label>
                        <Input
                          type="number"
                          min={2}
                          max={30}
                          value={rangeDays}
                          disabled={!canManage}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            setRangeDays(Math.min(30, Math.max(2, Math.round(n))));
                          }}
                          className="h-8 w-16 border-white/10 bg-black/20 text-[12px] text-white"
                        />
                        <span className="text-[11px] text-white/35">days</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-sky-200/70">
                        {rangePreview(selectedDay, rangeDays)} ({rangeDays} days)
                      </p>
                    </div>
                  ) : null}

                  <Input
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    disabled={!canManage}
                    placeholder={
                      holidayScope === 'week'
                        ? 'e.g. Summer shutdown / machinery upgrade'
                        : holidayScope === 'range'
                          ? 'e.g. Bridge days / long weekend'
                          : 'e.g. Local festival'
                    }
                    className="mt-2 border-white/10 bg-black/20 text-[12px] text-white placeholder:text-white/25"
                  />
                  <Button
                    type="button"
                    disabled={!canManage}
                    className="mt-2 w-full bg-violet-600 text-white hover:bg-violet-500"
                    onClick={addHoliday}
                  >
                    <PartyPopper className="mr-1.5 h-3.5 w-3.5" />
                    {holidayScope === 'week'
                      ? 'Request week off'
                      : holidayScope === 'range'
                        ? `Request ${rangeDays} days off`
                        : 'Request day off'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-white/40">Select a day on the calendar.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Selected week · capacity
            </p>
            {selectedWeek ? (
              <>
                <p className="mt-2 text-sm font-semibold text-white">
                  {weekRangeLabel(selectedWeek)}
                </p>
                {weekHolidays.length > 0 ? (
                  <p className="mt-1 text-[11px] text-sky-200/80">
                    Includes: {weekHolidays.map((h) => h.name).join(', ')}
                  </p>
                ) : null}

                <div
                  className={cn(
                    'mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset',
                    selectedFull
                      ? 'bg-amber-500/15 text-amber-100 ring-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-100 ring-emerald-500/25',
                  )}
                >
                  {selectedFull ? (
                    <>
                      <Lock className="h-3 w-3" /> Blocked full
                    </>
                  ) : (
                    'Open for assignment'
                  )}
                </div>

                <Button
                  type="button"
                  disabled={!canManage}
                  className={cn(
                    'mt-4 w-full',
                    selectedFull
                      ? 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/10'
                      : 'bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90',
                  )}
                  onClick={() => requestToggle(selectedWeek)}
                >
                  {selectedFull ? 'Open this week' : 'Block week as full'}
                </Button>

                {selectedFull ? (
                  <div className="mt-3">
                    <label className="text-[11px] text-white/40">Capacity note</label>
                    <Input
                      value={noteDraft[selectedWeek] ?? selectedBlock?.note ?? ''}
                      disabled={!canManage}
                      onChange={(e) =>
                        setNoteDraft((d) => ({ ...d, [selectedWeek]: e.target.value }))
                      }
                      onBlur={() => {
                        if (!canManage || !selectedWeek) return;
                        const next = (noteDraft[selectedWeek] ?? selectedBlock?.note ?? '').trim();
                        if (next === (selectedBlock?.note ?? '')) return;
                        updateCapacityWeekNote(selectedWeek, next);
                        setTick((n) => n + 1);
                      }}
                      placeholder="Shutdown, maintenance…"
                      className="mt-1.5 border-white/10 bg-black/20 text-[12px] text-white placeholder:text-white/25"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              This month
            </p>
            {monthHolidays.length === 0 ? (
              <p className="mt-2 text-[12px] text-white/35">No holidays in this month.</p>
            ) : (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {monthHolidays.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-2 text-[12px]">
                    <div>
                      <p className="font-medium text-white/85">{h.name}</p>
                      <p className="text-[10px] text-white/40">
                        {formatFactoryDate(h.date)}
                        {h.scope === 'week'
                          ? ' · week'
                          : h.scope === 'range'
                            ? ` · ${h.days ?? 1} days`
                            : ''}
                        {h.source === 'fixed'
                          ? ' · standard'
                          : h.status === 'pending'
                            ? ' · pending'
                            : h.status === 'declined'
                              ? ' · declined'
                              : ' · approved'}
                      </p>
                    </div>
                    {h.source === 'custom' &&
                    canManage &&
                    (h.status === 'pending' || h.status === 'declined') ? (
                      <button
                        type="button"
                        onClick={() => setRemoveHolidayId(h.id)}
                        className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={pendingBlock != null}
        onOpenChange={(open) => {
          if (!open) setPendingBlock(null);
        }}
        title={pendingBlock?.makeFull ? 'Block week as full?' : 'Open week for assignment?'}
        description={
          pendingBlock?.makeFull
            ? `Ceriga will treat ${pendingBlock ? weekRangeLabel(pendingBlock.weekStart) : ''} as at capacity and avoid new assignments.`
            : `Allow new Ceriga assignments into ${pendingBlock ? weekRangeLabel(pendingBlock.weekStart) : ''}.`
        }
        confirmLabel={pendingBlock?.makeFull ? 'Block week' : 'Open week'}
        onConfirm={commitToggle}
      />

      <ConfirmDialog
        open={requestConfirmOpen}
        onOpenChange={setRequestConfirmOpen}
        title="Send time-off request to Ceriga?"
        description={
          holidayScope === 'week'
            ? `Request week off starting ${selectedWeek ? formatFactoryDate(selectedWeek) : ''} (“${holidayName.trim()}”). Superadmin must approve before it blocks assignments.`
            : holidayScope === 'range' && selectedDay
              ? `Request ${rangeDays} days off from ${formatFactoryDate(selectedDay)} (“${holidayName.trim()}”). Awaits Ceriga approval.`
              : `Request day off on ${selectedDay ? formatFactoryDate(selectedDay) : ''} (“${holidayName.trim()}”). Awaits Ceriga approval.`
        }
        confirmLabel="Send request"
        onConfirm={commitTimeOffRequest}
      />

      <ConfirmDialog
        open={removeHolidayId != null}
        onOpenChange={(open) => {
          if (!open) setRemoveHolidayId(null);
        }}
        title="Withdraw time-off request?"
        description="Approved holidays stay until Ceriga changes them. You can only withdraw pending or declined requests."
        confirmLabel="Withdraw"
        onConfirm={commitRemoveHoliday}
      />
    </div>
  );
}
