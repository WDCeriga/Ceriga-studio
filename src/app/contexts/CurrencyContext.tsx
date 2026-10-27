import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { refreshAccountCurrency,resetCurrencyAccount } from '../lib/accountCurrency';
export function CurrencyProvider({children}:{children:ReactNode}){
 const {user,authReady}=useAuth();
 useEffect(()=>{resetCurrencyAccount(user?.id||null);if(!authReady||!user?.id)return;void refreshAccountCurrency();const retry=setTimeout(()=>void refreshAccountCurrency(),5000);const refresh=()=>{if(document.visibilityState==='visible')void refreshAccountCurrency();};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);clearTimeout(retry);window.removeEventListener('focus',refresh);};},[user?.id,authReady]);
 return <>{children}</>;
}
