import type { Metadata } from 'next';
import './store.css';
import './orders.css';
import '@ms/shared/src/billing.css';
import './billing.css';
export const metadata:Metadata={metadataBase:new URL(process.env.WEB_ORIGIN||'http://localhost:3000'),title:'MS Collection | Everyday. Elevated.',description:'Shop clothing, shoes, beauty, accessories, electronics and home essentials at MS Collection. Thoughtfully chosen products, delivered across Pakistan.',openGraph:{type:'website',siteName:'MS Collection',locale:'en_PK',title:'MS Collection | Everyday. Elevated.',description:'Discover considered pieces for your wardrobe, home and everyday life.'},twitter:{card:'summary',title:'MS Collection | Everyday. Elevated.'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
