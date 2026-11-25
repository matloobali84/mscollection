'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AlertCircle,Check,ChevronDown,ChevronLeft,ChevronRight,Expand,Heart,Home,LayoutGrid,LockKeyhole,Menu,MessageCircle,Minus,Package,Plus,Search,ShieldCheck,ShoppingBag,SlidersHorizontal,Truck,UserRound,X} from 'lucide-react';
import {money as formatMoney,onSale,price} from '@ms/shared';
import type {Catalogue,Collection,LiveProduct,Variant} from '../lib/catalogue';
import {request} from '../lib/client-api';
import {whatsAppLink} from '../lib/store';
import {useModalFocus} from './useModalFocus';
import ProductImage from './ProductImage';
import StoreFooter from './StoreFooter';
import HangingRail from './HangingRail';

type Panel='bag'|'checkout'|'wishlist'|null;
type Bag={items:{id:string;productId?:string;variantId:string;size:string;color:string;quantity:number;unitPrice:number;available:boolean;product?:LiveProduct}[];subtotal:number;shipping:number;tax:number;total:number};
const emptyBag:Bag={items:[],subtotal:0,shipping:0,tax:0,total:0};
const departments=[
 {name:'All',match:/.*/},{name:'Clothing',match:/clothing|womenswear|menswear/},
 {name:'Footwear',match:/shoe|sneaker|heel/},{name:'Bags',match:/bag|leather/},
 {name:'Beauty',match:/beauty|skin|fragrance/},{name:'Accessories',match:/jewel|watch|eyewear|gift/},
 {name:'Electronics',match:/computer|tablet|phone|audio|tech/},{name:'Home & living',match:/home|furniture|kitchen/},
 {name:'Everyday essentials',match:/grocer|sport/}
];
function title(p:LiveProduct){return p.slug.startsWith('demo-')?p.name.replace(/\s+\u00b7 Collection \d+$/,''):p.name}
function orderedSizes(values:string[]){const order=['XXS','XS','S','M','L','XL','XXL','XXXL','2XL','3XL','4XL'];return [...values].sort((a,b)=>{const ai=order.indexOf(a.toUpperCase()),bi=order.indexOf(b.toUpperCase());return ai>=0&&bi>=0?ai-bi:ai>=0?-1:bi>=0?1:a.localeCompare(b,undefined,{numeric:true})})}
function inDepartment(collection:Collection|undefined,department:string){return departments.find(d=>d.name===department)?.match.test((collection?.category||'').toLowerCase())??collection?.category.toLowerCase()===department.toLowerCase()}

