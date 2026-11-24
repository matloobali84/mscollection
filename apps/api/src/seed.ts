import {randomUUID,randomBytes} from 'node:crypto';
import {hash} from 'bcryptjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {shops,products} from '../../../packages/shared/src/index';
import type {Database} from './db';
import {root,settings} from './config';
export async function seed(db:Database,writeCredentials=true){
 if((await db.query('SELECT id FROM malls LIMIT 1')).rows.length)return;
 const password=process.env.ADMIN_PASSWORD||randomBytes(18).toString('base64url');
 if(settings.secure&&!process.env.ADMIN_PASSWORD)throw new Error('Set ADMIN_PASSWORD for initial production seed');
 const email=process.env.ADMIN_EMAIL||'owner@mscollection.local';
 await db.transaction(async tx=>{
 await tx.query('INSERT INTO malls(id,settings) VALUES ($1,$2)', ['main',JSON.stringify({name:'MS Collection',logo:'',primaryColor:'#294c3d',currency:process.env.STORE_CURRENCY||'PKR',country:process.env.STORE_COUNTRY||'Pakistan',shippingFee:250,freeShippingThreshold:10000,taxPercent:0,guestCheckout:true})]);
 await tx.query("INSERT INTO floors(id,name,level) VALUES ('ground','Ground floor',0)");
 for(const key of ['A01','A02','A03','A04','B01','B02','B03','B04'])await tx.query('INSERT INTO slots(id,floor_id,key,label) VALUES ($1,$2,$3,$4)',[`ground-${key}`,'ground',key,`Ground / ${key}`]);
 for(const key of ['clothing','jewellery','shoes','cosmetics','generic'])await tx.query('INSERT INTO shop_templates(key,name,display_point_schema) VALUES ($1,$2,$3)',[key,key[0].toUpperCase()+key.slice(1),JSON.stringify({groups:['rack','shelf','sale'],anchorFormat:'group_NN'})]);
 for(const s of shops)await tx.query('INSERT INTO shops(id,name,slug,tagline,category,floor_id,slot_id,template,color,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[s.id,s.name,s.slug,s.tagline,s.category,'ground',`ground-${s.slot}`,s.template,s.color,s.active]);
 const categories=new Map<string,string>();
 for(const p of products){if(!categories.has(p.category)){const id=randomUUID();categories.set(p.category,id);await tx.query('INSERT INTO categories(id,name,slug) VALUES ($1,$2,$3)',[id,p.category,p.category.toLowerCase()]);}
 await tx.query('INSERT INTO products(id,shop_id,category_id,name,slug,description,price,status,featured,image,display_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[p.id,p.shopId,categories.get(p.category),p.name,p.slug,p.description,p.price,'active',p.featured,p.image,products.indexOf(p)]);
 let i=0;for(const size of p.sizes)for(const color of p.colors)await tx.query('INSERT INTO product_variants(id,product_id,sku,size,color,stock) VALUES ($1,$2,$3,$4,$5,$6)',[`${p.id}-${++i}`,p.id,`${p.id}-${i}`.toUpperCase(),size,color,p.stock]);
 if(p.salePrice)await tx.query('INSERT INTO product_sales(id,product_id,price,starts_at,ends_at,pinned) VALUES ($1,$2,$3,$4,$5,$6)',[randomUUID(),p.id,p.salePrice,p.saleStart,p.saleEnd,p.featured]);
 }
 await tx.query('INSERT INTO admin_users(id,email,name,password_hash,role) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),email.toLowerCase(),'Store owner',await hash(password,12),'super_admin']);
 });
 if(!settings.secure&&writeCredentials){await mkdir(resolve(root,'.data'),{recursive:true});await writeFile(resolve(root,'.data/initial-admin.txt'),`Admin: http://localhost:3001\nEmail: ${email}\nPassword: ${password}\n\nGenerated once. Keep private. Change in Admin / Team.\n`,{mode:0o600});}
 if(writeCredentials)console.log('Database seeded. Local initial login is in .data/initial-admin.txt (not committed).');
}
