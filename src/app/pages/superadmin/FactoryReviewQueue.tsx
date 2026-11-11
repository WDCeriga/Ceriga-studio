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
        if (active) setError(cause instanceof Error ? cause.message : 'Please try again.');
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  return (
    <section id="factory-review-queue" className="am-panel am-review-queue" aria-labelledby="factory-review-heading">
      <div className="am-panel-heading">
        <h2 id="factory-review-heading">Verification submissions</h2>
        {rows && <span>{rows.length} awaiting review</span>}
      </div>
      {error ? (
        <div className="am-review-message" role="alert">
          <p>Could not load submissions. {error}</p>
          <button type="button" className="am-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button>
        </div>
      ) : !rows ? (
        <p className="am-review-message" role="status">Loading submissions…</p>
      ) : rows.length === 0 ? (
        <p className="am-review-message">No verification submissions awaiting review.</p>
      ) : (
        <ul className="am-review-list">
          {rows.map(row => (
            <li key={row.submission_id}>
              <div>
                <strong>{row.factory_name}</strong>
                <p>Submitted {new Date(row.submitted_at).toLocaleDateString('en-GB')} · {row.document_count} {row.document_count === 1 ? 'document' : 'documents'}</p>
              </div>
              <Link className="am-secondary" to={`/superadmin/manufacturers/${row.manufacturer_id}#factory-verification`}>
                Review verification <ArrowUpRight size={14} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
