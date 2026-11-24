// Mirror only the original demonstration seed photos, preserving prices, variants and stock.
const fs=require('node:fs/promises');require('dotenv').config({quiet:true});
(async()=>{
 const text=await fs.readFile('.data/initial-admin.txt','utf8'),base=`http://127.0.0.1:${process.env.API_PORT||4000}/api/v1/admin/`,headers={'content-type':'application/json','x-requested-with':'MSCollection'};
 const login=await fetch(base+'login',{method:'POST',headers,body:JSON.stringify({email:process.env.ADMIN_EMAIL||text.match(/Email: (.+)/)[1].trim(),password:process.env.ADMIN_PASSWORD||text.match(/Password: (.+)/)[1].trim()})});if(!login.ok)throw Error('Owner login failed: '+login.status);const session=await login.json(),cookie=login.headers.getSetCookie().find(c=>c.startsWith('ms_admin=')).split(';')[0];
 async function api(path,method='GET',body){const form=body instanceof FormData,r=await fetch(base+path,{method,headers:{cookie,'x-requested-with':'MSCollection','x-csrf-token':session.csrf,...(body&&!form?{'content-type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined});const result=await r.json();if(!r.ok)throw Error(path+': '+JSON.stringify(result));return result}
 const products=await api('products'),source=JSON.parse(await fs.readFile('.data/demo-catalogue/source-products.json','utf8')).products;let count=0;
 for(const product of products.filter(p=>/^(clothing|jewellery)-\d+$/.test(p.id)&&/^https?:/.test(p.image))){
  let response=await fetch(product.image,{signal:AbortSignal.timeout(12000)}).catch(()=>null);
  if(!response?.ok){const pool=source.filter(p=>p.category===(product.shopId==='jewellery'?'womens-jewellery':'mens-shirts'));const image=pool[count%pool.length].images[0];response=await fetch(image,{signal:AbortSignal.timeout(12000)})}
  if(!response.ok)throw Error('Could not obtain sample photo for '+product.name);const form=new FormData();form.append('file',await response.blob(),product.slug+'.webp');const photo=await api('media','POST',form);
  await api('products/'+product.id,'PUT',{...product,image:photo.url,media:[{url:photo.url,variants:photo.variants,alt:product.name},...(product.media||[]).filter(m=>m.url!==product.image)]});count++;console.log('Local photo:',product.name);
 }
 console.log(`Localized ${count} original seed photos. Existing inventory and prices were preserved.`);
})().catch(e=>{console.error(e.message);process.exitCode=1});
