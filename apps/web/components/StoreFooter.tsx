'use client';
import Brand from '@ms/shared/src/Brand';
import {MessageCircle,Mail,MapPin,Package,ShieldCheck} from 'lucide-react';
import type {StoreSettings} from '../lib/catalogue';
import {whatsAppLink} from '../lib/store';

export default function StoreFooter({settings}:{settings:StoreSettings}){
 const whatsapp=whatsAppLink(settings.supportWhatsApp,'Hello '+settings.name+', I need help with shopping.');
 return <>
  <section className='support-band' aria-label='Customer support'><div><MessageCircle size={32}/><span><strong>A little help goes a long way.</strong><p>Questions about a product or an order? We are here for you.</p></span></div><a className='secondary' href={whatsapp||'/help/contact'} target={whatsapp?'_blank':undefined} rel='noopener noreferrer'>Talk to our team</a></section>
  <footer className='store-footer'>
   <div className='footer-story'><a className='brand' href='/' aria-label='MS Collection home'><Brand logo={settings.logo}/></a><p>Fashion, beauty, home and everything in between. Discover good finds for the way you live.</p><span className='footer-market'><MapPin size={15}/>{settings.country} / {settings.currency}</span></div>
   <div className='footer-column'><strong>Discover</strong><a href='/#products'>Shop all products</a><a href='/?sort=newest#products'>New arrivals</a><a href='/collections'>Our collections</a><a href='/?sale=true#products'>The sale edit</a><a href='/account'>Your account</a><a href='/reseller'>Reseller sign in</a></div>
   <div className='footer-column'><strong>Customer care</strong><a href='/help/contact'>Contact & support</a><a href='/account'>Track your orders</a><a href='/help/delivery'>Delivery information</a><a href='/help/returns'>Returns & exchanges</a><a href='/help/privacy'>Privacy policy</a><a href='/help/terms'>Terms of service</a></div>
   <div className='footer-column'><strong>Stay in touch</strong>{whatsapp&&<a className='footer-contact' href={whatsapp} target='_blank' rel='noopener noreferrer'><MessageCircle size={17}/><span>WhatsApp support<small>{settings.supportWhatsApp}</small></span></a>}{settings.supportEmail&&<a className='footer-contact' href={'mailto:'+settings.supportEmail}><Mail size={17}/>{settings.supportEmail}</a>}<p>{settings.businessAddress||'For sizing advice, product details and order enquiries, our support team is a message away.'}</p><span className='footer-market'><Package size={15}/>Cash on delivery</span></div>
   <div className='footer-bottom'><span>&copy; {new Date().getFullYear()} {settings.name}</span><span>{settings.storeMode!=='live'?'Preview store / sample inventory':'Shopping with care, delivered across '+settings.country}</span><a href={process.env.NEXT_PUBLIC_ADMIN_URL||'http://localhost:3001'}>Store administration</a></div>
  </footer>
  {whatsapp&&<a className='whatsapp-float' aria-label='Chat with WhatsApp support' href={whatsapp} target='_blank' rel='noopener noreferrer'><MessageCircle size={24}/></a>}
 </>;
}
