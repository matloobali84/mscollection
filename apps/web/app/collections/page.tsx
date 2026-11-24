import Storefront from '../../components/Storefront';
import {getCatalogue} from '../../lib/catalogue';
export const dynamic='force-dynamic';
export const metadata={title:'Explore our collections | MS Collection',description:'Find clothing, footwear, beauty, home essentials and more in the MS Collection store.'};
export default async function Collections(){return <Storefront initialData={await getCatalogue()} directory/>}
