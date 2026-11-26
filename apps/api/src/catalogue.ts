import type {Queryable,Row} from './db';
import {settingsInput} from '../../../packages/shared/src/platform';
import {resolveProductPrice,type PricingTier} from '../../../packages/shared/src/pricing';
export const visibility="s.active=true AND s.deleted_at IS NULL";
export async function catalogue(db:Queryable,admin=false,tier:PricingTier='regular',fallbackOverride?:'regular_discounted'|'regular_base'){
 const [shopRows,floorRows,productRows,variants,sales,categories,mall,slots,templates,media,entities]=await Promise.all([
 db.query(`SELECT s.*,f.level FROM shops s JOIN floors f ON f.id=s.floor_id LEFT JOIN slots sl ON sl.id=s.slot_id ${admin?'WHERE s.deleted_at IS NULL':`WHERE ${visibility}`} ORDER BY f.sort_order,s.name`),
 db.query('SELECT * FROM floors ORDER BY sort_order,level'),
 db.query(`SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id JOIN floors f ON f.id=s.floor_id LEFT JOIN slots sl ON sl.id=s.slot_id WHERE p.deleted_at IS NULL ${admin?'':`AND p.status='active' AND ${visibility}`} ORDER BY p.display_order,p.created_at DESC`),
 db.query('SELECT * FROM product_variants WHERE active=true ORDER BY sku'),
 db.query('SELECT * FROM product_sales ORDER BY pinned DESC,created_at DESC'),db.query('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order,name'),db.query("SELECT * FROM malls WHERE id='main'"),db.query('SELECT * FROM slots ORDER BY key'),db.query('SELECT * FROM shop_templates'),db.query('SELECT * FROM product_media ORDER BY sort_order'),db.query('SELECT * FROM scene_entities ORDER BY created_at')]);
 const policy=settingsInput.parse(mall.rows[0]?.settings),fallback=fallbackOverride||policy.resellerFallback;
 const shops:Row[]=shopRows.rows.map(s=>({...s,interiorStyle:s.interior_style,floor:Number(s.level),floorId:s.floor_id,slot:slots.rows.find(slot=>slot.id===s.slot_id)?.key||null,slotId:s.slot_id}));
 const products:(Row & {variants:Row[]})[]=productRows.rows.map(p=>{
  const variantsForProduct=variants.rows.filter(v=>v.product_id===p.id);
  const sale=sales.rows.filter(s=>s.product_id===p.id&&s.active&&new Date(s.starts_at).getTime()<=Date.now()&&new Date(s.ends_at).getTime()>=Date.now()&&s.price<p.price).sort((a,b)=>a.price-b.price)[0];
  const saleInfo={salePrice:sale?.price,saleStart:sale?new Date(sale.starts_at).toISOString():undefined,saleEnd:sale?new Date(sale.ends_at).toISOString():undefined,salePinned:sale?.pinned||false};
  const raw={...p,price:p.price,...saleInfo};
  const vs:Row[]=variantsForProduct.map(v=>admin?{...v,priceOverride:v.price_override}:{id:v.id,sku:v.sku,size:v.size,color:v.color,stock:v.stock,...resolveProductPrice(raw,v,tier,fallback),priceOverride:tier==='regular'?v.price_override:resolveProductPrice(raw,v,tier,fallback).basePrice});
  const common={modelUrl:p.model_url,modelScale:p.model_scale,shopId:p.shop_id,categoryId:p.category_id,ageGroup:p.age_group,displayGroup:p.display_group,displayOrder:p.display_order,category:categories.rows.find(c=>c.id===p.category_id)?.name||'',sizes:[...new Set(vs.map(v=>v.size))],colors:[...new Set(vs.map(v=>v.color))],stock:vs.reduce((n,v)=>n+v.stock,0),variants:vs,media:media.rows.filter(m=>m.product_id===p.id).map(m=>({url:m.url,alt:m.alt_text,variants:m.variants}))};
  if(admin)return {...raw,...common,collectionName:shops.find(shop=>shop.id===p.shop_id)?.name||'',collectionCategory:shops.find(shop=>shop.id===p.shop_id)?.category||'',regularDiscount:p.regular_discount,resellerPrice:p.reseller_price,resellerDiscount:p.reseller_discount};
  // Explicit projection prevents future private pricing columns reaching the public API.
  const best=vs.filter(v=>v.stock>0).sort((a,b)=>a.unitPrice-b.unitPrice)[0]||vs.slice().sort((a,b)=>a.unitPrice-b.unitPrice)[0]||resolveProductPrice(raw,{},tier,fallback);
  return {id:p.id,name:p.name,slug:p.slug,description:p.description,image:p.image,currency:p.currency,status:p.status,gender:p.gender,featured:p.featured,created_at:p.created_at,...common,price:best.basePrice,effectivePrice:best.unitPrice,pricingTier:tier,salePrice:best.unitPrice<best.basePrice?best.unitPrice:undefined,saleStart:saleInfo.saleStart,saleEnd:saleInfo.saleEnd,salePinned:saleInfo.salePinned};
 });
 const floors:Row[]=floorRows.rows.map(f=>({...f,id:Number(f.level),databaseId:f.id,sortOrder:f.sort_order})).filter((f:Row)=>admin||f.active&&shops.some(s=>s.floorId===f.databaseId));
 return {entities:(admin?entities.rows:[]).filter(e=>admin||e.active&&floors.some(f=>f.databaseId===e.floor_id)&&(!e.shop_id||shops.some(s=>s.id===e.shop_id))&&(!e.product_id||products.some(p=>p.id===e.product_id))).map(e=>({...e,floorId:e.floor_id,shopId:e.shop_id,productId:e.product_id,modelUrl:e.model_url})),shops:admin?shops:shops.map(s=>({id:s.id,name:s.name,slug:s.slug,tagline:s.tagline,category:s.category,color:s.color,logo:s.logo,active:s.active})),products,floors:admin?floors:[],categories:categories.rows.filter(c=>admin||c.active),slots:admin?slots.rows:[],templates:admin?templates.rows:[],sales:admin?sales.rows:undefined,pricingTier:admin?undefined:tier,settings:admin?policy:publicSettings(policy),revision:mall.rows[0]?.revision};
}

export function publicSettings(settings:ReturnType<typeof settingsInput.parse>){const {resellerFallback,...publicPolicy}=settings;return publicPolicy}
