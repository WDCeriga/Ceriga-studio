import { useEffect, useState } from 'react';
import { createUploadSignedUrls } from '../../lib/ordersDb';
import { teamRpc } from '../../lib/factoryTeam';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

type ShareOption = { path: string; name: string; index: number; pinned: boolean; purpose: string | null };
type ShareOptions = { assigned: boolean; documents: ShareOption[] };

export function AdminFactoryDocuments({ orderId }: { orderId: string }) {
  const [options, setOptions] = useState<ShareOptions>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void teamRpc('admin_factory_order_share_options', { p_order: orderId }).then(result => {
      if (active) setOptions(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not list supporting files'); });
    return () => { active = false; };
  }, [orderId]);

  async function change(file: ShareOption, purpose: string | null) {
    setBusy(true); setError(''); setMessage('');
    try {
      await teamRpc('admin_share_factory_order_document',{ p_order:orderId, p_index:file.index, p_purpose:purpose, p_from_sample:file.pinned });
      setOptions(await teamRpc('admin_factory_order_share_options',{ p_order:orderId }));
      setMessage(purpose ? 'Sharing saved for ' + purpose : 'Sharing revoked');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change document access'); }
    finally { setBusy(false); }
  }
  async function review(file: ShareOption) {
    setError('');
    try {
      const urls = await createUploadSignedUrls([file.path]);
      if (!urls[file.path]) throw Error('File unavailable');
      window.open(urls[file.path], '_blank', 'noopener,noreferrer');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open file'); }
  }
  if (!options?.documents.length && !error) return null;
  return <details className="mb-5 rounded-xl border border-white/15 p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Share files with the assigned factory</summary>
    <p className="my-3">Review files for names, contacts and identifying artwork. Share only what the factory needs for this step.</p>
    {options && !options.assigned && <p>Assign a factory before sharing files.</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <ul className="mt-2 space-y-2">{options?.documents.map(file => <li key={String(file.pinned) + file.index} className="flex flex-wrap items-center gap-3 border-t border-white/10 py-2">
      <strong>{file.name}</strong><span>{file.purpose ? 'Shared for ' + file.purpose : 'Private'}</span>
      <button type="button" className="rounded border border-white/25 px-2 py-1" onClick={() => void review(file)}>Review file</button>
      {[['quotation','Allow for quotation'],['production','Allow after release'],[null,'Revoke']].map(([purpose,label]) => <button key={label} type="button" className="rounded border border-white/25 px-2 py-1"
        disabled={!options.assigned || busy || purpose === file.purpose} onClick={() => void change(file,purpose)}>{label}</button>)}
    </li>)}</ul>
  </details>;
}
