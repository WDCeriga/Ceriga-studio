import { useCallback, useEffect, useState } from 'react';
import {
  fetchAllOrders,
  fetchAllUsers,
  adminPatchOrder,
  adminPatchProfile,
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
  const [orders, setOrders] = useState<SuperAdminOrder[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerAccount[]>([]);
  const [manufacturerList, setManufacturerList] = useState<ManufacturerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authReady) return;

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

    setLoading(true);
    try {
      const isAdmin = await fetchIsSuperadmin();
      if (!isAdmin) {
        setOrders([]);
        setUsers([]);
        setManufacturers([]);
        setManufacturerList([]);
        setError(SUPERADMIN_RLS_HINT);
        return;
      }

      const [ordersResult, usersResult, manufacturersResult, manufacturerListResult] =
        await Promise.allSettled([
          fetchAllOrders(),
          fetchAllUsers(),
          fetchManufacturerAccounts(),
          fetchManufacturerList(),
        ]);

      const errors: string[] = [];

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value);
      } else {
        setOrders([]);
        errors.push(
          ordersResult.reason instanceof Error
            ? ordersResult.reason.message
            : 'Failed to load orders',
        );
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        setUsers([]);
        errors.push(
          usersResult.reason instanceof Error
            ? usersResult.reason.message
            : 'Failed to load users',
        );
      }

      if (manufacturersResult.status === 'fulfilled') {
        setManufacturers(manufacturersResult.value);
      } else {
        setManufacturers([]);
        errors.push(
          manufacturersResult.reason instanceof Error
            ? manufacturersResult.reason.message
            : 'Failed to load manufacturers',
        );
      }

      if (manufacturerListResult.status === 'fulfilled') {
        setManufacturerList(manufacturerListResult.value);
      } else {
        setManufacturerList([]);
        errors.push(
          manufacturerListResult.reason instanceof Error
            ? manufacturerListResult.reason.message
            : 'Failed to load manufacturer list',
        );
      }

      setError(errors.length > 0 ? errors.join(' · ') : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [authReady, isAuthenticated, usingSupabase, user?.email]);

  useEffect(() => {
    void refresh();
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
    refresh,
    patchOrder,
    patchProfile,
  };
}
