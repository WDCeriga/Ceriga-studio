import { Link } from 'react-router';
import { Mail, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SUPER_USERS } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export function SuperAdminUsers() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Users</h1>
          <p className="mt-1 text-sm text-white/45">View accounts, broadcast email, or push in-app notifications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
            onClick={() => toast.success('Mock: compose email to all users')}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email everyone
          </Button>
          <Button
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            onClick={() => toast.success('Mock: notification queued for all devices')}
          >
            <Bell className="mr-2 h-4 w-4" />
            Notify app
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {MOCK_SUPER_USERS.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{u.name}</div>
                    <div className="text-xs text-white/45">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-white/15 text-white/80">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white/80">{u.credits}</td>
                  <td className="px-4 py-3 tabular-nums text-white/80">{u.ordersCount}</td>
                  <td className="px-4 py-3 text-white/55">{u.lastActive}</td>
                  <td className="px-4 py-3">
                    <Button asChild size="sm" variant="ghost" className="text-[#CC2D24] hover:bg-white/5 hover:text-[#CC2D24]">
                      <Link to={`/superadmin/users/${u.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
