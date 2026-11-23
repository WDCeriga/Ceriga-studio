import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { useFactoryHistory } from '../../lib/factoryOrderHistory';

type Document = { id: string; purpose: 'quotation' | 'production' };

export function FactoryOrderDocuments({ orderId, factoryId, compact = false }: { orderId: string; factoryId: string; compact?: boolean }) {
  useCerigaTranslation();

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
    {loading && <p role="status">{cerigaTranslate("interface.text_7a53b474abb1cba2")}</p>}
    {error && <p role="alert">{cerigaTranslateLabel(error)} <button type="button" onClick={refresh}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button></p>}
    {downloadError && <p role="alert">{cerigaTranslateLabel(downloadError)}</p>}
    {data?.length ? <ul className="history-timeline">{data.map((document,index) => <li key={document.id}>
      <button type="button" className="history-action" disabled={!!busy} onClick={() => void download(document,index)}>{busy === document.id ? cerigaTranslate("interface.text_a778d3492af219c3") : cerigaTranslate("interface.text_48adf6935090c92a",{value0:(document.purpose === 'production' ? cerigaTranslate("nav.production") : cerigaTranslate("interface.text_0d0c6df9511cbc57")),value1:(index + 1)})}</button>
    </li>)}</ul> : data && <p>{cerigaTranslate("interface.text_f8d0b92d2ed7a974")}</p>}
  </>;
  return compact
    ? <details className="quote-disclosure"><summary>{cerigaTranslate("interface.text_c9a16e5e3eaa96b3")}{data && data.length > 0 ? ` (${data.length})` : ''}</summary>{content}</details>
    : <section className="history-panel"><h2>{cerigaTranslate("interface.text_684ef0a7fbf735c1")}</h2>{content}</section>;
}
