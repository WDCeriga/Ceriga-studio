import {Link} from 'react-router';
import {activeLocale,useCerigaTranslation} from '../../i18n/i18n';
import {STATUS_LABELS,type SuperAdminOrder} from '../../data/superadminMock';

/** Internal-only guidance: this component never changes workflow state. */
export function InternalOrderTask({order,shippingReady}:{order:SuperAdminOrder;shippingReady:boolean}) {
  const {t,label}=useCerigaTranslation();
  const active=['paid','in_production','shipped','completed'].includes(order.status);
  const assignment=!order.manufacturerId||['rejected','declined','expired'].includes(order.factoryQuoteStatus??'');
  const review=['pending_review','priced'].includes(order.status)||Boolean(order.quoteTiers?.length&&order.status==='assigned');
  const waitingFactory=Boolean(order.manufacturerId)&&!order.quoteTiers?.length&&!assignment;
  const overdue=waitingFactory&&!active&&!!order.dueQuoteBy&&new Date(order.dueQuoteBy+'T23:59:59').getTime()<Date.now();
  const needsAssignmentReview=(assignment||overdue)&&!active&&order.status!=='draft';
  const title=order.status==='draft'?t('adminOrders.draftHelp'):active?label(STATUS_LABELS[order.status]):review?t('workflow.readiness'):overdue?t('interface.text_f8f858967058d792'):waitingFactory?t('workflow.waitingFactory'):assignment?label('Need reassignment'):label(STATUS_LABELS[order.status]);
  const href=needsAssignmentReview?'/superadmin/assignment?order='+order.id:active?'#current-work':review?'#quotation-review':'#order-specifications';
  const action=needsAssignmentReview?label('Review assignments'):active?label('View order'):review?label('Review quotation'):label('Order specifications & tech pack');
  return <section className="od-next-task" aria-label={t('workflow.nextTask')}>
    <div><p>{t('workflow.nextTask')}</p><h2>{title}</h2>
      {order.dueQuoteBy&&!active&&<span>{label('Quote due')} <time dateTime={order.dueQuoteBy}>{new Date(order.dueQuoteBy.length===10?order.dueQuoteBy+'T12:00:00':order.dueQuoteBy).toLocaleDateString(activeLocale())}</time></span>}
      {review&&<span>{!order.quoteTiers?.length?t('workflow.missingQuote'):!shippingReady?t('workflow.missingShipping'):t('workflow.readyReview')}</span>}
      {active&&<span>{t('workflow.releaseBasis')}: {order.paymentVerifiedAt?label('Payment confirmed'):order.productionReleasedAt&&order.manufacturerSubmittedAt?t('workflow.unpaidRelease'):label('Awaiting production release')}</span>}
      {order.status==='completed'&&order.completionMethod&&<span>{t(order.completionMethod==='admin_delivery'?'workflow.confirmedDelivery':'workflow.automaticClosure')}</span>}
    </div>
    <Link to={href}>{action} &rarr;</Link>
  </section>;
}
