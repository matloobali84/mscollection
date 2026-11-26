import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {openDatabase,migrate} from './db';
import {seed} from './seed';
import {buildApp} from './app';
import {digest} from './auth';
import {parseCSV,toCSV} from './csv';
import {startOrderPayment} from './payments';
import {resolveProductPrice} from '../../../packages/shared/src/pricing';

test('product pricing: independent tiers, defaults, variants and scheduled sales',()=>{
 const product={price:5000,regularDiscount:{type:'percentage' as const,value:10},resellerPrice:4000,resellerDiscount:{type:'percentage' as const,value:5}};
 assert.equal(resolveProductPrice(product).unitPrice,4500);assert.equal(resolveProductPrice(product,{},'reseller').unitPrice,3800);
 const fallback={...product,resellerPrice:null};assert.equal(resolveProductPrice(fallback,{},'reseller').unitPrice,4275);assert.equal(resolveProductPrice(fallback,{},'reseller','regular_base').unitPrice,4750);
 assert.equal(resolveProductPrice(product,{priceOverride:6000}).unitPrice,5400);assert.equal(resolveProductPrice(product,{priceOverride:6000},'reseller').unitPrice,3800);
 const sale={...product,salePrice:4200,saleStart:'2020-01-01T00:00:00Z',saleEnd:'2030-01-01T00:00:00Z'};assert.equal(resolveProductPrice(sale).unitPrice,4200);assert.equal(resolveProductPrice(sale,{},'reseller').unitPrice,3800);
 assert.equal(resolveProductPrice({...product,price:101,regularDiscount:{type:'percentage',value:50}}).unitPrice,50);
 assert.equal(resolveProductPrice({...product,regularDiscount:{type:'fixed',value:10000}}).unitPrice,0);
});

