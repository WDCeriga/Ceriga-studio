import { activeLocale as cerigaLocale } from '../../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
import { PortalReport } from '../../../components/PortalReport';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';
import { displayMoney,useCurrency } from '../../../lib/accountCurrency';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  chatPlansByTier,
  creditsPurchased,
  dailyActiveUsers,
  engagementTrend,
  fulfilmentDays,
  manufacturerQuoteTrend,
  manufacturerThroughput,
  messageByType,
  monthlyRevenue,
  orderVolumeTrend,
  ordersByKind,
  ordersByStatus,
  paymentMethods,
  revenueByProduct,
  SECTION_KPI,
  sectionTitle,
  userRetention,
  usersByRole,
  weeklySignups,
  type StatsPeriod,
  type StatsSectionId,
} from '../../../data/superadminStatsMock';
import { listFactoryRankings } from '../../../data/superadminFactoryOpsMock';
import {
  axisProps,
  ChartPanel,
  chartTooltipStyle,
  DataTable,
  gridStroke,
  KpiGrid,
  RED,
  StatsPageHeader,
} from './statsShared';

const PIE_COLORS = ['#CC2D24', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

const VALID_SECTIONS: StatsSectionId[] = [
  'financial',
  'users',
  'orders',
  'ai-chat',
  'manufacturers',
  'engagement',
];

function FinancialSection() {
  useCerigaTranslation();

useCurrency();
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel
          title={cerigaTranslate("interface.text_4425ed8a445f4cfd")}
          className="lg:col-span-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillMargin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="m" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => displayMoney(Math.round(v*100),'GBP')} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={RED}
                fill="url(#fillRev)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="margin"
                name="Margin"
                stroke="#3B82F6"
                fill="url(#fillMargin)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_16d26116c2f4536e")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={paymentMethods}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={3}
              >
                {paymentMethods.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v}%`, 'Share']} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title={cerigaTranslate("interface.text_f7e0b8036cbe5aca")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByProduct} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={gridStroke} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} width={100} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number, _n, item) => [
                  `${v}% · ${displayMoney(Math.round((item.payload as { revenue: number }).revenue*100),'GBP')}`,
                  'Share',
                ]}
              />
              <Bar dataKey="value" fill={RED} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <DataTable
          title={cerigaTranslate("interface.text_dccf80c412dae340")}
          columns={['Product', 'Share', 'Revenue']}
          rows={revenueByProduct.map((r) => [`${r.name}`, `${r.value}%`, displayMoney(Math.round(r.revenue*100),'GBP')])}
        />
      </div>
    </div>
  );
}

function UsersSection() {
  useCerigaTranslation();

useCurrency();
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title={cerigaTranslate("interface.text_035238b3154ada71")} className="lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklySignups}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="w" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Line type="monotone" dataKey="signups" name="Signups" stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="active" name="Active" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_a0ac619b23301afc")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usersByRole}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="role" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={RED} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title={cerigaTranslate("interface.text_952574378718517c")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyActiveUsers}>
              <defs>
                <linearGradient id="fillDau" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="d" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="users" stroke="#10B981" fill="url(#fillDau)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_820ad7a8cd78e038")}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={userRetention}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="week" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v}%`, 'Retained']} />
              <Line type="monotone" dataKey="retained" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}

function OrdersSection() {
  useCerigaTranslation();

useCurrency();
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title={cerigaTranslate("interface.text_943a2d16ab53183a")} className="lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderVolumeTrend}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="m" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Bar dataKey="techpack" name="Tech pack" fill={RED} radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="custom" name="Custom" fill="#3B82F6" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_58529d286b7cc294")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ordersByKind}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={4}
              >
                {ordersByKind.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? RED : '#3B82F6'} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v}%`, 'Share']} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title={cerigaTranslate("interface.text_9f96cc889f60f9b0")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ordersByStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={gridStroke} horizontal={false} />
              <XAxis type="number" {...axisProps} hide />
              <YAxis
                type="category"
                dataKey="status"
                stroke="rgba(255,255,255,0.45)"
                fontSize={10}
                width={110}
              />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={RED} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_694cb353e237ce2e")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fulfilmentDays}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="stage" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `${v}d`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v} days`, 'Avg.']} />
              <Bar dataKey="days" fill="#F59E0B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}

function AiChatSection() {
  useCerigaTranslation();

useCurrency();
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel
          title={cerigaTranslate("interface.text_afeb4a86e39b6e6f")}
          className="lg:col-span-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={creditsPurchased}>
              <defs>
                <linearGradient id="fillAllowance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillUsed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="m" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Area
                type="monotone"
                dataKey="purchased"
                name="Allowance"
                stroke={RED}
                fill="url(#fillAllowance)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="used"
                name="Messages sent"
                stroke="#10B981"
                fill="url(#fillUsed)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_326a9546fbaa573a")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chatPlansByTier} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={gridStroke} horizontal={false} />
              <XAxis type="number" {...axisProps} hide />
              <YAxis type="category" dataKey="plan" stroke="rgba(255,255,255,0.45)" fontSize={11} width={80} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="subscribers" fill={RED} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <DataTable
        title={cerigaTranslate("interface.text_bfaa5a064cf8d851")}
        columns={['Plan', 'Subscribers', 'Est. MRR']}
        rows={chatPlansByTier.map((p) => [
          p.plan,
          p.subscribers.toLocaleString(cerigaLocale()),
          p.plan === 'Free' ? '—' : displayMoney(p.subscribers * (p.plan === 'Studio' ? 1900 : p.plan === 'Scale' ? 4900 : 9900),'GBP'),
        ])}
      />
    </div>
  );
}

