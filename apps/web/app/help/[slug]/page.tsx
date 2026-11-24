import {notFound} from 'next/navigation';
import {Mail,MapPin,MessageCircle,Package,Truck} from 'lucide-react';
import {money} from '@ms/shared';
import {getStoreSettings,type StoreSettings} from '../../../lib/catalogue';
import {whatsAppLink} from '../../../lib/store';
import PageHeader from '../../../components/PageHeader';
import StoreFooter from '../../../components/StoreFooter';
export const dynamic='force-dynamic';
const pages:Record<string,{title:string;intro:string;field?:keyof StoreSettings}>={
 contact:{title:'How can we help?',intro:'Product questions, order updates or a little help with checkout. Let us point you in the right direction.'},
 delivery:{title:'Delivery information',intro:'Your next good find, delivered with care across Pakistan.',field:'deliveryPolicy'},
 returns:{title:'Returns & exchanges',intro:'Find out how to get help with a product or an order.',field:'returnsPolicy'},
 privacy:{title:'Privacy policy',intro:'Information about how this store handles your personal details.',field:'privacyPolicy'},
 terms:{title:'Terms of service',intro:'The terms that apply when shopping with MS Collection.',field:'termsPolicy'}
};
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:pages[slug]?pages[slug].title+' | MS Collection':'MS Collection'}}
export default async function Help({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,content=pages[slug];if(!content)notFound();
 const settings=await getStoreSettings(),whatsapp=whatsAppLink(settings.supportWhatsApp,'Hello '+settings.name+', I need help with '+(slug==='contact'?'an order':slug)+'.'),text=content.field?settings[content.field]:null;
 return <><main className='help-page'><PageHeader active='help'/><div className='help-layout'><section><span className='eyebrow'>CUSTOMER CARE</span><h1>{content.title}</h1><p className='help-intro'>{content.intro}</p>
  {slug==='delivery'&&<div className='care-note'><h2><Truck size={21}/> Delivery across {settings.country}</h2><p>Standard delivery: {money(settings.shippingFee,settings.currency)}.<br/>Free delivery on orders over {money(settings.freeShippingThreshold,settings.currency)}.</p></div>}
  {text?<div className='policy-copy'>{String(text)}</div>:slug!=='contact'?<div className='care-note'><h2>Need more details?</h2><p>Our team can confirm current {slug==='returns'?'return and exchange eligibility':slug==='delivery'?'delivery coverage and estimated arrival times':'store policy details'} for your order.</p><a className='text-link' href={whatsapp||'/help/contact'} target={whatsapp?'_blank':undefined} rel='noopener noreferrer'>Contact customer support</a></div>:<div className='policy-copy'><p>For the quickest help, share your order reference and a short description of what you need. You can find your order reference on the confirmation page or in your account.</p><a className='primary' href='/account'><Package size={18}/>Your account & orders</a></div>}
  <div className='help-links'>{Object.entries(pages).filter(([key])=>key!==slug).map(([key,value])=><a key={key} href={'/help/'+key}>{value.title==='How can we help?'?'Contact us':value.title}</a>)}</div></section>
  <aside className='care-card'><span className='eyebrow'>LET US HELP</span><h2>Talk to our team</h2>{whatsapp&&<a className='care-channel' href={whatsapp} target='_blank' rel='noopener noreferrer'><MessageCircle size={25}/><span><strong>WhatsApp support</strong><small>{settings.supportWhatsApp}</small></span></a>}{settings.supportEmail&&<a className='care-channel' href={'mailto:'+settings.supportEmail}><Mail size={24}/><span><strong>Email support</strong><small>{settings.supportEmail}</small></span></a>}{settings.businessAddress&&<div className='care-channel'><MapPin size={24}/><span><strong>Our business</strong><small>{settings.businessAddress}</small></span></div>}<p>For your security, keep passwords and payment codes private when speaking with support.</p></aside>
 </div></main><StoreFooter settings={settings}/></>;
}
