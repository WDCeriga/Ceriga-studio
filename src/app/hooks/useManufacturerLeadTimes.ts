import{getActiveFactoryCacheId}from '../lib/factoryWorkspaceIdentity';
import { useEffect, useState } from 'react';
import { getProfileStorageKey } from '../data/manufacturerOnboardingStore';
import { loadCustomisationSettingsFromDb } from '../data/manufacturerCustomisationDb';
import type { SavedLeadTimes } from '../data/manufacturerLeadTimes';
export function readSavedOnboardingLeadTimes(): SavedLeadTimes | null {
 try { const user=JSON.parse(localStorage.getItem('user')||'null');const raw=localStorage.getItem(getProfileStorageKey())||(user?.email&&(!getActiveFactoryCacheId()||getActiveFactoryCacheId()===user.id)?localStorage.getItem(getProfileStorageKey(user.email)):null);return raw?JSON.parse(raw):null; } catch { return null; }
}
export function useManufacturerLeadTimes() {
 const [profile,setProfile]=useState<SavedLeadTimes|null>(readSavedOnboardingLeadTimes);
 const [error,setError]=useState('');
 useEffect(()=>{
  let current=true,version=0;
  const load=async()=>{const request=++version;const local=readSavedOnboardingLeadTimes();try{const remote=await loadCustomisationSettingsFromDb();if(current&&request===version){setProfile({...local,...remote});setError('');}}catch(cause){if(current&&request===version){setProfile(local);setError(cause instanceof Error?cause.message:'Could not load saved lead times');}}};
  void load();window.addEventListener('ceriga-manufacturer-profile-changed',load);
  return()=>{current=false;window.removeEventListener('ceriga-manufacturer-profile-changed',load);};
 },[]);
 return {profile,error};
}
