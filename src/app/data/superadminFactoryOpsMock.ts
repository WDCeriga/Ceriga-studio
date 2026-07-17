/**
 * Superadmin view of factory scorecards (stats export KPIs) and team permission audit.
 */

import {
  getManufacturerOrderStats,
  listManufacturerProfiles,
  type ManufacturerProfile,
} from './manufacturersMock';
import {
  ALL_FACTORY_PERMISSIONS,
  FACTORY_PERMISSION_LABEL,
  getFactoryAnalytics,
  getFactoryWorkspace,
  memberPermissions,
  ROLE_PERMISSIONS,
  type FactoryPermission,
  type FactoryTeamMember,
  type FactoryTeamRole,
} from './manufacturerPortalMock';

export type FactoryScorecard = {
  entityId: string;
  userId: string;
  name: string;
  location: string;
  status: ManufacturerProfile['status'];
  live: boolean;
  periodLabel: string;
  winRate: number;
  avgQuoteHours: number;
  onTimePct: number;
  otifPct: number;
  capacityPct: number;
  quoteToOrderRate: number;
  ordersAssigned: number;
  completed: number;
  /** 0–100 composite used for rankings */
  score: number;
  rank: number;
};

export type FactoryTeamAuditMember = {
  id: string;
  name: string;
  email: string;
  role: FactoryTeamRole;
  status: FactoryTeamMember['status'];
  lastActive: string;
  permissions: FactoryPermission[];
  /** True when member.permissions override replaces role defaults */
  hasCustomOverride: boolean;
  canQuote: boolean;
  canDecline: boolean;
  canEditShipping: boolean;
  canEditMaterials: boolean;
};

export type FactoryTeamAudit = {
  entityId: string;
  factoryName: string;
  live: boolean;
  members: FactoryTeamAuditMember[];
  permissionMatrix: {
    permission: FactoryPermission;
    label: string;
    memberIds: string[];
    memberNames: string[];
  }[];
};

function compositeScore(input: {
  winRate: number;
  avgQuoteHours: number;
  onTimePct: number;
  otifPct: number;
  capacityPct: number;
}): number {
  // Faster quotes score higher (cap at 72h). Capacity health prefers ~60–85% use.
  const quoteScore = Math.max(0, 100 - (Math.min(input.avgQuoteHours, 72) / 72) * 100);
  const capacityHealth =
    input.capacityPct <= 85
      ? Math.min(100, 40 + input.capacityPct * 0.7)
      : Math.max(40, 100 - (input.capacityPct - 85) * 2);
  return Math.round(
    input.winRate * 0.28 +
      quoteScore * 0.22 +
      input.otifPct * 0.25 +
      input.onTimePct * 0.15 +
      capacityHealth * 0.1,
  );
}

function seedScorecard(profile: ManufacturerProfile): Omit<FactoryScorecard, 'rank'> {
  const orderStats = getManufacturerOrderStats(profile.entityId);
  const avgQuoteHours = Math.round(profile.avgQuoteDays * 24);
  const capacityPct =
    profile.entityId === 'm2' ? 78 : profile.entityId === 'm3' ? 64 : 71;
  const otifPct =
    profile.entityId === 'm2' ? 93 : profile.entityId === 'm3' ? 88 : 91;
  const winRate = profile.winRate;
  const onTimePct = profile.onTimeRate;
  return {
    entityId: profile.entityId,
    userId: profile.userId,
    name: profile.name,
    location: `${profile.location}, ${profile.country}`,
    status: profile.status,
    live: false,
    periodLabel: 'Last 90 days',
    winRate,
    avgQuoteHours,
    onTimePct,
    otifPct,
    capacityPct,
    quoteToOrderRate: profile.quoteToOrderRate,
    ordersAssigned: orderStats.totalOrders,
    completed: orderStats.completedOrders,
    score: compositeScore({
      winRate,
      avgQuoteHours,
      onTimePct,
      otifPct,
      capacityPct,
    }),
  };
}

function liveNorthMillsScorecard(profile: ManufacturerProfile): Omit<FactoryScorecard, 'rank'> {
  const a = getFactoryAnalytics(90);
  const orderStats = getManufacturerOrderStats(profile.entityId);
  return {
    entityId: profile.entityId,
    userId: profile.userId,
    name: profile.name,
    location: `${profile.location}, ${profile.country}`,
    status: profile.status,
    live: true,
    periodLabel: a.periodLabel,
    winRate: a.kpis.winRate,
    avgQuoteHours: a.kpis.avgQuoteHours,
    onTimePct: a.kpis.onTimePct,
    otifPct: a.kpis.otifPct,
    capacityPct: a.kpis.capacityPct,
    quoteToOrderRate: profile.quoteToOrderRate,
    ordersAssigned: orderStats.totalOrders,
    completed: a.kpis.completed,
    score: compositeScore({
      winRate: a.kpis.winRate,
      avgQuoteHours: a.kpis.avgQuoteHours,
      onTimePct: a.kpis.onTimePct,
      otifPct: a.kpis.otifPct,
      capacityPct: a.kpis.capacityPct,
    }),
  };
}

