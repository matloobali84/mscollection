import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database,Queryable,Row} from './db';
import {problem} from './auth';
import {catalogue} from './catalogue';
import {orderEditInput,orderApprovalInput} from '../../../packages/shared/src/platform';
import {calculateBill} from '../../../packages/shared/src/billing';
import {editableOrderStatuses,orderQueues} from '../../../packages/shared/src/orders';

export async function orderDetails(db:Queryable,id:string,customer=false){
 const order=(await db.query('SELECT * FROM orders WHERE id=$1 FOR SHARE',[id])).rows[0];if(!order)problem(404,'Order not found');
 for(const field of ['access_token_hash','idempotency_key','cart_id','request_hash'])delete order[field];
 const items=(await db.query(customer?'SELECT id,name_snapshot,variant_snapshot,description_snapshot,price_snapshot,quantity FROM order_items WHERE order_id=$1 ORDER BY id':'SELECT * FROM order_items WHERE order_id=$1 ORDER BY id',[id])).rows;
 const events=(await db.query('SELECT id,status,message,created_at FROM order_events WHERE order_id=$1 ORDER BY created_at,id',[id])).rows;
 let bill;try{bill=billSnapshot(order,items)}catch{bill={subtotal:order.subtotal,shipping:order.shipping,tax:order.tax,total:order.total,originalTotal:order.original_total,items}}
 if(customer){delete order.notes;delete order.customer_id;delete order.version;delete order.pricing_settings;delete order.approved_by;delete order.payment_email;delete order.payment_started_at;delete order.reseller_id;delete order.reseller_username_snapshot;}
 if(customer){const published=order.review_status==='approved'?(order.approved_bill||order.original_bill||bill):bill;const output={...order,subtotal:published.subtotal,shipping:published.shipping,tax:published.tax,total:published.total,discount_amount:published.discountAmount||0,discount_type:published.discount?.type||'none',discount_value:published.discount?.value||0,additional_charges:published.additionalCharges||[],additional_charges_total:published.additionalChargesTotal||0,adjustment_amount:published.adjustmentAmount||0,bill:published,items:published.items,events};for(const field of ['original_bill','approved_bill','shipping_override','total_override','adjustment_reason','bill_revision'])delete (output as Row)[field];return output}
 const activePayment=!!order.payment_started_at||(await db.query('SELECT id FROM payments WHERE order_id=$1 AND provider_ref IS NOT NULL LIMIT 1',[id])).rows.length>0;
 return {...order,items,events,bill,canEditBill:editableOrderStatuses.includes(order.status)&&order.payment_status!=='paid'&&!activePayment,canReopenReview:editableOrderStatuses.includes(order.status)&&order.payment_status!=='paid'&&!activePayment};
}

export async function listOrders(db:Queryable,query:unknown){
 const input=z.object({view:z.literal('queue'),queue:z.enum(['undispatched','new','pending','dispatched','in_transit','delivered','closed','all']).default('undispatched'),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),search:z.string().trim().max(200).default(''),sort:z.enum(['newest','oldest']).default('newest'),buyer:z.enum(['all','regular','reseller']).default('all'),resellerId:z.string().max(100).optional()}).parse(query);
 const values:any[]=[];const clauses:string[]=[];
 if(input.buyer!=='all'){values.push(input.buyer);clauses.push('pricing_tier=$'+values.length);}
 if(input.resellerId){values.push(input.resellerId);clauses.push('reseller_id=$'+values.length);}
 const filterClauses=[...clauses],filterValues=[...values];
 const queue=orderQueues.find(queue=>queue.key===input.queue);
 if(queue){values.push([...queue.statuses]);clauses.push('status=ANY($'+values.length+'::text[])');}
 if(input.search){values.push('%'+input.search.replace(/[\\%_]/g,'\\$&')+'%');const param='$'+values.length;clauses.push("(number ILIKE "+param+" OR email ILIKE "+param+" OR shipping_address->>'name' ILIKE "+param+" OR shipping_address->>'phone' ILIKE "+param+" OR tracking_id ILIKE "+param+" OR courier ILIKE "+param+")");}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const total=Number((await db.query('SELECT count(*)::int AS count FROM orders'+where,values)).rows[0].count);
 const page=Math.min(input.page,Math.max(1,Math.ceil(total/input.limit)));
 const orders=(await db.query('SELECT id,number,email,status,payment_status,payment_method,total,currency,shipping_address,courier,tracking_id,review_status,original_total,discount_amount,pricing_tier,reseller_id,reseller_username_snapshot,created_at,updated_at,version FROM orders'+where+' ORDER BY created_at '+(input.sort==='oldest'?'ASC':'DESC')+',id LIMIT $'+(values.length+1)+' OFFSET $'+(values.length+2),[...values,input.limit,(page-1)*input.limit])).rows;
 const statuses=(await db.query('SELECT status,count(*)::int AS count FROM orders'+(filterClauses.length?' WHERE '+filterClauses.join(' AND '):'')+' GROUP BY status',filterValues)).rows;
 const counts:Record<string,number>={all:statuses.reduce((sum,row)=>sum+row.count,0)};
 for(const queue of orderQueues)counts[queue.key]=statuses.filter(row=>(queue.statuses as readonly string[]).includes(row.status)).reduce((sum,row)=>sum+row.count,0);
 return {orders,counts,total,page,limit:input.limit};
}

