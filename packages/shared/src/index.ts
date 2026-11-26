import { z } from 'zod';
export const shopSchema = z.object({ id:z.string(), slug:z.string(), name:z.string().min(1), tagline:z.string(), category:z.string(), floor:z.number().int().nonnegative(), slot:z.string().nullable(), active:z.boolean(), template:z.enum(['clothing','jewellery','shoes','cosmetics','generic']), color:z.string(),interiorStyle:z.enum(['boutique','aisles']).optional() });
export type Shop = z.infer<typeof shopSchema>;
export type SceneEntity={id:string;name:string;kind:'person'|'mannequin'|'display';floorId:string;shopId:string|null;productId:string|null;modelUrl:string;x:number;y:number;z:number;yaw:number;scale:number;animation:string;active:boolean};
export type Product = { id:string; slug:string; shopId:string; name:string; category:string; description:string; price:number; salePrice?:number; saleStart?:string; saleEnd?:string; image:string; modelUrl?:string;modelScale?:number; media?:{url:string;alt?:string;variants?:Record<string,string>}[]; sizes:string[]; colors:string[]; stock:number; featured:boolean;effectivePrice?:number };
export type Floor = { id:number; name:string; active:boolean };
export const floors:Floor[] = [{id:0,name:'Ground floor',active:true}];
export const shops:Shop[] = [
 {id:'clothing',slug:'ms-clothing',name:'MS Clothing',tagline:'Everyday, beautifully elevated.',category:'Clothing',floor:0,slot:'A01',active:true,template:'clothing',color:'#4d6358'},
 {id:'jewellery',slug:'ms-jewellery',name:'MS Jewellery',tagline:'Little things. Lasting impressions.',category:'Jewellery',floor:0,slot:'A02',active:true,template:'jewellery',color:'#aa8456'}
];
const photo=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`;
const clothing=[
 ['Linen Everyday Shirt','photo-1598554747436-c9293d6a588f',6800,4900,'Shirts'],
 ['The Essential Blazer','photo-1591047139829-d91aecb6caea',12500,undefined,'Outerwear'],
 ['Soft Knit Cardigan','photo-1434389677669-e08b4cac3105',8200,6500,'Knitwear'],
 ['Signature Cotton Tee','photo-1521572163474-6864f9cf17ab',3200,undefined,'Essentials'],
 ['Relaxed Linen Trousers','photo-1473966968600-fa801b869a1a',7200,undefined,'Trousers'],
 ['Weekend Overshirt','photo-1542272604-787c3835535d',8900,6900,'Outerwear'],
 ['Classic Oxford Shirt','photo-1596755094514-f87e34085b2c',6500,undefined,'Shirts'],
 ['Everyday Cotton Dress','photo-1515372039744-b8f02a3ae446',9800,undefined,'Dresses'],
 ['Textured Knit Sweater','photo-1576566588028-4147f3842f27',7600,5900,'Knitwear'],
 ['The Minimal Jacket','photo-1551028719-00167b16eac5',14500,undefined,'Outerwear']
] as const;
const jewellery=[
 ['Golden Hour Necklace','photo-1611652022419-a9419f74343d',5400,3900,'Necklaces'],
 ['Everyday Gold Hoops','photo-1535632066927-ab7c9ab60908',3800,undefined,'Earrings'],
 ['The Pearl Edit','photo-1506630448388-4e683c67ddb0',6200,4800,'Necklaces'],
 ['Sculpted Gold Ring','photo-1605100804763-247f67b3557e',4200,undefined,'Rings'],
 ['Delicate Chain Bracelet','photo-1611591437281-460bfbe1220a',4600,undefined,'Bracelets'],
 ['Signature Pendant','photo-1599643477877-530eb83abc8e',5800,4500,'Necklaces'],
 ['Petite Diamond Studs','photo-1630019852942-f89202989a4d',7500,undefined,'Earrings'],
 ['The Stacking Ring','photo-1603561591411-07134e71a2a9',2900,undefined,'Rings'],
 ['Heritage Bangle','photo-1531995811006-35cb42e1a022',6800,5200,'Bracelets'],
 ['Evening Drop Earrings','photo-1635767798638-3665a1d7b5bd',4900,undefined,'Earrings']
] as const;
export const products:Product[] = [...clothing.map((p,i)=>({...make(p,i,'clothing'),sizes:['XS','S','M','L','XL'],colors:['Natural','Sage','Black']})),...jewellery.map((p,i)=>({...make(p,i,'jewellery'),sizes:p[4]==='Rings'?['6','7','8','9']:['One size'],colors:['Gold','Silver']}))];
function make(p:readonly [string,string,number,number|undefined,string],i:number,shopId:string):Product{return {id:`${shopId}-${i+1}`,slug:p[0].toLowerCase().replaceAll(' ','-'),shopId,name:p[0],image:photo(p[1]),price:p[2],salePrice:p[3],saleStart:p[3]?'2026-01-01T00:00:00Z':undefined,saleEnd:p[3]?'2030-12-31T23:59:59Z':undefined,category:p[4],description:shopId==='clothing'?'Thoughtfully made for the way you move through your day. A considered silhouette, beautiful texture, and an effortless fit. Part of the MS Collection essentials edit.':'A little everyday luxury. Thoughtfully finished with a timeless silhouette, this piece is made to be worn, loved, and layered. Keep dry and store in the included soft pouch.',sizes:[],colors:[],stock:12+i,featured:i<3};}
export function isVisible(shop:Shop,allFloors:Floor[]=floors){return shop.active;}
export function onSale(p:Product,now=Date.now()){if(p.effectivePrice!==undefined)return p.effectivePrice<p.price;return p.salePrice!==undefined&&p.salePrice<p.price&&!!p.saleStart&&!!p.saleEnd&&now>=Date.parse(p.saleStart)&&now<=Date.parse(p.saleEnd);}
export function price(p:Product){return p.effectivePrice??(onSale(p)?p.salePrice!:p.price);}
export function money(value:number,currency='PKR'){return `${currency==='PKR'?'Rs.':currency} ${value.toLocaleString('en')}`;}
export function visibleProducts(allShops=shops){const ids=new Set(allShops.filter(s=>isVisible(s)).map(s=>s.id));return products.filter(p=>ids.has(p.shopId));}
export const cartLineSchema=z.object({productId:z.string(),size:z.string(),color:z.string(),quantity:z.number().int().min(1).max(20)});
export type CartLine=z.infer<typeof cartLineSchema>;

export function productPhoto(product:Pick<Product,'image'|'media'>|undefined,size='512'){const selected=product?.image?product.media?.find(image=>image.url===product.image):product?.media?.[0];return selected?.variants?.[size]||product?.image||selected?.url;}
