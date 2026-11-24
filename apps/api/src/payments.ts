import Stripe from 'stripe';
import type {Database} from './db';import {problem} from './auth';
export interface PaymentProvider{start(order:{id:string;number:string;total:number;currency:string;email:string;createdAt:string}):Promise<{reference:string;url:string}>;}
export const onlinePaymentsEnabled=()=>!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET&&!!process.env.WEB_ORIGIN;
export function paymentProvider():PaymentProvider{
 if(!onlinePaymentsEnabled())problem(503,'Online payments are not configured');
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!);
 return {async start(order){const digits=new Intl.NumberFormat('en',{style:'currency',currency:order.currency}).resolvedOptions().maximumFractionDigits??2;const result=await stripe.checkout.sessions.create({mode:'payment',customer_email:order.email,client_reference_id:order.id,metadata:{orderId:order.id},success_url:`${process.env.WEB_ORIGIN}/orders/${order.id}?payment=return`,cancel_url:`${process.env.WEB_ORIGIN}/?payment=cancelled`,expires_at:Math.floor(new Date(order.createdAt).getTime()/1000)+1800,line_items:[{quantity:1,price_data:{currency:order.currency.toLowerCase(),unit_amount:order.total*10**digits,product_data:{name:`MS Collection order ${order.number}`}}}]},{idempotencyKey:`order-${order.id}`});if(!result.url)problem(502,'Payment provider did not return a checkout URL');return {reference:result.id,url:result.url!};}};
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
 if(event.type==='checkout.session.expired'){if(order.status==='pending'&&order.payment_status==='unpaid'){await tx.query('UPDATE product_variants v SET stock=v.stock+i.quantity FROM order_items i WHERE i.variant_id=v.id AND i.order_id=$1',[order.id]);await tx.query("UPDATE orders SET status='cancelled' WHERE id=$1",[order.id]);}return;}
 if(checkout.payment_status!=='paid')return;
 const digits=new Intl.NumberFormat('en',{style:'currency',currency:order.currency}).resolvedOptions().maximumFractionDigits??2;
 if(checkout.amount_total!==order.total*10**digits||checkout.currency?.toUpperCase()!==order.currency)problem(409,'Payment amount or currency mismatch');
 if(order.status==='cancelled')problem(409,'Payment received after cancellation. Manual reconciliation required.');
 await tx.query("UPDATE orders SET status=CASE WHEN status='pending' THEN 'paid' ELSE status END,payment_status='paid',updated_at=now() WHERE id=$1",[order.id]);
 await tx.query("UPDATE payments SET status='paid',provider_ref=$1 WHERE order_id=$2",[checkout.id,order.id]);
 });return {received:true};
}
