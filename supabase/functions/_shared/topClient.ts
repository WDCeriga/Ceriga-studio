/** Alibaba / TOP Open Platform signed REST client (Deno). */

const TOP_GATEWAY = 'https://eco.taobao.com/router/rest';

export type TopCredentials = {
  appKey: string;
  appSecret: string;
  session: string;
  accountId: string;
};

export type TopConnectionStatus =
  | { configured: false; reason: 'missing_secrets' }
  | { configured: true; accountId: string };

export function readTopCredentials(): TopCredentials | null {
  const appKey = Deno.env.get('ALIBABA_APP_KEY')?.trim() ?? '';
  const appSecret = Deno.env.get('ALIBABA_APP_SECRET')?.trim() ?? '';
  const session = Deno.env.get('ALIBABA_SESSION')?.trim() ?? '';
  const accountId = Deno.env.get('ALIBABA_ACCOUNT_ID')?.trim() ?? '';
  if (!appKey || !appSecret || !session || !accountId) return null;
  return { appKey, appSecret, session, accountId };
}

export function getTopConnectionStatus(): TopConnectionStatus {
  const creds = readTopCredentials();
  if (!creds) return { configured: false, reason: 'missing_secrets' };
  return { configured: true, accountId: creds.accountId };
}

function gmt8Timestamp(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const gmt8 = new Date(utc + 8 * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${gmt8.getFullYear()}-${pad(gmt8.getMonth() + 1)}-${pad(gmt8.getDate())} ` +
    `${pad(gmt8.getHours())}:${pad(gmt8.getMinutes())}:${pad(gmt8.getSeconds())}`
  );
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function flattenParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

export async function topCall<T = unknown>(
  method: string,
  businessParams: Record<string, unknown>,
  creds: TopCredentials,
): Promise<T> {
  const system: Record<string, string> = {
    method,
    app_key: creds.appKey,
    session: creds.session,
    timestamp: gmt8Timestamp(),
    format: 'json',
    v: '2.0',
    sign_method: 'hmac-sha256',
    simplify: 'true',
  };

  const all = { ...system, ...flattenParams(businessParams) };
  const sortedKeys = Object.keys(all).sort();
  const base = sortedKeys.map((k) => `${k}${all[k]}`).join('');
  const sign = await hmacSha256Hex(creds.appSecret, base);
  all.sign = sign;

  const body = new URLSearchParams(all);
  const res = await fetch(TOP_GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });

  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Alibaba TOP returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (json.error_response) {
    const err = json.error_response as {
      code?: string | number;
      msg?: string;
      sub_code?: string;
      sub_msg?: string;
    };
    const parts = [err.msg, err.sub_msg, err.sub_code].filter(Boolean);
    throw new Error(parts.join(' — ') || `Alibaba TOP error ${String(err.code ?? res.status)}`);
  }

  return json as T;
}
