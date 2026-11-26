import Account from '../../components/Account';
import {getStoreSettings} from '../../lib/catalogue';
export const dynamic='force-dynamic';
export const metadata={title:'Reseller account | MS Collection',robots:{index:false,follow:false}};
export default async function Page(){return <Account settings={await getStoreSettings()} resellerMode/>}
