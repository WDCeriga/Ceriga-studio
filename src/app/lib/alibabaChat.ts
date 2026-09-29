import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type { ChatMessage } from '../data/superadminMock';

export type AlibabaConnectionStatus =
  | { configured: false; reason: 'missing_secrets' | 'not_configured' | 'error'; message?: string }
  | { configured: true; accountId: string };

export type AlibabaSyncResult = {
  ok: true;
  conversations: number;
  threadsUpserted: number;
  messagesUpserted: number;
};

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

async function invokeFunction<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
  });

  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = (await context.clone().json()) as { error?: string };
        if (payload?.error) throw new Error(payload.error);
      } catch (inner) {
        if (inner instanceof Error && inner.message !== error.message) throw inner;
      }
    }
    throw new Error(error.message || `Edge function ${name} failed`);
  }

  return data as T;
}

export async function getAlibabaConnectionStatus(): Promise<AlibabaConnectionStatus> {
  try {
    const data = await invokeFunction<AlibabaConnectionStatus | { error?: string }>(
      'alibaba-status',
    );
    if ('configured' in data) return data;
    return { configured: false, reason: 'error', message: 'Unexpected status response' };
  } catch (err) {
    return {
      configured: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'Could not reach Alibaba status function',
    };
  }
}

export async function syncAlibabaInbox(): Promise<AlibabaSyncResult> {
  return invokeFunction<AlibabaSyncResult>('alibaba-sync');
}

export async function sendAlibabaMessage(input: {
  threadId: string;
  body: string;
}): Promise<ChatMessage> {
  const data = await invokeFunction<{
    ok: true;
    message: { id: string; from: 'ceriga'; text: string; at: string };
  }>('alibaba-send', {
    threadId: input.threadId,
    body: input.body,
  });

  const at = new Date(data.message.at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    id: data.message.id,
    from: 'ceriga',
    text: data.message.text,
    at,
  };
}
