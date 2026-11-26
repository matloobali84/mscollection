import Stripe from 'stripe';
import {randomUUID} from 'node:crypto';
import type {Database,Row} from './db';import {problem} from './auth';
type PaymentOrder={id:string;number:string;total:number;currency:string;email:string;createdAt:string;billRevision:number};
export interface PaymentProvider{start(order:PaymentOrder):Promise<{reference:string;url:string}>;retrieve(reference:string):Promise<Stripe.Checkout.Session>}
export const onlinePaymentsEnabled=()=>!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET&&!!process.env.WEB_ORIGIN;
export function paymentProvider(client?:Stripe):PaymentProvider{
 if(!onlinePaymentsEnabled())problem(503,'Online payments are not configured');
 const stripe=client||new Stripe(process.env.STRIPE_SECRET_KEY!);
 return {
  async start(order){
   const digits=new Intl.NumberFormat('en',{style:'currency',currency:order.currency}).resolvedOptions().maximumFractionDigits??2;
   const result=await stripe.checkout.sessions.create({mode:'payment',customer_email:order.email,client_reference_id:order.id,metadata:{orderId:order.id,billRevision:String(order.billRevision)},success_url:process.env.WEB_ORIGIN+'/orders/'+order.id+'?payment=return',cancel_url:process.env.WEB_ORIGIN+'/orders/'+order.id+'?payment=cancelled',expires_at:Math.floor(new Date(order.createdAt).getTime()/1000)+3600,line_items:[{quantity:1,price_data:{currency:order.currency.toLowerCase(),unit_amount:order.total*10**digits,product_data:{name:'MS Collection order '+order.number+' / approved bill '+order.billRevision}}}]},{idempotencyKey:'order-'+order.id+'-bill-'+order.billRevision});
   if(!result.url)problem(502,'Payment provider did not return a checkout URL');return {reference:result.id,url:result.url!};
  },
  retrieve:reference=>stripe.checkout.sessions.retrieve(reference)
 };
}
export async function startOrderPayment(db:Database,id:string,credentials:{tokenHash?:string;customerId?:string},providerOverride?:PaymentProvider){
 if(!onlinePaymentsEnabled())problem(503,'Online payments are not configured');
 const prepared=await db.transaction(async tx=>{
  const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!order||credentials.tokenHash!==order.access_token_hash&&credentials.customerId!==order.customer_id)problem(404,'Order not found');
  if(order.pricing_tier==='reseller'){
   const owner=(await tx.query("SELECT id FROM customers WHERE id=$1 AND active=true AND account_type='reseller'",[credentials.customerId||''])).rows[0];
   if(!owner||owner.id!==order.reseller_id)problem(404,'Order not found');
  }
  if(order.review_status!=='approved')problem(409,'Your order is awaiting admin review. Payment opens after the final bill is confirmed.');
  if(order.payment_method!=='online'||order.payment_status==='paid'||['cancelled','refunded','delivered'].includes(order.status)||order.total<=0)problem(409,'This order does not require an online payment');
  const payment=(await tx.query('SELECT provider_ref FROM payments WHERE order_id=$1',[id])).rows[0];
  if(!payment)problem(409,'Payment record is unavailable. Contact support.');
  if(!order.payment_started_at){
   const timestamp=payment.provider_ref?order.created_at:new Date();
   await tx.query('UPDATE orders SET payment_started_at=$1,payment_email=$2 WHERE id=$3',[timestamp,order.email,id]);order.payment_started_at=timestamp;order.payment_email=order.email;
  }
  return {order,payment};
 });
 const {order,payment}=prepared,provider=providerOverride||paymentProvider();let result:{reference:string;url:string};
 if(payment.provider_ref){
  const existing=await provider.retrieve(payment.provider_ref);
  const digits=new Intl.NumberFormat('en',{style:'currency',currency:order.currency}).resolvedOptions().maximumFractionDigits??2;
  if(existing.amount_total!==order.total*10**digits||existing.currency?.toUpperCase()!==order.currency||existing.metadata?.orderId!==order.id||order.approved_bill&&existing.metadata?.billRevision!==String(order.bill_revision))problem(409,'The payment session does not match the approved bill. Contact support.');
  if(existing.status!=='open'||!existing.url)problem(409,'This payment session has completed or expired. Contact support.');
  result={reference:existing.id,url:existing.url};
 }else{
  if(Date.now()-new Date(order.payment_started_at).getTime()>1800000)problem(410,'Payment session expired. Please contact store support.');
  result=await provider.start({id:order.id,number:order.number,total:order.total,currency:order.currency,email:order.payment_email,createdAt:new Date(order.payment_started_at).toISOString(),billRevision:order.bill_revision});
 }
 await db.transaction(async tx=>{
  const current=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(current.review_status!=='approved'||current.bill_revision!==order.bill_revision||current.total!==order.total||['cancelled','refunded'].includes(current.status))problem(409,'This bill changed. Contact support before paying.');
  await tx.query('UPDATE payments SET provider_ref=$1 WHERE order_id=$2',[result.reference,id]);
 });
 return {checkoutUrl:result.url};
}
export async function handleWebhook(db:Database,raw:string,signature:string){
 if(!onlinePaymentsEnabled())problem(503,'Online payments are not configured');
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!);let event:Stripe.Event;
 try{event=stripe.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET!)}catch{problem(400,'Invalid webhook signature')}
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired'].includes(event.type))return {received:true};
 const checkout=event.data.object as Stripe.Checkout.Session;
 await db.transaction(async tx=>{
  const inserted=(await tx.query('INSERT INTO payment_events(id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',[event.id])).rows;if(!inserted.length)return;
  const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[checkout.metadata?.orderId||''])).rows[0];if(!order)problem(404,'Order not found');
  const payment=(await tx.query('SELECT provider_ref FROM payments WHERE order_id=$1',[order.id])).rows[0];
  const revision=checkout.metadata?.billRevision;
  if(order.payment_method!=='online'||order.review_status!=='approved')problem(409,'No approved online bill matches this payment.');
  if(revision?revision!==String(order.bill_revision):!!order.approved_bill)problem(409,'Payment bill revision mismatch.');
  if(payment?.provider_ref&&payment.provider_ref!==checkout.id)problem(409,'Payment session reference mismatch.');
  if(event.type==='checkout.session.expired'){
   if(['pending','confirmed','on_hold'].includes(order.status)&&order.payment_status==='unpaid'){
    const variants=(await tx.query('SELECT v.id FROM product_variants v WHERE v.id IN (SELECT variant_id FROM order_items WHERE order_id=$1) ORDER BY v.id FOR UPDATE',[order.id])).rows;
    for(const variant of variants)await tx.query('UPDATE product_variants SET stock=stock+(SELECT coalesce(sum(quantity),0)::int FROM order_items WHERE order_id=$1 AND variant_id=$2) WHERE id=$2',[order.id,variant.id]);
    await tx.query("UPDATE orders SET status='cancelled',updated_at=now(),version=version+1 WHERE id=$1",[order.id]);
    await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),order.id,'cancelled','Payment session expired']);
   }return;
  }
  if(checkout.payment_status!=='paid')return;
  const digits=new Intl.NumberFormat('en',{style:'currency',currency:order.currency}).resolvedOptions().maximumFractionDigits??2;
  if(checkout.amount_total!==order.total*10**digits||checkout.currency?.toUpperCase()!==order.currency)problem(409,'Payment amount or currency mismatch');
  if(['cancelled','refunded'].includes(order.status))problem(409,'Payment received after order closure. Manual reconciliation required.');
  if(order.payment_status==='paid')return;
  await tx.query("UPDATE orders SET payment_status='paid',updated_at=now(),version=version+1 WHERE id=$1",[order.id]);
  await tx.query("UPDATE payments SET status='paid',provider_ref=$1 WHERE order_id=$2",[checkout.id,order.id]);
  await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),order.id,order.status,'Payment confirmed']);
 });return {received:true};
}
