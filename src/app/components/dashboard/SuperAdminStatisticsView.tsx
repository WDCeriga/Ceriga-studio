import { activeLocale as cerigaLocale } from '../../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
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
  useCerigaTranslation();

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
    return new Date(value + 'T12:00:00Z').toLocaleDateString(cerigaLocale(), {...options,timeZone:'UTC'});
  };

  return (
    <section className="as-panel as-trend">
      <div className="as-panel-title"><h2>{cerigaTranslate("interface.text_7d41e8bcff3e9b5e")}</h2><span>{grain === 'day' ? cerigaTranslate("interface.text_b36c2611dcdfa190") : grain === 'week' ? cerigaTranslate("interface.text_2975132481a7a695") : grain === 'month' ? cerigaTranslate("interface.text_9b11f6b707d2a03e") : cerigaTranslate("interface.text_6e69b59ed34d42ef")}</span></div>
      <div className="as-trend-tabs" aria-label={cerigaTranslate("interface.text_f0e4c21f1f0830d8")}>
        {Object.entries(trendMetrics).map(([key, item]) => (
          <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key as keyof typeof trendMetrics)}>{cerigaTranslateLabel(item.label)}</button>
        ))}
      </div>
      {latestActivity && active ? (
        <>
          <div className="as-trend-summary" aria-live="polite">
            <span>{grain === 'week' && cerigaTranslate("interface.text_e1ec886a756873be")}{cerigaTranslateLabel(dateLabel(active.date))}</span>
            <strong>{active[metric]} {cerigaTranslate('interface.trendNoun_'+metric,{count:Number(active[metric])})}</strong>
            <span>{active[previous]}{" "}{cerigaTranslate("interface.text_5401daafb8b6bd4d")}</span>
          </div>
          <div className="as-trend-bars" aria-label={cerigaTranslate("interface.text_d754ec7d1836be7d",{value0:(label),value1:(grain)})}>
            {rows.map((row, index) => (
              <button key={row.date} type="button" aria-pressed={active.date === row.date}
                aria-label={cerigaTranslate("interface.text_a96164fdb5318330",{value0:(dateLabel(row.date) + ', ' + row[metric]),value1:(row[previous])})}
                onClick={() => setSelected(row.date)}>
                <span className="as-bar-pair" aria-hidden="true">
                  <span style={{height: (row[metric] / max * 100) + '%'}} />
                  <span style={{height: (row[previous] / max * 100) + '%'}} />
                </span>
                <span className="as-trend-tick" aria-hidden="true">{rows.length <= 13 || index % 5 === 0 ? dateLabel(row.date, true) : '\u00a0'}</span>
              </button>
            ))}
          </div>
          <div className="as-trend-legend"><span>{cerigaTranslate("interface.text_7aa351a109bd9c63")}</span><span>{cerigaTranslate("interface.text_6d23071bcd0cd538")}</span></div>
          <p className="as-note">{cerigaTranslate("interface.text_226dbd1a8a533686")}</p>
        </>
      ) : (
        <div className="as-empty"><BarChart3 size={24}/><h3>{cerigaTranslate("interface.text_1ea442a134b2a184")}{" "}{noun}{cerigaTranslate("interface.text_082c49d8c6b20230")}</h3><p>{cerigaTranslate("interface.text_5fa9a76e2065568c")}</p></div>
      )}
    </section>
  );
}

