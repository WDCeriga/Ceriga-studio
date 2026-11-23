import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { getSupabase } from '../../lib/supabaseClient';

type PendingVerification = {
  submission_id: string;
  manufacturer_id: string;
  factory_name: string;
  submitted_at: string;
  document_count: number;
};

export function FactoryReviewQueue() {
  useCerigaTranslation();

  const [rows, setRows] = useState<PendingVerification[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setError('');
      setRows(null);
      try {
        const { data, error } = await getSupabase().rpc('pending_factory_verifications');
        if (error) throw new Error(error.message);
        if (active) setRows(data ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_eea4fb33efd38283"));
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  return (
    <section id="factory-review-queue" className="am-panel am-review-queue" aria-labelledby="factory-review-heading">
      <div className="am-panel-heading">
        <h2 id="factory-review-heading">{cerigaTranslate("interface.text_0db71552025a46ef")}</h2>
        {rows && <span>{rows.length}{" "}{cerigaTranslate("interface.text_0f503c13fb6a5aec")}</span>}
      </div>
      {error ? (
        <div className="am-review-message" role="alert">
          <p>{cerigaTranslate("interface.text_68570a85b59f1f60")}{" "}{cerigaTranslateLabel(error)}</p>
          <button type="button" className="am-secondary" onClick={() => setAttempt(value => value + 1)}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button>
        </div>
      ) : !rows ? (
        <p className="am-review-message" role="status">{cerigaTranslate("interface.text_45ed14ba3a19966b")}</p>
      ) : rows.length === 0 ? (
        <p className="am-review-message">{cerigaTranslate("interface.text_c9129afb177e348c")}</p>
      ) : (
        <ul className="am-review-list">
          {rows.map(row => (
            <li key={row.submission_id}>
              <div>
                <strong>{row.factory_name}</strong>
                <p>{cerigaTranslate("adminOrders.submitted")}{" "}{new Date(row.submitted_at).toLocaleDateString(cerigaLocale())} · {row.document_count} {row.document_count === 1 ? cerigaTranslate("interface.text_43cc23fa52b87b4c") : cerigaTranslate("interface.text_9b16b44d0e0a5cac")}</p>
              </div>
              <Link className="am-secondary" to={`/superadmin/manufacturers/${row.manufacturer_id}#factory-verification`}>{cerigaTranslate("interface.text_9bcd324881d10acb")}{" "}<ArrowUpRight size={14} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
