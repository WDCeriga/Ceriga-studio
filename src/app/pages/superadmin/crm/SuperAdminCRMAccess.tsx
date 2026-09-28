import { Link } from 'react-router';
import { Building2, ChevronRight, Users } from 'lucide-react';
import { AUDIENCE_META, getProfilesForAudience, type AccessAudience } from '../../../data/crmAccessMock';
import { useSuperadminData } from '../../../hooks/useSuperadminData';
import { PageLoadingFallback } from '../../../components/PageLoadingFallback';
import { AccessBreadcrumb } from './accessShared';
import { cn } from '../../../components/ui/utils';

const AUDIENCE_ICONS = {
  users: Users,
  workers: Building2,
} as const;

/** Manufacturers live under /superadmin/manufacturers — not Roles & access. */
const AUDIENCES: Exclude<AccessAudience, 'manufacturers'>[] = ['users', 'workers'];

export function SuperAdminCRMAccess() {
  const { users, loading } = useSuperadminData();

  if (loading) {
    return <PageLoadingFallback />;
  }

  return (
    <div className="space-y-6">
      <AccessBreadcrumb />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
          Roles & access
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Who can see what
        </h1>
        <p className="mt-2 text-sm text-white/40">
          Brand and worker portal access.{' '}
          <Link to="/superadmin/manufacturers" className="text-[#CC2D24] hover:underline">
            Manage manufacturers
          </Link>{' '}
          in their own section.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {AUDIENCES.map((audience) => {
          const meta = AUDIENCE_META[audience];
          const Icon = AUDIENCE_ICONS[audience];
          const count = getProfilesForAudience(audience, users).length;

          return (
            <Link
              key={audience}
              to={`/superadmin/crm/access/${audience}`}
              className={cn(
                'group flex items-center justify-between gap-4 rounded-2xl border border-[#252528] bg-[#111113] p-5 transition hover:border-white/15',
              )}
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `${meta.accent}18`, color: meta.accent }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">{meta.title}</h2>
                  <p className="mt-1 text-sm text-white/45">{meta.subtitle}</p>
                  <p className="mt-3 text-[11px] tabular-nums text-white/35">
                    {count} account{count === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#CC2D24]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
