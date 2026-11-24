import Order from '../../../components/Order';
import {getStoreSettings} from '../../../lib/catalogue';
export const metadata={title:'Your order | MS Collection',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){return <Order id={(await params).id} settings={await getStoreSettings()}/>}
