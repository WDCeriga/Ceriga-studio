import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAllOrders,
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
export function useSuperadminData() {
  const { authReady, isAuthenticated, usingSupabase, user } = useAuth();
  const accountKey=`${user?.id||''}:${user?.email||''}`;
  const currentAccount=useRef(accountKey);currentAccount.current=accountKey;
  const inFlight=useRef<string|null>(null);
  const [orders, setOrders] = useState<SuperAdminOrder[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerAccount[]>([]);
  const [manufacturerList, setManufacturerList] = useState<ManufacturerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  const refresh = useCallback(async ({background=false}:{background?:boolean}={}) => {
    if (!authReady||inFlight.current===accountKey) return;
    const requestedAccount=accountKey;
    const current=()=>currentAccount.current===requestedAccount;
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

    inFlight.current=accountKey;
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
          fetchAllOrders(),
          fetchAllUsers(),
          fetchManufacturerAccounts(),
          fetchManufacturerList(),
        ]);

      if(!current())return;
      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value);
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

      const failed = [ordersResult, usersResult, manufacturersResult, manufacturerListResult].find((result) => result.status === 'rejected');
      setError(failed?.status === 'rejected' ? (failed.reason?.message || 'Failed to refresh admin data') : null);
    } catch (err) {
      if(!current())return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setUsersError(err instanceof Error ? err.message : 'Could not load user accounts');
    } finally {
      if(inFlight.current===requestedAccount)inFlight.current=null;
      if(current())setLoading(false);
    }
  }, [authReady, isAuthenticated, usingSupabase, accountKey]);

  useEffect(() => {
    setOrders([]);setUsers([]);setManufacturers([]);setManufacturerList([]);
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
