import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function ManufacturerMessagingTeam() {
  useCerigaTranslation();

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
      toast.success(cerigaTranslateLabel(enabled ? cerigaTranslate("interface.text_f18c4a00853a94a7") : cerigaTranslate("interface.text_f8e0695325f76df6")));
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border border-[#252528] bg-[#111113] p-5">
    <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_fa7321b410bc6658")}</h2>
    <p className="text-xs text-white/50">{cerigaTranslate("interface.text_28e0e7acf66cbb0a")}</p>
    {error && <p role="alert" className="text-sm text-red-300">{cerigaTranslateLabel(error)} <button onClick={() => void load()} className="underline">{cerigaTranslate("interface.text_942087cc2d41e013")}</button></p>}
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void change(email, true); }}>
      <Input aria-label={cerigaTranslate("interface.text_abcb2c82f56df7f2")} type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder={cerigaTranslate("interface.text_a6d1303014aeae45")} className="text-white" disabled={busy} />
      <Button disabled={busy || !email.trim()} type="submit">{cerigaTranslate("interface.text_9ff885c521c7d304")}</Button>
    </form>
    {!emails.length && !error && <p className="text-xs text-white/40">{cerigaTranslate("interface.text_6b7204f3a5d7c752")}</p>}
    {emails.map(address => <div key={address} className="flex items-center justify-between gap-2 text-sm text-white/75"><span>{address}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => void change(address, false)}>{cerigaTranslate("interface.text_bb349bfe675073cc")}</Button></div>)}
  </section>;
}
