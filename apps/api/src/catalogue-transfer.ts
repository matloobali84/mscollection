import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database,Queryable} from './db';
import {floorInput,slotInput,shopInput,categoryInput,productInput,entityInput,saleInput,settingsInput} from '../../../packages/shared/src/platform';
import {catalogue} from './catalogue';
const id=z.string().min(1).max(100);
// Owner CLI operation for an empty, freshly seeded deployment only.
export async function restoreCatalogue(db:Database,raw:unknown){
 const bundle=z.object({version:z.literal(1),settings:settingsInput,floors:z.array(z.any()).max(100),slots:z.array(z.any()).max(800),shops:z.array(z.any()).max(800),categories:z.array(z.any()).max(1000),products:z.array(z.any()).max(10000),entities:z.array(z.any()).max(5000),sales:z.array(z.any()).max(10000)}).parse(raw);
 const floors=bundle.floors.map(f=>({id:id.parse(f.databaseId||f.id),...floorInput.parse({...f,level:f.level??f.id})}));
 const slots=bundle.slots.map(s=>({id:id.parse(s.id),...slotInput.parse({...s,floorId:s.floor_id||s.floorId})}));
 const shops=bundle.shops.map(s=>({id:id.parse(s.id),...shopInput.parse(s)}));
 const categories=bundle.categories.map(c=>({id:id.parse(c.id),...categoryInput.parse({...c,parentId:c.parent_id||c.parentId||null,sortOrder:c.sort_order??c.sortOrder??0})}));
 const products=bundle.products.map(p=>({id:id.parse(p.id),...productInput.parse(p)}));
 const entities=bundle.entities.map(e=>({id:id.parse(e.id),...entityInput.parse(e)}));
 const sales=bundle.sales.map(s=>({id:id.parse(s.id),...saleInput.parse({...s,productId:s.product_id||s.productId,startsAt:new Date(s.starts_at||s.startsAt).toISOString(),endsAt:new Date(s.ends_at||s.endsAt).toISOString()})}));
 await db.transaction(async tx=>{
  const totals=(await tx.query("SELECT (SELECT count(*) FROM customers)::int AS customers,(SELECT count(*) FROM orders)::int AS orders,(SELECT count(*) FROM shops WHERE id NOT IN ('clothing','jewellery'))::int AS custom_shops,(SELECT count(*) FROM products WHERE id !~ '^(clothing|jewellery)-[0-9]+$')::int AS custom_products")).rows[0];
  if(totals.customers||totals.orders||totals.custom_shops||totals.custom_products)throw Error('Catalogue restore requires a fresh deployment with no customer/order or custom catalogue data. Use normal Admin tools for a running store.');
  await tx.query('TRUNCATE product_media,product_variants,product_sales,products,scene_entities,shops,slots,floors,categories CASCADE');
  async function insert(table:string,row:Record<string,unknown>){const keys=Object.keys(row);await tx.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})`,Object.values(row))}
  for(const f of floors)await insert('floors',{id:f.id,name:f.name,level:f.level,layout:f.layout,sort_order:f.sortOrder,active:f.active});
  for(const s of slots)await insert('slots',{id:s.id,floor_id:s.floorId,key:s.key,label:s.label});
  for(const c of categories)await insert('categories',{id:c.id,name:c.name,slug:c.slug,parent_id:null,sort_order:c.sortOrder,active:c.active});
  for(const c of categories)if(c.parentId)await tx.query('UPDATE categories SET parent_id=$1 WHERE id=$2',[c.parentId,c.id]);
  for(const s of shops)await insert('shops',{id:s.id,name:s.name,slug:s.slug,tagline:s.tagline,category:s.category,floor_id:s.floorId,slot_id:s.slotId,template:s.template,color:s.color,logo:s.logo,interior_style:s.interiorStyle,active:s.active});
  for(const p of products){
   await insert('products',{id:p.id,shop_id:p.shopId,category_id:p.categoryId,name:p.name,slug:p.slug,description:p.description,price:p.price,currency:p.currency,status:p.status,gender:p.gender,age_group:p.ageGroup,display_group:p.displayGroup,display_order:p.displayOrder,featured:p.featured,image:p.image,model_url:p.modelUrl,model_scale:p.modelScale});
   for(const v of p.variants)await insert('product_variants',{id:v.id||randomUUID(),product_id:p.id,sku:v.sku,size:v.size,color:v.color,stock:v.stock,price_override:v.priceOverride,active:true});
   for(const [i,m] of p.media.entries())await insert('product_media',{id:randomUUID(),product_id:p.id,url:m.url,alt_text:m.alt,variants:JSON.stringify(m.variants),sort_order:i});
  }
  for(const e of entities)await insert('scene_entities',{id:e.id,name:e.name,kind:e.kind,floor_id:e.floorId,shop_id:e.shopId,product_id:e.productId,model_url:e.modelUrl,x:e.x,y:e.y,z:e.z,yaw:e.yaw,scale:e.scale,animation:e.animation,active:e.active});
  for(const s of sales)await insert('product_sales',{id:s.id,product_id:s.productId,price:s.price,starts_at:s.startsAt,ends_at:s.endsAt,pinned:s.pinned,active:s.active});
  await tx.query("UPDATE malls SET settings=$1,revision=revision+1,updated_at=now() WHERE id='main'",[JSON.stringify(bundle.settings)]);
  const owner=(await tx.query("SELECT id FROM admin_users WHERE role='super_admin' AND active=true LIMIT 1")).rows[0];
  if(owner)await tx.query('INSERT INTO audit_logs(id,admin_user_id,action,entity,entity_id,diff) VALUES ($1,$2,$3,$4,$5,$6)',[randomUUID(),owner.id,'restore-catalogue','malls','main',JSON.stringify({products:products.length,shops:shops.length})]);
 });
 const result=await catalogue(db);return {shops:result.shops.length,products:result.products.length,floors:result.floors.length};
}
