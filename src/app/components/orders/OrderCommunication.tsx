import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FileText, MessageSquare, Paperclip, Plus, RefreshCw, X } from 'lucide-react';
import { Link } from 'react-router';
import { getSupabase } from '../../lib/supabaseClient';
import { activeLocale, availableLanguage, languages, type Language } from '../../i18n/i18n';
import './order-communication.css';
import { InternalAttachmentPreview } from './InternalAttachmentPreview';

export const categories = {
  general: 'General question', design: 'Design clarification', fabric: 'Material or colour alternative',
  colour: 'Colour alternative', moq: 'MOQ adjustment', timeline: 'Timeline adjustment',
  quotation: 'Quotation adjustment', other: 'Other', production_issue: 'Production issue',
};
const impacts = { informational: 'Informational', clarification: 'Needs clarification', approval: 'Needs customer approval', blocking: 'Blocks affected work' };
const terms = { quantity: 'Quantity / MOQ', material: 'Material', colour: 'Colour', price: 'Price', lead_time: 'Lead time', construction: 'Artwork / construction', shipping: 'Shipping / delivery date' };
const statuses: Record<string, string> = {
  draft: 'Draft', pending_review: 'Waiting for Ceriga review', clarification_requested: 'Clarification requested',
  awaiting_customer: 'Waiting for customer', customer_responded: 'Customer responded', rejected: 'Rejected', resolved: 'Resolved',
};
const labels: Record<string, string> = {
  submit: 'Original manufacturer submission', clarify: 'Manufacturer clarification', delivery: 'Message from Ceriga',
  reply: 'Customer reply', accept: 'Customer accepted', decline: 'Customer declined', share_reply: 'Reviewed response from Ceriga',
  request_clarification: 'Clarification requested by Ceriga', return_reply: 'Ceriga requested more information',
  reject: 'Declined by Ceriga', resolve: 'Commercial review closed', draft: 'Draft',
  follow_up: 'Manufacturer follow-up', resolve_issue: 'Issue resolved by Ceriga',
};
type Scope = 'manufacturer' | 'customer' | 'admin';
type Category = keyof typeof categories;
type Proposal = { field: keyof typeof terms; current: string; proposed: string };
type Event = { id: string; action: string; body: string; at: string; proposal: Proposal | null; files: string[]; reviewer?: string; language?: Language };
type Request = { id: string; createdAt: string; category: Category; version: number; status: string; decision: string | null; paid: boolean; canEdit: boolean; canAct?: boolean; impact?: keyof typeof impacts; events: Event[] };
type Mutation = { action: string; body?: string; category?: Category; proposal?: Proposal | null; impact?: keyof typeof impacts; files?: File[]; share?: boolean; language: Language };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Could not complete the request. Try again.';
const types = ['image/png', 'image/jpeg', 'application/pdf'];
const proposalFields: Partial<Record<Category, Proposal['field']>> = {
  fabric: 'material', colour: 'colour', moq: 'quantity', timeline: 'lead_time', quotation: 'price',
};
const attachmentError = 'Choose up to three PNG, JPEG or PDF files, 2 MiB each.';
const validFiles = (files: File[]) => files.length <= 3 && files.every(file => file.size > 0 && file.size <= 2 * 1024 ** 2 && types.includes(file.type));

async function encodeFiles(files: File[]) {
  if (!validFiles(files)) {
    throw new Error(attachmentError);
  }
  return Promise.all(files.map(file => new Promise<{ type: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("An attachment could not be read."));
    reader.onload = () => resolve({ type: file.type, data: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  })));
}