export function listFactoryScorecards(): FactoryScorecard[] {
  const rows = listManufacturerProfiles().map((p) =>
    p.entityId === 'm1' ? liveNorthMillsScorecard(p) : seedScorecard(p),
  );
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function getFactoryScorecard(userIdOrEntityId: string): FactoryScorecard | undefined {
  return listFactoryScorecards().find(
    (s) => s.userId === userIdOrEntityId || s.entityId === userIdOrEntityId,
  );
}

/** Ranked list for statistics leaderboard (same as scorecards, already ranked). */
export function listFactoryRankings(): FactoryScorecard[] {
  return listFactoryScorecards();
}

function toAuditMember(m: FactoryTeamMember): FactoryTeamAuditMember {
  const permissions = memberPermissions(m);
  const hasCustomOverride = Boolean(m.permissions && m.permissions.length > 0);
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status,
    lastActive: m.lastActive,
    permissions,
    hasCustomOverride,
    canQuote: permissions.includes('quote'),
    canDecline: permissions.includes('decline'),
    canEditShipping: permissions.includes('edit_shipping'),
    canEditMaterials: permissions.includes('edit_materials'),
  };
}

function seedEuroStitchTeam(): FactoryTeamMember[] {
  return [
    {
      id: 'es-tm1',
      name: 'Inês Costa',
      email: 'production@eurostitch.eu',
      role: 'admin',
      lastActive: '2026-04-11',
      status: 'active',
    },
    {
      id: 'es-tm2',
      name: 'Miguel Santos',
      email: 'quotes@eurostitch.eu',
      role: 'quoter',
      lastActive: '2026-04-10',
      status: 'active',
    },
    {
      id: 'es-tm3',
      name: 'Ana Ribeiro',
      email: 'floor@eurostitch.eu',
      role: 'production',
      lastActive: '2026-04-09',
      status: 'active',
    },
  ];
}

function seedPortoTeam(): FactoryTeamMember[] {
  return [
    {
      id: 'pg-tm1',
      name: 'Rui Mendes',
      email: 'hello@portogarment.pt',
      role: 'admin',
      lastActive: '2026-04-08',
      status: 'active',
    },
    {
      id: 'pg-tm2',
      name: 'Carla Dias',
      email: 'quotes@portogarment.pt',
      role: 'quoter',
      lastActive: '2026-04-07',
      status: 'active',
      // Custom override: can quote but cannot decline — useful audit example
      permissions: ['quote', 'view_stats'],
    },
    {
      id: 'pg-tm3',
      name: 'João Pinto',
      email: 'materials@portogarment.pt',
      role: 'production',
      lastActive: '2026-04-06',
      status: 'active',
    },
    {
      id: 'pg-tm4',
      name: 'Sofia Alves',
      email: 'sofia@portogarment.pt',
      role: 'viewer',
      lastActive: '2026-03-28',
      status: 'invited',
    },
  ];
}

function buildAudit(
  entityId: string,
  factoryName: string,
  live: boolean,
  team: FactoryTeamMember[],
): FactoryTeamAudit {
  const members = team.map(toAuditMember);
  const permissionMatrix = ALL_FACTORY_PERMISSIONS.map((permission) => {
    const who = members.filter((m) => m.permissions.includes(permission));
    return {
      permission,
      label: FACTORY_PERMISSION_LABEL[permission],
      memberIds: who.map((m) => m.id),
      memberNames: who.map((m) => m.name),
    };
  });
  return { entityId, factoryName, live, members, permissionMatrix };
}

export function getFactoryTeamAudit(userIdOrEntityId: string): FactoryTeamAudit | undefined {
  const profile = listManufacturerProfiles().find(
    (p) => p.userId === userIdOrEntityId || p.entityId === userIdOrEntityId,
  );
  if (!profile) return undefined;

  if (profile.entityId === 'm1') {
    const ws = getFactoryWorkspace();
    return buildAudit(profile.entityId, profile.name, true, ws.team);
  }
  if (profile.entityId === 'm2') {
    return buildAudit(profile.entityId, profile.name, false, seedEuroStitchTeam());
  }
  return buildAudit(profile.entityId, profile.name, false, seedPortoTeam());
}

export { FACTORY_PERMISSION_LABEL, ROLE_PERMISSIONS, ALL_FACTORY_PERMISSIONS };
