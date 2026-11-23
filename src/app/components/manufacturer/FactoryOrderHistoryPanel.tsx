import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useState } from 'react';
import { Link } from 'react-router';
import { teamRpc } from '../../lib/factoryTeam';
import { clientLink, compareHistory, displaySpecification, historyDate, orderLink, orderReference, runLabels, specificationFields, stageLabels, useFactoryHistory, type OrderHistory } from '../../lib/factoryOrderHistory';
import './factory-order-history.css';

function SpecificationList({ specification }: { specification: Record<string, unknown> }) {
  useCerigaTranslation();

  return <dl className="history-specs">{specificationFields.filter(([key]) => specification[key] != null).map(([key,label]) => <div key={key} className="contents"><dt>{cerigaTranslateLabel(label)}</dt><dd>{displaySpecification(specification[key])}</dd></div>)}</dl>;
}

function HistoryDetails({ history, quotation }: { history: OrderHistory; quotation: boolean }) {
  useCerigaTranslation();

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
    } catch (cause) { setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_10154291a5eccec4")); }
    finally { setSaving(false); }
  }
  return <div className={quotation ? 'quote-history' : 'history-detail'}>
    {quotation ? <p className="quote-client"><Link to={clientLink(order.customer_code)}>{cerigaTranslate("interface.text_0c77fe09ab336a3e")}{" "}{order.customer_code}</Link>{order.is_returning && <span>{cerigaTranslate("interface.text_8b089fd8bddffb79")}</span>}</p> :
    <section className="history-panel" aria-label={cerigaTranslate("interface.text_841db86718d9fdb2")}>
      <div className="history-identity">
        <div>
          <p><Link className="history-identity-link" to={clientLink(order.customer_code)}>{cerigaTranslate("interface.text_0c77fe09ab336a3e")}{" "}{order.customer_code}</Link> · {order.product_reference} · {cerigaTranslateLabel(runLabels[order.run_type])}</p>
          {order.is_returning && <p>{cerigaTranslate("interface.text_a49774b25f636ef5")}{" "}{order.prior_count}{" "}{cerigaTranslate("interface.text_f51d59a59a77e626")}{" "}{historyDate(order.last_order)}</p>}
          {storedNickname && <p>{cerigaTranslate("interface.text_ca21cd2674c8dbb8")}{" "}{storedNickname}</p>}
        </div>
        <button className="history-action" type="button" aria-expanded={editing} aria-controls="order-history-nickname" onClick={() => { setEditing(value => !value); setError(''); setNickname(storedNickname); setSaved(false); }}>{editing ? cerigaTranslate("common.cancel") : storedNickname ? cerigaTranslate("interface.text_779a4dae420625cf") : cerigaTranslate("interface.text_59450d24d11f8be5")}</button>
      </div>
      <form className="history-nickname" id="order-history-nickname" hidden={!editing} onSubmit={event => { event.preventDefault(); void saveNickname(); }}>
        <label>{cerigaTranslate("interface.text_425b408d0a373929")}<input value={nickname} maxLength={80} onChange={event => { setNickname(event.target.value); setSaved(false); }}/></label>
        <button className="history-action" type="submit" disabled={saving || nickname.trim() === storedNickname}>{saving ? cerigaTranslate("common.saving") : cerigaTranslate("interface.text_113735a2221f22c2")}</button>
        {error && <p role="alert">{cerigaTranslateLabel(error)}</p>}
      </form>
      {saved && <p role="status">{cerigaTranslate("interface.text_b17849e231cba813")}</p>}
    </section>}
    {(!quotation || relatedOrders.length > 0 || previousSpecification) && <details className={quotation ? 'quote-disclosure' : 'history-panel'} open={!quotation && Boolean(previousSpecification) || undefined}>
      <summary>{quotation ? cerigaTranslate("interface.text_a621b6167449908a") : cerigaTranslate("interface.text_e8197e4b3e3ca4b0")}</summary>
      <div className="history-detail-grid">
        <section>{!quotation && <h3>{cerigaTranslate("interface.text_7fca70a1801fbbd0")}</h3>}<Link className="text-xs" to={clientLink(order.customer_code) + '?product=' + encodeURIComponent(order.product_reference)}>{cerigaTranslate("interface.text_fd2b9f7bc3c206c7")}</Link><ol className="history-timeline">{relatedOrders.map(item => <li key={item.order_id}>
          <Link to={orderLink(item.order_id)}>{orderReference(item.order_id)}</Link> · {cerigaTranslateLabel(runLabels[item.run_type])} · {historyDate(item.created_at)}
          <p>{[item.units && cerigaTranslate("interface.text_44b3c2a4a47289c6",{value0:(item.units)}), item.approved && cerigaTranslate("interface.text_c0ed79cd89c6a21f"), stageLabels[item.stage ?? ''] || item.order_group].filter(Boolean).join(' · ')}</p>
        </li>)}</ol></section>
        {!quotation && <section><h3>{order.approved ? cerigaTranslate("interface.text_9d622942d935c70c") : cerigaTranslate("interface.text_3859410e7dfec6b3")}</h3>
          <p>{cerigaTranslate("interface.text_dd167905de0defca")}{" "}{history.version} · {historyDate(history.capturedAt)}</p>
          <SpecificationList specification={specification}/>
        </section>}
      </div>
      {previousSpecification && <section className="history-comparison">
        <h3>{cerigaTranslate("interface.text_29a00ce28ede060b")}</h3><p>{order.previous_order && <Link to={orderLink(order.previous_order)}>{orderReference(order.previous_order)}</Link>}{" "}{cerigaTranslate("interface.text_9b32b1212f48ee1f")}{" "}{history.previousVersion}</p>
        {visibleComparisons.length > 0 && <div className="history-comparison-scroll"><table><thead><tr><th>{cerigaTranslate("interface.text_397324160ebbc766")}</th><th>{cerigaTranslate("common.previous")}</th><th>{cerigaTranslate("interface.text_e0d1b68224bf0b31")}</th><th>{cerigaTranslate("interface.text_6e7d50e84f4731ef")}</th></tr></thead><tbody>
          {visibleComparisons.map(row => <tr key={row.key}><th scope="row">{cerigaTranslateLabel(row.label)}</th><td>{displaySpecification(row.before)}</td><td>{displaySpecification(row.after)}</td><td data-change={row.status}>{cerigaTranslateLabel(row.status)}</td></tr>)}
        </tbody></table></div>}
        {review.length > 0 && <details className="mt-3"><summary>{review.length}{" "}{cerigaTranslate("interface.text_7892f408fc1359b3")}</summary><ul className="history-timeline">{review.map(item => <li key={item.key}>{cerigaTranslateLabel(item.label)} · {displaySpecification(item.before)} → {displaySpecification(item.after)}</li>)}</ul></details>}
      </section>}
    </details>}
    {!quotation && history.versions.length > 1 && <details className="history-panel"><summary>{cerigaTranslate("interface.text_981d7e43340ae9a1")}</summary>
      {history.versions.map(version => <details key={version.version} className="mt-3 border-t border-black/10 pt-2">
        <summary>{cerigaTranslate("interface.text_dd167905de0defca")}{" "}{version.version} · {historyDate(version.capturedAt)}</summary><SpecificationList specification={version.specification}/>
      </details>)}
    </details>}
    {(!quotation || history.productionNotes.length > 0 || history.quality.length > 0) && <details className={quotation ? 'quote-disclosure' : 'history-panel'}><summary>{cerigaTranslate("interface.text_771fa0be75713cbe")}</summary>
      <div className="history-detail-grid">
        <section><h3>{cerigaTranslate("interface.text_4f9430e97bffad23")}</h3>{history.productionNotes.length ? <ul className="history-timeline">{history.productionNotes.map((note, index) => <li key={note.order_id + index}>
          <Link to={orderLink(note.order_id)}>{orderReference(note.order_id)}</Link> · {historyDate(note.created_at)} · {cerigaTranslateLabel(stageLabels[note.stage] ?? note.stage)}
          {note.note && <p>{note.note}</p>}{note.delay_reason && <p>{cerigaTranslate("interface.text_9c6712e9c0f8d974")}{" "}{note.delay_reason}</p>}{note.expected_completion && <p>{cerigaTranslate("interface.text_281d5b8b827cc620")}{" "}{historyDate(note.expected_completion)}</p>}
        </li>)}</ul> : <p>{cerigaTranslate("interface.text_8818380f27ab3e41")}</p>}</section>
        <section><h3>{cerigaTranslate("interface.text_4e732d31fab58380")}</h3>{history.quality.length ? <ul className="history-timeline">{history.quality.map((report, index) => <li key={report.order_id + index}>
          <Link to={orderLink(report.order_id)}>{orderReference(report.order_id)}</Link> · {historyDate(report.submitted_at)} · {(report.qc_status || report.result).replaceAll('_',' ')}
          {report.notes && <p>{report.notes}</p>}{report.review_note && <p>{report.review_note}</p>}
          {report.issues.map((issue, issueIndex) => <p key={issueIndex}>{issue.problem} · {issue.resolution || issue.status.replaceAll('_',' ')}</p>)}
        </li>)}</ul> : <p>{cerigaTranslate("interface.text_1e21a94739a2f7c7")}</p>}</section>
      </div>
    </details>}
  </div>;
}

export function FactoryOrderHistoryPanel({ orderId, factoryId, quotation = false }: { orderId: string; factoryId: string; quotation?: boolean }) {
  useCerigaTranslation();

  const { data, error, loading, refresh } = useFactoryHistory<OrderHistory>('factory_order_history_detail', { p_order: orderId }, factoryId);
  if (error) return <p role="alert" className={quotation ? 'quote-message quote-overdue' : 'history-error'}>{quotation ? cerigaTranslate("interface.text_2f84d1f9e6c82fea") : error} <button type="button" onClick={refresh}>{cerigaTranslate("interface.text_5663075c859e969c")}</button></p>;
  if (loading || !data) return <p role="status" className={quotation ? 'quote-message' : 'history-empty'}>{cerigaTranslate("interface.text_22d3a96ba2bb3044")}</p>;
  return <HistoryDetails history={data} quotation={quotation}/>;
}
