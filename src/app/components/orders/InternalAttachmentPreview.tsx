import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { useCerigaTranslation } from '../../i18n/i18n';

/** Internal review only. Fetches through the same per-event permission check as downloads. */
export function InternalAttachmentPreview({ eventId, index }: { eventId: string; index: number }) {
  const { t } = useCerigaTranslation();
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const active = useRef(true), resource = useRef(''), busy = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; if (resource.current) URL.revokeObjectURL(resource.current); }; }, []);
  async function open() {
    if (busy.current || url) return;
    busy.current = true; setLoading(true); setError('');
    try {
      const result = await getSupabase().rpc('order_communication_attachment', { p_event: eventId, p_index: index, p_scope: 'admin' });
      if (result.error) throw new Error(result.error.message);
      const data = result.data;
      if (!data || !['image/png', 'image/jpeg'].includes(data.type) || typeof data.data !== 'string' || data.data.length > 2_800_000) throw new Error(t('workflow.previewUnavailable'));
      const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if ((data.type === 'image/png' && !png) || (data.type === 'image/jpeg' && !jpeg)) throw new Error(t('workflow.previewUnavailable'));
      if (!active.current) return;
      resource.current = URL.createObjectURL(new Blob([bytes], { type: data.type })); setUrl(resource.current);
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : t('workflow.previewUnavailable')); }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }
  return <div className="communication-image-preview"><button type="button" className="communication-secondary" disabled={loading} onClick={() => void open()}>{t('workflow.previewImage')} {index + 1}</button>{error && <p role="alert">{error}</p>}{url && <img src={url} alt={t('workflow.previewImage') + ' ' + (index + 1)} />}</div>;
}
