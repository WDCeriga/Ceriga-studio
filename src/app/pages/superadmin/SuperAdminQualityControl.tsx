import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { QualityControlQueue } from '../../components/quality/QualityControlQueue';
import { OrderQualityControl } from '../../components/quality/OrderQualityControl';

export function SuperAdminQualityControl() {
  const { orderId } = useParams();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        {orderId && (
          <Link to="/superadmin/quality-control" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="h-4 w-4" />All production reports
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#CC2D24]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Production review</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Quality Control</h1>
            <p className="mt-1 text-sm text-white/45">Review manufacturer submissions, approve production or request changes before dispatch.</p>
          </div>
          {orderId && (
            <Link to={`/superadmin/orders/${orderId}`} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
              View full order<ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>
      {orderId ? (
        <OrderQualityControl key={orderId} orderId={orderId} />
      ) : (
        <QualityControlQueue admin title="Production reports" reviewBasePath="/superadmin/quality-control" />
      )}
    </div>
  );
}
