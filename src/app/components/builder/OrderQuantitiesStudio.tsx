import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Minus, Plus, Trash2 } from 'lucide-react';
import { ORDER_SIZE_KEYS, type OrderSizeKey } from '../../data/builderSteps';
import { applySizeChange, distributeQuantity, isSampleQuantityValid, maxBulkRuns, newBulkRun, setOrderMode, sumBreakdown, type OrderQuantityPlan, type OrderQuantityLine } from '../../data/orderQuantities';
import { InspectorHeading } from './shell/InspectorHeading';
import { BuilderSelect } from './shell/BuilderSelect';
import './order-quantities-studio.css';

type Props = { plan: OrderQuantityPlan; onChange: (plan: OrderQuantityPlan) => void; selectedRunId?: string; onRunChange?: (id: string) => void };
function activeRun(plan: OrderQuantityPlan, id?: string) { return plan.bulkRuns.find(run => run.id === id) ?? plan.sample; }

export function OrderQuantitiesStudio({ plan, garment, name, colour = '#262626', selectedRunId }: Props & { garment: ReactNode; name: string; colour?: string }) {
  const line = activeRun(plan, selectedRunId);
  const total = sumBreakdown(line.bySize);
  const maximum = Math.max(1, ...Object.values(line.bySize));
  const points = ORDER_SIZE_KEYS.map((size, index) => ({ x: 30 + index * 80, y: 146 - line.bySize[size] / maximum * 96, size }));
  return <div className="order-studio">
    <div className="order-canvas-caption"><span className="order-design-swatch" style={{background:colour}}/>{name}<span>Front</span></div>
    <div className="order-production-layout">
      <div className="order-garment-art">{garment}</div>
      <section className="order-canvas-breakdown" aria-label="Size breakdown">
        <span className="order-run-caption">{line.kind === 'sample' ? 'Samples' : `Bulk quote ${plan.bulkRuns.findIndex(run => run.id === line.id)+1}`}</span>
        <div className="order-total"><strong>{total.toLocaleString()} <small>{total === 1 ? 'unit' : 'units'}</small></strong></div>
        <div className="order-curve" role="img" aria-label={ORDER_SIZE_KEYS.map(size => `${size.toUpperCase()}: ${line.bySize[size]} units`).join(', ')}>
          <svg viewBox="0 0 460 190" aria-hidden="true"><line x1="30" x2="430" y1="146" y2="146" stroke="#e5e5e5"/><polyline points={points.map(point=>`${point.x},${point.y}`).join(' ')} fill="none" stroke="#a3a3a3" strokeWidth="1.5" strokeLinejoin="round"/>{points.map(({x,y,size})=><g key={size}><circle cx={x} cy={y} r="4" fill="#525252" stroke="white" strokeWidth="1.5"/><text x={x} y={y-14} textAnchor="middle" fill="#525252" fontSize="11">{line.bySize[size]}</text><text x={x} y="178" textAnchor="middle" fill="#888" fontSize="10">{size.toUpperCase()}</text></g>)}</svg>
        </div>
      </section>
    </div>
  </div>;
}

