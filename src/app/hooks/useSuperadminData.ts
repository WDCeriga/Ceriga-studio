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
import type { SuperAdminOrder, SuperAdminUser } from '../data/superadminMock';
import { useAuth } from '../contexts/AuthContext';

/**
 * Loads real orders + users from Supabase for the superadmin console.
 * Writes go to the DB, then re-fetch.
 */
export function useSuperadminData() {
  const { authReady, isAuthenticated, usingSupabase } = useAuth();
  const [orders, setOrders] = useState<SuperAdminOrder[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerAccount[]>([]);
  const [manufacturerList, setManufacturerList] = useState<ManufacturerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authReady) return;
    if (!usingSupabase || !isAuthenticated) {
      setOrders([]);
      setUsers([]);
      setManufacturers([]);
      setManufacturerList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [o, u, m, ml] = await Promise.all([
        fetchAllOrders(),
        fetchAllUsers(),
        fetchManufacturerAccounts(),
        fetchManufacturerList(),
      ]);
      setOrders(o);
      setUsers(u);
      setManufacturers(m);
      setManufacturerList(ml);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [authReady, isAuthenticated, usingSupabase]);

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
