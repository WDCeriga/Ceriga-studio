export type SavedLeadTimes = {
 sampleLeadTimeMinDays?: number;
 sampleLeadTimeMaxDays?: number;
 bulkLeadTimeMinDays?: number;
 bulkLeadTimeMaxDays?: number;
};
const valid=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>0&&value<=3650;
export function onboardingLeadDays(profile:SavedLeadTimes|null|undefined,kind:'sample'|'bulk'):string {
 const max=kind==='sample'?profile?.sampleLeadTimeMaxDays:profile?.bulkLeadTimeMaxDays;
 const min=kind==='sample'?profile?.sampleLeadTimeMinDays:profile?.bulkLeadTimeMinDays;
 return valid(max)?String(max):valid(min)?String(min):'';
}

export function onboardingLeadRange(profile:SavedLeadTimes|null|undefined,kind:'sample'|'bulk'):string {
 const min=kind==='sample'?profile?.sampleLeadTimeMinDays:profile?.bulkLeadTimeMinDays;
 const max=kind==='sample'?profile?.sampleLeadTimeMaxDays:profile?.bulkLeadTimeMaxDays;
 if(valid(min)&&valid(max)) return min===max?String(max):`${min}–${max}`;
 return onboardingLeadDays(profile,kind)||'Not set';
}
