import{useFactoryAccess}from '../contexts/FactoryAccessContext';
import { getCurrencyState,useCurrency, setAccountCurrency, refreshAccountCurrency } from '../lib/accountCurrency';
import { useEffect, useSyncExternalStore } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getProfileStorageKey, loadCompleteManufacturerProfile, saveCompleteManufacturerProfile } from './manufacturerOnboardingStore';
import type { PricingStructure } from './manufacturerOnboardingTypes';
import { normalizePricing, pricingValidationError } from './manufacturerPricingModel';

const changeEvent = 'ceriga-manufacturer-profile-changed';
type Snapshot = { pricing: PricingStructure; ready: boolean; saving: boolean; error: string };
const snapshots = new Map<string, Snapshot>();
const listeners = new Set<() => void>();
const loads = new Map<string, Promise<void>>();
function notify() { listeners.forEach(listener => listener()); }
function snapshot(): Snapshot {
  const key = getProfileStorageKey();
  if (!snapshots.has(key)) snapshots.set(key, { pricing: normalizePricing(loadCompleteManufacturerProfile().pricing), ready: !isSupabaseConfigured, saving: false, error: '' });
  return snapshots.get(key)!;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const refresh = () => { const key = getProfileStorageKey(), previous = snapshot(); snapshots.set(key, { ...previous, pricing: normalizePricing(loadCompleteManufacturerProfile().pricing) }); notify(); };
  window.addEventListener(changeEvent, refresh); window.addEventListener('storage', refresh);
  return () => { listeners.delete(listener); window.removeEventListener(changeEvent, refresh); window.removeEventListener('storage', refresh); };
}

export async function loadManufacturerPricingFromDb(client = isSupabaseConfigured ? getSupabase() : null): Promise<PricingStructure | null> {
  if (!client) return null;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in to load your account currency.');
  const { data, error } = await client.rpc('factory_workspace_profile');
  if (error) throw new Error(`Could not load account pricing: ${error.message}`);
  return data?.pricing ? normalizePricing(data.pricing) : null;
}

let writeQueue: Promise<unknown> = Promise.resolve();
export function saveManufacturerPricingToDb(pricing: PricingStructure, client = isSupabaseConfigured ? getSupabase() : null): Promise<void> {
  if (!client) return Promise.resolve();
  const error = pricingValidationError(pricing); if (error) return Promise.reject(new Error(error));
  const payload = normalizePricing(pricing), authentication = client.auth.getUser();
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const { data: { user }, error: authError } = await authentication;
    if (authError || !user) throw new Error('Sign in to save your account currency.');
    const { error } = await client.rpc('save_factory_pricing',{p_pricing:payload});
    if (error) throw new Error(`Pricing is saved on this device; database sync failed: ${error.message}`);
  });
  writeQueue = operation; return operation;
}

export async function hydrateManufacturerPricing(): Promise<void> {
  const key = getProfileStorageKey(); snapshot();
  if (!loads.has(key)) loads.set(key, (async () => {
    try {
      const remote = await loadManufacturerPricingFromDb();
      await refreshAccountCurrency();
      if (getProfileStorageKey() !== key) return;
      const local = loadCompleteManufacturerProfile();
      if (remote) saveCompleteManufacturerProfile({ ...local, pricing: remote }, undefined, { syncWorkspace: false });
      snapshots.set(key, { ...snapshot(), pricing: normalizePricing(loadCompleteManufacturerProfile().pricing), ready: true, error: '' });
    } catch (error) {
      snapshots.set(key, { ...snapshots.get(key)!, ready: true, error: error instanceof Error ? error.message : 'Could not load account currency.' });
      loads.delete(key);
    }
    notify();
  })());
  return loads.get(key);
}

export async function updateManufacturerPricing(pricing: PricingStructure): Promise<void> {
  const key = getProfileStorageKey(), next = normalizePricing({ ...pricing, updatedAt: new Date().toISOString() });
  const profile = loadCompleteManufacturerProfile();
  saveCompleteManufacturerProfile({ ...profile, pricing: next }, undefined, { syncWorkspace: false });
  snapshots.set(key, { pricing: next, ready: true, saving: true, error: '' }); notify();
  try { await saveManufacturerPricingToDb(next); if (getProfileStorageKey() === key) snapshots.set(key, { ...snapshot(), saving: false }); }
  catch (error) { if (getProfileStorageKey() === key) snapshots.set(key, { ...snapshot(), saving: false, error: error instanceof Error ? error.message : 'Pricing sync failed.' }); throw error; }
  finally { notify(); }
}

export function useManufacturerPricing() {
  const factoryAccess=useFactoryAccess();
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const accountCurrency=useCurrency();
  const account = getProfileStorageKey();
  useEffect(() => { if(isSupabaseConfigured&&!factoryAccess.ready)return;void hydrateManufacturerPricing(); return () => { loads.delete(account); }; }, [account,factoryAccess.ready]);
  return { ...state, pricing:{...state.pricing,preferredCurrency:accountCurrency.currency}, ready:state.ready && accountCurrency.ready,error:state.error||accountCurrency.error,saving:state.saving||accountCurrency.saving,currency:accountCurrency.currency, updatePricing:async(pricing:PricingStructure)=>{if(pricing.preferredCurrency!==getCurrencyState().currency)await setAccountCurrency(pricing.preferredCurrency);await updateManufacturerPricing(pricing);} };
}
