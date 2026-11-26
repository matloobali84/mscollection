import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {openDatabase,migrate} from './db';
import {seed} from './seed';
import {buildApp} from './app';
import Stripe from 'stripe';

test('order management: receipt, edits, queues, dispatch, private tracking and delivery',async t=>{
 const db=await openDatabase(true);await migrate(db);await seed(db,false);const app=await buildApp(db,false);await app.ready();
 const adminId=randomUUID();await db.query('INSERT INTO admin_users(id,email,name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[adminId,'order-owner@example.invalid','Order fixture owner',await hash('Order-Fixture-Password!',4),'super_admin']);
 function client(){let cookies:Record<string,string>={},csrf='';return {async send(path:string,method='GET',body?:any,token?:string){const response=await app.inject({url:'/api/v1/'+path,method:method as any,headers:{cookie:Object.entries(cookies).map(([key,value])=>key+'='+value).join('; '),'x-requested-with':'MSCollection','x-csrf-token':csrf,...(token?{authorization:'Bearer '+token}:{})},...(body?{payload:body}:{})});for(const cookie of response.cookies)cookies[cookie.name]=cookie.value;const data=response.json();if(data.csrf)csrf=data.csrf;return {status:response.statusCode,data}}}}
 const owner=client(),buyer=client(),stranger=client();
 const address={name:'Order Test Customer',phone:'03000000000',address:'123 Test Street',city:'Lahore',postal:'54000',country:'Pakistan'};
 const stock=async(id:string)=>(await db.query('SELECT stock FROM product_variants WHERE id=$1',[id])).rows[0].stock;
 const baseStock=await stock('clothing-1-1'),secondStock=await stock('clothing-2-1');
 let order:any,created:any,unitPrice=0;
 const detail=async(id=created.id)=>(await owner.send('admin/orders/'+id)).data;
 const approve=async(current:any)=>{const result=await owner.send('admin/orders/'+current.id+'/approve','POST',{version:current.version});assert.equal(result.status,200,JSON.stringify(result.data));return result.data};
 const editBody=(current:any)=>({version:current.version,email:current.email,address:current.shipping_address,notes:current.notes,items:current.items.map((item:any)=>({id:item.id,variantId:item.variant_id,quantity:item.quantity}))});
 const queue=async(name:string,search='')=>(await owner.send('admin/orders?view=queue&queue='+name+'&search='+encodeURIComponent(search))).data;
 async function create(customer=client(),quantity=1){await customer.send('cart');await customer.send('cart','POST',{variantId:'clothing-1-1',quantity});const result=await customer.send('checkout','POST',{email:'order-customer@example.invalid',address,paymentMethod:'cod',idempotencyKey:randomUUID()});assert.equal(result.status,200);return result.data}
 try{
  assert.equal((await owner.send('admin/login','POST',{email:'order-owner@example.invalid',password:'Order-Fixture-Password!'})).status,200);
  await t.test('a received order appears only in New Orders with private tracking access',async()=>{
   await buyer.send('auth/register','POST',{email:'order-customer@example.invalid',name:address.name,password:'Order-Customer-Password!'});
   created=await create(buyer);order=await detail();unitPrice=order.items[0].price_snapshot;
   assert.ok((await queue('new')).orders.some((item:any)=>item.id===created.id));assert.equal((await queue('pending')).orders.length,0);
   assert.equal((await stranger.send('orders/'+created.id)).status,404);assert.equal((await stranger.send('orders/'+created.id,'GET',undefined,'wrong-token')).status,404);
   const publicOrder=await stranger.send('orders/'+created.id,'GET',undefined,created.token);assert.equal(publicOrder.status,200);assert.equal(publicOrder.data.events[0].message,'Order received');assert.equal((await queue('undispatched')).counts.undispatched,1);assert.equal((await queue('undispatched')).orders[0].id,created.id);assert.equal((await owner.send('admin/orders/'+created.id,'PATCH',{status:'in_transit',version:order.version})).status,409);
   for(const field of ['notes','access_token_hash','idempotency_key','request_hash','cart_id','pricing_settings','customer_id'])assert.equal(publicOrder.data[field],undefined);
  });
  await t.test('pre-dispatch edits adjust stock, keep snapshot prices and original delivery terms',async()=>{
   const mall=(await db.query("SELECT settings FROM malls WHERE id='main'")).rows[0].settings;
   await db.query("UPDATE malls SET settings=$1 WHERE id='main'",[JSON.stringify({...mall,shippingFee:999,freeShippingThreshold:1,taxPercent:10})]);
   const input=editBody(order);input.email='corrected-contact@example.invalid';input.address={...address,name:'Corrected Recipient',phone:'03110000000'};input.notes='PRIVATE INTERNAL NOTE';input.items[0].quantity=2;
   const saved=await owner.send('admin/orders/'+order.id,'PUT',input);assert.equal(saved.status,200,JSON.stringify(saved.data));order=saved.data;
   assert.equal(order.subtotal,unitPrice*2);assert.equal(order.shipping,250);assert.equal(order.tax,0);assert.equal(order.total,unitPrice*2+250);assert.equal(await stock('clothing-1-1'),baseStock-2);
   assert.equal((await buyer.send('me/orders')).data[0].id,order.id);assert.equal((await buyer.send('orders/'+order.id)).status,200);
   assert.equal((await stranger.send('orders/'+order.id,'GET',undefined,created.token)).data.notes,undefined);
   assert.equal((await owner.send('admin/orders/'+order.id,'PUT',input)).status,409);assert.equal(await stock('clothing-1-1'),baseStock-2);
   await db.query("UPDATE malls SET settings=$1 WHERE id='main'",[JSON.stringify(mall)]);
  });
  await t.test('failed edits roll back, duplicate variants and foreign items are rejected',async()=>{
   const input=editBody(order);input.items[0].quantity=20;assert.equal((await owner.send('admin/orders/'+order.id,'PUT',input)).status,409);
   assert.equal((await detail()).version,order.version);assert.equal(await stock('clothing-1-1'),baseStock-2);
   const foreign=editBody(order);foreign.items[0].id='some-other-order-item';assert.equal((await owner.send('admin/orders/'+order.id,'PUT',foreign)).status,400);
   const duplicate=editBody(order);duplicate.items.push({...duplicate.items[0]});assert.equal((await owner.send('admin/orders/'+order.id,'PUT',duplicate)).status,400);
  });
  await t.test('adding and removing a variant reserves and returns the correct stock',async()=>{
   const input=editBody(order);input.items.push({id:undefined as any,variantId:'clothing-2-1',quantity:1});const saved=await owner.send('admin/orders/'+order.id,'PUT',input);assert.equal(saved.status,200,JSON.stringify(saved.data));order=saved.data;
   assert.equal(order.items.length,2);assert.equal(order.shipping,0);assert.equal(await stock('clothing-2-1'),secondStock-1);
   const remove=editBody(order);remove.items=remove.items.filter((item:any)=>item.variantId!=='clothing-2-1');order=(await owner.send('admin/orders/'+order.id,'PUT',remove)).data;
   assert.equal(await stock('clothing-2-1'),secondStock);assert.equal(order.subtotal,unitPrice*2);
  });
  await t.test('hold/preparation move an order to Pending and dispatch works without any tracking',async()=>{
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'on_hold',version:order.version})).status,200);order=await detail();
   assert.equal((await queue('new')).orders.length,0);assert.equal((await queue('pending')).orders[0].id,order.id);
   order=await approve(order);assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'packed',version:order.version})).status,200);order=await detail();
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'shipped',trackingId:'',courier:'',version:order.version})).status,200);order=await detail();
   assert.ok(order.dispatched_at);assert.equal(order.tracking_id,'');assert.equal(order.courier,'');assert.equal((await queue('pending')).orders.length,0);assert.equal((await queue('dispatched')).orders[0].id,order.id);
   assert.equal((await owner.send('admin/orders/'+order.id,'PUT',editBody(order))).status,409);
  });
  await t.test('tracking is editable after dispatch, validates the courier and remains private',async()=>{
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'shipped',trackingId:'CN-TEST-001',courier:'',version:order.version})).status,400);
   const firstVersion=order.version,dispatchedAt=order.dispatched_at;
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'shipped',trackingId:'CN-TEST-001',courier:'TCS',version:order.version})).status,200);order=await detail();
   const publicOrder=(await stranger.send('orders/'+order.id,'GET',undefined,created.token)).data;
   assert.equal(publicOrder.tracking_id,'CN-TEST-001');assert.equal(publicOrder.courier,'TCS');assert.equal(publicOrder.notes,undefined);assert.ok(publicOrder.events.some((event:any)=>event.message==='Delivery tracking details updated'));
   assert.equal((await stranger.send('orders/'+order.id)).status,404);
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'delivered',version:firstVersion})).status,409);
   const beforeEvents=order.events.length;
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'shipped',trackingId:'CN-TEST-001',courier:'TCS',version:order.version})).status,200);
   const repeated=await detail();assert.equal(repeated.version,order.version);assert.equal(repeated.events.length,beforeEvents);assert.equal(new Date(repeated.dispatched_at).getTime(),new Date(dispatchedAt).getTime());
  });
  await t.test('undispatched counts and in-transit orders have distinct queues and protected transitions',async()=>{
   const first=await queue('all');assert.equal(first.counts.undispatched,first.counts.new+first.counts.pending);assert.equal(first.counts.dispatched,1);assert.equal(first.counts.in_transit,0);
   const result=await owner.send('admin/orders/'+order.id,'PATCH',{status:'in_transit',version:order.version});assert.equal(result.status,200,JSON.stringify(result.data));order=await detail();assert.equal(order.status,'in_transit');assert.equal((await queue('dispatched')).orders.length,0);
   const transit=await queue('in_transit');assert.equal(transit.orders[0].id,order.id);assert.equal(transit.counts.in_transit,1);assert.equal(transit.counts.undispatched,0);assert.equal(transit.counts.all,1);
   const view=(await buyer.send('orders/'+order.id)).data;assert.equal(view.status,'in_transit');assert.ok(view.events.some((event:any)=>event.message==='Order is in transit'));assert.equal(view.tracking_id,'CN-TEST-001');
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'shipped',version:order.version})).status,409);assert.equal((await owner.send('admin/orders/'+order.id,'PUT',editBody(order))).status,409);
  });
  await t.test('delivery moves queues, records its date and settles COD once',async()=>{
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'delivered',version:order.version})).status,200);order=await detail();
   assert.equal(order.payment_status,'paid');assert.ok(order.delivered_at);assert.equal((await queue('dispatched')).orders.length,0);assert.equal((await queue('delivered')).orders[0].id,order.id);
   assert.equal((await db.query('SELECT amount,status FROM payments WHERE order_id=$1',[order.id])).rows[0].amount,order.total);
   assert.equal((await owner.send('admin/orders/'+order.id,'PATCH',{status:'shipped'})).status,409);
  });
  await t.test('direct dispatch with a courier and ID is supported',async()=>{
   const second=await create();await approve(await detail(second.id));assert.equal((await owner.send('admin/orders/'+second.id,'PATCH',{status:'shipped',courier:'Leopards Courier',trackingId:'TEST-SECOND'})).status,200);
   const shipment=await detail(second.id);assert.equal(shipment.courier,'Leopards Courier');assert.equal(shipment.tracking_id,'TEST-SECOND');assert.ok((await queue('dispatched','TEST-SECOND')).orders.some((item:any)=>item.id===second.id));
  });
  await t.test('concurrent edits are versioned and cancellation restores edited quantities once',async()=>{
   const created=await create();const current=await detail(created.id),input=editBody(current);input.items[0].quantity=2;
   const before=await stock('clothing-1-1'),results=await Promise.all([owner.send('admin/orders/'+current.id,'PUT',input),owner.send('admin/orders/'+current.id,'PUT',input)]);
   assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);assert.equal(await stock('clothing-1-1'),before-1);
   assert.equal((await owner.send('admin/orders/'+current.id,'PATCH',{status:'cancelled'})).status,200);assert.equal(await stock('clothing-1-1'),before+1);
   assert.equal((await owner.send('admin/orders/'+current.id,'PATCH',{status:'cancelled'})).status,200);assert.equal(await stock('clothing-1-1'),before+1);
  });
  await t.test('online payments keep their amount and require confirmed payment before dispatch',async()=>{
   const created=await create();await db.query("UPDATE orders SET payment_method='online' WHERE id=$1",[created.id]);let current=await approve(await detail(created.id)),input=editBody(current);input.items[0].quantity=2;
   const saved=await owner.send('admin/orders/'+current.id,'PUT',input);assert.equal(saved.status,200);current=saved.data;assert.equal(current.approved_bill.total,current.total);assert.equal(current.review_status,'approved');assert.equal((await owner.send('admin/orders/'+current.id,'PATCH',{status:'shipped'})).status,409);
   input=editBody(current);input.address={...input.address,city:'Islamabad'};assert.equal((await owner.send('admin/orders/'+current.id,'PUT',input)).status,200);
   await db.query("UPDATE orders SET payment_status='paid',status='paid',version=version+1 WHERE id=$1",[current.id]);current=await detail(created.id);
   assert.equal((await owner.send('admin/orders/'+current.id,'PATCH',{status:'shipped',version:current.version})).status,200);
  });
  await t.test('held online orders expire once and confirmed payments retain their queue',async()=>{
   const previous={key:process.env.STRIPE_SECRET_KEY,secret:process.env.STRIPE_WEBHOOK_SECRET,origin:process.env.WEB_ORIGIN};
   try{
    process.env.STRIPE_SECRET_KEY='sk_test_order_fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_order_fixture';process.env.WEB_ORIGIN='http://localhost:3000';
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    async function event(order:any,type:string,eventId:string){const payload=JSON.stringify({id:eventId,type,data:{object:{id:'cs_'+order.id,metadata:{orderId:order.id,billRevision:String(order.bill_revision)},payment_status:type.endsWith('expired')?'unpaid':'paid',currency:order.currency.toLowerCase(),amount_total:order.total*100}}}),signature=stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET!});return app.inject({url:'/api/v1/payments/webhook',method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},payload})}
    const created=await create();await db.query("UPDATE orders SET payment_method='online' WHERE id=$1",[created.id]);await approve(await detail(created.id));await owner.send('admin/orders/'+created.id,'PATCH',{status:'on_hold'});const held=await detail(created.id),before=await stock('clothing-1-1');
    assert.equal((await event(held,'checkout.session.expired','evt_hold_expiry')).statusCode,200);assert.equal((await detail(created.id)).status,'cancelled');assert.equal(await stock('clothing-1-1'),before+1);
    assert.equal((await event(held,'checkout.session.expired','evt_hold_expiry')).statusCode,200);assert.equal(await stock('clothing-1-1'),before+1);
    const confirmed=await create();await db.query("UPDATE orders SET payment_method='online' WHERE id=$1",[confirmed.id]);await approve(await detail(confirmed.id));await owner.send('admin/orders/'+confirmed.id,'PATCH',{status:'on_hold'});const pending=await detail(confirmed.id);
    assert.equal((await event(pending,'checkout.session.completed','evt_hold_paid')).statusCode,200);const paid=await detail(confirmed.id);assert.equal(paid.status,'on_hold');assert.equal(paid.payment_status,'paid');assert.ok(paid.version>pending.version);assert.ok(paid.events.some((item:any)=>item.message==='Payment confirmed'));
    assert.equal((await owner.send('admin/orders/'+confirmed.id,'PATCH',{status:'cancelled'})).status,409);
   }finally{for(const [key,value] of Object.entries({STRIPE_SECRET_KEY:previous.key,STRIPE_WEBHOOK_SECRET:previous.secret,WEB_ORIGIN:previous.origin})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
  });
  await t.test('queue pagination and counts include orders beyond the old 500-record list',async()=>{
   await db.query("INSERT INTO orders(id,number,customer_id,status,payment_status,payment_method,email,shipping_address,subtotal,shipping,tax,total,currency,idempotency_key,cart_id,access_token_hash,original_total) SELECT 'page-fixture-'||n,'PAGE-ORDER-'||n,customer_id,'pending','unpaid','cod',email,shipping_address,subtotal,shipping,tax,total,currency,'page-key-'||n,cart_id,access_token_hash,original_total FROM orders CROSS JOIN generate_series(1,501) n WHERE id=$1",[order.id]);
   const first=await queue('new');assert.ok(first.counts.new>=501);assert.equal(first.orders.length,25);
   const second=await owner.send('admin/orders?view=queue&queue=new&page=2&limit=25');assert.equal(second.data.orders.length,25);assert.ok(second.data.orders.every((item:any)=>!first.orders.some((previous:any)=>previous.id===item.id)));
   assert.equal((await queue('all','PRIVATE INTERNAL NOTE')).orders.length,0);assert.equal((await queue('all','%')).orders.length,0);
   assert.ok((await owner.send('admin/audit-logs')).data.some((entry:any)=>entry.action==='edit_before_dispatch'));
  });
 }finally{await app.close();await db.close()}
});
