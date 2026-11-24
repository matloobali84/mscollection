import type {MetadataRoute} from 'next';
import {getStoreSettings} from '../lib/catalogue';
export const dynamic='force-dynamic';
export default async function robots():Promise<MetadataRoute.Robots>{const settings=await getStoreSettings(),origin=process.env.WEB_ORIGIN||'http://localhost:3000';return {rules:{userAgent:'*',allow:settings.storeMode==='live'?'/':undefined,disallow:settings.storeMode==='live'?['/account','/orders/','/api/','/admin/']:['/']},sitemap:`${origin}/sitemap.xml`}}
