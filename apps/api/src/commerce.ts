import {randomUUID} from 'node:crypto';
import type {Database,Queryable,Row} from './db';
import {customerTier} from './resellers';
import {catalogue} from './catalogue';
import {problem,secret,digest} from './auth';
import {onlinePaymentsEnabled} from './payments';
import {billSnapshot} from './orders';
import {checkoutInput} from '../../../packages/shared/src/platform';
import {orderStatusLabel,orderTransitions} from '../../../packages/shared/src/orders';
export async function readCart(db:Queryable,id:string){const owner=(await db.query('SELECT customer_id FROM carts WHERE id=$1',[id])).rows[0];const tier=await customerTier(db,owner?.customer_id);const data=await catalogue(db,false,tier);const rows=(await db.query('SELECT * FROM cart_items WHERE cart_id=$1 ORDER BY id',[id])).rows;const items=rows.map(l=>{const p=data.products.find(p=>p.variants.some((v:Row)=>v.id===l.variant_id));const v=p?.variants.find((v:Row)=>v.id===l.variant_id);return {id:l.id,variantId:l.variant_id,productId:p?.id,size:v?.size,color:v?.color,quantity:l.quantity,unitPrice:v?.unitPrice??0,available:!!p&&!!v&&v.stock>=l.quantity,product:p};});const subtotal=items.reduce((n,l)=>n+l.unitPrice*l.quantity,0);const shipping=subtotal>=data.settings.freeShippingThreshold||subtotal===0?0:data.settings.shippingFee;const tax=Math.round(subtotal*data.settings.taxPercent/100);return {items,subtotal,shipping,tax,pricingTier:tier,total:subtotal+shipping+tax,currency:data.settings.currency};}
export async function checkout(db:Database,cart:string,raw:unknown,customer:any){
 const input=checkoutInput.parse(raw);const token=secret();
 const result=await db.transaction(async tx=>{
 // Lock the cart first, serializing identical requests and avoiding duplicate decrements.
 const lockedCart=(await tx.query('SELECT * FROM carts WHERE id=$1 FOR UPDATE',[cart])).rows[0];
 if(customer){const current=(await tx.query('SELECT * FROM customers WHERE id=$1 AND active=true FOR UPDATE',[customer.id])).rows[0];if(!current)problem(401,'Your session is no longer active. Sign in again.');customer=current;if(lockedCart?.customer_id!==customer.id)problem(403,'This bag belongs to another account');}
 else if(lockedCart?.customer_id)problem(401,'Please sign in to use this bag');
 const tier=customer?.account_type==='reseller'?'reseller':'regular';
 const existing=(await tx.query('SELECT id,number,cart_id,request_hash,payment_method,status,total,original_total,currency,review_status FROM orders WHERE idempotency_key=$1',[input.idempotencyKey])).rows[0];
 if(existing){if(existing.request_hash&&existing.request_hash!==digest(JSON.stringify(input)))problem(409,'Idempotency key was already used for different checkout details');if(existing.cart_id!==cart)problem(409,'Idempotency key already in use');await tx.query('UPDATE orders SET access_token_hash=$1 WHERE id=$2',[digest(token),existing.id]);return {id:existing.id,number:existing.number,token,total:existing.total,currency:existing.currency,reviewPending:existing.review_status!=='approved',replayed:true};}
 const mall=(await tx.query('SELECT settings FROM malls WHERE id=$1',['main'])).rows[0].settings;
 if(!mall.guestCheckout&&!customer)problem(401,'Please sign in to checkout');
 if(input.paymentMethod==='online'&&!onlinePaymentsEnabled())problem(503,'Online payments are not configured. Choose cash on delivery.');
 const lines=(await tx.query('SELECT ci.*,v.product_id,v.size,v.color,v.stock,v.price_override FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id WHERE ci.cart_id=$1 ORDER BY v.id FOR UPDATE OF v',[cart])).rows;
 if(!lines.length)problem(400,'Your bag is empty');
 const data=await catalogue(tx,false,tier);let subtotal=0;const snapshots=[];
 for(const l of lines){const p=data.products.find(p=>p.id===l.product_id);if(!p||!p.variants.some((v:Row)=>v.id===l.variant_id)||l.stock<l.quantity)problem(409,'An item is unavailable or has insufficient stock');const amount=p.variants.find((v:Row)=>v.id===l.variant_id)!.unitPrice;subtotal+=amount*l.quantity;snapshots.push({line:l,product:p,amount});}
 const shipping=subtotal>=mall.freeShippingThreshold?0:mall.shippingFee,tax=Math.round(subtotal*mall.taxPercent/100);const id=randomUUID(),number=`MS-${Date.now().toString(36).toUpperCase()}-${secret().slice(0,4).toUpperCase()}`;
 let customerId=customer?.id;
 if(!customerId){const c=(await tx.query('INSERT INTO customers(id,email,name,phone) VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email WHERE customers.account_type=\'customer\' RETURNING id',[randomUUID(),input.email.toLowerCase(),input.address.name,input.address.phone])).rows[0];if(!c)problem(401,'Sign in to your reseller account before ordering with this email');customerId=c.id;}
 await tx.query('INSERT INTO orders(id,number,customer_id,email,shipping_address,subtotal,shipping,tax,total,currency,payment_method,idempotency_key,cart_id,access_token_hash,request_hash,original_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[id,number,customerId,input.email.toLowerCase(),JSON.stringify(input.address),subtotal,shipping,tax,subtotal+shipping+tax,mall.currency,input.paymentMethod,input.idempotencyKey,cart,digest(token),digest(JSON.stringify(input)),subtotal+shipping+tax]);
 await tx.query('UPDATE orders SET pricing_settings=$1,pricing_tier=$2,reseller_id=$3,reseller_username_snapshot=$4 WHERE id=$5',[JSON.stringify({shippingFee:mall.shippingFee,freeShippingThreshold:mall.freeShippingThreshold,taxPercent:mall.taxPercent,resellerFallback:mall.resellerFallback||'regular_discounted'}),tier,tier==='reseller'?customer.id:null,tier==='reseller'?(customer.username||customer.email||customer.name):'',id]);
 await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),id,'pending','Order received']);
 for(const {line:l,product:p,amount} of snapshots){const changed=(await tx.query('UPDATE product_variants SET stock=stock-$1 WHERE id=$2 AND stock>=$1 RETURNING id',[l.quantity,l.variant_id])).rows;if(!changed.length)problem(409,'Insufficient stock');await tx.query('INSERT INTO order_items(id,order_id,product_id,variant_id,name_snapshot,variant_snapshot,price_snapshot,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),id,p.id,l.variant_id,p.name,`${l.size} / ${l.color}`,amount,l.quantity]);}
 const initialOrder=(await tx.query('SELECT * FROM orders WHERE id=$1',[id])).rows[0];
 const original=billSnapshot(initialOrder,(await tx.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id',[id])).rows);
 original.reference=number+'/QUOTE';
 await tx.query('UPDATE orders SET original_bill=$1 WHERE id=$2',[JSON.stringify(original),id]);
 await tx.query('INSERT INTO payments(id,order_id,provider,amount,status) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),id,input.paymentMethod==='cod'?'cod':'stripe',subtotal+shipping+tax,'pending']);
 await tx.query('DELETE FROM cart_items WHERE cart_id=$1',[cart]);
 await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'order-confirmation',JSON.stringify({to:input.email,number,total:subtotal+shipping+tax,currency:mall.currency,paymentMethod:input.paymentMethod,orderId:id})]);
 if(process.env.ADMIN_NOTIFICATION_EMAIL)await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'new-order',JSON.stringify({to:process.env.ADMIN_NOTIFICATION_EMAIL,number,total:subtotal+shipping+tax,currency:mall.currency,paymentMethod:input.paymentMethod,orderId:id})]);
 return {id,number,token,total:subtotal+shipping+tax,currency:mall.currency,reviewPending:true};
 });
 return result;
}
export async function updateOrder(tx:Queryable,id:string,status:string,notes?:string,shipment:{courier?:string;trackingId?:string;version?:number}={}){
 const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)problem(404,'Order not found');
 if(shipment.version!==undefined&&shipment.version!==order.version)problem(409,'This order changed. Reload its latest details before saving.');
 if(order.review_status!=='approved'&&['packed','shipped','in_transit','delivered'].includes(status))problem(409,'Review and confirm the final bill before preparation or dispatch.');
 if(order.payment_method==='online'&&order.payment_status!=='paid'&&['packed','shipped','in_transit','delivered'].includes(status))problem(409,'Wait for verified online payment before fulfilment');
 if(status!==order.status&&!orderTransitions[order.status]?.includes(status))problem(409,'Cannot change '+order.status+' to '+status);
 if(status==='refunded'&&order.payment_method!=='cod')problem(409,'Issue the refund through the configured payment provider first');
 if(status==='cancelled'&&order.payment_method==='online'&&(order.payment_started_at||(await tx.query('SELECT id FROM payments WHERE order_id=$1 AND provider_ref IS NOT NULL LIMIT 1',[id])).rows.length))problem(409,'Reconcile the existing online payment session with the provider before cancellation.');
 if(status==='cancelled'&&order.payment_method==='online'&&order.payment_status==='paid'&&order.total>0)problem(409,'Reconcile the online payment with the provider before cancellation.');
 const courier=shipment.courier??order.courier,trackingId=shipment.trackingId??order.tracking_id;
 if(trackingId&&!courier)problem(400,'Choose a courier company for this Tracking ID.');
 const trackingChanged=courier!==order.courier||trackingId!==order.tracking_id;
 if(trackingChanged&&['cancelled','refunded'].includes(order.status))problem(409,'Tracking cannot be changed on a closed order.');
 if(['cancelled','refunded'].includes(status)&&status!==order.status){
  const variants=(await tx.query('SELECT v.id FROM product_variants v WHERE v.id IN (SELECT variant_id FROM order_items WHERE order_id=$1) ORDER BY v.id FOR UPDATE',[id])).rows;
  for(const variant of variants)await tx.query('UPDATE product_variants SET stock=stock+(SELECT coalesce(sum(quantity),0)::int FROM order_items WHERE order_id=$1 AND variant_id=$2) WHERE id=$2',[id,variant.id]);
 }
 const payment=status==='delivered'&&order.payment_method==='cod'?'paid':status==='refunded'?'refunded':order.payment_status;
 const changed=status!==order.status||trackingChanged||(notes!==undefined&&notes!==order.notes);
 if(changed){
  await tx.query("UPDATE orders SET status=$1,payment_status=$2,notes=$3,courier=$4,tracking_id=$5,dispatched_at=CASE WHEN $1='shipped' THEN coalesce(dispatched_at,now()) ELSE dispatched_at END,delivered_at=CASE WHEN $1='delivered' THEN coalesce(delivered_at,now()) ELSE delivered_at END,version=version+1,updated_at=now() WHERE id=$6",[status,payment,notes??order.notes,courier,trackingId,id]);
  await tx.query('UPDATE payments SET status=$1 WHERE order_id=$2',[payment,id]);
  if(status!==order.status||trackingChanged){
   const message=status!==order.status?({pending:'Order returned to New Orders',on_hold:'Order is on hold',packed:'Order preparation started',shipped:'Order dispatched',in_transit:'Order is in transit',delivered:'Order delivered',cancelled:'Order cancelled',refunded:'Order refunded'} as Record<string,string>)[status]||orderStatusLabel(status):'Delivery tracking details updated';
   await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),id,status,message]);
  }
  if(status!==order.status)await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'order-status',JSON.stringify({to:order.email,number:order.number,status,orderId:id,courier,trackingId})]);
 }
 return {id,status,paymentStatus:payment,version:order.version+(changed?1:0)};
}
