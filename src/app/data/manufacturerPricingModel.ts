import {amountToCents,formatMoney,isCurrency,type Currency}from'../lib/currency';
import type{GarmentPriceKey,GarmentPriceRange,PricingStructure}from'./manufacturerOnboardingTypes';
export const PRICE_GARMENTS:{key:GarmentPriceKey;label:string}[]=[{key:'hoodie',label:'Hoodie'},{key:'tshirt',label:'T-shirt'},{key:'sweatshirt',label:'Sweatshirt'},{key:'jogger',label:'Joggers'}];
export function parseLegacyPriceRange(text:string,_fallback:Currency):GarmentPriceRange|undefined{
 const hints=new Set((text.match(/GBP|USD|EUR|[£$€]/gi)??[]).map(h=>h==='£'?'GBP':h==='$'?'USD':h==='€'?'EUR':h.toUpperCase()));
 if(hints.size!==1||(!/USD/i.test(text)&&text.includes('$')))return undefined;
 const currency=[...hints][0];if(!isCurrency(currency))return undefined;
 const match=text.trim().match(/^(?:GBP|USD|EUR|[£$€])?\s*(\d+(?:\.\d{1,2})?)\s*[-–—]\s*(?:GBP|USD|EUR|[£$€])?\s*(\d+(?:\.\d{1,2})?)\s*(?:GBP|USD|EUR)?$/i);
 if(!match)return undefined;return{minCents:amountToCents(match[1]),maxCents:amountToCents(match[2]),currency};
}
export function normalizePricing(input?:PricingStructure):PricingStructure{
 const pricing:PricingStructure={preferredCurrency:'GBP',samplePricingApproach:'multiplier_2x',quantityTierDiscount:true,requiresCustomQuotation:true,...input};
 if(!isCurrency(pricing.preferredCurrency))pricing.preferredCurrency='GBP';
 const priceBooks=Object.fromEntries(Object.entries(pricing.priceBooks??{}).map(([currency,book])=>[currency,{...book}]))as NonNullable<PricingStructure['priceBooks']>;
 for(const{key}of PRICE_GARMENTS){const legacy=pricing.indicativePriceRanges?.[key],range=legacy&&parseLegacyPriceRange(legacy,pricing.preferredCurrency);if(range&&!Object.prototype.hasOwnProperty.call(priceBooks[range.currency]??{},key))priceBooks[range.currency]={...priceBooks[range.currency],[key]:range};}
 return{...pricing,priceBooks};
}
export function pricingValidationError(pricing:PricingStructure):string|undefined{
 for(const[currency,book]of Object.entries(pricing.priceBooks??{}))for(const range of Object.values(book??{})){
  if(!range)continue;if(!isCurrency(currency)||range.currency!==currency)return'A saved price range has an inconsistent currency. Review its original values before updating it.';
  if([range.minCents,range.maxCents].some(v=>v!==undefined&&(!Number.isSafeInteger(v)||v<0)))return'Price ranges must contain non-negative monetary amounts.';
  if(range.minCents!==undefined&&range.maxCents!==undefined&&range.minCents>range.maxCents)return'Minimum price cannot exceed maximum price.';
 }
 if(Object.values(pricing.flatSampleFeeByCurrency??{}).some(v=>v!==undefined&&(!Number.isSafeInteger(v)||v<0)))return'Sample fees must be non-negative monetary amounts.';
}
export function formatPriceRange(range:GarmentPriceRange):string{return`${range.minCents===undefined?'Not set':formatMoney(range.minCents,range.currency)} – ${range.maxCents===undefined?'Not set':formatMoney(range.maxCents,range.currency)}`;}
export function samplePriceRange(pricing:PricingStructure,key:GarmentPriceKey):GarmentPriceRange|undefined{
 const currency=pricing.preferredCurrency;if(pricing.samplePricingApproach==='custom_quote')return undefined;
 if(pricing.samplePricingApproach==='flat_fee'){const source=pricing.flatSampleFeeByCurrency?.[currency]!==undefined?currency:Object.keys(pricing.flatSampleFeeByCurrency??{}).find(isCurrency);const fee=source?pricing.flatSampleFeeByCurrency?.[source]:undefined;return fee===undefined||!source?undefined:{currency:source,minCents:fee,maxCents:fee};}
 const range=pricing.priceBooks?.[currency]?.[key]??Object.values(pricing.priceBooks??{}).map(book=>book?.[key]).find(Boolean);if(!range)return undefined;
 const multiplier=pricing.samplePricingApproach==='multiplier_3x'?3:2;return{currency:range.currency,minCents:range.minCents===undefined?undefined:range.minCents*multiplier,maxCents:range.maxCents===undefined?undefined:range.maxCents*multiplier};
}
