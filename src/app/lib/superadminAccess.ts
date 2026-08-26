import { getProfileAccess } from '../data/crmAccessMock';
import { MOCK_SUPER_USERS } from '../data/superadminMock';

/**
 * Explicit superadmin identities (full email or local-part before @).
 * Keep in sync with worker rows in MOCK_SUPER_USERS where possible.
 */
const SUPERADMIN_ALLOWLIST = new Set(
  ['owner@ceriga.io', 'xexead', 'xexead@ceriga.io', 'maya.chen@ceriga.io', 'j.okonkwo@ceriga.io'].map(
    (v) => v.toLowerCase(),
  ),
);

function normalizeEmail(email: string): { full: string; local: string } {
  const full = email.trim().toLowerCase();
  const local = full.split('@')[0] ?? full;
  return { full, local };
}

/** True when the signed-in user is allowlisted or assigned as an internal worker with superadmin pages. */
export function canAccessSuperadmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const { full, local } = normalizeEmail(email);

  if (SUPERADMIN_ALLOWLIST.has(full) || SUPERADMIN_ALLOWLIST.has(local)) {
    return true;
  }

  const mockUser = MOCK_SUPER_USERS.find((u) => u.email.toLowerCase() === full);
  if (!mockUser || mockUser.role !== 'worker') return false;

  const access = getProfileAccess(mockUser.id);
  return Boolean(access?.enabledPages.some((page) => page.startsWith('superadmin_')));
}
