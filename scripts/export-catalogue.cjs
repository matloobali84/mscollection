const fs=require('node:fs/promises'),path=require('node:path');require('dotenv').config({quiet:true});
(async()=>{
 const text=await fs.readFile('.data/initial-admin.txt','utf8').catch(()=>''),base=`http://127.0.0.1:${process.env.API_PORT||4000}/api/v1/admin/`;
 const email=process.env.ADMIN_EMAIL||text.match(/Email: (.+)/)?.[1].trim(),password=process.env.ADMIN_PASSWORD||text.match(/Password: (.+)/)?.[1].trim();
 if(!email||!password)throw Error('Configure owner credentials first.');
 const r=await fetch(base+'login',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'MSCollection'},body:JSON.stringify({email,password})});if(!r.ok)throw Error('Owner login failed: '+r.status);
 const cookie=r.headers.getSetCookie().find(c=>c.startsWith('ms_admin=')).split(';')[0],bundle={version:1,exportedAt:new Date().toISOString()};
 const exportResponse=await fetch(base+'catalogue-export',{headers:{cookie}});if(!exportResponse.ok)throw Error('Catalogue export failed: '+exportResponse.status);Object.assign(bundle,await exportResponse.json());
 const products=new Set(bundle.products.map(p=>p.id)),shops=new Set(bundle.shops.map(s=>s.id));bundle.sales=bundle.sales.filter(s=>products.has(s.product_id));bundle.entities=bundle.entities.filter(e=>(!e.shopId||shops.has(e.shopId))&&(!e.productId||products.has(e.productId)));
 const destination=path.resolve('outputs/deployment-catalogue'),mediaRoot=path.resolve('.data/media');await fs.mkdir(path.join(destination,'media'),{recursive:true});
 const urls=new Set();function collect(value){if(typeof value==='string'&&value.startsWith('/media/'))urls.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect)}collect(bundle);
 for(const url of urls){if(!/^\/media\/[a-zA-Z0-9_.-]+$/.test(url))throw Error('Unsupported media path in catalogue');const filename=url.slice(7),source=path.resolve(mediaRoot,filename);if(path.dirname(source)!==mediaRoot)throw Error('Invalid media path');await fs.copyFile(source,path.join(destination,'media',filename))}
 await fs.writeFile(path.join(destination,'catalogue.json'),JSON.stringify(bundle));
 console.log(`Exported ${bundle.shops.length} collections, ${bundle.products.length} products and ${urls.size} media files to outputs/deployment-catalogue/.`);
 console.log('This transfers catalogue and store settings only. Customer accounts, orders and owner credentials stay in their original database.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
