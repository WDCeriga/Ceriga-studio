import {useState} from 'react';
import {Link} from 'react-router';
import {ArrowRight,ArrowUpRight,BarChart3,RefreshCw} from 'lucide-react';
import {sumConvertedMinor,formatAccountTotal,useCurrency} from '../../lib/accountCurrency';
import type {Report} from '../PortalReport';
import {formatMoney} from '../../lib/currency';
import './superadmin-statistics.css';
type Props={report:Report|null;days:number;loading:boolean;error:string;onDays:(n:number)=>void;onRefresh:()=>void};
const labels:Record<string,string>={submitted:'Submitted',quoting:'Quotation requested',priced:'Quotation received',pending_review:'Awaiting review',processing:'Production / QC',shipping:'Dispatched',completed:'Completed',cancelled:'Cancelled',draft:'Draft',paid:'Paid'};
const trendMetrics = {
  orders: { label: 'Orders', noun: 'order', previous: 'previousOrders' },
  quotes: { label: 'Quotations', noun: 'quotation', previous: 'previousQuotes' },
  completed: { label: 'Completed', noun: 'completed order', previous: 'previousCompleted' },
} as const;

function delta(current: number | undefined, previous: number | undefined, format = String) {
  if (current === undefined || previous === undefined) return undefined;
  const change = current - previous;
  return change === 0 ? 'No change' : (change > 0 ? '+' : '−') + format(Math.abs(change));
}

function StatisticsTrendChart({report}: {report: Report}) {
  const [metric, setMetric] = useState<keyof typeof trendMetrics>('orders');
  const [selected, setSelected] = useState('');
  const {label, noun, previous} = trendMetrics[metric];
  const rows = report.trend ?? [];
  const latestActivity = rows.filter(row => row[metric] || row[previous]).at(-1);
  const active = rows.find(row => row.date === selected) ?? latestActivity;
  const max = Math.max(1, ...rows.flatMap(row => [row[metric], row[previous]]));
  const grain = report.grain ?? 'day';
  const dateLabel = (value: string, compact = false) => {
    const options: Intl.DateTimeFormatOptions = grain === 'year' ? {year:'numeric'}
      : grain === 'month' ? {month:'short',year:'2-digit'}
      : {day:'numeric',month:'short',...(!compact && {year:'numeric'})};
    return new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', {...options,timeZone:'UTC'});
  };

  return (
    <section className="as-panel as-trend">
      <div className="as-panel-title"><h2>Order activity</h2><span>{grain === 'day' ? 'Daily' : grain === 'week' ? 'Weekly' : grain === 'month' ? 'Monthly' : 'Yearly'}</span></div>
      <div className="as-trend-tabs" aria-label="Trend metric">
        {Object.entries(trendMetrics).map(([key, item]) => (
          <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key as keyof typeof trendMetrics)}>{item.label}</button>
        ))}
      </div>
      {latestActivity && active ? (
        <>
          <div className="as-trend-summary" aria-live="polite">
            <span>{grain === 'week' && 'Week of '}{dateLabel(active.date)}</span>
            <strong>{active[metric]} {noun}{active[metric] === 1 ? '' : 's'}</strong>
            <span>{active[previous]} in the previous period</span>
          </div>
          <div className="as-trend-bars" aria-label={label + ' by ' + grain}>
            {rows.map((row, index) => (
              <button key={row.date} type="button" aria-pressed={active.date === row.date}
                aria-label={dateLabel(row.date) + ', ' + row[metric] + ' current, ' + row[previous] + ' previous'}
                onClick={() => setSelected(row.date)}>
                <span className="as-bar-pair" aria-hidden="true">
                  <span style={{height: (row[metric] / max * 100) + '%'}} />
                  <span style={{height: (row[previous] / max * 100) + '%'}} />
                </span>
                <span className="as-trend-tick" aria-hidden="true">{rows.length <= 13 || index % 5 === 0 ? dateLabel(row.date, true) : '\u00a0'}</span>
              </button>
            ))}
          </div>
          <div className="as-trend-legend"><span>Selected period</span><span>Previous period</span></div>
          <p className="as-note">Grouped by order creation date. Previous activity is aligned to the same point in the comparison period.</p>
        </>
      ) : (
        <div className="as-empty"><BarChart3 size={24}/><h3>No {noun}s in either period</h3><p>Try a longer reporting period or a different metric.</p></div>
      )}
    </section>
  );
}

