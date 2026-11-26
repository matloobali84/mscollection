import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {root} from './config';
import {openDatabase,migrate} from './db';
import {seed} from './seed';

test('release compatibility preserves legacy checkout writes and new quote approvals',async()=>{
 const db=await openDatabase(true);
 try{
  await migrate(db);await seed(db,false);
  const sql=await readFile(resolve(root,'deploy/legacy-checkout-compatibility.sql'),'utf8');
  const statements=[...sql.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]+?\$\$;|(?:DROP TRIGGER|CREATE TRIGGER|CREATE CONSTRAINT TRIGGER)[^;]+;/g)].map(match=>match[0]);
  assert.equal(statements.length,6);for(const statement of statements)await db.query(statement);
  const customer=randomUUID(),legacy=randomUUID(),modern=randomUUID();await db.query('INSERT INTO customers(id,email,name) VALUES ($1,$2,$3)',[customer,'legacy-release@example.invalid','Legacy release fixture']);
  await db.transaction(async tx=>{
   await tx.query("INSERT INTO orders(id,number,customer_id,email,shipping_address,subtotal,shipping,tax,total,payment_method,idempotency_key,cart_id,access_token_hash) VALUES ($1,$2,$3,$4,'{}',5000,250,0,5250,'cod',$5,$6,$7)",[legacy,'LEGACY-RELEASE',customer,'legacy-release@example.invalid',randomUUID(),randomUUID(),randomUUID()]);
   await tx.query('INSERT INTO order_items(id,order_id,product_id,variant_id,name_snapshot,variant_snapshot,price_snapshot,quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),legacy,'clothing-1','clothing-1-1','Original legacy piece','M',5000,1]);
  });
  const saved=(await db.query('SELECT * FROM orders WHERE id=$1',[legacy])).rows[0];assert.equal(saved.original_total,5250);assert.equal(saved.review_status,'approved');assert.equal(saved.original_bill.total,5250);assert.equal(saved.original_bill.items[0].price_snapshot,5000);
  await db.query('UPDATE order_items SET price_snapshot=4500 WHERE order_id=$1',[legacy]);assert.equal((await db.query('SELECT original_bill FROM orders WHERE id=$1',[legacy])).rows[0].original_bill.items[0].price_snapshot,5000);
  await db.transaction(async tx=>{
   await tx.query("INSERT INTO orders(id,number,customer_id,email,shipping_address,subtotal,shipping,tax,total,original_total,original_bill,payment_method,idempotency_key,cart_id,access_token_hash) VALUES ($1,$2,$3,$4,'{}',4000,250,0,4250,4250,$5,'cod',$6,$7,$8)",[modern,'MODERN-RELEASE',customer,'legacy-release@example.invalid',JSON.stringify({total:4250,items:[]}),randomUUID(),randomUUID(),randomUUID()]);
  });
  const current=(await db.query('SELECT * FROM orders WHERE id=$1',[modern])).rows[0];assert.equal(current.review_status,'pending');assert.equal(current.original_bill.total,4250);
 }finally{await db.close()}
});
