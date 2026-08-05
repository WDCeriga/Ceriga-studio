import { Link } from 'react-router';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { SuperAdminUser } from '../../../data/superadminMock';
import type { AccessAudience } from '../../../data/crmAccessMock';
import { AUDIENCE_META } from '../../../data/crmAccessMock';
import { cn } from '../../../components/ui/utils';

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfileAvatar({
  name,
  accent,
  className,
}: {
  name: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border font-bold text-white',
        className,
      )}
      style={{
        borderColor: accent ? `${accent}44` : 'rgba(255,255,255,0.1)',
        background: accent
          ? `linear-gradient(145deg, ${accent}22 0%, rgba(0,0,0,0.4) 100%)`
          : 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.3) 100%)',
      }}
    >
      {initials(name)}
    </div>
  );
}

export function AccessBreadcrumb({
  audience,
  profileName,
}: {
  audience?: AccessAudience;
  profileName?: string;
}) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] text-white/40">
      <Link to="/superadmin/crm" className="hover:text-white/70">
        CRM
      </Link>
      <ChevronRight className="h-3 w-3" />
      <Link to="/superadmin/crm/access" className="hover:text-white/70">
        Roles & access
      </Link>
      {audience ? (
        <>
          <ChevronRight className="h-3 w-3" />
          <Link
            to={`/superadmin/crm/access/${audience}`}
            className="hover:text-white/70"
          >
            {AUDIENCE_META[audience].title}
          </Link>
        </>
      ) : null}
      {profileName ? (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white/60">{profileName}</span>
        </>
      ) : null}
    </nav>
  );
}

export function ProfileCard({
  user,
  audience,
  meta,
  enabledCount,
  totalPages,
}: {
  user: SuperAdminUser;
  audience: AccessAudience;
  meta: (typeof AUDIENCE_META)[AccessAudience];
  enabledCount: number;
  totalPages: number;
}) {
  return (
    <Link
      to={`/superadmin/crm/access/${audience}/${user.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 transition hover:border-white/[0.14] hover:bg-[#141416]"
    >
      <ProfileAvatar name={user.name} accent={meta.accent} className="h-12 w-12 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white group-hover:text-[#F2F0EC]">
          {user.name}
        </p>
        <p className="truncate text-xs text-white/40">{user.email}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-medium text-[#CC2D24]">
          {enabledCount}/{totalPages} pages
        </p>
        <ChevronRight className="ml-auto mt-1 h-4 w-4 text-white/25 transition group-hover:text-white/50" />
      </div>
    </Link>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-white/45 transition hover:text-white/80"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