export function OrderRequestInspector({ plan, onChange, onContinue, selectedRunId, onRunChange }: Props & { onContinue: () => void }) {
  const [localRun,setLocalRun] = useState('sample');
  const [distribution,setDistribution] = useState('custom');
  const line = activeRun(plan,selectedRunId ?? localRun);
  const sample = line.kind === 'sample';
  const total = sumBreakdown(line.bySize);
  const amount = line.targetTotal ?? total;
  const valid = isSampleQuantityValid(plan);
  const quotesValid = plan.bulkRuns.every(run => run.targetTotal == null || run.targetTotal === sumBreakdown(run.bySize));
  const selectRun = (id:string) => { setLocalRun(id);onRunChange?.(id);setDistribution('custom'); };
  const update = (next:OrderQuantityLine) => onChange(sample ? {...plan,sample:next} : {...plan,bulkRuns:plan.bulkRuns.map(run=>run.id===line.id?next:run)});
  const setQuantity = (quantity:number) => {
    const value = Math.max(sample?1:0,Math.floor(quantity||0));
    update({...line,targetTotal:value,bySize:distributeQuantity(value)});
    setDistribution('balanced');
  };
  const setSize = (size:OrderSizeKey,value:number) => {
    const bySize = applySizeChange(line.bySize,size,Math.max(0,Math.floor(value||0)));
    update({...line,bySize,...(sample?{targetTotal:sumBreakdown(bySize)}:{})});
    setDistribution('custom');
  };
  const distribute = (method:string) => {
    setDistribution(method);
    if(method==='custom')return;
    const target = line.targetTotal ?? total;
    const bySize = method==='balanced'?distributeQuantity(target):Object.fromEntries(ORDER_SIZE_KEYS.map((size,index)=>[size,Math.floor(target/6)+(index<target%6?1:0)])) as OrderQuantityLine['bySize'];
    update({...line,targetTotal:target,bySize});
  };
  return <div className="order-request">
    <div className="order-editor-scroll">
      <InspectorHeading eyebrow="PRODUCTION STUDIO" title="Order & quantities" description="Choose your quantities and size split."/>
      <div className="order-run-picker"><BuilderSelect label="Sample or bulk quote" value={line.id} onChange={selectRun} options={[{value:'sample',label:'Samples'},...plan.bulkRuns.map((run,index)=>({value:run.id,label:`Bulk quote ${index+1}`}))]}/>
        {plan.bulkRuns.length < maxBulkRuns(plan.mode)&&<button className="order-icon-button" aria-label="Add bulk quote" title="Add bulk quote" onClick={()=>{const run=newBulkRun();onChange({...plan,bulkRuns:[...plan.bulkRuns,run]});selectRun(run.id);}}><Plus size={17}/></button>}
        {!sample&&plan.mode==='custom_clothing'&&<button className="order-icon-button" aria-label="Remove selected bulk quote" onClick={()=>{onChange({...plan,bulkRuns:plan.bulkRuns.filter(run=>run.id!==line.id)});selectRun('sample');}}><Trash2 size={16}/></button>}
      </div>
      <section className="order-editor-section"><label htmlFor="order-quantity">{sample?'Sample quantity':'Production quantity'}</label><div className="order-quantity-stepper"><button aria-label="Decrease total quantity" disabled={amount<=(sample?1:0)} onClick={()=>setQuantity(amount-1)}><Minus size={16}/></button><input id="order-quantity" aria-label={sample?'Sample quantity':'Production quote quantity'} type="number" inputMode="numeric" min={sample?1:0} step="1" value={amount} onChange={event=>setQuantity(Number(event.target.value))}/><span>{amount===1?'unit':'units'}</span><button aria-label="Increase total quantity" onClick={()=>setQuantity(amount+1)}><Plus size={16}/></button></div><p>{sample?'Order from one sample, in any size.':'Each bulk quote is a separate production option.'}</p></section>
      <section className="order-editor-section"><label>Sizes</label><div className="order-size-grid">{ORDER_SIZE_KEYS.map(size=><label key={size}><span>{size.toUpperCase()}</span><input aria-label={`${size.toUpperCase()} quantity`} type="number" inputMode="numeric" min="0" step="1" value={line.bySize[size]} onChange={event=>setSize(size,Number(event.target.value))}/></label>)}</div><div className="order-allocation-status">{sample?`${total} ${total===1?'sample':'samples'}`:total===amount?<><Check size={12}/>All units allocated</>:total<amount?`${amount-total} left to allocate`:`${total-amount} above quantity`}</div></section>
      <section className="order-editor-section"><label>Size distribution</label><BuilderSelect label="Size distribution" value={distribution} onChange={distribute} options={[{value:'custom',label:'Custom split'},{value:'balanced',label:'Balanced split'},{value:'even',label:'Split evenly'}]}/></section>
      <details className="order-settings"><summary>Order type<span>{plan.mode==='custom_clothing'?'Custom clothing':'Tech pack'}</span></summary><BuilderSelect label="Order type" value={plan.mode} onChange={value=>onChange(setOrderMode(plan,value as OrderQuantityPlan['mode']))} options={[{value:'custom_clothing',label:'Custom clothing'},{value:'techpack',label:'Tech pack'}]}/></details>
      {!valid&&<p className="order-validation" role="status">Choose at least one sample in any size to continue.</p>}
      {!quotesValid&&<p className="order-validation" role="status">Match each bulk size split to its quote quantity to continue.</p>}
    </div>
    <footer className="order-request-footer"><button className="order-continue" disabled={!valid||!quotesValid} onClick={onContinue}>Continue to delivery<ArrowRight size={17}/></button><p>Pricing follows manufacturer review.</p></footer>
  </div>;
}
