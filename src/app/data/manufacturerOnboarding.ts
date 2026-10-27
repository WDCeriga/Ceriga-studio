import {getSupabase,isSupabaseConfigured}from '../lib/supabaseClient';
import {completeFactoryOnboarding}from './manufacturerPortalMock';
import {fetchMyManufacturerProfile,type ManufacturerProfile}from './manufacturerDb';
import type {CompleteManufacturerProfile}from './manufacturerOnboardingTypes';
export async function completeOnboardingInDb(profile:CompleteManufacturerProfile):Promise<ManufacturerProfile|null>{
 if(isSupabaseConfigured){const{data,error}=await getSupabase().rpc('save_manufacturer_profile',{p_profile:profile,p_complete:true});if(error||!data)throw new Error(error?.message||'Onboarding completion was not confirmed');}
 completeFactoryOnboarding({factoryName:profile.factoryName,garments:profile.garments as never[],capabilities:Object.keys(profile.capabilitiesMap)as never[],shippingRegions:profile.shippingDestinations,moq:profile.generalMoq,monthlyCapacity:profile.monthlyCapacity});
 return isSupabaseConfigured?fetchMyManufacturerProfile():null;
}
