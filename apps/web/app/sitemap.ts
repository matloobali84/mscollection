import {getCatalogue} from '../lib/catalogue';
export const dynamic='force-dynamic';
export default async function sitemap(){const {shops,products}=await getCatalogue(),origin=process.env.WEB_ORIGIN||'http://localhost:3000';return [{url:origin},{url:`${origin}/collections`},...['contact','delivery','returns','privacy','terms'].map(page=>({url:`${origin}/help/${page}`})),...shops.map(c=>({url:`${origin}/collections/${c.slug}`})),...products.map(p=>({url:`${origin}/products/${p.slug}`}))]}
