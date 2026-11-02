import type {ReactNode} from 'react';
import {Link} from 'react-router';
import {ArrowUpRight} from 'lucide-react';
import './manufacturer-onboarding-shell.css';
export function ManufacturerOnboardingShell({children}:{children:ReactNode}){
 return <div className="manufacturer-onboarding-shell"><header className="manufacturer-onboarding-topbar"><div><Link className="manufacturer-onboarding-brand" to="/" aria-label="Ceriga home">CERIGA<span>Manufacturer setup</span></Link><Link className="manufacturer-onboarding-exit" to="/">Back to Ceriga<ArrowUpRight size={13}/></Link></div></header><main className="manufacturer-onboarding-content">{children}</main></div>;
}
