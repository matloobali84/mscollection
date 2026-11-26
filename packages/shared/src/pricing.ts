export type PriceDiscount={type:'none'|'percentage'|'fixed';value:number};
export type PricingTier='regular'|'reseller';
export type ResellerFallback='regular_discounted'|'regular_base';
type ProductPrice={price:number;regularDiscount?:PriceDiscount;regular_discount?:PriceDiscount;resellerPrice?:number|null;reseller_price?:number|null;resellerDiscount?:PriceDiscount;reseller_discount?:PriceDiscount;salePrice?:number;saleStart?:string;saleEnd?:string};
export function applyPriceDiscount(base:number,discount?:PriceDiscount){
 if(!Number.isSafeInteger(base)||base<0)throw Error('Invalid product price');
 if(!discount||discount.type==='none')return base;
 const reduction=discount.type==='percentage'?Number((BigInt(base)*BigInt(Math.round(discount.value*100))+5000n)/10000n):Math.round(discount.value);
 return Math.max(0,base-Math.min(base,reduction));
}
export function resolveProductPrice(product:ProductPrice,variant:{priceOverride?:number|null;price_override?:number|null}={},tier:PricingTier='regular',fallback:ResellerFallback='regular_discounted',now=Date.now()){
 const regularBase=variant.priceOverride??variant.price_override??product.price;
 const discounted=applyPriceDiscount(regularBase,product.regularDiscount??product.regular_discount);
 const sale=product.salePrice!==undefined&&product.saleStart&&product.saleEnd&&now>=Date.parse(product.saleStart)&&now<=Date.parse(product.saleEnd)?product.salePrice:undefined;
 const regularFinal=sale===undefined?discounted:Math.min(discounted,sale,regularBase);
 if(tier==='regular')return {basePrice:regularBase,unitPrice:regularFinal,pricingTier:tier};
 const explicit=product.resellerPrice??product.reseller_price;
 const base=explicit??(fallback==='regular_base'?regularBase:regularFinal);
 return {basePrice:base,unitPrice:applyPriceDiscount(base,product.resellerDiscount??product.reseller_discount),pricingTier:tier};
}
