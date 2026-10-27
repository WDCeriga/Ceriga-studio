export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];
/** Only for explicitly GBP-denominated legacy factory price books, never unknown orders. */
export const LEGACY_FACTORY_CURRENCY: Currency = 'GBP';
export const isCurrency = (value: unknown): value is Currency => SUPPORTED_CURRENCIES.includes(value as Currency);
export type RateSnapshot={rates:Record<Currency,string>;retrieved_at:string;rate_date:string;provider:string;valid_until:string};
export function currencySymbol(currency: Currency): string {
 if(!isCurrency(currency))return '?';
 return new Intl.NumberFormat('en-GB',{style:'currency',currency,currencyDisplay:'narrowSymbol'}).formatToParts(0).find(part=>part.type==='currency')!.value;
}
export function formatMoney(cents:number,currency:Currency,locale?:string):string{
 if(!Number.isSafeInteger(cents)||!isCurrency(currency))return 'Currency needs review';
 const formatter=new Intl.NumberFormat(locale||(typeof navigator!=='undefined'?navigator.language:'en-GB'),{style:'currency',currency,currencyDisplay:'symbol',minimumFractionDigits:2,maximumFractionDigits:2});
 const absolute=BigInt(cents<0?-cents:cents),whole=absolute/100n,fractional=(absolute%100n).toString().padStart(2,'0');
 const signed=cents<0?(whole===0n?-0:-whole):whole;
 const formatted=formatter.formatToParts(signed).map(p=>p.type==='fraction'?fractional:p.value).join('');return currency==='USD'?formatted+' USD':formatted;
}

function fraction(value:string):[bigint,bigint]{
 if(!/^\d+(\.\d{1,40})?$/.test(value))throw new Error('Invalid exchange rate');
 const [whole,part='']=value.split('.');const n=BigInt(whole+part);if(n<=0n)throw new Error('Invalid exchange rate');return[n,10n**BigInt(part.length)];
}
/** Exact integer arithmetic, half away from zero; all three currencies use 100 minor units. */
export function convertMinor(cents:number,source:Currency,target:Currency,snapshot:RateSnapshot|null,now=Date.now()):number{
 if(!Number.isSafeInteger(cents)||!isCurrency(source)||!isCurrency(target))throw new Error('Invalid money');if(source===target)return cents;
 if(!snapshot||!Number.isFinite(Date.parse(snapshot.retrieved_at))||!Number.isFinite(Date.parse(snapshot.rate_date))||!Number.isFinite(Date.parse(snapshot.valid_until))||Date.parse(snapshot.valid_until)<=now||Date.parse(snapshot.retrieved_at)>now+300000)throw new Error('A current exchange rate is required');
 const [sn,sd]=fraction(snapshot.rates[source]),[tn,td]=fraction(snapshot.rates[target]);
 let numerator=BigInt(cents)*tn*sd;const denominator=td*sn;const sign=numerator<0n?-1n:1n;numerator*=sign;
 const result=sign*((numerator*2n+denominator)/(2n*denominator));const value=Number(result);if(!Number.isSafeInteger(value))throw new Error('Converted amount exceeds supported limits');return value;
}
export function amountToCents(value:string):number|undefined{
 if(!value.trim())return undefined;if(!/^\d+(\.\d{1,2})?$/.test(value.trim()))return NaN;const[whole,part='']=value.trim().split('.');const result=Number(BigInt(whole)*100n+BigInt(part.padEnd(2,'0')));return Number.isSafeInteger(result)?result:NaN;
}

export function percentMinor(cents:number,basisPoints:number):number{if(!Number.isSafeInteger(cents)||!Number.isInteger(basisPoints))throw new Error('Invalid percentage amount');const n=BigInt(cents)*BigInt(basisPoints),sign=n<0n?-1n:1n;const result=Number(sign*((n*sign+5000n)/10000n));if(!Number.isSafeInteger(result))throw new Error('Amount exceeds supported limits');return result;}

export function applyStoredRate(cents:number,rate:string,sourceRate?:string,targetRate?:string):number{
if(!Number.isSafeInteger(cents))throw new Error('Invalid money');
if(sourceRate&&targetRate){const[sn,sd]=fraction(sourceRate),[tn,td]=fraction(targetRate),v=BigInt(cents)*tn*sd,d=td*sn,sign=v<0n?-1n:1n;const result=Number(sign*((v*sign*2n+d)/(2n*d)));if(!Number.isSafeInteger(result))throw new Error('Amount exceeds supported limits');return result;}if(!Number.isSafeInteger(cents))throw new Error('Invalid money');const[n,d]=fraction(rate);const value=BigInt(cents)*n,sign=value<0n?-1n:1n;const result=Number(sign*((value*sign*2n+d)/(2n*d)));if(!Number.isSafeInteger(result))throw new Error('Amount exceeds supported limits');return result;}
