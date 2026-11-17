import {shops,products,isVisible,onSale} from '@ms/shared';
export const dynamic='force-static';
export function generateStaticParams(){return shops.filter(s=>isVisible(s)).map(s=>({slug:s.slug}));}
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;const shop=shops.find(s=>s.slug===slug&&isVisible(s));if(!shop)return Response.json({error:'Shop not found'},{status:404});return Response.json({shop,products:products.filter(p=>p.shopId===shop.id).map((p,i)=>({...p,displayPoint:onSale(p)?`sale_${String(i+1).padStart(2,'0')}`:`${shop.template==='clothing'?'rack':'shelf'}_${String(i+1).padStart(2,'0')}`}))});}
