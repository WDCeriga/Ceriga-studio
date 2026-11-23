import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { AssignedOrderDetails } from '../../components/manufacturer/AssignedOrderDetails';
import { useAssignedOrders } from '../../components/manufacturer/AssignedOrdersInbox';
import { ManufacturerOrdersView } from '../../components/manufacturer/ManufacturerOrdersView';
import '../../components/dashboard/manufacturer-dashboard.css';

export function ManufacturerQuotations() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const queued = params.get('mode') === 'queue';
  return <QuotationQueue key={id ?? (queued ? 'queue' : 'list')} startId={id} queued={queued} params={params} />;
}

function QuotationQueue({ startId, queued, params }: { startId?: string; queued: boolean; params: URLSearchParams }) {
  useCerigaTranslation();

  const navigate = useNavigate();
  const { orders, loading, error, permissions, onRefresh } = useAssignedOrders(true);
  const [finished, setFinished] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const pending = orders.filter(order =>
    ['submitted', 'awaiting_payment'].includes(order.status) &&
    ['new', 'reviewing', 'clarifying'].includes(order.factoryStatus ?? 'new') &&
    !finished.includes(order.id),
  ).sort((a, b) => (a.dueQuoteBy || '9999').localeCompare(b.dueQuoteBy || '9999'));
  const listParams = new URLSearchParams(params);
  listParams.delete('mode');
  const quoteBack = '/manufacturer/quotations' + (listParams.size ? '?' + listParams.toString() : '');
  if (!startId && !queued && permissions.includes('quote')) {
    return <ManufacturerOrdersView orders={orders} loading={loading} error={error} permissions={permissions}
      onRefresh={onRefresh} quotationOnly quoteFilters={params} canStartQueue={pending.length > 0} />;
  }
  const selected = !finished.length && startId ? orders.find(order => order.id === startId) : undefined;
  const current = startId && !finished.length ? selected : pending[0];
  const remaining = pending.filter(order => order.id !== current?.id);
  const advance = (message: string) => {
    if (!current) return;
    if (!queued || remaining.length === 0) {
      toast.success(cerigaTranslateLabel(message));
      void navigate(quoteBack, { replace: true });
      return;
    }
    setFinished(previous => previous.includes(current.id) ? previous : [...previous, current.id]);
    setFeedback(message);
  };

  if (!loading && !error && permissions.includes('quote') && current) {
    return <AssignedOrderDetails key={current.id} id={current.id} quotationOnly
        quoteBack={quoteBack}
        queue={queued ? { remaining: remaining.length, feedback } : undefined}
        onSkip={queued ? () => advance('Skipped for now. The order is still available in Quotes.') : undefined}
        onResolved={advance}/>;
  }

  return <div className="factory-home">
    <Link to={queued || startId ? quoteBack : '/manufacturer/orders'}>← {queued || startId ? cerigaTranslate("interface.text_a5ff5d3d356ac348") : cerigaTranslate("orders.back")}</Link>
    <header className="fh-heading"><div><h1>{cerigaTranslate("manufacturerOrders.quoteAction")}<span>.</span></h1></div></header>
    {feedback && <p role="status">{cerigaTranslateLabel(feedback)}</p>}
    {loading ? <p role="status">{cerigaTranslate("interface.text_59d391fff73d934d")}</p> : error
      ? <div className="fh-error" role="alert"><span>{cerigaTranslateLabel(error)}</span><button type="button" onClick={onRefresh}>{cerigaTranslate("common.retry")}</button></div>
      : <p>{!permissions.includes('quote') ? cerigaTranslate("interface.text_409117a94eb2e3ee")
        : startId && !finished.length ? cerigaTranslate("interface.text_1959cd62a623644a")
        : finished.length ? cerigaTranslate("interface.text_885db0dc11bc31cc") : cerigaTranslate("interface.text_ac0d647fc211abd0")}</p>}
  </div>;
}
