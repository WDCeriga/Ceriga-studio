import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SuperAdminAssignmentConsole } from './SuperAdminAssignmentConsole';
import { SuperAdminQualityControl } from './SuperAdminQualityControl';
import './superadmin-production-review.css';

export function SuperAdminProductionReview() {
  const { orderId } = useParams();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const quality = Boolean(orderId) || pathname.startsWith('/superadmin/quality-control') || params.get('view') === 'quality';

  return (
    <div className="admin-production-review">
      <header className="production-review-heading">
        <span>CERIGA / OPERATIONS</span>
        <h1>Production review</h1>
        <p>Assign the right manufacturer. Review quality before delivery.</p>
      </header>
      <nav className="production-review-views" aria-label="Production review views">
        <Link to="/superadmin/assignment" aria-current={!quality ? 'page' : undefined}>Assignment</Link>
        <Link to="/superadmin/assignment?view=quality" aria-current={quality ? 'page' : undefined}>Quality control</Link>
      </nav>
      <section aria-label={quality ? 'Quality control' : 'Assignment'}>
        {orderId && <div className="production-review-report-links">
          <Link to="/superadmin/assignment?view=quality"><ArrowLeft size={14} />All production reports</Link>
          <Link to={`/superadmin/orders/${orderId}`}>View full order<ArrowUpRight size={14} /></Link>
        </div>}
        {quality ? <SuperAdminQualityControl embedded /> : <SuperAdminAssignmentConsole embedded />}
      </section>
    </div>
  );
}
