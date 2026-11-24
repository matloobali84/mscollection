import {cache} from 'react';
import type {Product} from '@ms/shared';
export type Collection={id:string;name:string;slug:string;tagline:string;category:string;active:boolean;color:string;logo?:string};
export type Variant={id:string;sku:string;size:string;color:string;stock:number;priceOverride:number|null};
export type LiveProduct=Product&{variants:Variant[];currency:string;gender:string;ageGroup:string;displayPoint?:string;salePinned?:boolean};
export type StoreSettings={storeMode?:'demo'|'live';supportEmail?:string;supportWhatsApp?:string;businessAddress?:string;deliveryPolicy?:string;returnsPolicy?:string;privacyPolicy?:string;termsPolicy?:string;name:string;logo:string;primaryColor:string;currency:string;country:string;shippingFee:number;freeShippingThreshold:number;taxPercent:number;guestCheckout:boolean};
export type Catalogue={shops:Collection[];products:LiveProduct[];settings:StoreSettings;revision:number};
export const getCatalogue=cache(async function getCatalogue():Promise<Catalogue>{
 const result=await fetch(`${process.env.API_INTERNAL_URL||'http://127.0.0.1:4000'}/api/v1/catalogue`,{cache:'no-store'});
 if(!result.ok)throw new Error('The catalogue service is unavailable');
 return result.json();
});
export const getStoreSettings=cache(async function getStoreSettings():Promise<StoreSettings>{
 const result=await fetch(`${process.env.API_INTERNAL_URL||'http://127.0.0.1:4000'}/api/v1/store`,{cache:'no-store'});
 if(!result.ok)throw new Error('The store service is unavailable');
 return result.json();
});
