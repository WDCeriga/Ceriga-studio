import { Link } from 'react-router';
import { Building2, ChevronRight, Users } from 'lucide-react';
import { AUDIENCE_META, getProfilesForAudience, type AccessAudience } from '../../../data/crmAccessMock';
import { AccessBreadcrumb } from './accessShared';
import { cn } from '../../../components/ui/utils';

const AUDIENCE_ICONS = {
  users: Users,
  workers: Building2,
} as const;

/** Manufacturers live under /superadmin/manufacturers — not Roles & access. */
const AUDIENCES: Exclude<AccessAudience, 'manufacturers'>[] = ['users', 'workers'];

export function SuperAdminCRMAccess() {
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
          const count = getProfilesForAudience(audience).length;

          return (
            <Link
              key={audience}
              to={`/superadmin/crm/access/${audience}`}
              className="group rounded-2xl border border-white/[0.08] bg-[#111113] p-5 transition hover:border-white/[0.14] hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
              style={{
                background: `linear-gradient(145deg, ${meta.accent}10 0%, #111113 55%)`,
              }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30"
                style={{ color: meta.accent }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">{meta.title}</h2>
              <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <span className="text-[11px] text-white/35">
                  {count} profile{count === 1 ? '' : 's'}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#CC2D24]',
                  )}
                >
                  Open
                  <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
