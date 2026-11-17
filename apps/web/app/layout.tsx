import type { Metadata } from 'next';
import './globals.css';
import './ui.css';
export const metadata:Metadata={title:'MS Collection — A new way to wander',description:'Step inside MS Collection. Explore our virtual mall and discover thoughtfully curated clothing and jewellery.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
