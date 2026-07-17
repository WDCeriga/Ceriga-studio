import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Search } from 'lucide-react';
import {
  AUDIENCE_META,
  PAGE_ACCESS,
  countEnabledPages,
  getProfileAccess,
  getProfilesForAudience,
  type AccessAudience,
} from '../../../data/crmAccessMock';
import { AccessBreadcrumb, BackLink, ProfileCard } from './accessShared';

const VALID_AUDIENCES = new Set<string>(['users', 'workers']);

export function SuperAdminCRMAccessList() {
  const { audience: audienceParam } = useParams<{ audience: string }>();
  const [search, setSearch] = useState('');

  if (audienceParam === 'manufacturers') {
    return <Navigate to="/superadmin/manufacturers" replace />;
  }

  if (!audienceParam || !VALID_AUDIENCES.has(audienceParam)) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] px-6 py-16 text-center">
        <p className="text-sm text-white/50">Unknown audience.</p>
      </div>
    );
  }

  const audience = audienceParam as AccessAudience;
  const meta = AUDIENCE_META[audience];
  const profiles = getProfilesForAudience(audience);
  const totalPages = PAGE_ACCESS[audience].length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  return (
    <div className="space-y-6">
      <AccessBreadcrumb audience={audience} />
      <BackLink to="/superadmin/crm/access" label="All audiences" />

      <div>
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: meta.accent }}
        >
          {meta.title}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {meta.title} profiles
        </h1>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${meta.title.toLowerCase()}…`}
          className="h-9 w-full border-0 border-b border-white/15 bg-transparent pl-7 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#CC2D24]/70"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#111113] px-6 py-16 text-center">
          <p className="text-sm text-white/45">No profiles match.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const access = getProfileAccess(user.id);
            const enabledCount = access ? countEnabledPages(access) : totalPages;

            return (
              <ProfileCard
                key={user.id}
                user={user}
                audience={audience}
                meta={meta}
                enabledCount={enabledCount}
                totalPages={totalPages}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