export function SuperAdminStatisticsView({report,days,loading,error,onDays,onRefresh}:Props){
 useCurrency();
 const revenueTotal = report && sumConvertedMinor(report.verifiedRevenue.map(r=>({cents:Number(r.cents),currency:r.currency})));
 const previous = report?.comparison;
 const previousRevenue = previous && sumConvertedMinor(previous.verifiedRevenue.map(r=>({cents:Number(r.cents),currency:r.currency})));
 const onTime = report?.quoteDeadlineSamples ? Math.round(report.quotesOnTime/report.quoteDeadlineSamples*100) : undefined;
 const previousOnTime = previous?.quoteDeadlineSamples ? Math.round(previous.quotesOnTime/previous.quoteDeadlineSamples*100) : undefined;
 const metrics=report ? [
   {label:'Verified revenue',value:formatAccountTotal(revenueTotal ?? undefined),note:'Payments received in this period',change:delta(revenueTotal ?? undefined,previousRevenue,formatAccountTotal)},
   {label:'Orders received',value:report.orders,note:'Orders created in this period',change:delta(report.orders,previous?.orders)},
   {label:'Completed orders',value:report.completed,note:'Completed from this order cohort',change:delta(report.completed,previous?.completed)},
   {label:'Quotes on time',value:onTime === undefined ? '—' : onTime+'%',note:report.quoteDeadlineSamples?report.quotesOnTime+' of '+report.quoteDeadlineSamples+' dated quotations':'No dated quotations to measure',change:delta(onTime,previousOnTime,n=>n+' pp')},
 ] : [];
 return <div className="admin-statistics" aria-busy={loading}><div className="as-topline"><span>CERIGA / INSIGHTS</span><span>Operational reporting</span></div><header className="as-heading"><div><h1>Statistics<span>.</span></h1><p>A clear picture of your orders, revenue, and manufacturing network.</p></div><div className="as-toolbar"><select aria-label="Reporting period" value={days} disabled={loading} onChange={e=>onDays(Number(e.target.value))}>{[7,30,90,365,3650].map(n=><option key={n} value={n}>{n===3650?'Last 10 years':'Last '+n+' days'}</option>)}</select><button type="button" aria-label="Refresh statistics" disabled={loading} onClick={onRefresh}><RefreshCw size={15}/></button></div></header>
 {error&&<div role="alert" className="as-error"><span>{error}</span><button type="button" onClick={onRefresh}>Try again<ArrowRight size={14}/></button></div>}{loading&&<div role="status" className="as-loading">Loading verified reporting data…</div>}
 {report&&!error&&<><section className="as-metrics" aria-label="Reporting overview">{metrics.map(m=><div key={m.label}><span>{m.label}</span><strong>{m.value}</strong><small>{m.note}</small>{m.change && <small className="as-delta">{m.change} <span>vs previous {days} days</span></small>}</div>)}</section><p className="as-scope">Order metrics follow orders created in the selected period. Revenue follows verified payment dates. Converted totals are indicative; original payment currencies are preserved.</p>
 <div className="as-chart-grid"><StatisticsTrendChart key={days} report={report} />
 <section className="as-panel"><div className="as-panel-title"><h2>Order pipeline</h2><Link to="/superadmin/orders">Open orders<ArrowUpRight size={13}/></Link></div><div className="as-pipeline">{report.pipeline.map(p=><div key={p.status}><div><span>{labels[p.status]||p.status.replaceAll('_',' ')}</span><strong>{p.n}</strong></div><div className="as-progress"><span style={{width:report.orders?Math.min(100,p.n/report.orders*100)+'%':'0%'}}/></div></div>)}</div>{!report.pipeline.length&&<p className="as-empty">No orders in this period.</p>}</section></div>
 <div className="as-chart-grid"><section className="as-panel"><div className="as-panel-title"><h2>Operational follow-up</h2><span>Selected order cohort</span></div><div className="as-followups">{[{label:'Awaiting assignment',n:report.awaitingAssignment,to:'/superadmin/assignment'},{label:'In production / QC',n:report.production,to:'/superadmin/orders'},{label:'QC awaiting review',n:report.pendingQc,to:'/superadmin/assignment?view=quality'},{label:'QC changes required',n:report.changesRequired,to:'/superadmin/assignment?view=quality'}].map(a=><Link key={a.label} to={a.to}><span>{a.label}</span><strong>{a.n}</strong><ArrowUpRight size={14}/></Link>)}</div><p className="as-note">Open the corresponding page to manage all current work, including orders outside this period.</p></section>
 <section className="as-panel"><div className="as-panel-title"><h2>Quotation performance</h2><span>Recorded responses</span></div><div className="as-quote"><strong>{report.quotesSubmitted}</strong><span>quotations submitted for this order cohort</span></div><p className="as-note">{report.quoteDeadlineSamples?report.quotesOnTime+' of '+report.quoteDeadlineSamples+' quotations with a recorded deadline arrived on time.':'No recorded quotation deadlines are available for comparison.'} This measures quotation response, rather than delivery performance.</p><details className="as-definitions"><summary>How these metrics are calculated</summary><p>Orders received: orders created in the selected period. Completed: those orders currently marked completed. Quotes on time: dated quotations submitted before the end of their due date. Delivery punctuality and defect rates require separate recorded evidence.</p></details></section></div>
 <section className="as-network" aria-label="Account and network totals"><div><span>New accounts</span><strong>{report.users}</strong><small>Created in the selected period</small></div><Link to="/superadmin/manufacturers"><span>Manufacturer accounts</span><strong>{report.manufacturers}</strong><small>Current network total<ArrowUpRight size={12}/></small></Link><Link to="/superadmin/notifications"><span>Unread notifications</span><strong>{report.unreadNotifications}</strong><small>Current unread total<ArrowUpRight size={12}/></small></Link></section>
 <details className="as-finance"><summary>Verified payments by original currency</summary><p>Unpaid quotations and temporary payment-bypass orders are excluded. Account currency changes do not alter transaction records.</p>{report.verifiedRevenue.length?<ul>{report.verifiedRevenue.map(r=><li key={r.currency}><span>{r.currency}</span><strong>{formatMoney(Number(r.cents),r.currency)}</strong><span>{r.payments} verified payment{r.payments===1?'':'s'}</span></li>)}</ul>:<p>No verified payments in this period.</p>}</details>
 <footer className="as-footer"><span>Updated {new Date(report.generatedAt).toLocaleString('en-GB')}</span><span>Verified backend records · refresh to update</span></footer></>}
 </div>;
}
