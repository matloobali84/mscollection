import {randomUUID} from 'node:crypto';
import type {Database,Queryable,Row} from './db';
import {catalogue} from './catalogue';
import {problem,secret,digest} from './auth';
import {onlinePaymentsEnabled,paymentProvider} from './payments';
import {checkoutInput} from '../../../packages/shared/src/platform';
export async function readCart(db:Queryable,id:string){const data=await catalogue(db);const rows=(await db.query('SELECT * FROM cart_items WHERE cart_id=$1 ORDER BY id',[id])).rows;const items=rows.map(l=>{const p=data.products.find(p=>p.variants.some((v:Row)=>v.id===l.variant_id));const v=p?.variants.find((v:Row)=>v.id===l.variant_id);return {id:l.id,variantId:l.variant_id,productId:p?.id,size:v?.size,color:v?.color,quantity:l.quantity,unitPrice:p?(p.salePrice??v?.priceOverride??p.price):0,available:!!p&&!!v&&v.stock>=l.quantity,product:p};});const subtotal=items.reduce((n,l)=>n+l.unitPrice*l.quantity,0);const shipping=subtotal>=data.settings.freeShippingThreshold||subtotal===0?0:data.settings.shippingFee;const tax=Math.round(subtotal*data.settings.taxPercent/100);return {items,subtotal,shipping,tax,total:subtotal+shipping+tax,currency:data.settings.currency};}
export async function checkout(db:Database,cart:string,raw:unknown,customer:any){
 const input=checkoutInput.parse(raw);const token=secret();
 const result=await db.transaction(async tx=>{
 // Lock the cart first, serializing identical requests and avoiding duplicate decrements.
 await tx.query('SELECT id FROM carts WHERE id=$1 FOR UPDATE',[cart]);
 const existing=(await tx.query('SELECT id,number,cart_id,request_hash,payment_method,status FROM orders WHERE idempotency_key=$1',[input.idempotencyKey])).rows[0];
 if(existing){if(existing.request_hash&&existing.request_hash!==digest(JSON.stringify(input)))problem(409,'Idempotency key was already used for different checkout details');if(existing.cart_id!==cart)problem(409,'Idempotency key already in use');await tx.query('UPDATE orders SET access_token_hash=$1 WHERE id=$2',[digest(token),existing.id]);return {id:existing.id,number:existing.number,token,replayed:true};}
 const mall=(await tx.query('SELECT settings FROM malls WHERE id=$1',['main'])).rows[0].settings;
 if(!mall.guestCheckout&&!customer)problem(401,'Please sign in to checkout');
 if(input.paymentMethod==='online'&&!onlinePaymentsEnabled())problem(503,'Online payments are not configured. Choose cash on delivery.');
 const lines=(await tx.query('SELECT ci.*,v.product_id,v.size,v.color,v.stock,v.price_override FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id WHERE ci.cart_id=$1 ORDER BY v.id FOR UPDATE OF v',[cart])).rows;
 if(!lines.length)problem(400,'Your bag is empty');
 const data=await catalogue(tx);let subtotal=0;const snapshots=[];
 for(const l of lines){const p=data.products.find(p=>p.id===l.product_id);if(!p||!p.variants.some((v:Row)=>v.id===l.variant_id)||l.stock<l.quantity)problem(409,'An item is unavailable or has insufficient stock');const amount=p.salePrice??l.price_override??p.price;subtotal+=amount*l.quantity;snapshots.push({line:l,product:p,amount});}
 const shipping=subtotal>=mall.freeShippingThreshold?0:mall.shippingFee,tax=Math.round(subtotal*mall.taxPercent/100);const id=randomUUID(),number=`MS-${Date.now().toString(36).toUpperCase()}-${secret().slice(0,4).toUpperCase()}`;
 let customerId=customer?.id;
 if(!customerId){const c=(await tx.query('INSERT INTO customers(id,email,name,phone) VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id',[randomUUID(),input.email.toLowerCase(),input.address.name,input.address.phone])).rows[0];customerId=c.id;}
 await tx.query('INSERT INTO orders(id,number,customer_id,email,shipping_address,subtotal,shipping,tax,total,currency,payment_method,idempotency_key,cart_id,access_token_hash,request_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[id,number,customerId,input.email.toLowerCase(),JSON.stringify(input.address),subtotal,shipping,tax,subtotal+shipping+tax,mall.currency,input.paymentMethod,input.idempotencyKey,cart,digest(token),digest(JSON.stringify(input))]);
 for(const {line:l,product:p,amount} of snapshots){const changed=(await tx.query('UPDATE product_variants SET stock=stock-$1 WHERE id=$2 AND stock>=$1 RETURNING id',[l.quantity,l.variant_id])).rows;if(!changed.length)problem(409,'Insufficient stock');await tx.query('INSERT INTO order_items(id,order_id,product_id,variant_id,name_snapshot,variant_snapshot,price_snapshot,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),id,p.id,l.variant_id,p.name,`${l.size} / ${l.color}`,amount,l.quantity]);}
 await tx.query('INSERT INTO payments(id,order_id,provider,amount,status) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),id,input.paymentMethod==='cod'?'cod':'stripe',subtotal+shipping+tax,'pending']);
 await tx.query('DELETE FROM cart_items WHERE cart_id=$1',[cart]);
 await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'order-confirmation',JSON.stringify({to:input.email,number,total:subtotal+shipping+tax,currency:mall.currency,paymentMethod:input.paymentMethod,orderId:id})]);
 if(process.env.ADMIN_NOTIFICATION_EMAIL)await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'new-order',JSON.stringify({to:process.env.ADMIN_NOTIFICATION_EMAIL,number,total:subtotal+shipping+tax,currency:mall.currency,paymentMethod:input.paymentMethod,orderId:id})]);
 return {id,number,token,total:subtotal+shipping+tax,currency:mall.currency};
 });
 if(input.paymentMethod==='online'){const order=(await db.query('SELECT * FROM orders WHERE id=$1',[result.id])).rows[0];if(order.payment_status==='paid')return result;try{const payment=await paymentProvider().start({id:order.id,number:order.number,total:order.total,currency:order.currency,email:order.email,createdAt:order.created_at});await db.query('UPDATE payments SET provider_ref=$1 WHERE order_id=$2',[payment.reference,result.id]);return {...result,checkoutUrl:payment.url};}catch{console.warn('Online payment session needs retry for order',order.id);return {...result,paymentPending:true};}}
 return result;
}
export async function updateOrder(tx:Queryable,id:string,status:string,notes?:string){
 const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)problem(404,'Order not found');
 if(order.payment_method==='online'&&order.payment_status!=='paid'&&['packed','shipped','delivered'].includes(status))problem(409,'Wait for verified online payment before fulfilment');
 if(order.payment_method==='online'&&order.payment_status!=='paid'&&['packed','shipped','delivered'].includes(status))problem(409,'Online payment must be confirmed by the provider before fulfilment');
 const transitions:Record<string,string[]>={pending:['packed','cancelled'],paid:['packed','refunded'],packed:['shipped','cancelled'],shipped:['delivered'],delivered:['refunded'],cancelled:[],refunded:[]};
 if(status!==order.status&&!transitions[order.status]?.includes(status))problem(409,`Cannot change ${order.status} to ${status}`);
 if(status==='refunded'&&order.payment_method!=='cod')problem(409,'Issue the refund through the configured payment provider first');
 if(['cancelled','refunded'].includes(status)&&status!==order.status){await tx.query('UPDATE product_variants v SET stock=v.stock+i.quantity FROM order_items i WHERE i.variant_id=v.id AND i.order_id=$1',[id]);}
 const payment=status==='delivered'&&order.payment_method==='cod'?'paid':status==='refunded'?'refunded':order.payment_status;
 await tx.query('UPDATE orders SET status=$1,payment_status=$2,notes=$3,updated_at=now() WHERE id=$4',[status,payment,notes??order.notes,id]);
 await tx.query('UPDATE payments SET status=$1 WHERE order_id=$2',[payment,id]);
 if(status!==order.status)await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'order-status',JSON.stringify({to:order.email,number:order.number,status,orderId:id})]);
 return {id,status,paymentStatus:payment};
}
