import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAllOrders,
  fetchAdminOrderPage,
  type AdminOrderPage,
  type AdminOrderQuery,
  fetchAllUsers,
  adminPatchOrder,
  adminPatchProfile,
  adminDeleteOrder,
  adminDeleteAccount,
  type ManufacturerAccount,
  fetchManufacturerAccounts,
  fetchManufacturerList,
  type ManufacturerListItem,
} from '../lib/superadminDb';
import {
  hydrateSuperAdminOrdersFromStorage,
  MOCK_SUPER_ORDERS,
  MOCK_SUPER_USERS,
  type SuperAdminOrder,
  type SuperAdminUser,
} from '../data/superadminMock';
import { useAuth } from '../contexts/AuthContext';
import { canAccessSuperadminLocalPreview } from '../lib/superadminAccess';
import { fetchIsSuperadmin } from '../lib/superadminDb';

const SUPERADMIN_RLS_HINT =
  'Your sign-in email must be in the Supabase table superadmin_emails (full address, case-insensitive). Run: insert into public.superadmin_emails (email) values (\'you@example.com\') on conflict do nothing;';

/**
 * Loads real orders + users from Supabase for the superadmin console.
 * Writes go to the DB, then re-fetch.
 */
export function useSuperadminData(options:{orderPage?:AdminOrderQuery;orderId?:string;scope?:'orders'|'users'|'manufacturers'|'assignment'}={}) {
  const queryKey=JSON.stringify({page:options.orderPage??null,orderId:options.orderId??null,scope:options.scope??null});
  const queryRef=useRef(queryKey);queryRef.current=queryKey;
  const requestGeneration=useRef(0);
  const { authReady, isAuthenticated, usingSupabase, user } = useAuth();
  const accountKey=`${user?.id||''}:${user?.email||''}`;
  const lastScope=useRef(accountKey);
  const currentAccount=useRef(accountKey);currentAccount.current=accountKey;
  const inFlight=useRef<string|null>(null);
  const [orders, setOrders] = useState<SuperAdminOrder[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerAccount[]>([]);
  const [manufacturerList, setManufacturerList] = useState<ManufacturerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [orderPage,setOrderPage]=useState<AdminOrderPage|null>(null);

  const refresh = useCallback(async ({background=false}:{background?:boolean}={}) => {
    if (!authReady||inFlight.current===accountKey+queryKey) return;
    const requestedAccount=accountKey,requestedQuery=queryKey,generation=++requestGeneration.current;
    const current=()=>currentAccount.current===requestedAccount&&queryRef.current===requestedQuery&&generation===requestGeneration.current;
    setUsersError(null);

    if (!isAuthenticated) {
      setOrders([]);
      setUsers([]);
      setManufacturers([]);
      setManufacturerList([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!usingSupabase) {
      if (canAccessSuperadminLocalPreview(user?.email)) {
        hydrateSuperAdminOrdersFromStorage();
        setOrders(MOCK_SUPER_ORDERS);
        setUsers(MOCK_SUPER_USERS);
      } else {
        setOrders([]);
        setUsers([]);
      }
      setManufacturers([]);
      setManufacturerList([]);
      setLoading(false);
      setError(null);
      return;
    }

    inFlight.current=accountKey+queryKey;
    if(!background)setLoading(true);
    try {
      const localPreviewEnabled =
        import.meta.env.DEV && import.meta.env.VITE_DEV_SUPERADMIN_PREVIEW === 'true';
      const isAllowlisted = canAccessSuperadminLocalPreview(user?.email);

      let isAdmin = false;
      if (usingSupabase) {
        try {
          isAdmin = await fetchIsSuperadmin();
        } catch {
          isAdmin = false;
        }
      }
      if (!isAdmin && localPreviewEnabled && isAllowlisted) {
        isAdmin = true;
      }

      if(!current())return;
      if (!isAdmin) {
        setOrders([]);
        setUsers([]);
        setManufacturers([]);
        setManufacturerList([]);
        setError(SUPERADMIN_RLS_HINT);
        setUsersError(SUPERADMIN_RLS_HINT);
        return;
      }

      const [ordersResult, usersResult, manufacturersResult, manufacturerListResult] =
        await Promise.allSettled([
          options.scope==='users'||options.scope==='manufacturers'?Promise.resolve({orders:[]} as AdminOrderPage):options.orderPage?fetchAdminOrderPage(options.orderPage):fetchAllOrders(options.orderId).then(orders=>({orders}) as AdminOrderPage),
          options.scope&&options.scope!=='users'?Promise.resolve([]):fetchAllUsers(),
          options.orderPage||options.scope&&options.scope!=='assignment'?Promise.resolve([]):fetchManufacturerAccounts(),
          options.orderPage||options.scope&&options.scope!=='manufacturers'?Promise.resolve([]):fetchManufacturerList(),
        ]);

      if(!current())return;
      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value.orders);
        setOrderPage(options.orderPage?ordersResult.value:null);
      } else {
        setOrders([]);
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        setUsers([]);
        setUsersError(usersResult.reason?.message || 'Could not load user accounts');
      }

      if (manufacturersResult.status === 'fulfilled' && manufacturersResult.value.length > 0) {
        setManufacturers(manufacturersResult.value);
      } else {
        setManufacturers([]);
      }

      if (manufacturerListResult.status === 'fulfilled' && manufacturerListResult.value.length > 0) {
        setManufacturerList(manufacturerListResult.value);
      } else {
        setManufacturerList([]);
      }

      const failed = (options.orderPage?[ordersResult]:[ordersResult, usersResult, manufacturersResult, manufacturerListResult]).find((result) => result.status === 'rejected');
      setError(failed?.status === 'rejected' ? (failed.reason?.message || 'Failed to refresh admin data') : null);
    } catch (err) {
      if(!current())return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setUsersError(err instanceof Error ? err.message : 'Could not load user accounts');
    } finally {
      if(inFlight.current===requestedAccount+requestedQuery)inFlight.current=null;
      if(current())setLoading(false);
    }
  }, [authReady, isAuthenticated, usingSupabase, accountKey, queryKey, options.scope]);

  useEffect(() => {
    if(!options.orderPage||lastScope.current!==accountKey){setOrders([]);setUsers([]);setManufacturers([]);setManufacturerList([]);setOrderPage(null);}
    lastScope.current=accountKey;
    void refresh();
    const update=()=>{if(document.visibilityState==='visible')void refresh({background:true});};
    const timer=window.setInterval(update,30000);
    window.addEventListener('focus',update);
    window.addEventListener('ceriga-orders-updated',update);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('ceriga-orders-updated',update);};
  }, [refresh]);

  const patchOrder = useCallback(
    async (
      id: string,
      patch: Parameters<typeof adminPatchOrder>[1],
    ): Promise<boolean> => {
      try {
        await adminPatchOrder(id, patch);
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        return false;
      }
    },
    [refresh],
  );

  const patchProfile = useCallback(
    async (
      id: string,
      patch: Parameters<typeof adminPatchProfile>[1],
    ): Promise<boolean> => {
      try {
        await adminPatchProfile(id, patch);
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
        return false;
      }
    },
    [refresh],
  );

  return {
    orders,
    orderPage,
    users,
    manufacturers,
    manufacturerList,
    loading,
    error,
    usersError,
    refresh,
    patchOrder,
    patchProfile,
    deleteOrder: async (id: string) => {
      await adminDeleteOrder(id);
      setOrders((previous) => previous.filter((order) => order.id !== id));
      await refresh();
    },
    deleteAccount: async (id: string) => {
      await adminDeleteAccount(id);
      setUsers((previous) => previous.filter((account) => account.id !== id));
      setManufacturerList((previous) => previous.filter((account) => account.userId !== id));
      await refresh();
    },
  };
}
