import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'dotenv';

async function main(){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const production=parse(await readFile(resolve(root,'.data/vercel-production.env')));
 const databaseUrl=production.DATABASE_URL_UNPOOLED||production.DATABASE_URL;
 if(!/^postgres(?:ql)?:\/\//.test(databaseUrl||'')||!production.BLOB_READ_WRITE_TOKEN)throw Error('Pull the production PostgreSQL and Blob credentials into .data/vercel-production.env first.');
 const credentials=await readFile(resolve(root,'.data/initial-admin.txt'),'utf8');
 const email=credentials.match(/Email: (.+)/)?.[1].trim(),password=credentials.match(/Password: (.+)/)?.[1].trim();
 if(!email||!password)throw Error('Initial owner credentials are missing; local data will not be modified.');
 Object.assign(process.env,production,{NODE_ENV:'production',DATABASE_URL:databaseUrl,ADMIN_EMAIL:email,ADMIN_PASSWORD:password,VERCEL:'1'});
 // Configuration is imported only after selecting the remote database; never open the local PGlite store here.
 const [{openDatabase,migrate},{seed},{restoreCatalogue},{storeMedia}]=await Promise.all([import('../apps/api/src/db'),import('../apps/api/src/seed'),import('../apps/api/src/catalogue-transfer'),import('../apps/api/src/media')]);
 const db=await openDatabase();
 try{
  await migrate(db);await seed(db,false);
  const totals=(await db.query("SELECT (SELECT count(*) FROM customers)::int AS customers,(SELECT count(*) FROM orders)::int AS orders,(SELECT count(*) FROM shops WHERE id NOT IN ('clothing','jewellery'))::int AS custom_shops,(SELECT count(*) FROM products WHERE id !~ '^(clothing|jewellery)-[0-9]+$')::int AS custom_products")).rows[0];
  if(totals.customers||totals.orders||totals.custom_shops||totals.custom_products)throw Error('Production already contains customer/order or custom catalogue data. Refusing to replace it.');
  const bundle=JSON.parse(await readFile(resolve(root,'outputs/deployment-catalogue/catalogue.json'),'utf8'));
  const mediaRoot=resolve(root,'.data/media'),mappingPath=resolve(root,'.data/vercel-media-map.json');
  const mapping:Record<string,string>=JSON.parse(await readFile(mappingPath,'utf8').catch(()=>'{}')),urls=new Set<string>();
  function collect(value:unknown){if(typeof value==='string'&&value.startsWith('/media/'))urls.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect)}
  collect(bundle);const pending=[...urls].filter(url=>!mapping[url]);
  for(let offset=0;offset<pending.length;offset+=6){
   const results=await Promise.allSettled(pending.slice(offset,offset+6).map(async url=>{
    if(!/^\/media\/[a-zA-Z0-9_.-]+$/.test(url))throw Error('Invalid catalogue media path');
    const filename=url.slice(7),source=resolve(mediaRoot,filename);if(dirname(source)!==mediaRoot)throw Error('Media must stay inside its directory');
    const contentType=({'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.glb':'model/gltf-binary'} as Record<string,string>)[extname(filename)]||'application/octet-stream';
    mapping[url]=await storeMedia(`import-${filename}`,await readFile(source),contentType);
   }));
   await writeFile(mappingPath,JSON.stringify(mapping),{mode:0o600});
   const failure=results.find(result=>result.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
   if(offset%60===0||offset+6>=pending.length)console.log(`Product media uploaded: ${Math.min(offset+6,pending.length)} / ${pending.length}`);
  }
  function rewrite(value:any):any{if(typeof value==='string')return mapping[value]||value;if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rewrite(v)]));return value}
  const result=await restoreCatalogue(db,rewrite(bundle));
  await writeFile(resolve(root,'.data/production-admin.txt'),`Admin: https://mscollection-rouge.vercel.app\nEmail: ${email}\nPassword: ${password}\n`,{mode:0o600});
  console.log('Production catalogue transferred; local database preserved.',{collections:result.shops,products:result.products,media:urls.size});
  console.log('Owner login saved privately to .data/production-admin.txt.');
 }finally{await db.close()}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Production bootstrap failed');process.exitCode=1});
