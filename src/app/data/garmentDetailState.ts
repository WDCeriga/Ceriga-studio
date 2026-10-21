import type {GarmentDetail} from './garmentDetails';
/** One identity belongs to one placed detail. Preserve its first saved view and intentional copies. */
export function normaliseGarmentDetails(details:GarmentDetail[]):GarmentDetail[]{
 const seen=new Set<string>();
 return details.filter(detail=>{if(seen.has(detail.id))return false;seen.add(detail.id);return true});
}
