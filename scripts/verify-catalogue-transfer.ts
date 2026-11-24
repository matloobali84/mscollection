import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../apps/api/src/db';
import {seed} from '../apps/api/src/seed';
import {catalogue} from '../apps/api/src/catalogue';
import {restoreCatalogue} from '../apps/api/src/catalogue-transfer';
async function main(){
 const bundle=JSON.parse(await readFile(process.argv[2]||'outputs/deployment-catalogue/catalogue.json','utf8'));
 const db=await openDatabase(true);
 try{
  await migrate(db);await seed(db,false);const counts=await restoreCatalogue(db,bundle),result=await catalogue(db,true);
  assert.equal(result.products.length,bundle.products.length);assert.equal(result.shops.length,bundle.shops.length);
  for(const p of bundle.products){const restored=result.products.find(row=>row.id===p.id)!;assert.ok(restored);assert.equal(restored.image,p.image);assert.equal(restored.price,p.price);assert.deepEqual(restored.variants.map((v:any)=>({id:v.id,stock:v.stock,priceOverride:v.priceOverride})),p.variants.map((v:any)=>({id:v.id,stock:v.stock,priceOverride:v.priceOverride})))}
  assert.equal(result.settings.supportWhatsApp,bundle.settings.supportWhatsApp);
  console.log('PASS: current catalogue round-trip preserves products, variant IDs, prices, media, stock and support settings.',counts);
 }finally{await db.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
