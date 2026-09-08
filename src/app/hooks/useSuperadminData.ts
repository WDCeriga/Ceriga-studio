import { useCallback, useEffect, useState } from 'react';
import {
  fetchAllOrders,
  fetchAllUsers,
  adminPatchOrder,
  type ManufacturerAccount,
  fetchManufacturerAccounts,
} from '../lib/superadminDb';
import type { SuperAdminOrder, SuperAdminUser } from '../data/superadminMock';
import { useAuth } from '../contexts/AuthContext';

/**
 * Loads real orders + users from Supabase into local state for the superadmin
 * console. Ops writes go straight to the DB via adminPatchOrder, then re-fetch.
 * Falls back to [] on error so the console still renders (with an error flag).
 */
export function useSuperadminData() {
  const { authReady, isAuthenticated, usingSupabase } = useAuth();
  const [orders, setOrders] = useState<SuperAdminOrder[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authReady) return;
    if (!usingSupabase || !isAuthenticated) {
      setOrders([]);
      setUsers([]);
      setManufacturers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [o, u, m] = await Promise.all([
        fetchAllOrders(),
        fetchAllUsers(),
        fetchManufacturerAccounts(),
      ]);
      setOrders(o);
      setUsers(u);
      setManufacturers(m);
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

  return { orders, users, manufacturers, loading, error, refresh, patchOrder };
}

/**
 * Fallback hook for pages not yet converted: keeps the mock arrays as the data
 * source but exposes the same shape. These pages remain labelled demo.
 */
export function useDemoSuperadminOrders(): SuperAdminOrder[] {
  return [];
}
