'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,Copy,ExternalLink,LockKeyhole,MapPin,Package,Printer,RefreshCw,ShieldCheck,Truck} from 'lucide-react';
import {money} from '@ms/shared';
import Brand from '@ms/shared/src/Brand';
import BillSummary from '@ms/shared/src/BillSummary';
import {orderStatusLabel,trackingUrl} from '@ms/shared/src/orders';
import type {StoreSettings} from '../lib/catalogue';
import PageHeader from './PageHeader';
import StoreFooter from './StoreFooter';

export default function Order({id,settings}:{id:string;settings:StoreSettings}){
 const [order,setOrder]=useState<any>(null),[error,setError]=useState(''),[paying,setPaying]=useState(false),[refreshing,setRefreshing]=useState(false),[copied,setCopied]=useState(''),[paymentError,setPaymentError]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const ticket=++sequence.current;
  const token=window.location.hash.slice(1)||sessionStorage.getItem('ms-order-'+id)||'';
  if(token)sessionStorage.setItem('ms-order-'+id,token);
  try{const response=await fetch('/api/v1/orders/'+id,{cache:'no-store',headers:token?{authorization:'Bearer '+token}:{},signal}),data=await response.json();
  if(ticket!==sequence.current)return null;if(!response.ok)throw Error(data.error);return data;}catch(error){if(ticket!==sequence.current)return null;throw error}
 },[id]);
 useEffect(()=>{
  const controller=new AbortController();let loading=false;
  const refresh=async()=>{if(loading||controller.signal.aborted)return;loading=true;try{const data=await load(controller.signal);if(data){setOrder(data);setError('')}}catch(error){if((error as Error).name!=='AbortError'){setOrder(null);setError((error as Error).message)}}finally{loading=false}};
  const visible=()=>{if(document.visibilityState==='visible')void refresh()};
  void refresh();const timer=setInterval(visible,5000);document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
  return()=>{controller.abort();sequence.current++;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible)};
 },[load]);
 async function refresh(){setRefreshing(true);try{const data=await load();if(data){setOrder(data);setError('')}}catch(e){setOrder(null);setError((e as Error).message)}finally{setRefreshing(false)}}
 async function copy(){try{await navigator.clipboard.writeText(order.tracking_id);setCopied('Tracking ID copied.')}catch{setCopied('Select the Tracking ID above to copy it.')}setTimeout(()=>setCopied(''),4000)}
 async function pay(){
  setPaying(true);setPaymentError('');
  try{const token=window.location.hash.slice(1)||sessionStorage.getItem('ms-order-'+id)||'',response=await fetch('/api/v1/orders/'+id+'/payment',{method:'POST',headers:{'x-requested-with':'MSCollection',authorization:'Bearer '+token}}),data=await response.json();if(!response.ok)throw Error(data.error);window.location.href=data.checkoutUrl}
  catch(e){setPaymentError((e as Error).message);setPaying(false)}
 }
 const stage=order?({pending:0,paid:0,confirmed:1,on_hold:order.review_status==='approved'?1:0,packed:1,shipped:2,in_transit:3,delivered:4} as Record<string,number>)[order.status]??-1:-1;
 const url=order?.courier&&order?.tracking_id?trackingUrl(order.courier):null;
 return <><main className='server-page order-page'><PageHeader active='account' logo={settings.logo}/><div className='bill-print-brand'><Brand logo={settings.logo}/><span>MS Collection / Approved order bill</span></div><div className='order-heading'><span className='eyebrow'>YOUR ORDER</span><h1>{order?'Your order details.':'Order information'}</h1><p>{order?'Order '+order.number+' / '+new Date(order.created_at).toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'}):'Your items, delivery address and order status in one place.'}</p></div>
  {error&&<div className='account-error' role='alert'>{error}. <a href='/account'>Customer sign in</a> or <a href='/reseller'>reseller sign in</a>. Reseller orders require your active reseller login; other orders also accept the private link from checkout.</div>}
  {!order&&!error?<div className='empty-state'><Package size={36}/><h3>Loading your order</h3></div>:order&&<>
   {!['cancelled','refunded'].includes(order.status)&&<section className={'customer-review-note '+(order.review_status==='approved'?'approved':'')}><h2>{order.review_status==='approved'?'Your final bill is approved':'Your order is awaiting admin review'}</h2><p>{order.review_status==='approved'?'Your latest products, discounts, charges and final payable amount are shown below. Saved updates from our team appear automatically.':'The amount below is your latest saved quote. Updates from our team appear automatically. The final bill is confirmed before payment or dispatch.'}</p></section>}
   <div className='customer-order-state'><span className={'order-state '+order.status}>{orderStatusLabel(order.status)}</span><button className='text-link' disabled={refreshing} onClick={refresh}><RefreshCw size={16}/>{refreshing?'Refreshing...':'Refresh status'}</button></div>
   {stage>=0&&<div className='order-progress' aria-label='Order progress'>{['Order received','Confirmed / preparing','Dispatched','In transit','Delivered'].map((label,index)=><span className={index<=stage?'complete':''} key={label} aria-current={index===stage?'step':undefined}><b>{index<stage?<Check size={14}/>:index+1}</b>{label}</span>)}</div>}
   <section className='customer-tracking-card' aria-labelledby='delivery-tracking-heading'><div className='tracking-card-heading'><Truck size={25}/><div><span className='eyebrow'>DELIVERY UPDATES</span><h2 id='delivery-tracking-heading'>Track your order</h2></div></div>
    {order.status==='on_hold'&&<p>Your order is on hold while our team reviews or prepares it. Contact support if you need help.</p>}
    {['cancelled','refunded'].includes(order.status)?<p>This order is {orderStatusLabel(order.status).toLowerCase()}. Contact support for any questions.</p>:<>
     {order.courier&&<div className='tracking-field'><span>Courier company</span><strong>{order.courier}</strong></div>}
     {order.tracking_id?<><div className='tracking-field'><span>Tracking ID</span><div><code>{order.tracking_id}</code><button className='icon-button' aria-label='Copy Tracking ID' onClick={copy}><Copy size={18}/></button></div></div>{copied&&<p className='tracking-copy-feedback' role='status'>{copied}</p>}{url?<><a className='primary' href={url} target='_blank' rel='noopener noreferrer'>Open courier tracking<ExternalLink size={16}/></a><p className='tracking-instructions'>Copy your Tracking ID, then enter it on {order.courier}&apos;s tracking page for the courier&apos;s latest updates.</p></>:<p>Use this Tracking ID with {order.courier||'your courier'}. <a className='text-link' href='/help/contact'>Contact support</a> for help tracking your parcel.</p>}</>:<p>{order.status==='delivered'?'Your order has been marked as delivered.':order.status==='in_transit'?'Your order is in transit. A Tracking ID has not been provided.':order.status==='shipped'?'Your order has been dispatched. A Tracking ID has not been provided.':'Your order has been received. Courier tracking details will appear here if provided at dispatch.'} <a className='text-link' href='/help/contact'>Need help?</a></p>}
     {order.dispatched_at&&<p className='tracking-date'>Dispatched: <time dateTime={order.dispatched_at}>{new Date(order.dispatched_at).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'})}</time></p>}
     {order.delivered_at&&<p className='tracking-date'>Delivered: <time dateTime={order.delivered_at}>{new Date(order.delivered_at).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'})}</time></p>}
    </>}
   </section>
   <div className='order-content'><section className='order-card'><h2>Your items</h2>{order.items.map((item:any,index:number)=><div className='order-item' key={item.id||index}><Package size={24}/><span><strong>{item.name_snapshot}</strong><small>{item.variant_snapshot} / Quantity {item.quantity} / {money(item.price_snapshot,order.currency)} each</small>{item.description_snapshot&&<small>{item.description_snapshot}</small>}</span><b>{money(item.price_snapshot*item.quantity,order.currency)}</b></div>)}<p className='order-help'>Need to discuss this order? <a href='/help/contact'>Contact support</a> with your order reference.</p>
     {!!order.events?.length&&<section className='customer-order-history'><h3>Order timeline</h3><ol>{order.events.map((event:any)=><li key={event.id}><strong>{event.message}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'})}</time></li>)}</ol></section>}
    </section>
    <aside><section className='order-card'><h2><MapPin size={19}/> Delivery details</h2><p className='order-address'><strong>{order.shipping_address.name}</strong><br/>{order.shipping_address.address}<br/>{order.shipping_address.city}, {order.shipping_address.postal}<br/>{order.shipping_address.country}<br/>{order.shipping_address.phone}</p></section>
     <section className='order-card customer-bill-card'><h2>{order.review_status==='approved'?'Final approved bill':'Order quote / pending review'}</h2><p className='secure-note'><LockKeyhole size={16}/>{order.payment_method==='cod'?'Cash on delivery':'Online payment'} / {String(order.payment_status).replaceAll('_',' ')}</p><BillSummary bill={{...order.bill,originalTotal:order.original_total??order.total}} currency={order.currency} mode={order.review_status==='approved'?'approved':'quote'}/>
      {order.approved_at&&<p className='bill-approved-time'>Approved: <time dateTime={order.approved_at}>{new Date(order.approved_at).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'})}</time></p>}
      {order.review_status==='approved'&&<button className='secondary print-bill' onClick={()=>window.print()}><Printer size={17}/>Print approved bill</button>}
      {paymentError&&<p className='bill-payment-error' role='alert'>{paymentError}</p>}
      {order.review_status==='approved'&&order.payment_method==='online'&&order.payment_status==='unpaid'&&order.total>0&&!['cancelled','refunded','delivered'].includes(order.status)&&<button className='primary full' disabled={paying} onClick={pay}>{paying?'Opening payment...':'Pay approved bill securely'}</button>}
     </section></aside></div><p className='account-security'><ShieldCheck size={18}/>This order page is private. Keep your access link safe.</p>
  </>}<a className='primary' href='/#products' style={{marginTop:25}}>Continue shopping</a>
 </main><StoreFooter settings={settings}/></>;
}
