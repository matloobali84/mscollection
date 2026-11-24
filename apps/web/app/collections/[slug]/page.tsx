import {notFound} from 'next/navigation';
import Storefront from '../../../components/Storefront';
import {getCatalogue} from '../../../lib/catalogue';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params,data=await getCatalogue(),collection=data.shops.find(c=>c.slug===slug);return {title:collection?`${collection.name} | MS Collection`:'Collection not found',description:collection?.tagline,alternates:{canonical:`/collections/${slug}`}}}
export default async function CollectionPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params,data=await getCatalogue();if(!data.shops.some(c=>c.slug===slug))notFound();return <Storefront initialData={data} collectionSlug={slug}/>}
