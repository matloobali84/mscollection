import type {Database} from './db';
import {catalogue} from './catalogue';
export async function launchReadiness(db:Database){
 const data=await catalogue(db),s=data.settings;
 const online=!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET;
 const checks=[
  {key:'catalogue',label:'Active collections and stocked products',status:data.shops.length&&data.products.some(p=>p.stock>0)?'ready':'action',detail:`${data.shops.length} shops · ${data.floors.length} floors · ${data.products.length} products`},
  {key:'market',label:'Selling market',status:s.country&&s.currency?'ready':'action',detail:`${s.country} / ${s.currency}`},
  {key:'support',label:'Customer support',status:s.supportWhatsApp||s.supportEmail?'ready':'action',detail:s.supportWhatsApp?'WhatsApp contact configured':s.supportEmail?'Support email configured':'Add support details in Mall settings.'},
  {key:'policies',label:'Store policies',status:[s.deliveryPolicy,s.returnsPolicy,s.privacyPolicy,s.termsPolicy].every(Boolean)?'ready':'action',detail:'Publish your delivery, return, privacy and terms content in Mall settings.'},
  {key:'database',label:'Production PostgreSQL',status:process.env.DATABASE_URL?'ready':'action',detail:process.env.DATABASE_URL?'External PostgreSQL configured':'Local embedded database; deploy with persistent PostgreSQL.'},
  {key:'media',label:'Persistent product media',status:process.env.S3_BUCKET||process.env.LOCAL_MEDIA_STORAGE==='true'?'ready':'action',detail:process.env.S3_BUCKET?'Object storage configured':process.env.LOCAL_MEDIA_STORAGE==='true'?'Local media provider enabled; retain and back up its mounted volume.':'Configure object storage or the persistent Docker media volume.'},
  {key:'email',label:'Order and account emails',status:process.env.SMTP_HOST?'ready':'action',detail:process.env.SMTP_HOST?'SMTP configured; verify real delivery before launch.':'Email is saved locally. Configure SMTP to deliver to customers.'},
  {key:'domain',label:'Live HTTPS address',status:/^https:\/\//.test(process.env.WEB_ORIGIN||'')?'ready':'action',detail:/^https:\/\//.test(process.env.WEB_ORIGIN||'')?'HTTPS storefront URL configured':'Set your domain and WEB_ORIGIN on the production host.'},
  {key:'payments',label:'Payment methods',status:'ready',detail:online?'Cash on delivery and online provider configured; verify the provider in test mode.':'Cash on delivery available. Online payments can be added with eligible provider credentials.'},
  {key:'sample',label:'Merchant inventory',status:data.products.some(p=>p.slug.startsWith('demo-')||/^(clothing|jewellery)-\d+$/.test(p.id))?'warning':'ready',detail:'Replace illustrative products, photos, prices and stock with your actual inventory before accepting real orders.'},
  {key:'mode',label:'Store mode',status:s.storeMode==='live'?'ready':'warning',detail:s.storeMode==='live'?'Live storefront mode selected':'Demo mode is visible to shoppers; change it after reviewing launch settings.'},
 ];
 return {ready:checks.every(c=>c.status==='ready'),checks,counts:{collections:data.shops.length,products:data.products.length},checkedAt:new Date().toISOString()};
}
