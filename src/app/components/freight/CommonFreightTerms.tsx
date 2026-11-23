import {useState}from'react';
import{formatMoney}from'../../lib/currency';
import{useCerigaTranslation}from'../../i18n/i18n';
import type{FreightContext}from'../../lib/freight';
export function CommonFreightTerms({data,busy,apply}:{data:FreightContext;busy:boolean;apply:(source:string,targets:string[])=>void}){
 const{t,label}=useCerigaTranslation();const[source,setSource]=useState(''),[targets,setTargets]=useState<string[]>([]);
 const quotes=data.quotes.filter(q=>q.source==='forwarder'&&q.forwarder_id&&(q.terms.validUntil??'')>=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));const selected=quotes.find(q=>q.id===source);
 if(data.paid||quotes.length<2)return null;
 const description=(id:string)=>{const q=quotes.find(q=>q.id===id)!;return label(data.manufacturerQuotes?.find(tier=>tier.id===q.option_id)?.label??q.option_id)+' · '+q.terms.provider+' · '+formatMoney(q.terms.priceCents,q.terms.currency);};
 return <details className="freight-common-terms"><summary>{t('workflow.commonTerms')}</summary><p className="freight-help">{t('workflow.commonTermsHelp')}</p><label>{t('workflow.sourceQuote')}<select value={source} disabled={busy} onChange={e=>{setSource(e.target.value);setTargets([]);}}><option value="">{t('workflow.sourceQuote')}</option>{quotes.map(q=><option key={q.id} value={q.id}>{description(q.id)}</option>)}</select></label>{selected&&<><p className="freight-help">{[selected.terms.insurance,selected.terms.services,selected.terms.tradeTerms].filter(Boolean).join(' · ')}</p><fieldset disabled={busy}><legend>{t('workflow.targetQuotes')}</legend>{quotes.filter(q=>q.id!==source&&q.forwarder_id===selected.forwarder_id&&q.option_id!==selected.option_id).map(q=><label key={q.id}><input type="checkbox" checked={targets.includes(q.id)} onChange={e=>setTargets(old=>e.target.checked?[...old,q.id]:old.filter(id=>id!==q.id))}/>{description(q.id)}</label>)}</fieldset><button type="button" disabled={busy||!targets.length} onClick={()=>apply(source,targets)}>{t('workflow.applyTerms')}</button></>}</details>;
}
