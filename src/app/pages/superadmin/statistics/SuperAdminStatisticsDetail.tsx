import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
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
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel
          title="Revenue & margin"
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
              <YAxis {...axisProps} tickFormatter={(v) => `£${v / 1000}k`} />
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

        <ChartPanel title="Payment methods" className="lg:col-span-2">
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
        <ChartPanel title="Revenue by product">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByProduct} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={gridStroke} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} width={100} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number, _n, item) => [
                  `${v}% · £${(item.payload as { revenue: number }).revenue.toLocaleString()}`,
                  'Share',
                ]}
              />
              <Bar dataKey="value" fill={RED} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <DataTable
          title="Top revenue lines"
          columns={['Product', 'Share', 'Revenue']}
          rows={revenueByProduct.map((r) => [`${r.name}`, `${r.value}%`, `£${r.revenue.toLocaleString()}`])}
        />
      </div>
    </div>
  );
}

function UsersSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title="Signups & active users" className="lg:col-span-3">
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

        <ChartPanel title="Users by role" className="lg:col-span-2">
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
        <ChartPanel title="Daily active users">
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

        <ChartPanel title="Retention cohort">
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
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title="Order volume" className="lg:col-span-3">
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

        <ChartPanel title="Product mix" className="lg:col-span-2">
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
        <ChartPanel title="Pipeline status">
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

        <ChartPanel title="Fulfilment timing">
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
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel
          title="Allowance vs usage"
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

        <ChartPanel title="Subscribers by plan" className="lg:col-span-2">
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
        title="Plan breakdown"
        columns={['Plan', 'Subscribers', 'Est. MRR']}
        rows={chatPlansByTier.map((p) => [
          p.plan,
          p.subscribers.toLocaleString(),
          p.plan === 'Free' ? '—' : `£${(p.subscribers * (p.plan === 'Studio' ? 19 : p.plan === 'Scale' ? 49 : 99)).toLocaleString()}`,
        ])}
      />
    </div>
  );
}

function ManufacturersSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title="Partner throughput" className="lg:col-span-3">
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

        <ChartPanel title="Quote response time" className="lg:col-span-2">
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

      <DataTable
        title="Manufacturer leaderboard"
        columns={['Partner', 'Orders', 'Avg. quote (days)']}
        rows={manufacturerThroughput.map((m) => [m.name, m.orders, m.avgDays])}
      />
    </div>
  );
}

function EngagementSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <ChartPanel title="Engagement over time" className="lg:col-span-3">
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

        <ChartPanel title="Messages by channel" className="lg:col-span-2">
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

export function SuperAdminStatisticsDetail() {
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
