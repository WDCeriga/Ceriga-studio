import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useState } from 'react';
import { createUploadSignedUrls } from '../../lib/ordersDb';
import { teamRpc } from '../../lib/factoryTeam';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

type ShareOption = { path: string; name: string; index: number; pinned: boolean; purpose: string | null };
type ShareOptions = { assigned: boolean; documents: ShareOption[] };

export function AdminFactoryDocuments({ orderId }: { orderId: string }) {
  useCerigaTranslation();

  const [options, setOptions] = useState<ShareOptions>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void teamRpc('admin_factory_order_share_options', { p_order: orderId }).then(result => {
      if (active) setOptions(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_fbbecf29706da911")); });
    return () => { active = false; };
  }, [orderId]);

  async function change(file: ShareOption, purpose: string | null) {
    setBusy(true); setError(''); setMessage('');
    try {
      await teamRpc('admin_share_factory_order_document',{ p_order:orderId, p_index:file.index, p_purpose:purpose, p_from_sample:file.pinned });
      setOptions(await teamRpc('admin_factory_order_share_options',{ p_order:orderId }));
      setMessage(purpose ? 'Sharing saved for ' + purpose : cerigaTranslate("interface.text_42a3239317d01262"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_719d9a09dc7bc039")); }
    finally { setBusy(false); }
  }
  async function review(file: ShareOption) {
    setError('');
    try {
      const urls = await createUploadSignedUrls([file.path]);
      if (!urls[file.path]) throw Error('File unavailable');
      window.open(urls[file.path], '_blank', 'noopener,noreferrer');
    } catch (cause) { setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_082ec35ee80b7a2c")); }
  }
  if (!options?.documents.length && !error) return null;
  return <details className="mb-5 rounded-xl border border-white/15 p-4 text-sm">
    <summary className="cursor-pointer font-semibold">{cerigaTranslate("interface.text_d2618bc3239675e3")}</summary>
    <p className="my-3">{cerigaTranslate("interface.text_0df10033bacf8666")}</p>
    {options && !options.assigned && <p>{cerigaTranslate("interface.text_85eaeb98e26d6bc0")}</p>}
    {error && <p role="alert">{cerigaTranslateLabel(error)}</p>}{message && <p role="status">{cerigaTranslateLabel(message)}</p>}
    <ul className="mt-2 space-y-2">{options?.documents.map(file => <li key={String(file.pinned) + file.index} className="flex flex-wrap items-center gap-3 border-t border-white/10 py-2">
      <strong>{file.name}</strong><span>{file.purpose ? cerigaTranslate("interface.text_d38b3de0094be56f",{value0:(file.purpose)}) : cerigaTranslate("interface.text_c63eb6720c6e8849")}</span>
      <button type="button" className="rounded border border-white/25 px-2 py-1" onClick={() => void review(file)}>{cerigaTranslate("interface.text_d5f013b8b846a494")}</button>
      {[['quotation','Allow for quotation'],['production','Allow after release'],[null,'Revoke']].map(([purpose,label]) => <button key={label} type="button" className="rounded border border-white/25 px-2 py-1"
        disabled={!options.assigned || busy || purpose === file.purpose} onClick={() => void change(file,purpose)}>{cerigaTranslateLabel(label)}</button>)}
    </li>)}</ul>
  </details>;
}
