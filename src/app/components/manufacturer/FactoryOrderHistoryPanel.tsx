import { useState } from 'react';
import { Link } from 'react-router';
import { teamRpc } from '../../lib/factoryTeam';
import { clientLink, compareHistory, displaySpecification, historyDate, orderLink, orderReference, runLabels, specificationFields, stageLabels, useFactoryHistory, type OrderHistory } from '../../lib/factoryOrderHistory';
import './factory-order-history.css';

function SpecificationList({ specification }: { specification: Record<string, unknown> }) {
  return <dl className="history-specs">{specificationFields.filter(([key]) => specification[key] != null).map(([key,label]) => <div key={key} className="contents"><dt>{label}</dt><dd>{displaySpecification(specification[key])}</dd></div>)}</dl>;
}

function HistoryDetails({ history, quotation }: { history: OrderHistory; quotation: boolean }) {
  const { order, specification, previousSpecification } = history;
  const comparisons = previousSpecification ? compareHistory(previousSpecification,specification).map(item =>
    item.key === 'artworkRevision' && history.artworkComparison
      ? { ...item, before: 'Recorded artwork', after: 'Recorded artwork', status: history.artworkComparison } : item
  ) : [];
  const visibleComparisons = comparisons.filter(item => item.status !== 'Manual review').sort((a,b) => Number(b.status === 'Changed') - Number(a.status === 'Changed'));
  const review = comparisons.filter(item => item.status === 'Manual review');
  const relatedOrders = quotation ? history.timeline.filter(item => item.order_id !== order.order_id) : history.timeline;
  const [nickname, setNickname] = useState(order.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [storedNickname, setStoredNickname] = useState(order.nickname ?? '');
  async function saveNickname() {
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await teamRpc('factory_save_order_nickname', { p_order: order.order_id, p_nickname: nickname });
      setNickname(result); setStoredNickname(result); setSaved(true); setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save nickname'); }
    finally { setSaving(false); }
  }
  return <div className={quotation ? 'quote-history' : 'history-detail'}>
    {quotation ? <p className="quote-client"><Link to={clientLink(order.customer_code)}>Client {order.customer_code}</Link>{order.is_returning && <span>Returning customer</span>}</p> :
    <section className="history-panel" aria-label="Anonymous customer and product">
      <div className="history-identity">
        <div>
          <p><Link className="history-identity-link" to={clientLink(order.customer_code)}>Client {order.customer_code}</Link> · {order.product_reference} · {runLabels[order.run_type]}</p>
          {order.is_returning && <p>Returning customer · {order.prior_count} previous orders · Last ordered {historyDate(order.last_order)}</p>}
          {storedNickname && <p>Nickname · {storedNickname}</p>}
        </div>
        <button className="history-action" type="button" aria-expanded={editing} aria-controls="order-history-nickname" onClick={() => { setEditing(value => !value); setError(''); setNickname(storedNickname); setSaved(false); }}>{editing ? 'Cancel' : storedNickname ? 'Edit nickname' : 'Add nickname'}</button>
      </div>
      <form className="history-nickname" id="order-history-nickname" hidden={!editing} onSubmit={event => { event.preventDefault(); void saveNickname(); }}>
        <label>Internal nickname<input value={nickname} maxLength={80} onChange={event => { setNickname(event.target.value); setSaved(false); }}/></label>
        <button className="history-action" type="submit" disabled={saving || nickname.trim() === storedNickname}>{saving ? 'Saving…' : 'Save nickname'}</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {saved && <p role="status">Nickname saved</p>}
    </section>}
    {(!quotation || relatedOrders.length > 0 || previousSpecification) && <details className={quotation ? 'quote-disclosure' : 'history-panel'} open={!quotation && Boolean(previousSpecification) || undefined}>
      <summary>{quotation ? 'Previous orders' : 'Product history'}</summary>
      <div className="history-detail-grid">
        <section>{!quotation && <h3>Related orders</h3>}<Link className="text-xs" to={clientLink(order.customer_code) + '?product=' + encodeURIComponent(order.product_reference)}>View product history</Link><ol className="history-timeline">{relatedOrders.map(item => <li key={item.order_id}>
          <Link to={orderLink(item.order_id)}>{orderReference(item.order_id)}</Link> · {runLabels[item.run_type]} · {historyDate(item.created_at)}
          <p>{[item.units && item.units + ' units', item.approved && 'Sample approved', stageLabels[item.stage ?? ''] || item.order_group].filter(Boolean).join(' · ')}</p>
        </li>)}</ol></section>
        {!quotation && <section><h3>{order.approved ? 'Approved sample specifications' : 'Recorded specifications'}</h3>
          <p>Version {history.version} · {historyDate(history.capturedAt)}</p>
          <SpecificationList specification={specification}/>
        </section>}
      </div>
      {previousSpecification && <section className="history-comparison">
        <h3>Compare with previous order</h3><p>{order.previous_order && <Link to={orderLink(order.previous_order)}>{orderReference(order.previous_order)}</Link>} · Recorded version {history.previousVersion}</p>
        {visibleComparisons.length > 0 && <div className="history-comparison-scroll"><table><thead><tr><th>Specification</th><th>Previous</th><th>Current</th><th>Result</th></tr></thead><tbody>
          {visibleComparisons.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{displaySpecification(row.before)}</td><td>{displaySpecification(row.after)}</td><td data-change={row.status}>{row.status}</td></tr>)}
        </tbody></table></div>}
        {review.length > 0 && <details className="mt-3"><summary>{review.length} specifications require manual review</summary><ul className="history-timeline">{review.map(item => <li key={item.key}>{item.label} · {displaySpecification(item.before)} → {displaySpecification(item.after)}</li>)}</ul></details>}
      </section>}
    </details>}
    {!quotation && history.versions.length > 1 && <details className="history-panel"><summary>Saved specification versions</summary>
      {history.versions.map(version => <details key={version.version} className="mt-3 border-t border-black/10 pt-2">
        <summary>Version {version.version} · {historyDate(version.capturedAt)}</summary><SpecificationList specification={version.specification}/>
      </details>)}
    </details>}
    {(!quotation || history.productionNotes.length > 0 || history.quality.length > 0) && <details className={quotation ? 'quote-disclosure' : 'history-panel'}><summary>Production notes and quality control</summary>
      <div className="history-detail-grid">
        <section><h3>Production updates</h3>{history.productionNotes.length ? <ul className="history-timeline">{history.productionNotes.map((note, index) => <li key={note.order_id + index}>
          <Link to={orderLink(note.order_id)}>{orderReference(note.order_id)}</Link> · {historyDate(note.created_at)} · {stageLabels[note.stage] ?? note.stage}
          {note.note && <p>{note.note}</p>}{note.delay_reason && <p>Delay · {note.delay_reason}</p>}{note.expected_completion && <p>Expected completion · {historyDate(note.expected_completion)}</p>}
        </li>)}</ul> : <p>No production updates recorded.</p>}</section>
        <section><h3>Quality control</h3>{history.quality.length ? <ul className="history-timeline">{history.quality.map((report, index) => <li key={report.order_id + index}>
          <Link to={orderLink(report.order_id)}>{orderReference(report.order_id)}</Link> · {historyDate(report.submitted_at)} · {(report.qc_status || report.result).replaceAll('_',' ')}
          {report.notes && <p>{report.notes}</p>}{report.review_note && <p>{report.review_note}</p>}
          {report.issues.map((issue, issueIndex) => <p key={issueIndex}>{issue.problem} · {issue.resolution || issue.status.replaceAll('_',' ')}</p>)}
        </li>)}</ul> : <p>No quality reports recorded.</p>}</section>
      </div>
    </details>}
  </div>;
}

export function FactoryOrderHistoryPanel({ orderId, factoryId, quotation = false }: { orderId: string; factoryId: string; quotation?: boolean }) {
  const { data, error, loading, refresh } = useFactoryHistory<OrderHistory>('factory_order_history_detail', { p_order: orderId }, factoryId);
  if (error) return <p role="alert" className={quotation ? 'quote-message quote-overdue' : 'history-error'}>{quotation ? 'Order history is unavailable.' : error} <button type="button" onClick={refresh}>Retry history</button></p>;
  if (loading || !data) return <p role="status" className={quotation ? 'quote-message' : 'history-empty'}>Loading order history…</p>;
  return <HistoryDetails history={data} quotation={quotation}/>;
}
