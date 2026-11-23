import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SuperAdminAssignmentConsole } from './SuperAdminAssignmentConsole';
import { SuperAdminQualityControl } from './SuperAdminQualityControl';
import { SuperAdminOrderReviewQueue } from './SuperAdminOrderReviewQueue';
import './superadmin-production-review.css';

export function SuperAdminProductionReview() {
  useCerigaTranslation();

  const { orderId } = useParams();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const quality = Boolean(orderId) || pathname.startsWith('/superadmin/quality-control') || params.get('view') === 'quality';
  const pricing = !quality && params.get('view') === 'pricing';
  const view = quality ? 'Quality control' : pricing ? 'Price review' : 'Assignment';

  return (
    <div className="admin-production-review">
      <header className="production-review-heading">
        <span>{cerigaTranslate("adminOrders.operations")}</span>
        <h1>{cerigaTranslate("nav.review")}</h1>
        <p>{cerigaTranslate("interface.text_8273ecd521a41fc1")}</p>
      </header>
      <nav className="production-review-views" aria-label={cerigaTranslate("interface.text_ac577c79a7b57974")}>
        <Link to="/superadmin/assignment" aria-current={view === 'Assignment' ? 'page' : undefined}>{cerigaTranslate("interface.text_153cdaaec56103da")}</Link>
        <Link to="/superadmin/assignment?view=pricing" aria-current={pricing ? 'page' : undefined}>{cerigaTranslate("interface.text_69017a5771a9d89d")}</Link>
        <Link to="/superadmin/assignment?view=quality" aria-current={quality ? 'page' : undefined}>{cerigaTranslate("interface.text_4e732d31fab58380")}</Link>
      </nav>
      <section aria-label={view}>
        {orderId && <div className="production-review-report-links">
          <Link to="/superadmin/assignment?view=quality"><ArrowLeft size={14} />{cerigaTranslate("interface.text_bac78464d363591c")}</Link>
          <Link to={`/superadmin/orders/${orderId}`}>{cerigaTranslate("interface.text_17f9a9c935463a95")}<ArrowUpRight size={14} /></Link>
        </div>}
        {quality ? <SuperAdminQualityControl embedded /> : pricing ? <SuperAdminOrderReviewQueue /> : <SuperAdminAssignmentConsole embedded />}
      </section>
    </div>
  );
}
