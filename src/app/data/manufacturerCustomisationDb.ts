import type { SavedLeadTimes } from './manufacturerLeadTimes';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { CompleteManufacturerProfile } from './manufacturerOnboardingTypes';
import { getCapabilityCatalog, linkLegacyMethodConstraints } from './manufacturerMethodConstraints';
import { garmentMoqOverridesForProfile } from './manufacturerGarmentMoqs';

export type CustomisationSettings = SavedLeadTimes & Pick<CompleteManufacturerProfile, 'capabilitiesMap' | 'customCapabilities' | 'capabilityCatalog' | 'customMethodMoqs' | 'customisationUpdatedAt'>
  & Partial<Pick<CompleteManufacturerProfile, 'acceptingNewOrders' | 'maxSingleOrderQuantity' | 'generalMoq' | 'garmentMoqOverrides' | 'confirmedGarmentMoqOverrides' | 'currentAvailableMonthlyCapacity' | 'shippingDestinations' | 'garmentDetails'>> & {factoryProfile?:Partial<CompleteManufacturerProfile>};

export function toCustomisationSettings(profile: CustomisationSettings): CustomisationSettings {
  return {
    ...Object.fromEntries(['sampleLeadTimeMinDays','sampleLeadTimeMaxDays','bulkLeadTimeMinDays','bulkLeadTimeMaxDays'].filter(key => key in profile).map(key => [key, profile[key as keyof SavedLeadTimes]])),
    ...(profile.currentAvailableMonthlyCapacity !== undefined ? {currentAvailableMonthlyCapacity:profile.currentAvailableMonthlyCapacity} : {}),
    ...(profile.shippingDestinations !== undefined ? {shippingDestinations:profile.shippingDestinations} : {}),
    ...(profile.garmentDetails !== undefined ? {garmentDetails:profile.garmentDetails} : {}),
    ...(profile.acceptingNewOrders!==undefined?{acceptingNewOrders:profile.acceptingNewOrders}:{}),
    ...(profile.maxSingleOrderQuantity!==undefined?{maxSingleOrderQuantity:profile.maxSingleOrderQuantity}:{}),
    capabilitiesMap: profile.capabilitiesMap,
    customCapabilities: profile.customCapabilities,
    capabilityCatalog: getCapabilityCatalog(profile),
    customMethodMoqs: linkLegacyMethodConstraints(profile),
    customisationUpdatedAt: profile.customisationUpdatedAt ?? new Date().toISOString(),
    // Older cloud documents lack these fields; omit them rather than clearing
    // the local values when loading a pre-upgrade account.
    ...(profile.generalMoq !== undefined ? { generalMoq: profile.generalMoq } : {}),
    ...(profile.garmentMoqOverrides !== undefined ? { garmentMoqOverrides: garmentMoqOverridesForProfile(profile) } : {}),
    ...(profile.confirmedGarmentMoqOverrides !== undefined ? { confirmedGarmentMoqOverrides: [...profile.confirmedGarmentMoqOverrides] } : {}),
  };
}

function syncError(error: { message?: string } | null): Error {
  return new Error(`Could not sync customisation methods and MOQs. Your local draft is retained. ${error?.message ?? 'Unknown database error'}`);
}

export async function loadCustomisationSettingsFromDb(client = isSupabaseConfigured ? getSupabase() : null): Promise<CustomisationSettings | null> {
  if (!client) return null;
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw syncError(authError ?? { message: 'Sign in to sync manufacturer settings.' });
  const { data, error } = await client.rpc('factory_operational_settings');
  if (error) throw syncError(error);
  if (!data) return null;
  const settings = data;
  if (!settings || settings.version !== 1 || !settings.capabilitiesMap || !Array.isArray(settings.customCapabilities)
    || !Array.isArray(settings.capabilityCatalog) || !Array.isArray(settings.customMethodMoqs)) {
    throw syncError({ message: 'Saved method settings could not be read safely.' });
  }
  const {data:core,error:coreError}=await client.rpc('factory_workspace_profile');
  if(coreError)throw syncError(coreError);
  return {...toCustomisationSettings(settings),factoryProfile:core?.profile_details||{}};
}

// Serialize autosaves so a slower earlier write cannot replace a newer draft.
let pendingSave: Promise<unknown> = Promise.resolve();
export function saveCustomisationSettingsToDb(profile: CustomisationSettings, client = isSupabaseConfigured ? getSupabase() : null): Promise<void> {
  if (!client) return Promise.resolve();
  const settings = { version: 1, ...toCustomisationSettings(profile) };
  const authentication = client.auth.getUser();
  const operation = pendingSave.catch(() => undefined).then(async () => {
    const { data: { user }, error: authError } = await authentication;
    if (authError || !user) throw syncError(authError ?? { message: 'Sign in to sync manufacturer settings.' });
    if('factoryName'in profile&&typeof client.rpc==='function'){const {error:profileError}=await client.rpc('save_manufacturer_profile',{p_profile:profile,p_complete:false});if(profileError)throw syncError(profileError);}
    const { error } = await client.rpc('save_factory_operational_settings',{p_settings:settings});
    if (error) throw syncError(error);
  });
  pendingSave = operation;
  return operation;
}