function ManufacturersSection() {
  useCerigaTranslation();

useCurrency();
  const rankings = listFactoryRankings();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title={cerigaTranslate("interface.text_d6ddb908366fe9b8")} className="lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={manufacturerThroughput}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="orders" fill={RED} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_c90e703e25299790")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={manufacturerQuoteTrend}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="m" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `${v}h`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v}h`, 'Avg.']} />
              <Line type="monotone" dataKey="avgHours" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_7a1008cea3e04d2b")}</h2>
            <p className="mt-0.5 text-[11px] text-white/40">{cerigaTranslate("interface.text_ab7edef83d38f8d3")}</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#252528] text-[11px] font-semibold uppercase tracking-wider text-white/40">
                <th className="pb-3 pr-3">#</th>
                <th className="pb-3 pr-4">{cerigaTranslate("interface.text_29035e784f9305c0")}</th>
                <th className="pb-3 pr-4">{cerigaTranslate("interface.text_38e5a46cbc5ad328")}</th>
                <th className="pb-3 pr-4">{cerigaTranslate("interface.text_4be2547225845431")}</th>
                <th className="pb-3 pr-4">{cerigaTranslate("interface.text_eb4cdebd82bf1194")}</th>
                <th className="pb-3 pr-4">{cerigaTranslate("interface.text_49b39509e9e70980")}</th>
                <th className="pb-3 pr-4">{cerigaTranslate("interface.text_ae65d096550ff4eb")}</th>
                <th className="pb-3">{cerigaTranslate("nav.orders")}</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => (
                <tr key={r.entityId} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-3 pr-3 tabular-nums text-white/50">{r.rank}</td>
                  <td className="py-3 pr-4">
                    <Link
                      to={`/superadmin/manufacturers/${r.userId}`}
                      className="font-medium text-white hover:text-[#CC2D24]"
                    >
                      {r.name}
                    </Link>
                    {r.live ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-emerald-300">{cerigaTranslate("interface.text_b64ac05f17e64d03")}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-white/80">{r.score}</td>
                  <td className="py-3 pr-4 tabular-nums text-white/70">{r.winRate}%</td>
                  <td className="py-3 pr-4 tabular-nums text-white/70">{r.avgQuoteHours}h</td>
                  <td className="py-3 pr-4 tabular-nums text-white/70">{r.otifPct}%</td>
                  <td className="py-3 pr-4 tabular-nums text-white/70">{r.capacityPct}%</td>
                  <td className="py-3 tabular-nums text-white/70">{r.ordersAssigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EngagementSection() {
  useCerigaTranslation();

useCurrency();
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title={cerigaTranslate("interface.text_c83da21f8a5e0a15")} className="lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={engagementTrend}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="m" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Line type="monotone" dataKey="messages" name="Messages" stroke={RED} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="emails" name="Emails" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
              <Line
                type="monotone"
                dataKey="notifications"
                name="Notifications"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title={cerigaTranslate("interface.text_324e42abd8dea27a")} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={messageByType} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={gridStroke} horizontal={false} />
              <XAxis type="number" {...axisProps} hide />
              <YAxis
                type="category"
                dataKey="type"
                stroke="rgba(255,255,255,0.45)"
                fontSize={10}
                width={130}
              />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill={RED} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}

const SECTION_VIEWS: Record<StatsSectionId, () => JSX.Element> = {
  financial: FinancialSection,
  users: UsersSection,
  orders: OrdersSection,
  'ai-chat': AiChatSection,
  manufacturers: ManufacturersSection,
  engagement: EngagementSection,
};

function SuperAdminStatisticsDetailPreview() {
useCurrency();
  const { section } = useParams<{ section: string }>();
  const [period, setPeriod] = useState<StatsPeriod>('month');

  if (section === 'credits') {
    return <Navigate to="/superadmin/statistics/ai-chat" replace />;
  }

  if (!section || !VALID_SECTIONS.includes(section as StatsSectionId)) {
    return <Navigate to="/superadmin/statistics" replace />;
  }

  const sectionId = section as StatsSectionId;
  const SectionView = SECTION_VIEWS[sectionId];

  return (
    <div className="space-y-8">
      <StatsPageHeader
        title={sectionTitle(sectionId)}
        period={period}
        onPeriodChange={setPeriod}
      />
      <KpiGrid items={SECTION_KPI[sectionId]} />
      <SectionView />
    </div>
  );
}

export function SuperAdminStatisticsDetail(){return isSupabaseConfigured?<PortalReport admin/>:<SuperAdminStatisticsDetailPreview/>;}