export function SuperAdminStatisticsView({report,days,loading,error,onDays,onRefresh}:Props){
  useCerigaTranslation();

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
 return <div className="admin-statistics" aria-busy={loading}><div className="as-topline"><span>{cerigaTranslate("interface.text_aa6e99c779d46ffa")}</span><span>{cerigaTranslate("interface.text_29cc868e137d37a6")}</span></div><header className="as-heading"><div><h1>{cerigaTranslate("nav.statistics")}<span>.</span></h1><p>{cerigaTranslate("interface.text_06745e1ede959a40")}</p></div><div className="as-toolbar"><select aria-label={cerigaTranslate("interface.text_d4bd1581397c2210")} value={days} disabled={loading} onChange={e=>onDays(Number(e.target.value))}>{[7,30,90,365,3650].map(n=><option key={n} value={n}>{n===3650?cerigaTranslate("interface.text_69c1c12b7d414554"):cerigaTranslate("interface.text_b05faa9556fd9ba7",{value0:(n)})}</option>)}</select><button type="button" aria-label={cerigaTranslate("interface.text_c97295eb4b2bf0c6")} disabled={loading} onClick={onRefresh}><RefreshCw size={15}/></button></div></header>
 {error&&<div role="alert" className="as-error"><span>{cerigaTranslateLabel(error)}</span><button type="button" onClick={onRefresh}>{cerigaTranslate("common.retry")}<ArrowRight size={14}/></button></div>}{loading&&<div role="status" className="as-loading">{cerigaTranslate("interface.text_b375b375884ae2e6")}</div>}
 {report&&!error&&<><section className="as-metrics" aria-label={cerigaTranslate("interface.text_adeb9087f7b33510")}>{metrics.map(m=><div key={m.label}><span>{cerigaTranslateLabel(m.label)}</span><strong>{m.value}</strong><small>{m.note}</small>{m.change && <small className="as-delta">{m.change} <span>{cerigaTranslate("interface.text_b70cbf3f9b014ab7")}{" "}{days}{" "}{cerigaTranslate("interface.text_ab51004e9d71a485")}</span></small>}</div>)}</section><p className="as-scope">{cerigaTranslate("interface.text_38a78307d3a7e6eb")}</p>
 <div className="as-chart-grid"><StatisticsTrendChart key={days} report={report} />
 <section className="as-panel"><div className="as-panel-title"><h2>{cerigaTranslate("interface.text_99f5b3c3e08a4bd4")}</h2><Link to="/superadmin/orders">{cerigaTranslate("interface.text_bf98116896a845a3")}<ArrowUpRight size={13}/></Link></div><div className="as-pipeline">{report.pipeline.map(p=><div key={p.status}><div><span>{cerigaTranslateLabel(labels[p.status]||p.status.replaceAll('_',' '))}</span><strong>{p.n}</strong></div><div className="as-progress"><span style={{width:report.orders?Math.min(100,p.n/report.orders*100)+'%':'0%'}}/></div></div>)}</div>{!report.pipeline.length&&<p className="as-empty">{cerigaTranslate("interface.text_f9cd7ef5035129fc")}</p>}</section></div>
 <div className="as-chart-grid"><section className="as-panel"><div className="as-panel-title"><h2>{cerigaTranslate("interface.text_e70c7069c32ebebe")}</h2><span>{cerigaTranslate("interface.text_1f273e348102d36a")}</span></div><div className="as-followups">{[{label:'Awaiting assignment',n:report.awaitingAssignment,to:'/superadmin/assignment'},{label:'In production / QC',n:report.production,to:'/superadmin/orders'},{label:'QC awaiting review',n:report.pendingQc,to:'/superadmin/assignment?view=quality'},{label:'QC changes required',n:report.changesRequired,to:'/superadmin/assignment?view=quality'}].map(a=><Link key={a.label} to={a.to}><span>{cerigaTranslateLabel(a.label)}</span><strong>{a.n}</strong><ArrowUpRight size={14}/></Link>)}</div><p className="as-note">{cerigaTranslate("interface.text_58040bdd3671d955")}</p></section>
 <section className="as-panel"><div className="as-panel-title"><h2>{cerigaTranslate("interface.text_2e56727060140029")}</h2><span>{cerigaTranslate("interface.text_6ab61f20c0b917eb")}</span></div><div className="as-quote"><strong>{report.quotesSubmitted}</strong><span>{cerigaTranslate("interface.text_9fad5f85c636d7c3")}</span></div><p className="as-note">{report.quoteDeadlineSamples?cerigaTranslate("interface.text_a58d4a77276705cb",{value0:(report.quotesOnTime),value1:(report.quoteDeadlineSamples)}):cerigaTranslate("interface.text_a2bcae0dfd850a1d")}{" "}{cerigaTranslate("interface.text_05c86e88936bf767")}</p><details className="as-definitions"><summary>{cerigaTranslate("interface.text_ef00e6a1c4412100")}</summary><p>{cerigaTranslate("interface.text_17ca5135bec8a2e9")}</p></details></section></div>
 <section className="as-network" aria-label={cerigaTranslate("interface.text_08917c54290ee40c")}><div><span>{cerigaTranslate("interface.text_38586d62ee9a67aa")}</span><strong>{report.users}</strong><small>{cerigaTranslate("interface.text_80c5419758b4b72c")}</small></div><Link to="/superadmin/manufacturers"><span>{cerigaTranslate("interface.text_09b7431ff5ebb33d")}</span><strong>{report.manufacturers}</strong><small>{cerigaTranslate("interface.text_b754305c5a7fb721")}<ArrowUpRight size={12}/></small></Link><Link to="/superadmin/notifications"><span>{cerigaTranslate("interface.text_b1e97dfc5eb8de74")}</span><strong>{report.unreadNotifications}</strong><small>{cerigaTranslate("interface.text_da47917222a78246")}<ArrowUpRight size={12}/></small></Link></section>
 <details className="as-finance"><summary>{cerigaTranslate("interface.text_57f0c5e5f873c6fa")}</summary><p>{cerigaTranslate("interface.text_7eec4cdff1241e35")}</p>{report.verifiedRevenue.length?<ul>{report.verifiedRevenue.map(r=><li key={r.currency}><span>{r.currency}</span><strong>{formatMoney(Number(r.cents),r.currency)}</strong><span>{r.payments}{" "}{cerigaTranslate("interface.plural_noun_bd4e40b99a907d40",{count:Number(r.payments)})}</span></li>)}</ul>:<p>{cerigaTranslate("interface.text_db69fee5a5b31b0c")}</p>}</details>
 <footer className="as-footer"><span>{cerigaTranslate("interface.text_3a5ecca188c0579c")}{" "}{new Date(report.generatedAt).toLocaleString(cerigaLocale())}</span><span>{cerigaTranslate("interface.text_22662a88339bb9e2")}</span></footer></>}
 </div>;
}
