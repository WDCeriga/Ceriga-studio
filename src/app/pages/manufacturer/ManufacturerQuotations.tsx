import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AssignedOrderDetails } from '../../components/manufacturer/AssignedOrderDetails';
import { useAssignedOrders } from '../../components/manufacturer/AssignedOrdersInbox';
import '../../components/dashboard/manufacturer-dashboard.css';

export function ManufacturerQuotations() {
  const { id } = useParams();
  return <QuotationQueue key={id ?? 'queue'} startId={id}/>;
}

function QuotationQueue({ startId }: { startId?: string }) {
  const { orders, loading, error, permissions, onRefresh } = useAssignedOrders(true);
  const [finished, setFinished] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const pending = orders.filter(order =>
    ['submitted', 'awaiting_payment'].includes(order.status) &&
    ['new', 'reviewing', 'clarifying'].includes(order.factoryStatus ?? 'new') &&
    !finished.includes(order.id),
  );
  const selected = !finished.length && startId ? orders.find(order => order.id === startId) : undefined;
  const current = startId && !finished.length ? selected : pending[0];
  const remaining = pending.filter(order => order.id !== current?.id);
  const advance = (message: string) => {
    if (!current) return;
    setFinished(previous => previous.includes(current.id) ? previous : [...previous, current.id]);
    setFeedback(message);
  };

  if (!loading && !error && permissions.includes('quote') && current) {
    return <AssignedOrderDetails key={current.id} id={current.id} quotationOnly
        queue={{ remaining: remaining.length, feedback }}
        onSkip={() => advance('Skipped for now. The order is still available in Orders.')}
        onResolved={advance}/>;
  }

  return <div className="factory-home">
    <Link to="/manufacturer/orders">← Back to orders</Link>
    <header className="fh-heading"><div><h1>Quote orders<span>.</span></h1></div></header>
    {feedback && <p role="status">{feedback}</p>}
    {loading ? <p role="status">Loading quotation requests…</p> : error
      ? <div className="fh-error" role="alert"><span>{error}</span><button type="button" onClick={onRefresh}>Try again</button></div>
      : <p>{!permissions.includes('quote') ? 'You do not have permission to submit quotations.'
        : startId && !finished.length ? 'This quotation is no longer available.'
        : finished.length ? 'You’ve reached the end of this queue.' : 'No quotation requests need a response.'}</p>}
  </div>;
}
