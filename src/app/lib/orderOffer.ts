export const OFFER_VALIDITY_DAYS=30;
export const PAYMENTS_ENABLED=false;
export function offerExpiresAt(order:{quoteExpiresAt?:string;pricedAt?:string}):Date|null {
 const date=order.quoteExpiresAt?new Date(order.quoteExpiresAt):order.pricedAt?new Date(new Date(order.pricedAt).getTime()+OFFER_VALIDITY_DAYS*86400000):null;
 return date&&Number.isFinite(date.getTime())?date:null;
}
export function offerExpired(order:{quoteExpiresAt?:string;pricedAt?:string},now=Date.now()):boolean {
 const expiry=offerExpiresAt(order);return !expiry||now>=expiry.getTime();
}
