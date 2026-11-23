import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import './superadmin-quality.css';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { QualityControlQueue } from '../../components/quality/QualityControlQueue';
import { OrderQualityControl } from '../../components/quality/OrderQualityControl';

export function SuperAdminQualityControl({ embedded = false }: { embedded?: boolean } = {}) {
  useCerigaTranslation();

  const { orderId } = useParams();

  return (
    <div className="admin-qc-page space-y-6">
      {!embedded && <header className="space-y-3">
        {orderId && (
          <Link to="/superadmin/quality-control" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
            <ArrowLeft className="h-4 w-4" />{cerigaTranslate("interface.text_bac78464d363591c")}</Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#CC2D24]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">{cerigaTranslate("interface.text_2ca72ec4da58eb58")}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{cerigaTranslate("interface.text_da5685ac3f26b049")}</h1>
            <p className="mt-1 text-sm text-white/45">{cerigaTranslate("interface.text_c9ca422083269fe1")}</p>
          </div>
          {orderId && (
            <Link to={`/superadmin/orders/${orderId}`} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">{cerigaTranslate("interface.text_17f9a9c935463a95")}<ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>}
      {orderId ? (
        <OrderQualityControl key={orderId} orderId={orderId} view="quality" />
      ) : (
        <QualityControlQueue admin title={cerigaTranslate("interface.text_666ae107d08fc51f")} reviewBasePath="/superadmin/assignment/quality" />
      )}
    </div>
  );
}
