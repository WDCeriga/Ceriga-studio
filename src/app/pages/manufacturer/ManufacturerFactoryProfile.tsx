import { Link, useLocation, useSearchParams } from 'react-router';
import { useFactoryAccess } from '../../contexts/FactoryAccessContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { FactoryPortfolioPanel } from '../../components/manufacturer/FactoryPortfolioPanel';
import { ManufacturerVerificationView } from '../../components/manufacturer/ManufacturerVerificationView';
import './manufacturer-factory-profile.css';

export function ManufacturerFactoryProfile({ embedded = false }: { embedded?: boolean } = {}) {
  const { access, ready, error } = useFactoryAccess();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const portfolioAllowed = !isSupabaseConfigured || !!access?.permissions.includes('portfolio');
  const credentialsAllowed = !isSupabaseConfigured || !!access?.permissions.includes('verification');
  const credentialsRequested = pathname === '/manufacturer/verification' || params.get('view') === 'certifications';
  const credentials = credentialsAllowed && (credentialsRequested || !portfolioAllowed);

  if (isSupabaseConfigured && !ready) return <p role="status">Loading factory profile…</p>;
  if (error) return <p role="alert">Could not load factory access: {error}</p>;
  if (!portfolioAllowed && !credentialsAllowed) return <p role="alert">Your role does not have access to this factory profile.</p>;

  return (
    <div className="manufacturer-factory-profile">
      {!embedded && <header className="factory-profile-heading">
        <span>YOUR FACTORY</span>
        <h1>Factory profile</h1>
        <p>Show your work and manage your business credentials.</p>
      </header>}
      <nav className="factory-profile-views" aria-label="Factory profile views">
        {portfolioAllowed && <Link to="/manufacturer/settings/profile" aria-current={!credentials ? 'page' : undefined}>Portfolio</Link>}
        {credentialsAllowed && <Link to="/manufacturer/settings/profile?view=certifications" aria-current={credentials ? 'page' : undefined}>Certifications</Link>}
      </nav>
      <section aria-label={credentials ? 'Certifications and business verification' : 'Production portfolio'}>
        {credentials ? <ManufacturerVerificationView embedded /> : <FactoryPortfolioPanel embedded />}
      </section>
    </div>
  );
}
