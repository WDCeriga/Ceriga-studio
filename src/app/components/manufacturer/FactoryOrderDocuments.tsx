import { useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { useFactoryHistory } from '../../lib/factoryOrderHistory';

type Document = { id: string; purpose: 'quotation' | 'production' };

export function FactoryOrderDocuments({ orderId, factoryId, compact = false }: { orderId: string; factoryId: string; compact?: boolean }) {
  const { data, error, loading, refresh } = useFactoryHistory<Document[]>('factory_order_documents_list', { p_order: orderId }, factoryId);
  const [busy, setBusy] = useState('');
  const [downloadError, setDownloadError] = useState('');
  async function download(document: Document, index: number) {
    setBusy(document.id); setDownloadError('');
    try {
      const result = await getSupabase().functions.invoke('factory-order-document', { body: { orderId, documentId: document.id, factoryId } });
      if (result.error || !(result.data instanceof Blob)) throw Error('Could not retrieve the approved file.');
      const url = URL.createObjectURL(result.data);
      const link = window.document.createElement('a');
      const extension: Record<string,string> = { 'application/pdf':'pdf', 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'application/zip':'zip' };
      link.href = url; link.download = 'ceriga-supporting-file-' + (index + 1) + '.' + (extension[result.response?.headers.get('x-ceriga-file-type') ?? ''] ?? 'bin');
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : 'Could not download file'); }
    finally { setBusy(''); }
  }
  const content = <>
    {loading && <p role="status">Checking available files…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    {downloadError && <p role="alert">{downloadError}</p>}
    {data?.length ? <ul className="history-timeline">{data.map((document,index) => <li key={document.id}>
      <button type="button" className="history-action" disabled={!!busy} onClick={() => void download(document,index)}>{busy === document.id ? 'Downloading…' : (document.purpose === 'production' ? 'Production' : 'Quotation') + ' file ' + (index + 1)}</button>
    </li>)}</ul> : data && <p>Ceriga has not shared files for this step.</p>}
  </>;
  return compact
    ? <details className="quote-disclosure"><summary>Supporting files{data && data.length > 0 ? ` (${data.length})` : ''}</summary>{content}</details>
    : <section className="history-panel"><h2>Approved supporting files</h2>{content}</section>;
}
