import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function ManufacturerMessagingTeam() {
  const { user, usingSupabase } = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!usingSupabase || !user?.id) return;
    const { data, error } = await getSupabase().from('manufacturer_profiles').select('messaging_team_emails').eq('user_id', user.id).maybeSingle();
    setError(error?.message || '');
    setEmails(data?.messaging_team_emails || []);
  }, [usingSupabase, user?.id]);
  useEffect(() => { void load(); }, [load]);
  if (!usingSupabase) return null;
  const change = async (address: string, enabled: boolean) => {
    setBusy(true);
    try {
      const { error } = await getSupabase().rpc('set_messaging_teammate', { p_email: address, p_enabled: enabled });
      if (error) throw error;
      if (enabled) setEmail('');
      await load();
      toast.success(enabled ? 'Teammate can now access your Ceriga conversation' : 'Messaging access removed');
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border border-[#252528] bg-[#111113] p-5">
    <h2 className="text-sm font-semibold text-white">Team messaging access</h2>
    <p className="text-xs text-white/50">These teammates share your factory’s conversation with Ceriga. They must sign in with the verified email below and open Messages.</p>
    {error && <p role="alert" className="text-sm text-red-300">{error} <button onClick={() => void load()} className="underline">Retry</button></p>}
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void change(email, true); }}>
      <Input aria-label="Messaging teammate email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@factory.com" className="text-white" disabled={busy} />
      <Button disabled={busy || !email.trim()} type="submit">Add teammate</Button>
    </form>
    {!emails.length && !error && <p className="text-xs text-white/40">No messaging teammates added yet.</p>}
    {emails.map(address => <div key={address} className="flex items-center justify-between gap-2 text-sm text-white/75"><span>{address}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => void change(address, false)}>Remove access</Button></div>)}
  </section>;
}