test('reseller accounts, pricing privacy and approved order lifecycle',async t=>{
 const db=await openDatabase(true);await migrate(db);await seed(db,false);const app=await buildApp(db,false);await app.ready();
 await db.query('INSERT INTO admin_users(id,email,name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),'reseller-owner@example.invalid','Reseller owner',await hash('Owner-Test-Password!',4),'super_admin']);
 function client(){const cookies:Record<string,string>={};let csrf='';return {async send(path:string,method='GET',body?:any,token?:string){const result=await app.inject({url:'/api/v1/'+path,method:method as any,headers:{cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; '),'x-requested-with':'MSCollection','x-csrf-token':csrf,...(token?{authorization:'Bearer '+token}:{})},...(body?{payload:body}:{})});for(const c of result.cookies)cookies[c.name]=c.value;const data=String(result.headers['content-type']).includes('text/csv')?result.body:result.json();if(data.csrf)csrf=data.csrf;return {status:result.statusCode,data,headers:result.headers}}}}
 const owner=client(),reseller=client(),guest=client(),regular=client();
 const account={name:'Wholesale Partner',username:'wholesale.test',email:'partner@example.invalid',phone:'03000000000',password:'Partner-Test-Password!',active:true};let resellerId='',productId='',variantId='',created:any;
 const address={name:'Wholesale Partner',phone:'03000000000',address:'123 Reseller Test Street',city:'Lahore',postal:'54000',country:'Pakistan'};
 const product=async()=>(await owner.send('admin/products')).data.find((p:any)=>p.id===productId);
 const detail=async()=>(await owner.send('admin/orders/'+created.id)).data;
 try{
  await owner.send('admin/login','POST',{email:'reseller-owner@example.invalid',password:'Owner-Test-Password!'});
  await t.test('only owner creates accounts; public registration cannot grant a reseller role',async()=>{
   assert.equal((await guest.send('admin/resellers','POST',account)).status,401);
   const created=await owner.send('admin/resellers','POST',account);assert.equal(created.status,200,JSON.stringify(created.data));resellerId=created.data.id;
   assert.equal((await owner.send('admin/resellers','POST',{...account,email:'',username:'username.only'})).status,200);
   assert.equal((await owner.send('admin/resellers','POST',{...account,username:'short-password',email:'',password:'123'})).status,400);
   const registered=await regular.send('auth/register','POST',{email:'retail@example.invalid',name:'Retail Buyer',password:'Retail-Test-Password!',accountType:'reseller',account_type:'reseller'});assert.equal(registered.status,200);assert.equal((await regular.send('auth/me')).data.user.accountType,'customer');
   await owner.send('admin/users','POST',{email:'reseller-manager@example.invalid',name:'Manager',password:'Manager-Test-Password!',role:'manager',active:true});const manager=client();await manager.send('admin/login','POST',{email:'reseller-manager@example.invalid',password:'Manager-Test-Password!'});assert.equal((await manager.send('admin/resellers')).status,403);
   assert.equal((await manager.send('admin/customers/'+resellerId,'PUT',{name:'Bypass',email:account.email,phone:''})).status,404);
   assert.equal((await owner.send('admin/customers')).data.some((c:any)=>c.id===resellerId),false);
  });
  await t.test('reseller username/email login is separate; profile contains no password; admin access denied',async()=>{
   assert.equal((await reseller.send('auth/login','POST',{email:account.email,password:account.password})).status,401);
   const login=await reseller.send('auth/reseller/login','POST',{email:account.username.toUpperCase(),password:account.password});assert.equal(login.status,200,JSON.stringify(login.data));assert.equal(login.data.user.accountType,'reseller');assert.equal(login.data.user.password_hash,undefined);
   const emailLogin=client();assert.equal((await emailLogin.send('auth/reseller/login','POST',{email:account.email,password:account.password})).status,200);
   assert.equal((await reseller.send('admin/orders')).status,401);assert.equal((await reseller.send('admin/resellers')).status,401);
   const listed=(await owner.send('admin/resellers')).data;assert.ok(listed.some((u:any)=>u.id===resellerId));assert.equal(JSON.stringify(listed).includes('password'),false);
  });
  await t.test('products support separate discounts and no private pricing is returned to retail clients',async()=>{
   const response=await owner.send('admin/products','POST',{name:'Reseller Test Product',slug:'reseller-test-product',shopId:'clothing',description:'Reseller fixture',price:5000,regularDiscount:{type:'percentage',value:10},resellerPrice:4000,resellerDiscount:{type:'percentage',value:5},status:'active',variants:[{sku:'RESELLER-FIXTURE-1',size:'M',color:'Sage',stock:30}]});assert.equal(response.status,200,JSON.stringify(response.data));productId=response.data.id;variantId=(await product()).variants[0].id;
   for(const c of [guest,regular]){
    const p=(await c.send('products/reseller-test-product?tier=reseller&role=reseller')).data;assert.equal(p.effectivePrice,4500);assert.equal(p.variants[0].unitPrice,4500);
    for(const key of ['resellerPrice','reseller_price','resellerDiscount','reseller_discount','regular_discount'])assert.equal(p[key],undefined);
    assert.equal(JSON.stringify(p).includes('3800'),false);assert.equal((await c.send('store')).data.resellerFallback,undefined);
   }
   const p=await reseller.send('products/reseller-test-product');assert.equal(p.data.effectivePrice,3800);assert.equal(p.data.variants[0].unitPrice,3800);assert.match(String(p.headers['cache-control']),/private.*no-store/);assert.match(String(p.headers.vary),/Cookie/);
   const search=(await reseller.send('products?search=Reseller%20Test')).data;assert.equal(search.items[0].effectivePrice,3800);
  });
  await t.test('fallback defaults, owner settings, imports and fixed discounts are preserved',async()=>{
   const p=await product();await owner.send('admin/products/'+productId,'PUT',{...p,resellerPrice:null,resellerDiscount:{type:'none',value:0}});assert.equal((await reseller.send('products/reseller-test-product')).data.effectivePrice,4500);
   const settings=(await owner.send('admin/settings')).data;await owner.send('admin/settings','PUT',{...settings,resellerFallback:'regular_base'});assert.equal((await reseller.send('products/reseller-test-product')).data.effectivePrice,5000);await owner.send('admin/settings','PUT',settings);
   await owner.send('admin/products/'+productId,'PUT',{...p,resellerPrice:4000,resellerDiscount:{type:'fixed',value:200}});assert.equal((await reseller.send('products/reseller-test-product')).data.effectivePrice,3800);
   const csv=await app.inject({url:'/api/v1/admin/products/export'});assert.equal(csv.statusCode,401);
   const exported=(await owner.send('admin/products/export')).data;const row=parseCSV(exported).find(row=>row.id===productId)!;assert.equal(JSON.parse(row.regularDiscount).value,10);assert.equal(Number(row.resellerPrice),4000);assert.equal(JSON.parse(row.resellerDiscount).value,200);
   assert.equal((await owner.send('admin/products/import','POST',{csv:toCSV([row])})).status,200);delete row.resellerPrice;delete row.resellerDiscount;delete row.regularDiscount;assert.equal((await owner.send('admin/products/import','POST',{csv:toCSV([row])})).status,200);
   const manager=client();await manager.send('admin/login','POST',{email:'reseller-manager@example.invalid',password:'Manager-Test-Password!'});assert.equal((await manager.send('admin/products/'+productId,'PUT',{...await product(),resellerPrice:1})).status,403);
   assert.equal((await manager.send('admin/products/import','POST',{csv:toCSV([{...row,resellerPrice:'1'}])})).status,403);
   const current=await product();delete current.resellerPrice;delete current.resellerDiscount;delete current.regularDiscount;assert.equal((await owner.send('admin/products/'+productId,'PUT',current)).status,200);assert.equal((await product()).resellerPrice,4000);assert.equal((await product()).regularDiscount.value,10);
  });
  await t.test('cart and checkout use authenticated prices and snapshot reseller identity',async()=>{
   await reseller.send('cart');assert.equal((await reseller.send('cart','POST',{variantId,quantity:2,price:1,role:'regular'})).data.subtotal,7600);
   await guest.send('cart');assert.equal((await guest.send('cart','POST',{variantId,quantity:1,reseller:true})).data.subtotal,4500);
   const denied=await guest.send('checkout','POST',{email:account.email,address,idempotencyKey:randomUUID()});assert.equal(denied.status,401);
   const result=await reseller.send('checkout','POST',{email:account.email,address,idempotencyKey:randomUUID(),total:1,pricingTier:'regular'});assert.equal(result.status,200,JSON.stringify(result.data));created=result.data;
   const order=await detail();assert.equal(order.pricing_tier,'reseller');assert.equal(order.reseller_id,resellerId);assert.equal(order.subtotal,7600);assert.equal(order.original_bill.items[0].price_snapshot,3800);
   assert.equal((await guest.send('orders/'+created.id,'GET',undefined,created.token)).status,404);assert.equal((await regular.send('orders/'+created.id,'GET',undefined,created.token)).status,404);assert.equal((await reseller.send('orders/'+created.id)).status,200);
   const p=await product();await owner.send('admin/products/'+productId,'PUT',{...p,resellerPrice:4500});assert.equal((await reseller.send('orders/'+created.id)).data.bill.items[0].price_snapshot,3800);
  });
  await t.test('admin review discounts apply to reseller snapshots; approval, queues and delivery remain intact',async()=>{
   let order=await detail();const input={version:order.version,email:order.email,address:order.shipping_address,notes:'',items:order.items.map((i:any)=>({id:i.id,variantId:i.variant_id,quantity:i.quantity})),discount:{type:'fixed',value:500}};
   const edited=await owner.send('admin/orders/'+created.id,'PUT',input);assert.equal(edited.status,200);assert.equal(edited.data.subtotal,7600);assert.equal(edited.data.bill.discountAmount,500);order=edited.data;
   order=(await owner.send('admin/orders/'+created.id+'/approve','POST',{version:order.version})).data;assert.equal(order.approved_bill.total,order.total);
   const visible=(await reseller.send('orders/'+created.id)).data;assert.equal(visible.bill.discountAmount,500);assert.equal(visible.bill.total,order.total);
   const filtered=(await owner.send('admin/orders?view=queue&queue=all&buyer=reseller&resellerId='+resellerId)).data;assert.equal(filtered.orders.length,1);assert.equal(filtered.counts.all,1);assert.equal(filtered.orders[0].id,created.id);
   assert.equal((await owner.send('admin/orders?view=queue&queue=all&buyer=regular')).data.orders.length,0);
   assert.equal((await owner.send('admin/orders/'+created.id,'PATCH',{version:order.version,status:'shipped',courier:'TCS',trackingId:''})).status,200);order=await detail();assert.equal((await owner.send('admin/orders/'+created.id,'PATCH',{version:order.version,status:'delivered'})).status,200);assert.equal((await detail()).payment_status,'paid');
  });
  await t.test('reseller online payment requires the active owner login and uses only the approved amount',async()=>{
   const previous={STRIPE_SECRET_KEY:process.env.STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET:process.env.STRIPE_WEBHOOK_SECRET,WEB_ORIGIN:process.env.WEB_ORIGIN};
   try{
    process.env.STRIPE_SECRET_KEY='sk_test_local_reseller';process.env.STRIPE_WEBHOOK_SECRET='whsec_local_reseller';process.env.WEB_ORIGIN='http://localhost:3000';
    await reseller.send('cart','POST',{variantId,quantity:1});const received=(await reseller.send('checkout','POST',{email:account.email,address,paymentMethod:'online',idempotencyKey:randomUUID()})).data;
    let order=(await owner.send('admin/orders/'+received.id)).data;assert.equal(order.review_status,'pending');
    order=(await owner.send('admin/orders/'+received.id+'/approve','POST',{version:order.version})).data;
    assert.equal((await guest.send('orders/'+received.id+'/payment','POST',{},received.token)).status,404);assert.equal((await regular.send('orders/'+received.id+'/payment','POST',{},received.token)).status,404);
    let providerAmount=-1;
    const payment=await startOrderPayment(db,received.id,{customerId:resellerId},{start:async bill=>{providerAmount=bill.total;return {reference:'cs_reseller_local',url:'https://example.invalid/local-checkout'}},retrieve:async()=>{throw Error('Unexpected provider call')}});
    assert.equal(payment.checkoutUrl,'https://example.invalid/local-checkout');assert.equal(providerAmount,order.approved_bill.total);assert.equal(providerAmount,4550); // Updated reseller base 4500 minus fixed 200, plus delivery 250.
   }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
  });
  await t.test('resellers cannot use regular recovery or old reset tokens; owner resets revoke sessions',async()=>{
   const before=(await db.query('SELECT count(*)::int AS count FROM account_reset_tokens WHERE customer_id=$1',[resellerId])).rows[0].count;
   assert.equal((await reseller.send('auth/forgot-password','POST',{email:account.email})).status,200);assert.equal((await db.query('SELECT count(*)::int AS count FROM account_reset_tokens WHERE customer_id=$1',[resellerId])).rows[0].count,before);
   const token='old-reseller-reset-token-'+randomUUID();await db.query("INSERT INTO account_reset_tokens(token_hash,customer_id,expires_at) VALUES ($1,$2,now()+interval '30 minutes')",[digest(token),resellerId]);
   assert.equal((await reseller.send('auth/reset-password','POST',{token,password:'Unauthorized-New-Password!'})).status,400);
   assert.equal((await owner.send('admin/resellers/'+resellerId,'PUT',{...account,password:'Owner-Reset-Password!'})).status,200);assert.equal((await reseller.send('auth/me')).status,401);
   assert.equal((await reseller.send('auth/reseller/login','POST',{email:account.username,password:account.password})).status,401);assert.equal((await reseller.send('auth/reseller/login','POST',{email:account.username,password:'Owner-Reset-Password!'})).status,200);
   const noPassword={...account,password:undefined,active:false};assert.equal((await owner.send('admin/resellers/'+resellerId,'PUT',noPassword)).status,200);assert.equal((await reseller.send('auth/me')).status,401);assert.equal((await reseller.send('orders/'+created.id,'GET',undefined,created.token)).status,404);assert.equal((await reseller.send('catalogue')).data.pricingTier,'regular');assert.equal((await reseller.send('auth/reseller/login','POST',{email:account.username,password:'Owner-Reset-Password!'})).status,401);
   await owner.send('admin/resellers/'+resellerId,'PUT',{...noPassword,active:true});assert.equal((await reseller.send('auth/me')).status,401);assert.equal((await reseller.send('auth/reseller/login','POST',{email:account.username,password:'Owner-Reset-Password!'})).status,200);
  });
 }finally{await app.close();await db.close()}
});
