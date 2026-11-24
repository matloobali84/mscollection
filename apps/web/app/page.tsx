import Storefront from '../components/Storefront';
import {getCatalogue} from '../lib/catalogue';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{q?:string|string[]}>}){const params=await searchParams;return <Storefront initialData={await getCatalogue()} initialQuery={(Array.isArray(params.q)?params.q[0]:params.q)||''}/>}
