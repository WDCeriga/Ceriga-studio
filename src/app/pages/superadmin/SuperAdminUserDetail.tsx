import { Link, useParams } from 'react-router';
import { ArrowLeft, Coins, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SUPER_USERS } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export function SuperAdminUserDetail() {
  const { id } = useParams();
  const user = MOCK_SUPER_USERS.find((u) => u.id === id);

  if (!user) {
    return (
      <div className="text-white/60">
        User not found.{' '}
        <Link to="/superadmin/users" className="text-[#CC2D24] hover:underline">
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/superadmin/users"
          className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Users
        </Link>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">{user.name}</h1>
        <p className="mt-1 text-sm text-white/45">{user.email}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Coins className="h-4 w-4 text-[#CC2D24]" />
            Credits
          </h2>
          <p className="mt-2 text-xs text-white/45">Adjust wallet credits for this account.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/55">Balance</Label>
              <Input
                readOnly
                value={user.credits}
                className="w-28 border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">Add credits</Label>
              <Input type="number" placeholder="0" className="w-28 border-white/15 bg-white/5 text-white" />
            </div>
            <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={() => toast.success('Mock: credits updated')}>
              Save
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Shield className="h-4 w-4 text-[#CC2D24]" />
            Role & permissions
          </h2>
          <p className="mt-2 text-xs text-white/45">Maps to your future RBAC — workers vs manufacturers.</p>
          <div className="mt-4 space-y-3">
            <Label className="text-white/55">Platform role</Label>
            <Select defaultValue={user.role}>
              <SelectTrigger className="border-white/15 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                <SelectItem value="brand">Brand</SelectItem>
                <SelectItem value="manufacturer">Manufacturer (admin)</SelectItem>
                <SelectItem value="worker">Internal worker</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={() => toast.success('Mock: role saved')}>
              Update role
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Usage snapshot</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Orders</div>
            <div className="mt-1 text-2xl font-semibold text-white">{user.ordersCount}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Joined</div>
            <div className="mt-1 text-lg text-white/90">{user.createdAt}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Last active</div>
            <div className="mt-1 text-lg text-white/90">{user.lastActive}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
