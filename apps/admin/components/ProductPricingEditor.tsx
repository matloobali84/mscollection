'use client';
import {money} from '@ms/shared';
import {resolveProductPrice} from '@ms/shared/src/pricing';
type Data=Record<string,any>;
export default function ProductPricingEditor({product,onChange,owner,fallback}:{product:Data;onChange:(value:Data)=>void;owner:boolean;fallback:'regular_discounted'|'regular_base'}){
 const discount=(key:'regularDiscount'|'resellerDiscount',label:string,disabled=false)=>{
  const value=product[key]||{type:'none',value:0};
  return <div className='pricing-discount'><label>{label} method<select aria-label={label+' method'} disabled={disabled} value={value.type} onChange={e=>onChange({...product,[key]:{type:e.target.value,value:0}})}><option value='none'>No discount</option><option value='percentage'>Percentage</option><option value='fixed'>Fixed amount</option></select></label>{value.type!=='none'&&<label>{label} {value.type==='percentage'?'(%)':'('+product.currency+')'}<input aria-label={label+' value'} type='number' required min={0} max={value.type==='percentage'?100:2147483647} step={value.type==='percentage'?'.01':1} disabled={disabled} value={value.value} onChange={e=>onChange({...product,[key]:{...value,value:e.target.value===''?'':Number(e.target.value)}})}/></label>}</div>;
 };
 let regular:number|undefined,reseller:number|undefined;
 try{regular=resolveProductPrice({...product,price:product.price}).unitPrice;reseller=resolveProductPrice({...product,price:product.price},{},'reseller',fallback).unitPrice}catch{}
 return <section className='full-field product-pricing'><h3>Customer & reseller pricing</h3><p className='subtle'>Regular price is entered above. Discounts use whole currency amounts or percentages with up to two decimals.</p>
  <div className='pricing-columns'><div><h4>Regular customers</h4>{discount('regularDiscount','Regular discount')}{regular!==undefined&&<p className='pricing-preview'>Regular price after discount <strong>{money(regular,product.currency)}</strong></p>}</div>
  <div><h4>Resellers only</h4><label>Reseller price (optional)<input aria-label='Reseller price' type='number' min={0} max={100000000} step={1} disabled={!owner} placeholder='Use default pricing' value={product.resellerPrice??''} onChange={e=>onChange({...product,resellerPrice:e.target.value===''?null:Number(e.target.value)})}/></label>{discount('resellerDiscount','Reseller discount',!owner)}{reseller!==undefined&&<p className='pricing-preview'>Reseller price after discount <strong>{money(reseller,product.currency)}</strong></p>}</div></div>
  <p className='subtle'>A blank reseller price uses {fallback==='regular_base'?'the regular price before discounts':'the regular discounted price'}, then applies the reseller discount. An explicit reseller price uses only the reseller discount. Scheduled sales can lower regular prices; discounts do not stack with sales. Variant overrides change the regular base; a reseller price applies to all variants. Fixed discounts stop at zero.</p>{!owner&&<p className='subtle'>Only the store owner can change reseller prices.</p>}
 </section>;
}
