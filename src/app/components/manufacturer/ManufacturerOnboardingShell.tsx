import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import type {ReactNode} from 'react';
import {Link} from 'react-router';
import {ArrowUpRight} from 'lucide-react';
import './manufacturer-onboarding-shell.css';
export function ManufacturerOnboardingShell({children}:{children:ReactNode}){
  useCerigaTranslation();

 return <div className="manufacturer-onboarding-shell"><header className="manufacturer-onboarding-topbar"><div><Link className="manufacturer-onboarding-brand" to="/" aria-label={cerigaTranslate("interface.text_c6072e83dc0325b7")}>{cerigaTranslate("interface.text_1a14c3ff9f7c2a42")}<span>{cerigaTranslate("interface.text_9afc7611352d1cb1")}</span></Link><Link className="manufacturer-onboarding-exit" to="/">{cerigaTranslate("interface.text_c9a63922edb9d5c4")}<ArrowUpRight size={13}/></Link></div></header><main className="manufacturer-onboarding-content">{children}</main></div>;
}
