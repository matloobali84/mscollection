import {shops,products,isVisible} from '@ms/shared';
export const dynamic='force-static';
const origin='https://ms-collection-virtual-mall.unhurriedcanopy5.chatgpt.site';
export default function sitemap(){return [{url:origin},...shops.filter(s=>isVisible(s)).flatMap(s=>[{url:`${origin}/shops/${s.slug}`},...products.filter(p=>p.shopId===s.id).map(p=>({url:`${origin}/shops/${s.slug}/products/${p.slug}`}))])];}
