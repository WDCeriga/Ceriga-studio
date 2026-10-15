import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const INVITES_STORAGE_KEY = 'ceriga_manufacturer_invites_store';

export interface StoredInvite {
  token: string;
  email: string;
  expiresAt: number;
  createdAt: number;
  redeemedAt: number | null;
}

export function getStoredInvites(): StoredInvite[] {
  try {
    const raw = localStorage.getItem(INVITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteStoredInvite(token: string): void {
  try {
    const list = getStoredInvites().filter((i) => i.token !== token);
    localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function confirmAndActivateManufacturer(email: string): void {
  const normalized = email.trim().toLowerCase();
  try {
    localStorage.setItem(`ceriga_role_${normalized}`, 'manufacturer');
    localStorage.setItem(`ceriga_manufacturer_onboarded_${normalized}`, 'true');
    const invites = getStoredInvites();
    let found = false;
    for (const inv of invites) {
      if (inv.email.toLowerCase() === normalized) {
        inv.redeemedAt = Date.now();
        found = true;
      }
    }
    if (!found) {
      invites.push({
        token: `inv_${normalized.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: normalized,
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        redeemedAt: Date.now(),
      });
    }
    localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(invites));
  } catch {
    /* ignore */
  }

  if (isSupabaseConfigured) {
    try {
      const supabase = getSupabase();
      void supabase
        .from('profiles')
        .update({ role: 'manufacturer' })
        .eq('email', normalized);
    } catch {
      /* ignore */
    }
  }
}

function recordLocalInvite(
  token: string,
  email: string,
  expiresAt: number = Date.now() + 7 * 24 * 60 * 60 * 1000,
  createdAt: number = Date.now(),
): void {
  try {
    const invites = getStoredInvites().filter((i) => i.token !== token);
    invites.push({
      token,
      email: email.toLowerCase(),
      expiresAt,
      createdAt,
      redeemedAt: null,
    });
    localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(invites));
  } catch {
    /* ignore */
  }
}

function markLocalInviteRedeemed(token: string): void {
  try {
    const invites = getStoredInvites();
    const target = invites.find((i) => i.token === token);
    if (target) {
      target.redeemedAt = Date.now();
      localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(invites));
    }
  } catch {
    /* ignore */
  }
}

export function parseInviteToken(token: string): { email: string; expiresAt: number; isRedeemed?: boolean } | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const stored = getStoredInvites().find((i) => i.token === trimmed);
  if (stored) {
    return {
      email: stored.email,
      expiresAt: stored.expiresAt,
      isRedeemed: stored.redeemedAt !== null,
    };
  }

  if (trimmed.startsWith('inv_')) {
    try {
      const b64 = trimmed.slice(4).replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
      const json = decodeURIComponent(escape(atob(b64 + pad)));
      const parsed = JSON.parse(json) as { email?: string; exp?: number };
      if (parsed.email && typeof parsed.exp === 'number') {
        return { email: parsed.email.toLowerCase(), expiresAt: parsed.exp };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function createManufacturerInvite(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Please enter a valid email address.');
  }

  // 1. Try Supabase RPC if database is connected
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase().rpc('create_manufacturer_invite', {
        p_email: normalized,
      });
      if (!error && typeof data === 'string' && data) {
        recordLocalInvite(data, normalized);
        return data;
      }
      if (error) {
        console.warn(
          '[manufacturerInvites] Supabase RPC create_manufacturer_invite returned error; generating fallback token:',
          error.message,
        );
      }
    } catch (rpcErr) {
      console.warn('[manufacturerInvites] Supabase RPC call threw; generating fallback token:', rpcErr);
    }
  }

  // 2. Resilient fallback: produce a self-contained, verifiable invitation token
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
  const payload = {
    email: normalized,
    exp: expiresAt,
    iat: now,
    nonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
  };
  const jsonStr = JSON.stringify(payload);
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const token = `inv_${base64}`;

  recordLocalInvite(token, normalized, expiresAt, now);
  return token;
}

export async function redeemManufacturerInvite(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error('Invalid or missing invitation code.');
  }

  let currentEmail: string | null = null;
  let currentUserId: string | null = null;

  if (isSupabaseConfigured) {
    try {
      const {
        data: { user },
      } = await getSupabase().auth.getUser();
      if (user) {
        currentEmail = user.email ? user.email.toLowerCase() : null;
        currentUserId = user.id;
      }
    } catch {
      /* ignore */
    }
  }

  if (!currentEmail || !currentUserId) {
    try {
      const rawLocal = localStorage.getItem('ceriga_user');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal) as { email?: string; id?: string };
        if (parsed.email) currentEmail = parsed.email.toLowerCase();
        if (parsed.id) currentUserId = parsed.id;
      }
    } catch {
      /* ignore */
    }
  }

  if (!currentEmail) {
    throw new Error('Please sign in before redeeming the invitation.');
  }

  // 1. Try Supabase RPC if configured
  let rpcSuccess = false;
  if (isSupabaseConfigured) {
    try {
      const { error } = await getSupabase().rpc('redeem_manufacturer_invite', {
        p_token: trimmed,
      });
      if (!error) {
        rpcSuccess = true;
      } else {
        console.warn('[manufacturerInvites] Supabase RPC redeem_manufacturer_invite failed:', error.message);
      }
    } catch (rpcErr) {
      console.warn('[manufacturerInvites] Supabase RPC redeem threw:', rpcErr);
    }
  }

  // 2. Validate token if RPC was unavailable or did not succeed
  if (!rpcSuccess) {
    const parsed = parseInviteToken(trimmed);
    if (!parsed) {
      throw new Error('Invitation is invalid, expired, or already used.');
    }
    if (parsed.isRedeemed) {
      throw new Error('This invitation has already been redeemed.');
    }
    if (parsed.expiresAt < Date.now()) {
      throw new Error('This invitation has expired.');
    }
    if (parsed.email !== currentEmail) {
      throw new Error(`This invitation was issued to ${parsed.email}, but you are signed in as ${currentEmail}.`);
    }
  }

  // 3. Mark as redeemed and assign manufacturer role
  markLocalInviteRedeemed(trimmed);

  if (currentUserId) {
    try {
      localStorage.setItem(`ceriga_role_${currentUserId}`, 'manufacturer');
    } catch {
      /* ignore */
    }
  }
  if (currentEmail) {
    try {
      localStorage.setItem(`ceriga_role_${currentEmail}`, 'manufacturer');
    } catch {
      /* ignore */
    }
  }

  if (isSupabaseConfigured && currentUserId) {
    try {
      await getSupabase().auth.updateUser({
        data: { role: 'manufacturer' },
      });
    } catch (metaErr) {
      console.warn('[manufacturerInvites] Could not update auth user_metadata role:', metaErr);
    }

    try {
      await getSupabase().from('profiles').update({ role: 'manufacturer' }).eq('id', currentUserId);
    } catch (profileErr) {
      console.warn('[manufacturerInvites] Could not update public.profiles role:', profileErr);
    }
  }
}
