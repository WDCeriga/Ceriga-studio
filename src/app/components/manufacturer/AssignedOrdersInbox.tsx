import {ManufacturerOrdersView} from './ManufacturerOrdersView';
import{useFactoryAccess}from '../../contexts/FactoryAccessContext';
import { useEffect, useRef, useState } from 'react';
import { fetchAssignedOrders } from '../../data/manufacturerDb';
import type { UserOrder } from '../../data/userOrders';

export function useAssignedOrders(quotationOnly = false) {
  const{access,ready}=useFactoryAccess();
  const loadedFactory=useRef(access?.factoryId);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    if(ready===false){setOrders([]);setLoading(true);return;}
    setOrders([]);setLoading(true);setError('');
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const rows = await fetchAssignedOrders({quotations:quotationOnly});
        if (current) { loadedFactory.current=access?.factoryId;setOrders(rows); setError(''); }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Could not load assigned orders');
      } finally {
        inFlight = false;
        if (current) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 10000);
    const refresh=()=>{if(document.visibilityState==='visible')void load();};
    window.addEventListener('focus', refresh);window.addEventListener('ceriga-orders-updated',refresh);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener('focus', refresh);window.removeEventListener('ceriga-orders-updated',refresh); };
  }, [retry,quotationOnly,access?.factoryId,ready]);

  return {
    orders: loadedFactory.current === access?.factoryId ? orders : [],
    loading: loading || (!error && loadedFactory.current !== access?.factoryId),
    error,
    permissions: access?.permissions || [],
    onRefresh: () => { setLoading(true); setRetry(value => value + 1); },
  };
}

export function AssignedOrdersInbox({quotationOnly=false}:{quotationOnly?:boolean}={}) {
  const inbox = useAssignedOrders(quotationOnly);
  return <ManufacturerOrdersView quotationOnly={quotationOnly} {...inbox}/>;
}