export default function Storefront({initialData,collectionSlug,productSlug,initialQuery='',directory=false}:{initialData:Catalogue;collectionSlug?:string;productSlug?:string;initialQuery?:string;directory?:boolean}){
 const [data,setData]=useState(initialData);
 const [collectionId,setCollectionId]=useState<string|null>(initialData.shops.find(c=>c.slug===collectionSlug)?.id||null);
 const [query,setQuery]=useState(initialQuery),[department,setDepartment]=useState('All'),[saleOnly,setSaleOnly]=useState(false),[stockOnly,setStockOnly]=useState(false);
 const [sort,setSort]=useState('featured'),[minimum,setMinimum]=useState<number|null>(null),[maximum,setMaximum]=useState<number|null>(null),[limit,setLimit]=useState(24);
 const [filtersOpen,setFiltersOpen]=useState(false),[mobileMenu,setMobileMenu]=useState(false),[panel,setPanel]=useState<Panel>(null);
 const [headerQuery,setHeaderQuery]=useState(initialQuery),[searchFocused,setSearchFocused]=useState(false),[collectionSearch,setCollectionSearch]=useState('');
 const searchInput=useRef<HTMLInputElement>(null),searchContainer=useRef<HTMLFormElement>(null);
 const [inspected,setInspected]=useState<LiveProduct|null>(null),[image,setImage]=useState(''),[zoomed,setZoomed]=useState(false);
 const [size,setSize]=useState(''),[colour,setColour]=useState(''),[quantity,setQuantity]=useState(1),[bag,setBag]=useState<Bag>(emptyBag);
 const [wishlist,setWishlist]=useState<string[]>([]),[wishlistReady,setWishlistReady]=useState(false),[adding,setAdding]=useState<string|null>(null),[updatingLine,setUpdatingLine]=useState<string|null>(null),[notice,setNotice]=useState('');
 const bagQueue=useRef<Promise<unknown>>(Promise.resolve());
 const updateBag=useCallback((path='cart',method='GET',body?:unknown)=>{
  const operation=bagQueue.current.then(()=>request(path,method,body)).then(result=>{setBag(result);return result});
  bagQueue.current=operation.catch(()=>{});return operation;
 },[]);
 const [customer,setCustomer]=useState<{name:string;email:string}|null>(null),[csrf,setCsrf]=useState(''),[addresses,setAddresses]=useState<any[]>([]),[addressId,setAddressId]=useState('');
 const [online,setOnline]=useState(false),[payment,setPayment]=useState('cod'),[checkoutKey,setCheckoutKey]=useState(''),[checkoutBusy,setCheckoutBusy]=useState(false),[checkoutError,setCheckoutError]=useState('');
 const [order,setOrder]=useState<{id:string;number:string;token?:string;online:boolean}|null>(null);
 const settings=data.settings,collections=data.shops.filter(c=>c.active),products=data.products.filter(p=>collections.some(c=>c.id===p.shopId));
 const extraDepartments=[...new Set(collections.map(c=>c.category).filter(category=>category&&!departments.slice(1).some(d=>d.match.test(category.toLowerCase()))))].map(name=>({name}));
 const categoryFilters=[...departments,...extraDepartments];
 const collection=collections.find(c=>c.id===collectionId),detail=products.find(p=>p.slug===productSlug)||null,selected=inspected||detail;
 const variants=selected?.variants||[],variant=variants.find(v=>v.size===size&&v.color===colour),stock=variant?.stock||0;
 const money=(amount:number)=>formatMoney(amount,settings.currency),bagCount=bag.items.reduce((n,line)=>n+line.quantity,0),saved=products.filter(p=>wishlist.includes(p.id));
 const whatsapp=whatsAppLink(settings.supportWhatsApp,'Hello '+settings.name+', I need help with a product.');
 useModalFocus(!!panel||!!inspected||!!order||filtersOpen||mobileMenu||zoomed,zoomed?'zoom':inspected?.id||panel||order?.id||(filtersOpen?'filters':mobileMenu?'navigation':undefined));
 const refresh=useCallback(async()=>setData(await request('catalogue')),[]);
 useEffect(()=>{
  try{const stored=JSON.parse(localStorage.getItem('ms-wishlist')||'[]');if(Array.isArray(stored))setWishlist(stored.filter(id=>typeof id==='string'))}catch{}
  setWishlistReady(true);
  const params=new URLSearchParams(location.search),linked=initialData.products.find(p=>p.id===params.get('product'));
  if(linked)setInspected(linked);
  if(departments.some(d=>d.name===params.get('department')))setDepartment(params.get('department')!);
  if(params.get('sale')==='true')setSaleOnly(true);
  if(params.get('sort')==='newest')setSort('newest');
  const legacy=initialData.shops.find(c=>c.slug===(params.get('collection')||params.get('shop')));if(legacy)setCollectionId(legacy.id);
  updateBag().catch(e=>setNotice(e.message));request('payment-methods').then(d=>setOnline(d.online)).catch(()=>{});
  request('auth/me').then(async d=>{
   setCustomer(d.user);setCsrf(d.csrf);
   const [accountWishlist,savedAddresses]=await Promise.all([request('me/wishlist'),request('me/addresses')]);
   setWishlist(v=>[...new Set([...v,...accountWishlist])]);setAddresses(savedAddresses);
  }).catch(()=>{});
  setCheckoutKey(crypto.randomUUID());
  const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh().catch(()=>{})},60000);
  return()=>clearInterval(timer);
 },[initialData,refresh,updateBag]);
 useEffect(()=>{if(wishlistReady)localStorage.setItem('ms-wishlist',JSON.stringify(wishlist))},[wishlist,wishlistReady]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer)},[notice]);
 useEffect(()=>{
  if(!selected)return;
  const available=selected.variants.find(v=>v.stock>0)||selected.variants[0];
  setSize(available?.size||'');setColour(available?.color||'');setImage(selected.image);setQuantity(1);
 },[selected?.id]);
 useEffect(()=>setQuantity(q=>Math.max(1,Math.min(q,stock||1,20))),[variant?.id,stock]);
 useEffect(()=>setLimit(24),[query,department,saleOnly,stockOnly,sort,minimum,maximum,collectionId]);
 useEffect(()=>{
  const close=(event:KeyboardEvent)=>{
   if(event.key!=='Escape')return;
   if(searchFocused){event.preventDefault();setSearchFocused(false);return}
   if(zoomed){setZoomed(false);return}
   setInspected(null);setPanel(null);setMobileMenu(false);setFiltersOpen(false);setSearchFocused(false);
  };
  const outside=(event:PointerEvent)=>{if(!searchContainer.current?.contains(event.target as Node))setSearchFocused(false)};
  window.addEventListener('keydown',close);document.addEventListener('pointerdown',outside);
  return()=>{window.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside)};
 },[zoomed,searchFocused]);
 useEffect(()=>{if(panel==='bag'||panel==='checkout')updateBag().catch(e=>setNotice(e.message))},[panel,updateBag]);
 const filtered=useMemo(()=>products.filter(p=>
  (!collectionId||p.shopId===collectionId)&&inDepartment(collections.find(c=>c.id===p.shopId),department)&&
  (!saleOnly||onSale(p))&&(!stockOnly||p.stock>0)&&(minimum===null||price(p)>=minimum)&&(maximum===null||price(p)<=maximum)&&
  (p.name+' '+p.category+' '+collections.find(c=>c.id===p.shopId)?.name).toLowerCase().includes(query.toLowerCase())
 ).sort((a,b)=>sort==='low'?price(a)-price(b):sort==='high'?price(b)-price(a):sort==='newest'?(Date.parse((b as any).created_at||'')||0)-(Date.parse((a as any).created_at||'')||0):Number(b.featured)-Number(a.featured)||Number(a.slug.startsWith('demo-'))-Number(b.slug.startsWith('demo-'))),[products,collections,collectionId,department,saleOnly,stockOnly,minimum,maximum,query,sort]);
 const suggestions=headerQuery.trim()?products.filter(p=>(p.name+' '+p.category).toLowerCase().includes(headerQuery.toLowerCase())).slice(0,5):[];
 const filterCount=Number(department!=='All')+Number(saleOnly)+Number(stockOnly)+Number(minimum!==null)+Number(maximum!==null);
 const ceiling=Math.ceil(Math.max(1000,...products.map(p=>price(p)))/1000)*1000;
 const selectedAddress=addresses.find(a=>a.id===addressId)?.data;
 const selectedPrice=selected?(onSale(selected)?selected.salePrice!:variant?.priceOverride??selected.price):0;
 const home=!directory&&!detail&&!collection&&!initialQuery;

 function goProducts(){document.getElementById('products')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
 function resetFilters(){setDepartment('All');setQuery('');setHeaderQuery('');setMinimum(null);setMaximum(null);setSaleOnly(false);setStockOnly(false)}
 function openPanel(value:Panel){setInspected(null);setZoomed(false);setFiltersOpen(false);setMobileMenu(false);setSearchFocused(false);setPanel(value)}
 function inspect(product:LiveProduct){openPanel(null);setInspected(product)}
 function chooseDepartment(name:string){
  setMobileMenu(false);setSearchFocused(false);
  if(directory||detail||collectionSlug){location.href='/?department='+encodeURIComponent(name)+'#products';return}
  resetFilters();setCollectionId(null);setDepartment(name);goProducts();
 }
 function newArrivals(){
  if(directory||detail||collectionSlug){location.href='/?sort=newest#products';return}
  resetFilters();setCollectionId(null);setSort('newest');goProducts();
 }
 function submitSearch(event:React.FormEvent){
  event.preventDefault();setSearchFocused(false);
  if(directory||detail||collectionSlug){location.href='/?q='+encodeURIComponent(headerQuery)+'#products';return}
  resetFilters();setCollectionId(null);setQuery(headerQuery);setHeaderQuery(headerQuery);goProducts();searchInput.current?.blur();
 }
 function chooseColour(value:string){
  setColour(value);
  if(!variants.some(v=>v.color===value&&v.size===size&&v.stock>0))setSize(variants.find(v=>v.color===value&&v.stock>0)?.size||size);
 }
 async function toggleWish(product:LiveProduct){
  const exists=wishlist.includes(product.id);
  try{if(csrf)await request('me/wishlist/'+product.id,exists?'DELETE':'POST',undefined,csrf);setWishlist(items=>exists?items.filter(id=>id!==product.id):[...items,product.id])}
  catch(e){setNotice((e as Error).message)}
 }
 async function add(product:LiveProduct,option:Variant|undefined,count=1){
  if(!option||option.stock<count){setNotice('Please choose an available option.');return}
  if(adding)return;setAdding(product.id);
  try{await updateBag('cart','POST',{variantId:option.id,quantity:count});setInspected(null);setNotice('Added to your bag.')}
  catch(e){setNotice((e as Error).message)}finally{setAdding(null)}
 }
 function quickAdd(product:LiveProduct){const available=product.variants.filter(v=>v.stock>0);if(available.length===1)void add(product,available[0]);else inspect(product)}
 async function changeLine(id:string,count:number){
  if(updatingLine)return;setUpdatingLine(id);
  try{await updateBag('cart/items/'+id,count<1?'DELETE':'PATCH',count<1?undefined:{quantity:count})}
  catch(e){setNotice((e as Error).message)}finally{setUpdatingLine(null)}
 }
 async function checkout(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(checkoutBusy)return;setCheckoutBusy(true);setCheckoutError('');
  const form=new FormData(event.currentTarget);
  try{
   const result=await request('checkout','POST',{email:form.get('email'),address:{name:form.get('name'),phone:form.get('phone'),address:form.get('address'),city:form.get('city'),postal:form.get('postal'),country:settings.country},paymentMethod:payment,idempotencyKey:checkoutKey});
   if(result.token)sessionStorage.setItem('ms-order-'+result.id,result.token);
   if(result.checkoutUrl){location.href=result.checkoutUrl;return}
   setOrder({...result,online:payment==='online'});setPanel(null);setCheckoutKey(crypto.randomUUID());await updateBag();await refresh();
  }catch(e){setCheckoutError((e as Error).message)}finally{setCheckoutBusy(false)}
 }

 const card=(p:LiveProduct)=><article className='product-card' key={p.id}>
  <div className={'product-image '+(p.slug.startsWith('demo-')?'cutout':'lifestyle')}>
   <a href={'/products/'+p.slug} aria-label={'View '+p.name}><ProductImage src={p.media?.[0]?.variants?.['512']||p.image} alt={title(p)} loading='lazy'/></a>
   <div className='product-badges'>{onSale(p)?<span className='sale-badge'>Save {Math.round((1-price(p)/p.price)*100)}%</span>:p.featured?<span>Featured</span>:null}{!p.stock&&<span>Sold out</span>}</div>
   <button className={'save-product '+(wishlist.includes(p.id)?'is-saved':'')} onClick={()=>toggleWish(p)} aria-label={(wishlist.includes(p.id)?'Unsave ':'Save ')+p.name} aria-pressed={wishlist.includes(p.id)}><Heart size={19} fill={wishlist.includes(p.id)?'currentColor':'none'}/></button>
   <button className='quick-view' aria-label={'Quick view '+p.name} onClick={()=>inspect(p)}><Expand size={16}/>Quick view</button>
  </div>
  <div className='product-meta'><span>{p.category||collections.find(c=>c.id===p.shopId)?.category}</span><a href={'/products/'+p.slug}>{title(p)}</a>
   <p className='card-price'>{money(price(p))}{onSale(p)&&<del>{money(p.price)}</del>}</p>
   <small>{p.colors.length>1?p.colors.length+' colours':collections.find(c=>c.id===p.shopId)?.name}</small>
   <button className='card-add' onClick={()=>quickAdd(p)} disabled={!p.stock||!!adding} aria-label={'Add '+p.name+' to bag'}>{adding===p.id?'Adding...':!p.stock?'Out of stock':p.variants.filter(v=>v.stock>0).length===1?'Add to bag':'Choose options'}{p.stock>0&&<Plus size={16}/>}</button>
  </div>
 </article>;
 const collectionCard=(c:Collection)=><a className='collection-card' key={c.id} href={'/collections/'+c.slug}>
  <div><ProductImage src={products.find(p=>p.shopId===c.id)?.image} alt='' loading='lazy'/></div>
  <span><small>{c.category||'Collection'}</small><strong>{c.name}</strong><p>{c.tagline}</p><b>{products.filter(p=>p.shopId===c.id).length} products</b></span>
 </a>;
 const totals=<><p><span>Subtotal</span><b>{money(bag.subtotal)}</b></p><p><span>Delivery</span><span>{bag.shipping?money(bag.shipping):'Free'}</span></p>{bag.tax>0&&<p><span>Tax</span><span>{money(bag.tax)}</span></p>}<p className='total'><span>Total</span><strong>{money(bag.total)}</strong></p></>;
 const productDetails=(p:LiveProduct)=><div className='product-detail-grid'>
  <div className='detail-gallery'><button className={'detail-main-image '+(p.slug.startsWith('demo-')?'cutout':'')} aria-label={'Enlarge '+p.name+' image'} onClick={()=>setZoomed(true)}><ProductImage src={image||p.image} alt={title(p)}/><span><Expand size={18}/></span></button>
   {(p.media?.length||0)>1&&<div className='detail-thumbs'>{[...new Set([p.image,...(p.media||[]).map(m=>m.url)])].map((url,index)=><button key={url} className={image===url?'selected':''} aria-label={'Show product image '+(index+1)} aria-pressed={image===url} onClick={()=>setImage(url)}><ProductImage src={url} alt=''/></button>)}</div>}
  </div>
  <div className='detail-content'>
   <div className='detail-brand'><a href={'/collections/'+collections.find(c=>c.id===p.shopId)?.slug}>{collections.find(c=>c.id===p.shopId)?.name}</a><button className='icon-button' aria-label={(wishlist.includes(p.id)?'Unsave ':'Save ')+p.name} aria-pressed={wishlist.includes(p.id)} onClick={()=>toggleWish(p)}><Heart size={21} fill={wishlist.includes(p.id)?'currentColor':'none'}/></button></div>
   <h1>{title(p)}</h1><div className='detail-price-row'><p className='detail-price'>{money(selectedPrice)}{onSale(p)&&<del>{money(p.price)}</del>}</p>{onSale(p)&&<span className='offer-label'>On sale</span>}</div>
   <p className='detail-description'>{p.description?.split('\n\n')[0]}</p>
   <div className='product-option'><span>Colour <b>{colour}</b></span><div>{p.colors.map(c=><button key={c} className={colour===c?'selected':''} aria-pressed={colour===c} disabled={!variants.some(v=>v.color===c&&v.stock>0)} onClick={()=>chooseColour(c)}>{c}</button>)}</div></div>
   <div className='product-option'><span>Size <b>{size}</b></span><div>{orderedSizes(p.sizes).map(s=><button key={s} className={size===s?'selected':''} aria-pressed={size===s} disabled={!variants.some(v=>v.size===s&&v.color===colour&&v.stock>0)} onClick={()=>setSize(s)}>{s}</button>)}</div></div>
   <p className={'stock-line '+(stock?'available':'')}><span/>{stock?'In stock. '+stock+' available.':'This option is currently sold out.'}</p>
   <div className='purchase-row'><div className='quantity'><button disabled={quantity<=1} aria-label='Decrease quantity' onClick={()=>setQuantity(q=>q-1)}><Minus size={16}/></button><span>{quantity}</span><button disabled={quantity>=Math.min(20,stock)} aria-label='Increase quantity' onClick={()=>setQuantity(q=>q+1)}><Plus size={16}/></button></div><button className='primary' disabled={!stock||!!adding} onClick={()=>add(p,variant,quantity)}><ShoppingBag size={19}/>{adding?'Adding...':'Add to bag'}</button></div>
   <div className='detail-assurances'><span><Truck size={19}/>Free delivery over {money(settings.freeShippingThreshold)}</span><span><ShieldCheck size={19}/>Cash on delivery available</span></div>
   <div className='product-accordions'><details><summary>Product details<Plus size={17}/></summary><p>{p.description}</p></details><details><summary>Delivery & returns<Plus size={17}/></summary><p>Delivery across {settings.country}. Standard delivery is {money(settings.shippingFee)}; orders over {money(settings.freeShippingThreshold)} qualify for free delivery.</p><a href='/help/delivery'>Delivery information</a><a href='/help/returns'>Returns & exchanges</a></details><details><summary>Need help with this product?<Plus size={17}/></summary><p>Ask our support team about sizing, availability or your order.</p><a href={whatsapp||'/help/contact'} target={whatsapp?'_blank':undefined} rel='noopener noreferrer'>Contact customer support</a></details></div>
   {inspected&&<a className='text-link full-details-link' href={'/products/'+p.slug}>View full product details</a>}
  </div>
 </div>;

 return <div className='store-app' style={{'--brand':settings.primaryColor} as React.CSSProperties}>
  <a className='skip-link' href='#main-content'>Skip to content</a>
  <div className='announcement'><span>Free delivery over {money(settings.freeShippingThreshold)}</span><span>Delivered across {settings.country} <i/> Cash on delivery</span><a href='/help/contact'>Customer support</a></div>
  <header className='store-header'>
   <button className='mobile-menu-toggle icon-button' aria-label='Open navigation' aria-expanded={mobileMenu} onClick={()=>{openPanel(null);setMobileMenu(true)}}><Menu size={23}/></button>
   <a className='brand' href='/' aria-label='MS Collection home'><span className='brand-mark'>MS<span/></span><span className='brand-name'>COLLECTION<small>EVERYDAY, ELEVATED.</small></span></a>
   <form ref={searchContainer} className='header-search' role='search' onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setSearchFocused(false)}} onSubmit={submitSearch}>
    <Search size={20}/><input ref={searchInput} type='search' aria-label='Search the store' aria-expanded={searchFocused} aria-controls='search-suggestions' placeholder='Search products, collections and more' autoComplete='off' value={headerQuery} onFocus={()=>setSearchFocused(true)} onChange={e=>setHeaderQuery(e.target.value)}/>
    <button type='submit' aria-label='Submit search'>Search</button>
    {searchFocused&&<div className='search-suggestions' id='search-suggestions' role='region' aria-label='Search suggestions'>
     <div className='suggestion-heading'>{headerQuery?'Suggested products':'Popular categories'}<button type='button' aria-label='Close search suggestions' onClick={()=>setSearchFocused(false)}><X size={18}/></button></div>
     {headerQuery?suggestions.length?<>{suggestions.map(p=><a key={p.id} href={'/products/'+p.slug}><ProductImage src={p.media?.[0]?.variants?.['256']||p.image} alt=''/><span><strong>{title(p)}</strong><small>{p.category}</small></span><b>{money(price(p))}</b></a>)}<button type='submit' className='all-search-results'>View all results for &quot;{headerQuery}&quot;</button></>:<p className='search-empty'>No matching products. Try a category or another name.</p>:<div className='popular-searches'>{departments.slice(1,7).map(d=><button type='button' key={d.name} onClick={()=>chooseDepartment(d.name)}>{d.name}</button>)}</div>}
    </div>}
   </form>
   <div className='header-actions'><a href='/account' aria-label='Your account'><UserRound size={23}/><span>Account</span></a><button className='desktop-wishlist' aria-label='Open wishlist' onClick={()=>openPanel('wishlist')}><Heart size={23}/><span>Wishlist</span>{saved.length>0&&<b>{saved.length}</b>}</button><button aria-label='Open shopping bag' onClick={()=>openPanel('bag')}><ShoppingBag size={23}/><span>Bag</span><b>{bagCount}</b></button></div>
  </header>
  {mobileMenu&&<button className='navigation-backdrop' aria-label='Close navigation' onClick={()=>setMobileMenu(false)}/>}
  <nav className={'store-navigation '+(mobileMenu?'is-open':'')} role={mobileMenu?'dialog':undefined} aria-modal={mobileMenu?true:undefined} aria-label={mobileMenu?'Shop navigation':'Main navigation'}>
   <div className='mobile-navigation-heading'><strong>Shop MS Collection</strong><button className='icon-button' aria-label='Close navigation menu' onClick={()=>setMobileMenu(false)}><X size={23}/></button></div>
   <a href='/collections' className='all-collections-nav'><LayoutGrid size={17}/>Shop all collections</a><button onClick={newArrivals}>New arrivals</button>
   {['Clothing','Footwear','Beauty','Accessories','Home & living','Electronics'].map(name=><button key={name} className={department===name?'active':''} onClick={()=>chooseDepartment(name)}>{name}</button>)}
   <button className='sale-nav' onClick={()=>{if(directory||detail||collectionSlug){location.href='/?sale=true#products';return}chooseDepartment('All');setSaleOnly(true)}}>Sale</button>
   <a className='nav-support' href='/help/contact'>Need help?</a>
  </nav>
  <main id='main-content' tabIndex={-1}>
   {detail?<><div className='breadcrumbs'><a href='/'>Home</a><ChevronRight size={13}/><a href={'/collections/'+collections.find(c=>c.id===detail.shopId)?.slug}>{collections.find(c=>c.id===detail.shopId)?.name}</a><ChevronRight size={13}/><span>{title(detail)}</span></div>{productDetails(detail)}<section className='related-products'><div className='section-heading'><div><span className='eyebrow'>COMPLETE YOUR DISCOVERY</span><h2>You may also like</h2></div><a className='text-link' href={'/collections/'+collections.find(c=>c.id===detail.shopId)?.slug}>View collection</a></div><div className='product-grid'>{products.filter(p=>p.id!==detail.id&&p.shopId===detail.shopId).slice(0,4).map(card)}</div></section></>:<>
    {directory?<section className='collection-directory'><div className='breadcrumbs'><a href='/'>Home</a><ChevronRight size={13}/><span>Collections</span></div><div className='directory-intro'><div><span className='eyebrow'>EXPLORE MS COLLECTION</span><h1>A collection for every day.</h1><p>From wardrobe staples to your next home upgrade. Find what feels like you.</p></div><label className='directory-search'><Search size={20}/><input type='search' aria-label='Search collections' placeholder='Find a collection' value={collectionSearch} onChange={e=>setCollectionSearch(e.target.value)}/></label></div><div className='collection-directory-grid'>{collections.filter(c=>(c.name+' '+c.category).toLowerCase().includes(collectionSearch.toLowerCase())).map(collectionCard)}</div>{!collections.some(c=>(c.name+' '+c.category).toLowerCase().includes(collectionSearch.toLowerCase()))&&<div className='empty-state'><Search size={32}/><h2>No collections found</h2><p>Try a different collection or category name.</p></div>}</section>:collection?<section className='collection-heading'><div className='breadcrumbs'><a href='/'>Home</a><ChevronRight size={13}/><a href='/collections'>Collections</a><ChevronRight size={13}/><span>{collection.name}</span></div><span className='eyebrow'>{collection.category||'THE COLLECTION'}</span><h1>{collection.name}</h1><p>{collection.tagline}</p></section>:home?<>
     <section className='store-hero'><img className='campaign-image' src='/images/everyday-campaign.webp' srcSet='/images/everyday-campaign-960.webp 960w, /images/everyday-campaign.webp 1920w' sizes='(max-width: 700px) 100vw, 1440px' alt='Contemporary everyday style in a bright architectural studio' fetchPriority='high'/><div className='hero-copy'><span className='eyebrow'>THE NEW EVERYDAY EDIT</span><h1>Everyday.<br/><span>Elevated.</span></h1><p>Good style. Smart finds. Everything for your world, thoughtfully brought together.</p><div className='hero-actions'><button className='primary' onClick={newArrivals}>Shop new arrivals</button><a href='/collections' className='secondary'>Explore collections</a></div><span className='hero-caption'>FASHION &nbsp; / &nbsp; BEAUTY &nbsp; / &nbsp; HOME &nbsp; / &nbsp; MORE</span></div></section>
     <div className='service-strip'><span><Truck size={24}/><span><strong>Delivery across {settings.country}</strong><small>Free over {money(settings.freeShippingThreshold)}</small></span></span><span><ShieldCheck size={24}/><span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span></span><span><ShoppingBag size={24}/><span><strong>Something for every day</strong><small>{collections.length} collections to explore</small></span></span><a href='/help/contact'><MessageCircle size={24}/><span><strong>Here to help</strong><small>Talk to our support team</small></span></a></div>
     <section className='department-section'><div className='section-heading'><div><span className='eyebrow'>FIND YOUR NEXT FAVOURITE</span><h2>Shop by category</h2></div><a href='/collections' className='text-link'>View all collections</a></div><div className='department-grid'>{departments.slice(1,9).map(d=>{const matches=products.filter(p=>inDepartment(collections.find(c=>c.id===p.shopId),d.name)),photo=matches.find(p=>p.slug.startsWith('demo-'))||matches[0];return <button key={d.name} onClick={()=>chooseDepartment(d.name)}><span><ProductImage src={photo?.media?.[0]?.variants?.['256']||photo?.image} alt='' loading='lazy'/></span><strong>{d.name}</strong><small>{matches.length} products</small></button>})}</div></section>
     <HangingRail products={products.filter(p=>p.displayGroup==='hanger'||inDepartment(collections.find(c=>c.id===p.shopId),'Clothing'))} currency={settings.currency} onInspect={inspect}/>
    </>:null}
    {!directory&&<section id='products' className='catalogue-section'>
     <div className='section-heading'><div><span className='eyebrow'>{saleOnly?'THE SALE EDIT':'DISCOVER SOMETHING GOOD'}</span><h2>{query?'Results for "'+query+'"':saleOnly?'Great finds. Better prices.':department!=='All'?department:collection?'Shop the collection':sort==='newest'?'New arrivals':'Your everyday favourites'}</h2><p>{filtered.length} products to make your own.</p></div><a className='text-link catalogue-collections-link' href='/collections'>Browse collections</a></div>
     <div className='catalogue-toolbar'><button className='filter-toggle secondary' aria-expanded={filtersOpen} onClick={()=>{openPanel(null);setFiltersOpen(v=>!v)}}><SlidersHorizontal size={18}/>Filters{filterCount>0&&<b>{filterCount}</b>}</button><div className='catalogue-tabs' role='group' aria-label='Product availability'><button aria-pressed={!saleOnly&&!stockOnly} className={!saleOnly&&!stockOnly?'active':''} onClick={()=>{setSaleOnly(false);setStockOnly(false)}}>All products</button><button aria-pressed={stockOnly} className={stockOnly?'active':''} onClick={()=>setStockOnly(v=>!v)}>In stock</button><button aria-pressed={saleOnly} className={saleOnly?'active':''} onClick={()=>setSaleOnly(v=>!v)}>On sale</button></div><label className='sort-select'>Sort by<select aria-label='Sort products' value={sort} onChange={e=>setSort(e.target.value)}><option value='featured'>Featured</option><option value='newest'>Newest arrivals</option><option value='low'>Price: low to high</option><option value='high'>Price: high to low</option></select></label></div>
     {(filterCount>0||query)&&<div className='active-filters' aria-label='Applied filters'>{query&&<button onClick={()=>{setQuery('');setHeaderQuery('')}}>Search: {query}<X size={14}/></button>}{department!=='All'&&<button onClick={()=>setDepartment('All')}>{department}<X size={14}/></button>}{minimum!==null&&<button onClick={()=>setMinimum(null)}>From {money(minimum)}<X size={14}/></button>}{maximum!==null&&<button onClick={()=>setMaximum(null)}>Up to {money(maximum)}<X size={14}/></button>}{stockOnly&&<button onClick={()=>setStockOnly(false)}>In stock<X size={14}/></button>}{saleOnly&&<button onClick={()=>setSaleOnly(false)}>On sale<X size={14}/></button>}<button className='clear-filters' onClick={resetFilters}>Clear all</button></div>}
     {filtersOpen&&<button className='filter-backdrop' aria-label='Close product filters' onClick={()=>setFiltersOpen(false)}/>}
     <div className='catalogue-layout'><aside className={'catalogue-sidebar '+(filtersOpen?'is-open':'')} role={filtersOpen?'dialog':undefined} aria-modal={filtersOpen?true:undefined} aria-label='Product filters'><div className='filter-heading'><h3>Filter products</h3><button className='icon-button' aria-label='Close filters' onClick={()=>setFiltersOpen(false)}><X size={22}/></button></div><div className='filter-content'><label className='catalogue-search'><Search size={18}/><input type='search' aria-label='Search products in filters' placeholder='Search products' value={query} onChange={e=>setQuery(e.target.value)}/></label><h4>Category</h4>{categoryFilters.filter(d=>d.name==='All'||products.some(p=>(!collectionId||p.shopId===collectionId)&&inDepartment(collections.find(c=>c.id===p.shopId),d.name))).map(d=><button className={'department-filter '+(department===d.name?'selected':'')} key={d.name} aria-pressed={department===d.name} onClick={()=>setDepartment(d.name)}><span><i/>{d.name}</span><small>{products.filter(p=>(!collectionId||p.shopId===collectionId)&&inDepartment(collections.find(c=>c.id===p.shopId),d.name)).length}</small></button>)}<h4>Price range ({settings.currency})</h4><div className='price-inputs'><label>From<input aria-label='Minimum price' type='number' min='0' placeholder='0' value={minimum??''} onChange={e=>setMinimum(e.target.value===''?null:Math.max(0,Number(e.target.value)))}/></label><span>-</span><label>To<input aria-label='Maximum price' type='number' min='0' placeholder={String(ceiling)} value={maximum??''} onChange={e=>setMaximum(e.target.value===''?null:Math.max(0,Number(e.target.value)))}/></label></div><h4>Availability</h4><label className='check-filter'><input type='checkbox' checked={stockOnly} onChange={e=>setStockOnly(e.target.checked)}/>In stock only</label><label className='check-filter'><input type='checkbox' checked={saleOnly} onChange={e=>setSaleOnly(e.target.checked)}/>On sale only</label></div><div className='filter-footer'><button className='text-link' onClick={resetFilters}>Reset filters</button><button className='primary' onClick={()=>setFiltersOpen(false)}>Show {filtered.length} products</button></div></aside>
     <div className='catalogue-results'><label className='inline-product-search'><Search size={18}/><input type='search' aria-label='Search products' placeholder='Search this collection' value={query} onChange={e=>setQuery(e.target.value)}/></label><div className='product-grid'>{filtered.slice(0,limit).map(card)}</div>{!filtered.length&&<div className='empty-state'><Search size={36}/><h3>No products match your filters</h3><p>Try another search or clear a filter to see more.</p><button className='primary' onClick={resetFilters}>Clear filters</button></div>}{filtered.length>0&&<div className='load-more'><span>Showing {Math.min(limit,filtered.length)} of {filtered.length} products</span><i><b style={{width:Math.min(100,limit/filtered.length*100)+'%'}}/></i>{filtered.length>limit&&<button className='secondary' onClick={()=>setLimit(n=>n+24)}>Load more products<Plus size={18}/></button>}</div>}</div></div>
    </section>}
    {home&&<section className='store-editorial'><div><span className='eyebrow'>MAKE ROOM FOR GOOD FINDS</span><h2>Small upgrades.<br/>A better everyday.</h2><p>Discover accessories, home essentials and thoughtful finishing touches.</p><button className='primary' onClick={()=>chooseDepartment('Accessories')}>Discover accessories</button></div><div className='editorial-products'>{products.filter(p=>/watch|bag|home/i.test(p.category)&&p.slug.startsWith('demo-')).slice(0,3).map(p=><a key={p.id} href={'/products/'+p.slug}><ProductImage src={p.image} alt={title(p)} loading='lazy'/></a>)}</div></section>}
   </>}
  </main>
  <StoreFooter settings={settings}/>
  {!detail&&<nav className='mobile-bottom-nav' aria-label='Mobile shopping navigation'><a href='/' className={home?'active':''}><Home size={21}/><span>Home</span></a><a href='/collections' className={directory?'active':''}><LayoutGrid size={21}/><span>Collections</span></a><button onClick={()=>{window.scrollTo({top:0,behavior:'smooth'});searchInput.current?.focus();setSearchFocused(true)}}><Search size={22}/><span>Search</span></button><button onClick={()=>openPanel('wishlist')} aria-label='Open mobile wishlist'><Heart size={21}/><span>Saved</span>{saved.length>0&&<b>{saved.length}</b>}</button><button onClick={()=>openPanel('bag')} aria-label='Open mobile shopping bag'><ShoppingBag size={21}/><span>Bag</span>{bagCount>0&&<b>{bagCount}</b>}</button></nav>}
  {detail&&!inspected&&!panel&&<div className='mobile-purchase-bar'><div><small>Total price</small><strong>{money(selectedPrice)}</strong></div><button className='primary' disabled={!stock||!!adding} onClick={()=>add(detail,variant,quantity)}><ShoppingBag size={18}/>{adding?'Adding...':'Add to bag'}</button></div>}
  {notice&&<div className={'toast '+(notice.startsWith('Added')?'success':'error')} role='status'>{notice.startsWith('Added')?<Check size={20}/>:<AlertCircle size={20}/>}<span>{notice}</span>{notice.startsWith('Added')&&<button onClick={()=>{openPanel('bag');setNotice('')}}>View bag</button>}<button className='icon-button' aria-label='Dismiss notification' onClick={()=>setNotice('')}><X size={18}/></button></div>}
  {inspected&&<div className='modal-backdrop' onClick={()=>setInspected(null)}><section className='product-dialog' role='dialog' aria-modal='true' aria-label={inspected.name} onClick={e=>e.stopPropagation()}><button className='close-button icon-button' aria-label='Close product' onClick={()=>setInspected(null)}><X size={23}/></button>{productDetails(inspected)}</section></div>}
  {panel&&<div className='sheet-overlay' onClick={()=>setPanel(null)}><aside className={'commerce-sheet '+(panel==='checkout'?'checkout-sheet':panel==='wishlist'?'wishlist-sheet':'')} role='dialog' aria-modal='true' aria-label={panel==='bag'?'Shopping bag':panel==='checkout'?'Checkout':'Wishlist'} onClick={e=>e.stopPropagation()}><header className='sheet-header'><div><span className='eyebrow'>MS COLLECTION</span><h2>{panel==='bag'?'Your shopping bag':panel==='checkout'?'Checkout':'Your saved finds'}{panel==='bag'&&<span>{bagCount}</span>}</h2></div><button className='icon-button' aria-label='Close panel' onClick={()=>setPanel(null)}><X size={24}/></button></header>
   <div className={'sheet-content '+(panel==='bag'?'bag-content':'')}>
    {panel==='wishlist'&&(saved.length?<><p className='sheet-intro'>{saved.length} products you have your eye on.</p><div className='product-grid'>{saved.map(card)}</div></>:<div className='empty-state'><Heart size={40}/><h3>A place for your favourites</h3><p>Tap the heart on a product to keep it here for later.</p><button className='primary' onClick={()=>setPanel(null)}>Discover products</button></div>)}
    {panel==='bag'&&(bag.items.length?<><div className='cart-scroll'><div className='delivery-progress'><Truck size={20}/><p>{bag.subtotal>=settings.freeShippingThreshold?'Your order qualifies for free delivery.':'You are '+money(settings.freeShippingThreshold-bag.subtotal)+' away from free delivery.'}</p><i><b style={{width:Math.min(100,bag.subtotal/Math.max(1,settings.freeShippingThreshold)*100)+'%'}}/></i></div>{bag.items.map(line=>{const p=products.find(p=>p.id===line.productId)||line.product;return <div className='cart-line' key={line.id} aria-busy={updatingLine===line.id}><ProductImage src={p?.image} alt={p?.name||'Unavailable product'}/><div><a href={p?'/products/'+p.slug:undefined}><strong>{p?title(p):'Unavailable product'}</strong></a><small>{line.color} / {line.size}</small><b>{money(line.unitPrice)}</b>{!line.available&&<small className='line-unavailable'>Adjust the quantity or remove this item.</small>}<div className='quantity'><button disabled={!!updatingLine} aria-label={'Decrease '+p?.name} onClick={()=>changeLine(line.id,line.quantity-1)}><Minus size={14}/></button><span>{line.quantity}</span><button disabled={!!updatingLine||line.quantity>=20} aria-label={'Increase '+p?.name} onClick={()=>changeLine(line.id,line.quantity+1)}><Plus size={14}/></button></div></div><button className='icon-button remove-line' disabled={!!updatingLine} aria-label={'Remove '+(p?.name||'product')} onClick={()=>changeLine(line.id,0)}><X size={18}/></button></div>})}</div><div className='cart-summary'><div className='cart-totals'>{totals}</div><button className='primary full' disabled={!!updatingLine||!!adding||bag.items.some(line=>!line.available)} onClick={()=>{setCheckoutError('');setPanel('checkout')}}>Continue to checkout<LockKeyhole size={18}/></button><p className='secure-note'><ShieldCheck size={16}/>Cash on delivery available</p><button className='text-link full' onClick={()=>setPanel(null)}>Continue shopping</button></div></>:<div className='empty-state'><ShoppingBag size={42}/><h3>Your bag is waiting</h3><p>Find something you love and make it yours.</p><button className='primary' onClick={()=>{setPanel(null);goProducts()}}>Explore the collection</button></div>)}
    {panel==='checkout'&&<><button className='text-link back-to-bag' onClick={()=>setPanel('bag')}><ChevronLeft size={16}/>Back to your bag</button><details className='checkout-order-summary'><summary><span><ShoppingBag size={19}/>Order summary ({bagCount} items)<ChevronDown size={15}/></span><strong>{money(bag.total)}</strong></summary><div>{bag.items.map(line=><p key={line.id}><span>{line.product?.name||products.find(p=>p.id===line.productId)?.name} <small>x {line.quantity}</small></span><b>{money(line.unitPrice*line.quantity)}</b></p>)}<div className='cart-totals'>{totals}</div></div></details>
     {!settings.guestCheckout&&!customer&&<p className='account-error'>Please <a href='/account'>sign in</a> to complete your order. Your bag is saved.</p>}
     {addresses.length>0&&<label className='saved-address-select'>Use a saved address<select value={addressId} onChange={e=>setAddressId(e.target.value)}><option value=''>Enter a new address</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.data.name+' / '+a.data.city+' / '+a.data.address}</option>)}</select></label>}
     <form className='checkout-form' onSubmit={checkout} key={addressId}><div className='checkout-section-heading'><UserRound size={20}/><h3>Contact information</h3>{!customer&&<a href='/account'>Sign in</a>}</div>
      <label>Full name<input name='name' autoComplete='name' required maxLength={200} defaultValue={selectedAddress?.name||customer?.name||''}/></label><div className='form-row'><label>Email address<input name='email' type='email' autoComplete='email' required maxLength={200} defaultValue={customer?.email||''}/></label><label>Phone number<input name='phone' type='tel' autoComplete='tel' required minLength={7} maxLength={40} defaultValue={selectedAddress?.phone||''}/></label></div>
      <div className='checkout-section-heading'><Truck size={20}/><h3>Delivery address</h3><span>{settings.country}</span></div><label>Street address<input name='address' autoComplete='street-address' required minLength={5} maxLength={1000} defaultValue={selectedAddress?.address||''}/></label><div className='form-row'><label>City<input name='city' autoComplete='address-level2' required maxLength={200} defaultValue={selectedAddress?.city||''}/></label><label>Postal code<input name='postal' autoComplete='postal-code' required minLength={2} maxLength={30} defaultValue={selectedAddress?.postal||''}/></label></div>
      <div className='checkout-section-heading'><LockKeyhole size={20}/><h3>Payment</h3></div><label className={'payment-choice '+(payment==='cod'?'selected':'')}><input type='radio' name='payment' checked={payment==='cod'} onChange={()=>setPayment('cod')}/><span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span><Package size={23}/></label>{online&&<label className={'payment-choice '+(payment==='online'?'selected':'')}><input type='radio' name='payment' checked={payment==='online'} onChange={()=>setPayment('online')}/><span><strong>Online payment</strong><small>Continue to the secure payment provider.</small></span><ShieldCheck size={23}/></label>}
      {checkoutError&&<div className='account-error' role='alert'><AlertCircle size={18}/>{checkoutError}</div>}
      <div className='cart-totals checkout-total'>{totals}</div><button className='primary full' disabled={!bag.items.length||bag.items.some(line=>!line.available)||checkoutBusy||!checkoutKey||(!settings.guestCheckout&&!customer)}>{checkoutBusy?'Saving your order...':'Place order'}<LockKeyhole size={18}/></button>
      <p className='checkout-note'>By placing an order, you agree to our <a href='/help/terms'>terms</a> and <a href='/help/privacy'>privacy policy</a>. <a href='/help/delivery'>Delivery</a> and <a href='/help/returns'>returns information</a>.</p>
     </form>
    </>}
   </div>
  </aside></div>}
  {order&&<div className='modal-backdrop'><section className='order-confirmation' role='dialog' aria-modal='true' aria-label='Order confirmation'><span className='order-success'><Check size={35}/></span><span className='eyebrow'>THANK YOU FOR YOUR ORDER</span><h2>Your order has been received.</h2><p>We have received order <strong>{order.number}</strong>.</p><div className='confirmation-note'><Package size={25}/><p>{order.online?'Check or complete your payment from the order details page.':'Payment is due on delivery. Keep your private order link to follow its status.'}</p></div><a className='primary full' href={'/orders/'+order.id+(order.token?'#'+order.token:'')}>View order details</a><button className='text-link' onClick={()=>setOrder(null)}>Continue shopping</button></section></div>}
  {zoomed&&selected&&<div className='image-zoom' role='dialog' aria-modal='true' aria-label='Enlarged product image' onClick={()=>setZoomed(false)}><button className='close-button icon-button' aria-label='Close enlarged image' onClick={()=>setZoomed(false)}><X size={26}/></button><ProductImage src={image||selected.image} alt={title(selected)} onClick={e=>e.stopPropagation()}/></div>}
 </div>;
}
