import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { FactoryPortfolioPanel } from '../../components/manufacturer/FactoryPortfolioPanel';
import { ManufacturerVerificationView } from '../../components/manufacturer/ManufacturerVerificationView';
import './manufacturer-factory-profile.css';

export function ManufacturerFactoryProfile({ embedded = false }: { embedded?: boolean } = {}) {
  useCerigaTranslation();

  const { access, ready, error } = useFactoryAccess();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const portfolioAllowed = !isSupabaseConfigured || !!access?.permissions.includes('portfolio');
  const credentialsAllowed = !isSupabaseConfigured || !!access?.permissions.includes('verification');
  const credentialsRequested = pathname === '/manufacturer/verification' || params.get('view') === 'certifications';
  const credentials = credentialsAllowed && (credentialsRequested || !portfolioAllowed);

  if (isSupabaseConfigured && !ready) return <p role="status">{cerigaTranslate("interface.text_e85b827203324e53")}</p>;
  if (error) return <p role="alert">{cerigaTranslate("interface.text_f6fcdd63ce9e1052")}{" "}{cerigaTranslateLabel(error)}</p>;
  if (!portfolioAllowed && !credentialsAllowed) return <p role="alert">{cerigaTranslate("interface.text_a755c6967e781883")}</p>;

  return (
    <div className="manufacturer-factory-profile">
      {!embedded && <header className="factory-profile-heading">
        <span>{cerigaTranslate("interface.text_6475be07fc2b2502")}</span>
        <h1>{cerigaTranslate("interface.text_9fe768f9c153a5fc")}</h1>
        <p>{cerigaTranslate("interface.text_1ef39c5eea30efd8")}</p>
      </header>}
      <nav className="factory-profile-views" aria-label={cerigaTranslate("interface.text_a83c2e886df82bf9")}>
        {portfolioAllowed && <Link to="/manufacturer/settings/profile" aria-current={!credentials ? 'page' : undefined}>{cerigaTranslate("interface.text_1853eb2e9e5ed2bc")}</Link>}
        {credentialsAllowed && <Link to="/manufacturer/settings/profile?view=certifications" aria-current={credentials ? 'page' : undefined}>{cerigaTranslate("interface.text_471502f86c773c59")}</Link>}
      </nav>
      <section aria-label={credentials ? cerigaTranslate("interface.text_d77cd8e4a7154947") : cerigaTranslate("interface.text_e8ddb946bb382eef")}>
        {credentials ? <ManufacturerVerificationView embedded /> : <FactoryPortfolioPanel embedded />}
      </section>
    </div>
  );
}