async function download(event: Event, index: number, scope: Scope) {
  const { data, error } = await getSupabase().rpc('order_communication_attachment', { p_event: event.id, p_index: index, p_scope: scope });
  if (error || !data) throw new Error(error?.message || 'This attachment is unavailable.');
  const bytes = Uint8Array.from(atob(data.data), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `attachment-${index + 1}.${data.type === 'application/pdf' ? 'pdf' : data.type === 'image/png' ? 'png' : 'jpg'}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function Composer({ scope, request, send, onCancel, id, production = false }: { scope: Scope; request?: Request; send: (mutation: Mutation) => Promise<void>; onCancel?: () => void; id?: string; production?: boolean }) {
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const fileInput = useId();
  const original = request?.events.slice().reverse().find(event => ['draft', 'submit'].includes(event.action));
  const incoming = request?.events.slice().reverse().find(event => ['reply', 'accept', 'decline'].includes(event.action));
  const shared = request?.events.at(-1)?.action === 'share_reply';
  const submission = request?.events.slice().reverse().find(event => ['submit', 'clarify', 'follow_up'].includes(event.action));
  const initial = request?.status === 'draft' ? original?.body : scope === 'admin'
    ? request?.status === 'pending_review' ? submission?.body : request?.status === 'customer_responded' && !shared ? incoming?.body : '' : '';
  const [body, setBody] = useState(initial ?? '');
  const [messageLanguage, setMessageLanguage] = useState<Language>(() =>
    availableLanguage((request?.status === 'pending_review' ? submission : incoming)?.language)
      ?? availableLanguage(document.documentElement.lang) ?? 'en');
  const [category, setCategory] = useState<Category>(request?.category ?? 'general');
  const lastProposal = request?.events.slice().reverse().find(event => ['draft', 'submit', 'delivery'].includes(event.action))?.proposal;
  const [proposal, setProposal] = useState<Proposal | null>(lastProposal ?? null);
  const [impact, setImpact] = useState<keyof typeof impacts>(request?.impact ?? 'informational');
  const [files, setFiles] = useState<File[]>([]);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const create = scope === 'manufacturer' && (!request || request.status === 'draft');
  const approve = scope === 'admin' && request?.status === 'pending_review';
  const reviewReply = scope === 'admin' && request?.status === 'customer_responded' && !shared;
  const close = scope === 'admin' && request?.status === 'customer_responded' && shared;
  const clarify = scope === 'manufacturer' && request?.status === 'clarification_requested';
  const followUp = scope === 'manufacturer' && request?.status === 'resolved' && !lastProposal;
  const reply = scope === 'customer' && request?.status === 'awaiting_customer';
  const formal = reply && request?.events.some(event => event.action === 'delivery' && event.proposal);
  if (request?.canAct === false || (!create && !approve && !reviewReply && !close && !clarify && !followUp && !reply)) return null;

  const act = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!button?.value || sending.current) return;
    const action = button.value;
    setError('');
    if (!body.trim() && !['draft', 'accept', 'decline'].includes(action)) {
      setError('Enter a message before continuing.');
      event.currentTarget.querySelector('textarea')?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      await send({ action, body, category, proposal: create || (approve && action === 'approve') ? proposal : null,
        impact: create && category === 'production_issue' ? impact : undefined, files, share, language: messageLanguage });
    } catch (cause) { setError(errorText(cause)); }
    finally { sending.current = false; setBusy(false); }
  };
  const button = (action: string, label: string, secondary = false) =>
    <button type="submit" value={action} disabled={busy} className={secondary ? 'communication-secondary' : ''}>{cerigaTranslateLabel(translateLabel(label))}</button>;

  return <form id={id} className="communication-form" onSubmit={act} aria-label={create ? cerigaTranslate("interface.text_25d20d01489c3bd9") : cerigaTranslate("interface.text_0abf3bab17d69b79")} aria-busy={busy}>
    {create && <div className="communication-fields">
      <label>{cerigaTranslate("interface.text_292c06f0045a45d0")}<select value={category} onChange={event => {
        const next = event.target.value as Category;
        setCategory(next);
      }}>{Object.entries(categories).filter(([value]) => !['colour', 'quotation'].includes(value) || value === category)
        .filter(([value]) => value !== 'production_issue' || production || value === category)
        .map(([value, label]) => <option key={value} value={value}>{cerigaTranslateLabel(label)}</option>)}</select></label>
      {category === 'production_issue' && <label>{cerigaTranslate("interface.text_09771cf1fc4d943c")}<select value={impact} onChange={event => setImpact(event.target.value as keyof typeof impacts)}>
        {Object.entries(impacts).map(([value, label]) => <option key={value} value={value}>{cerigaTranslateLabel(label)}</option>)}
      </select></label>}
      <label className="communication-check"><input type="checkbox" checked={!!proposal} onChange={event => setProposal(event.target.checked ? { field: proposalFields[category] ?? 'construction', current: '', proposed: '' } : null)}/>{" "}{cerigaTranslate("interface.text_6a635b8d76404ff1")}</label>
    </div>}
    {(create || approve) && proposal && <fieldset className="communication-fields">
      <legend>{t('messages.proposal')}</legend>
      <label>{cerigaTranslate("interface.text_4e21dce0b38ac74f")}<select disabled={approve} value={proposal.field} onChange={event => setProposal({ ...proposal, field: event.target.value as Proposal['field'] })}>
        {Object.entries(terms).map(([value, label]) => <option key={value} value={value}>{cerigaTranslateLabel(label)}</option>)}</select></label>
      <label>{t('messages.current')}<input maxLength={500} value={proposal.current} onChange={event => setProposal({ ...proposal, current: event.target.value })}/></label>
      <label>{t('messages.proposed')}<input maxLength={500} value={proposal.proposed} onChange={event => setProposal({ ...proposal, proposed: event.target.value })}/></label>
    </fieldset>}
    <label>{approve || reviewReply ? t('messages.reviewed') : close ? cerigaTranslate("interface.text_53b7ceb4653b58c7") : formal ? cerigaTranslate("interface.text_24b9b404fc40c057") : clarify ? cerigaTranslate("interface.text_598bf32be3e85003") : reply || followUp ? cerigaTranslate("interface.text_ca840452efbd22b6") : cerigaTranslate("interface.text_2f77668a9dfbf8d5")}
      <textarea dir="auto" rows={4} maxLength={5000} value={body} placeholder={create ? cerigaTranslate("interface.text_e674ecb65421a59f") : undefined} onChange={event => setBody(event.target.value)}/>
    </label>
    {!close && <label>{t('messages.language')}<select value={messageLanguage} onChange={event => setMessageLanguage(availableLanguage(event.target.value) ?? 'en')}>
      {Object.entries(languages).map(([id, entry]) => <option key={id} value={id} lang={id}>{cerigaTranslateLabel(entry.label)}</option>)}
    </select></label>}
    {(create || clarify || followUp || reply) && <div className="communication-attachments">
      <div className="communication-attach-row">
        <input id={fileInput} className="sr-only" type="file" multiple accept={types.join(',')} disabled={busy} aria-describedby={fileInput + '-hint'} onChange={event => {
          const selected = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (!selected.length) return;
          const next = [...files, ...selected.filter(file => !files.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified))];
          if (!validFiles(next)) { setFileError(attachmentError); return; }
          setFiles(next);
          setFileError('');
        }}/>
        <label htmlFor={fileInput}><Paperclip size={15} aria-hidden="true"/> {t('messages.attachment')}</label>
        <span id={fileInput + '-hint'} className="communication-muted">{cerigaTranslate("interface.text_8bd8c1e0ca5e2709")}</span>
      </div>
      {files.length > 0 && <ul className="communication-files" aria-label={cerigaTranslate("interface.text_ccfc6f3674266bfc")}>{files.map((file, index) => <li key={index}>
        <FileText size={14} aria-hidden="true"/><span>{file.name}</span>
        <button type="button" className="communication-icon" disabled={busy} aria-label={cerigaTranslate("interface.text_e224cf245aada55a",{value0:(file.name)})} onClick={() => {
          setFiles(current => current.filter((_, position) => position !== index));
          setFileError('');
        }}><X size={14} aria-hidden="true"/></button>
      </li>)}</ul>}
      {fileError && <p role="alert" className="communication-error">{cerigaTranslateLabel(fileError)}</p>}
      {request?.status === 'draft' && original?.files.length ? <span className="communication-muted">{cerigaTranslate("interface.text_6160c0eff5f09ea4")}</span> : null}
    </div>}
    {(approve || reviewReply) && <label className="communication-check"><input type="checkbox" checked={share} onChange={event => setShare(event.target.checked)}/>{" "}{cerigaTranslate("interface.text_d6760d9d157f9b40")}</label>}
    {(formal || close || (approve && proposal)) && <p className="communication-muted">{request?.paid ? cerigaTranslate("interface.text_f6c9b8824f74ea3f") : cerigaTranslate("interface.text_749c95f264b5719b")}</p>}
    {error && <p role="alert" className="communication-error">{cerigaTranslateLabel(error)}</p>}
    <div className="communication-actions communication-form-actions">
      {create && <>{button('submit', 'Send to Ceriga')}{button('draft', 'Save draft', true)}{onCancel && <button type="button" className="communication-quiet" disabled={busy} onClick={onCancel}>{cerigaTranslate("common.close")}</button>}</>}
      {clarify && button('clarify', 'Send clarification')}
      {followUp && button('follow_up', 'Send follow-up to Ceriga')}
      {approve && <>{button('approve', 'Approve and send')}{button('request_clarification', 'Request clarification', true)}{request?.category === 'production_issue' && !proposal && button('resolve_issue', 'Resolve with manufacturer', true)}{button('reject', 'Reject', true)}</>}
      {reviewReply && <>{button('share_reply', 'Approve and share')}{button('return_reply', 'Ask customer to clarify', true)}</>}
      {close && button('resolve', 'Record outcome and close')}
      {reply && (formal ? <>{button('accept', 'Accept proposal')}{button('decline', 'Decline proposal', true)}{button('reply', 'Ask a question', true)}</> : button('reply', 'Send to Ceriga'))}
    </div>
    {busy && <p role="status" className="communication-muted">{cerigaTranslate("common.saving")}</p>}
  </form>;
}

export function OrderCommunication({ orderId, scope, onChange, production = false,readOnly=false }: { orderId: string; scope: Scope; onChange?: () => void; production?: boolean;readOnly?:boolean }) {
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const composerId = useId();
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [compose, setCompose] = useState(false);
  const [older, setOlder] = useState(false);
  const newRequestId = useRef<string | undefined>(undefined);
  const preparingRevision=useRef(false);
  const closeComposer = () => {
    setCompose(false);
    newRequestId.current = undefined;
    requestAnimationFrame(() => document.getElementById(composerId + '-open')?.focus());
  };
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await getSupabase().rpc('order_communication_history', { p_order: orderId, p_scope: scope });
      if (error) {
        if (error.code === '42501' || /access denied/i.test(error.message)) setRequests([]);
        throw new Error(error.message);
      }
      setRequests(data ?? []);
      setOlder(data?.length === 50);
      setError('');
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, scope]);

  useEffect(() => { void load(); }, [load]);

  const loadOlder = async () => {
    const last = requests[requests.length - 1];
    const { data, error } = await getSupabase().rpc('order_communication_history', {
      p_order: orderId, p_scope: scope, p_before: last.createdAt, p_before_id: last.id,
    });
    if (error) { setError(error.message); return; }
    setOlder(data.length === 50);
    setRequests(current => [...current, ...data.filter((item: Request) => !current.some(row => row.id === item.id))]);
  };
  const send = async (mutation: Mutation, request?: Request) => {
    const { error } = await getSupabase().rpc('order_communication_localized_action', {
      p_order: orderId, p_scope: scope, p_id: request?.id ?? (newRequestId.current ??= crypto.randomUUID()),
      p_version: request?.version ?? 0, p_action: mutation.action, p_body: mutation.body,
      p_category: mutation.category,
      p_proposal: mutation.impact ? { ...mutation.proposal, impact: mutation.impact } : mutation.proposal,
      p_files: await encodeFiles(mutation.files ?? []),
      p_share_files: mutation.share ?? false,
      p_language: mutation.language,
    });
    if (error) throw new Error(error.message);
    if (!request) closeComposer();
    await load();
    setFeedback(mutation.action === 'draft' ? cerigaTranslate("interface.text_be997844b2a8950f") : mutation.action === 'submit' ? cerigaTranslate("interface.text_7217f2f84aae28f7") : cerigaTranslate("interface.text_3ac349fdfe701586"));
    onChange?.();
  };
  const prepareRevision=async(request:Request)=>{
    if(preparingRevision.current)return;preparingRevision.current=true;setError('');
    try{
      const {data,error}=await getSupabase().rpc('internal_order_work',{p_order:orderId,p_kind:'amendment',p_action:'create',p_data:{request_id:request.id}});
      if(error||!data?.id)throw new Error(error?.message??'The database did not confirm this action.');
      setFeedback(t('workflow.awaitingAmendment'));
      window.dispatchEvent(new Event('ceriga-internal-work-updated'));
    }catch(cause){setError(errorText(cause));}finally{preparingRevision.current=false;}
  };
  return <section id="customer-communication" className="order-communication" aria-label={cerigaTranslate("messages.order")}>
    <header className="communication-heading"><div><h2>{t(scope === 'manufacturer' ? "messages.questions" : scope === 'customer' ? "messages.updates" : "messages.order")}</h2>
      <p className="communication-muted">{scope === 'manufacturer' ? cerigaTranslate("interface.text_6a3c8de9d06e870d") : scope === 'customer' ? cerigaTranslate("interface.text_8eda077762c5642b") : cerigaTranslate("interface.text_6e56a29ece512ae3")}</p>
    </div><div className="communication-actions">
      <button type="button" className="communication-icon" aria-label={cerigaTranslate("interface.text_2ce6d3e734cb2f08")} title={cerigaTranslate("interface.text_2ce6d3e734cb2f08")} disabled={refreshing} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true"/></button>
      {!readOnly && scope === 'manufacturer' && !loading && !compose && <button id={composerId + '-open'} type="button" onClick={() => {
        setFeedback('');
        setCompose(true);
        requestAnimationFrame(() => document.getElementById(composerId)?.querySelector('select')?.focus());
      }}><Plus size={16} aria-hidden="true"/> {t('messages.new')}</button>}
    </div></header>
    {loading && <p role="status">{t('messages.loading')}</p>}
    {error && <p role="alert" className="communication-error">{cerigaTranslateLabel(error)}</p>}
    {feedback && <p role="status" className="communication-feedback">{cerigaTranslateLabel(feedback)}</p>}
    {!loading && <>
      {compose && <Composer scope={scope} production={production} send={send} id={composerId} onCancel={closeComposer}/>}
      {!requests.length && !compose && !error && <div className="communication-empty"><MessageSquare size={18} aria-hidden="true"/><p>{t('messages.empty')}</p></div>}
      {requests.map(request => <article key={request.id} className="communication-thread">
        <header><h3>{categories[request.category]}</h3><span className="communication-status">{
          request.status === 'awaiting_customer' && request.events.some(event => event.proposal) ? cerigaTranslate("interface.text_2d1046f680c9a180")
            : request.decision === 'accepted' && request.status === 'customer_responded' && scope !== 'customer' && request.events.at(-1)?.action === 'share_reply'
              ? cerigaTranslate("interface.text_02c0189c6fe1ce69") : translateLabel(statuses[request.status] ?? request.status)
        }</span></header>
        {request.impact && <p className={request.impact === 'blocking' ? 'communication-error' : 'communication-muted'}>{impacts[request.impact]}</p>}
        {request.decision && <p>{cerigaTranslate("interface.text_5d42766c7ecac46c")}{" "}{request.decision}</p>}
        {request.events.filter((event, index, events) => labels[event.action] && (event.action !== 'draft' || (request.status === 'draft' && index === events.length - 1))).map(event => <div key={event.id} className="communication-entry">
          <div><strong>{scope === 'customer' && ['reply', 'accept', 'decline'].includes(event.action) ? cerigaTranslate("interface.text_8c8e46966c31598e") : labels[event.action]}</strong> <time dateTime={event.at}>{new Date(event.at).toLocaleString(activeLocale())}</time>
            {event.language && languages[event.language] && <small lang={event.language} className="communication-muted"> {cerigaTranslateLabel(languages[event.language].label)}</small>}
          </div>
          {event.reviewer && <small className="communication-muted">{cerigaTranslate("interface.text_d29f46772c4aaacb")}{" "}{event.reviewer}</small>}
          {event.body && <p lang={event.language} dir="auto">{event.body}</p>}
          {event.proposal && <dl><dt>{terms[event.proposal.field]}</dt><dd>{cerigaTranslate("interface.text_c09f632874c2511b")}{" "}{event.proposal.current}</dd><dd>{cerigaTranslate("interface.text_05f49faae181270b")}{" "}{event.proposal.proposed}</dd></dl>}
          {scope === 'admin' && event.files.map((type,index) => type !== 'application/pdf' ? <InternalAttachmentPreview key={index} eventId={event.id} index={index}/> : null)}
          {event.files.map((type, index) => <button type="button" key={index} className="communication-secondary" onClick={() => void download(event, index, scope).catch(cause => setError(errorText(cause)))}>{cerigaTranslate("interface.text_d6eafe8235910042")}{" "}{type === 'application/pdf' ? cerigaTranslate("interface.text_1d393b0081b632c5") : cerigaTranslate("interface.text_6105d6cc76af4003")} {index + 1}</button>)}
        </div>)}
        {!readOnly && (request.status !== 'draft' || request.canEdit) && (scope === 'manufacturer' && request.status === 'resolved' && !request.events.some(event => event.action === 'submit' && event.proposal)
          ? <details><summary>{cerigaTranslate("interface.text_7d28f801df95601a")}</summary><Composer key={request.version} scope={scope} request={request} send={mutation => send(mutation, request)}/></details>
          : <Composer key={request.version} scope={scope} production={production} request={request} send={mutation => send(mutation, request)}/>)}
        {!readOnly && scope === 'admin' && request.decision === 'accepted' && <div className="communication-actions"><button type="button" disabled={request.events.at(-1)?.action!=='share_reply'} onClick={()=>void prepareRevision(request)}>{t('workflow.prepareRevision')}</button><Link to={'/superadmin/orders/'+orderId+'#internal-amendment'}>{t('workflow.awaitingAmendment')}</Link></div>}
      </article>)}
      {older && <button type="button" className="communication-secondary" onClick={() => void loadOlder()}>{cerigaTranslate("interface.text_ac318011a6611dbc")}</button>}
    </>}
  </section>;
}