export function billSnapshot(order:Row,items:Row[]){
 const policy=order.pricing_settings;
 const bill=calculateBill({items:items.map(item=>({quantity:item.quantity,unitPrice:item.price_snapshot})),shipping:order.shipping_override??(policy?undefined:(order.original_bill?.shipping??order.shipping)),shippingPolicy:policy||undefined,taxPercent:policy?.taxPercent,legacyTax:policy?undefined:{subtotal:order.original_bill?.subtotal??order.subtotal,tax:order.original_bill?.tax??order.tax},discount:{type:order.discount_type||'none',value:Number(order.discount_value||0)},charges:order.additional_charges||[],totalOverride:order.total_override,adjustmentReason:order.adjustment_reason});
 return {...bill,discount:{type:order.discount_type||'none',value:Number(order.discount_value||0)},additionalCharges:order.additional_charges||[],adjustmentReason:order.adjustment_reason||'',originalTotal:order.original_total??order.total,revision:order.bill_revision||1,reference:order.number+'/B'+(order.bill_revision||1),items:items.map(item=>({id:item.id,name_snapshot:item.name_snapshot,variant_snapshot:item.variant_snapshot,description_snapshot:item.description_snapshot||'',price_snapshot:item.price_snapshot,quantity:item.quantity}))};
}
function billError(error:unknown):never{return problem(400,error instanceof Error?error.message:'Invalid bill amounts.')}
async function recordAudit(tx:Queryable,adminId:string,id:string,action:string,diff:unknown){
 await tx.query('INSERT INTO audit_logs(id,admin_user_id,action,entity,entity_id,diff) VALUES ($1,$2,$3,$4,$5,$6)',[randomUUID(),adminId,action,'orders',id,JSON.stringify(diff)]);
 await tx.query("UPDATE malls SET revision=revision+1,updated_at=now() WHERE id='main'");
}
export async function editOrder(db:Database,id:string,raw:unknown,adminId:string){
 const input=orderEditInput.parse(raw);
 return db.transaction(async tx=>{
  const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)problem(404,'Order not found');
  if(order.version!==input.version)problem(409,'This order changed. Reload its latest details before saving.');
  if(!editableOrderStatuses.includes(order.status))problem(409,'Order details can only be edited before dispatch.');
  const oldItems=(await tx.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id',[id])).rows;
  for(const item of input.items)if(item.id&&!oldItems.some(old=>old.id===item.id&&old.variant_id===item.variantId))problem(400,'Order item does not belong to this order or variant.');
  const lineChanged=input.items.length!==oldItems.length||input.items.some(item=>!oldItems.some(old=>old.id===item.id&&old.variant_id===item.variantId&&old.quantity===item.quantity&&(item.unitPrice===undefined||item.unitPrice===old.price_snapshot)&&(item.name===undefined||item.name===old.name_snapshot)&&(item.description===undefined||item.description===old.description_snapshot)&&(item.variantLabel===undefined||item.variantLabel===old.variant_snapshot)));
  const discount=input.discount||{type:order.discount_type,value:Number(order.discount_value)},charges=input.additionalCharges??order.additional_charges,shippingOverride=input.shippingOverride===undefined?order.shipping_override:input.shippingOverride,totalOverride=input.totalOverride===undefined?order.total_override:input.totalOverride,reason=input.adjustmentReason??order.adjustment_reason;
  const financialChange=lineChanged||discount.type!==order.discount_type||discount.value!==Number(order.discount_value)||(charges.length!==order.additional_charges.length||charges.some((charge:any,index:number)=>charge.label!==order.additional_charges[index]?.label||charge.amount!==order.additional_charges[index]?.amount))||shippingOverride!==order.shipping_override||totalOverride!==order.total_override||reason!==order.adjustment_reason;
  if(financialChange&&order.payment_status==='paid')problem(409,'Paid bills cannot be rewritten.');
  if(financialChange&&order.payment_method==='online'&&(order.payment_started_at||(await tx.query('SELECT id FROM payments WHERE order_id=$1 AND provider_ref IS NOT NULL LIMIT 1',[id])).rows.length))problem(409,'An online payment session already exists. Reconcile it before changing the bill.');
  let snapshots=oldItems;
  if(lineChanged){
   const ids=[...new Set([...oldItems.flatMap(item=>item.variant_id?[item.variant_id]:[]),...input.items.flatMap(item=>item.variantId?[item.variantId]:[])])].sort();
   const locked=ids.length?(await tx.query('SELECT id,stock FROM product_variants WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[ids])).rows:[];
   const data=await catalogue(tx,false,order.pricing_tier||'regular',order.pricing_settings?.resellerFallback);snapshots=[];
   for(const item of input.items){
    const old=oldItems.find(old=>old.id===item.id);let product:Row|undefined,variant:Row|undefined;
    if(item.variantId){
     product=data.products.find(product=>product.variants.some((variant:Row)=>variant.id===item.variantId));variant=product?.variants.find((variant:Row)=>variant.id===item.variantId);
     if(!old&&(!product||!variant))problem(409,'A selected product is no longer available.');
     if(!old&&product!.currency!==order.currency)problem(409,'New items must use the original order currency.');
     const reserved=oldItems.filter(old=>old.variant_id===item.variantId).reduce((sum,old)=>sum+old.quantity,0),stock=locked.find(variant=>variant.id===item.variantId)?.stock;
     if(stock===undefined||item.quantity>stock+reserved)problem(409,'Insufficient stock for '+(old?.name_snapshot||product?.name||'an item'));
     if(old&&item.quantity>reserved&&!product)problem(409,'An unavailable product cannot be increased.');
    }
    snapshots.push({id:old?.id||randomUUID(),product_id:old?.product_id||product?.id||null,variant_id:item.variantId,name_snapshot:item.name??old?.name_snapshot??product?.name,description_snapshot:item.description??old?.description_snapshot??'',variant_snapshot:item.variantLabel??old?.variant_snapshot??(variant?variant.size+' / '+variant.color:'Service / custom item'),price_snapshot:item.unitPrice??old?.price_snapshot??variant?.unitPrice??product?.effectivePrice??product?.price,quantity:item.quantity});
   }
   for(const variantId of ids){const before=oldItems.filter(item=>item.variant_id===variantId).reduce((sum,item)=>sum+item.quantity,0),after=input.items.filter(item=>item.variantId===variantId).reduce((sum,item)=>sum+item.quantity,0);await tx.query('UPDATE product_variants SET stock=stock+$1 WHERE id=$2',[before-after,variantId]);}
  }
  const candidate={...order,discount_type:discount.type,discount_value:discount.value,additional_charges:charges,shipping_override:shippingOverride,total_override:totalOverride,adjustment_reason:reason,bill_revision:order.bill_revision+(financialChange?1:0)};
  let bill;try{bill=billSnapshot(candidate,snapshots)}catch(error){billError(error)}
  if(lineChanged){
   await tx.query('DELETE FROM order_items WHERE order_id=$1',[id]);
   for(const item of snapshots)await tx.query('INSERT INTO order_items(id,order_id,product_id,variant_id,name_snapshot,variant_snapshot,description_snapshot,price_snapshot,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[item.id,id,item.product_id,item.variant_id,item.name_snapshot,item.variant_snapshot,item.description_snapshot,item.price_snapshot,item.quantity]);
  }
  await tx.query('UPDATE orders SET email=$1,shipping_address=$2,notes=$3,subtotal=$4,shipping=$5,tax=$6,total=$7,discount_type=$8,discount_value=$9,discount_amount=$10,additional_charges=$11,additional_charges_total=$12,shipping_override=$13,total_override=$14,adjustment_reason=$15,adjustment_amount=$16,bill_revision=$17,version=version+1,updated_at=now() WHERE id=$18',[input.email.toLowerCase(),JSON.stringify(input.address),input.notes,bill.subtotal,bill.shipping,bill.tax,bill.total,discount.type,discount.value,bill.discountAmount,JSON.stringify(charges),bill.additionalChargesTotal,shippingOverride,totalOverride,reason,bill.adjustmentAmount,candidate.bill_revision,id]);
  if(financialChange)await tx.query("UPDATE payments SET amount=$1 WHERE order_id=$2 AND status<>'paid'",[bill.total,id]);
  if(financialChange&&order.review_status==='approved'){
   // Publish the saved revision in the same transaction without interrupting fulfilment.
   await tx.query("UPDATE orders SET approved_bill=$1,approved_at=now(),approved_by=$2,payment_status=CASE WHEN total=0 THEN 'paid' ELSE payment_status END WHERE id=$3",[JSON.stringify(bill),adminId,id]);
   if(bill.total===0)await tx.query("UPDATE payments SET status='paid' WHERE order_id=$1",[id]);
   await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),id,order.status,'Final bill updated by the store']);
  }
  await recordAudit(tx,adminId,id,'edit_before_dispatch',{previousVersion:order.version,financialChange,previousTotal:order.total,total:bill.total,previousItems:oldItems,items:snapshots,discount,charges,shippingOverride,totalOverride,adjustmentReason:reason,billRevision:candidate.bill_revision});
  return orderDetails(tx,id);
 });
}
export async function approveOrder(db:Database,id:string,raw:unknown,adminId:string){
 const input=orderApprovalInput.parse(raw);
 return db.transaction(async tx=>{
  const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)problem(404,'Order not found');
  if(order.version!==input.version)problem(409,'This order changed. Reload its latest details before confirming.');
  if(!editableOrderStatuses.includes(order.status))problem(409,'This order cannot be confirmed at its current stage.');
  if(order.review_status==='approved')return orderDetails(tx,id);
  const items=(await tx.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id',[id])).rows;let bill;
  try{bill=billSnapshot(order,items)}catch(error){billError(error)}
  if(bill.total!==order.total)problem(409,'The saved bill totals do not match. Edit and save the bill before confirming.');
  await tx.query("UPDATE orders SET review_status='approved',status='confirmed',approved_at=now(),approved_by=$1,approved_bill=$2,payment_status=CASE WHEN total=0 THEN 'paid' ELSE payment_status END,version=version+1,updated_at=now() WHERE id=$3",[adminId,JSON.stringify(bill),id]);
  await tx.query("UPDATE payments SET amount=$1,status=CASE WHEN $1=0 THEN 'paid' ELSE status END WHERE order_id=$2",[bill.total,id]);
  await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),id,'confirmed','Order confirmed. Final bill approved.']);
  await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'order-approved',JSON.stringify({to:order.email,number:order.number,orderId:id,total:bill.total,originalTotal:order.original_total,discount:bill.discountAmount,currency:order.currency,paymentMethod:order.payment_method})]);
  await recordAudit(tx,adminId,id,'approve_bill',{billRevision:order.bill_revision,total:bill.total,originalTotal:order.original_total});
  return orderDetails(tx,id);
 });
}
export async function reopenOrderReview(db:Database,id:string,raw:unknown,adminId:string){
 const input=orderApprovalInput.parse(raw);
 return db.transaction(async tx=>{
  const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)problem(404,'Order not found');
  if(order.version!==input.version)problem(409,'This order changed. Reload its latest details before reopening review.');
  if(!editableOrderStatuses.includes(order.status)||order.payment_status==='paid')problem(409,'Only an unpaid order before dispatch can be reopened for pricing review.');
  if(order.review_status==='pending')return orderDetails(tx,id);
  if(order.payment_method==='online'&&(order.payment_started_at||(await tx.query('SELECT id FROM payments WHERE order_id=$1 AND provider_ref IS NOT NULL',[id])).rows.length))problem(409,'An online payment session already exists. Reconcile it with the provider before changing the approved bill.');
  await tx.query("UPDATE orders SET review_status='pending',status='pending',approved_at=null,approved_by=null,approved_bill=null,version=version+1,updated_at=now() WHERE id=$1",[id]);
  await tx.query('INSERT INTO order_events(id,order_id,status,message) VALUES ($1,$2,$3,$4)',[randomUUID(),id,'pending','Order returned for bill review']);
  await recordAudit(tx,adminId,id,'reopen_bill_review',{previousBillRevision:order.bill_revision,previousApprovedBill:order.approved_bill});
  return orderDetails(tx,id);
 });
}
