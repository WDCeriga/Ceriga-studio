import { Link } from 'react-router';
import { ArrowRight, Package, Users, TrendingUp, MessageSquare } from 'lucide-react';
import { MOCK_SUPER_ORDERS, MOCK_SUPER_USERS, MOCK_THREADS } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';

export function SuperAdminDashboard() {
  const pendingOrders = MOCK_SUPER_ORDERS.filter((o) => ['submitted', 'assigned', 'priced'].includes(o.status)).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Overview of users, orders, and conversations. Connect your API to replace mock data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total users', value: String(MOCK_SUPER_USERS.length), icon: Users, to: '/superadmin/users' },
          { label: 'Open order actions', value: String(pendingOrders), icon: Package, to: '/superadmin/orders' },
          { label: 'Active chats', value: String(MOCK_THREADS.length), icon: MessageSquare, to: '/superadmin/messages' },
          { label: 'Revenue (mock)', value: '£12.4k', icon: TrendingUp, to: '/superadmin/statistics' },
        ].map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group rounded-2xl border border-white/[0.08] bg-[#111113] p-5 transition hover:border-white/15 hover:bg-[#141416]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{c.label}</div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-white">{c.value}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[#CC2D24]">
                <c.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-[11px] font-medium text-[#CC2D24] opacity-0 transition group-hover:opacity-100">
              Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="bg-[#CC2D24] hover:bg-[#CC2D24]/90">
            <Link to="/superadmin/users">Email all users</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">
            <Link to="/superadmin/orders">Review orders</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">
            <Link to="/superadmin/crm">Manage catalog & roles</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
