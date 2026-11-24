'use client';
import {useEffect,useState} from 'react';
import {Check,LockKeyhole,MapPin,Package,ShieldCheck,Truck} from 'lucide-react';
import {money} from '@ms/shared';
import type {StoreSettings} from '../lib/catalogue';
import PageHeader from './PageHeader';
import StoreFooter from './StoreFooter';

export default function Order({id,settings}:{id:string;settings:StoreSettings}){
 const [order,setOrder]=useState<any>(null),[error,setError]=useState(''),[paying,setPaying]=useState(false);
 useEffect(()=>{
  const token=window.location.hash.slice(1)||sessionStorage.getItem('ms-order-'+id)||'';
  fetch('/api/v1/orders/'+id,{headers:token?{authorization:'Bearer '+token}:{}}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);setOrder(data)}).catch(e=>setError(e.message));
 },[id]);
 async function pay(){
  setPaying(true);setError('');
  try{const token=window.location.hash.slice(1)||sessionStorage.getItem('ms-order-'+id)||'',response=await fetch('/api/v1/orders/'+id+'/payment',{method:'POST',headers:{'x-requested-with':'MSCollection',authorization:'Bearer '+token}}),data=await response.json();if(!response.ok)throw Error(data.error);window.location.href=data.checkoutUrl}
  catch(e){setError((e as Error).message);setPaying(false)}
 }
 const stage=order?({pending:0,paid:1,packed:1,shipped:2,delivered:3} as Record<string,number>)[order.status]??-1:-1;
 return <><main className='server-page order-page'><PageHeader active='account'/><div className='order-heading'><span className='eyebrow'>YOUR ORDER</span><h1>{order?'Your order details.':'Order information'}</h1><p>{order?'Order '+order.number+' / '+new Date(order.created_at).toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'}):'Your items, delivery address and order status in one place.'}</p></div>
  {error&&<div className='account-error' role='alert'>{error}. Sign in to your account, or use the private order link from checkout.</div>}
  {!order&&!error?<div className='empty-state'><Package size={36}/><h3>Loading your order</h3></div>:order&&<>
   {stage>=0?<div className='order-progress' aria-label='Order progress'>{['Order received','Preparing','Shipped','Delivered'].map((label,index)=><span className={index<=stage?'complete':''} key={label} aria-current={index===stage?'step':undefined}><b>{index<stage?<Check size={14}/>:index+1}</b>{label}</span>)}</div>:<p className={'order-state '+order.status}>{order.status}</p>}
   <div className='order-content'><section className='order-card'><h2>Your items</h2>{order.items.map((item:any,index:number)=><div className='order-item' key={item.id||index}><Package size={24}/><span><strong>{item.name_snapshot}</strong><small>{item.variant_snapshot} / Quantity {item.quantity}</small></span><b>{money(item.price_snapshot*item.quantity,order.currency)}</b></div>)}<p className='order-help'>Need to discuss this order? <a href='/help/contact'>Contact support</a> with your order reference.</p></section>
    <aside><section className='order-card'><h2><MapPin size={19}/> Delivery details</h2><p className='order-address'><strong>{order.shipping_address.name}</strong><br/>{order.shipping_address.address}<br/>{order.shipping_address.city}, {order.shipping_address.postal}<br/>{order.shipping_address.country}<br/>{order.shipping_address.phone}</p></section>
     <section className='order-card'><h2>Order summary</h2><p className='secure-note'><LockKeyhole size={16}/>{order.payment_method==='cod'?'Cash on delivery':'Online payment'} / {String(order.payment_status).replaceAll('_',' ')}</p><div className='cart-totals'><p><span>Subtotal</span><b>{money(order.subtotal,order.currency)}</b></p><p><span>Delivery</span><span>{order.shipping?money(order.shipping,order.currency):'Free'}</span></p>{order.tax>0&&<p><span>Tax</span><span>{money(order.tax,order.currency)}</span></p>}<p className='total'><span>Total</span><strong>{money(order.total,order.currency)}</strong></p></div>
      {order.payment_method==='online'&&order.status==='pending'&&order.payment_status==='unpaid'&&<button className='primary full' disabled={paying} onClick={pay}>{paying?'Opening payment...':'Continue secure payment'}</button>}
     </section></aside></div><p className='account-security'><ShieldCheck size={18}/>This order page is private. Keep your access link safe.</p>
  </>}<a className='primary' href='/#products' style={{marginTop:25}}>Continue shopping</a>
 </main><StoreFooter settings={settings}/></>;
}
