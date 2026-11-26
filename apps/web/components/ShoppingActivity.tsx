'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ShoppingBag,Sparkles,X} from 'lucide-react';
import {money,price,productPhoto} from '@ms/shared';
import type {LiveProduct} from '../lib/catalogue';
import ProductImage from './ProductImage';

export default function ShoppingActivity({products,currency,demo,blocked,onInspect}:{products:LiveProduct[];currency:string;demo:boolean;blocked:boolean;onInspect:(product:LiveProduct)=>void}){
 const [visible,setVisible]=useState(false),[index,setIndex]=useState(0),[dismissed,setDismissed]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
 const latest=useRef(products);latest.current=products.filter(product=>product.stock>0);
 const shown=useRef(0),showing=useRef(false);showing.current=visible;
 useEffect(()=>{try{setDismissed(sessionStorage.getItem('ms-shopping-activity-hidden')==='1')}catch{}},[]);
 useEffect(()=>{
  if(blocked||dismissed){setVisible(false);return;}
  const show=()=>{if(shown.current>=3||showing.current||document.visibilityState!=='visible'||!latest.current.length)return;setIndex(shown.current%latest.current.length);shown.current++;setVisible(true)};
  const first=setTimeout(show,12000),next=setInterval(show,60000);return()=>{clearTimeout(first);clearInterval(next)};
 },[blocked,dismissed,demo]);
 useEffect(()=>{if(!visible||hovered||focused)return;const timer=setTimeout(()=>setVisible(false),10000);return()=>clearTimeout(timer)},[visible,hovered,focused]);
 function dismiss(){setVisible(false);setDismissed(true);try{sessionStorage.setItem('ms-shopping-activity-hidden','1')}catch{}}
 const product=latest.current[index];if(!visible||blocked||dismissed||!product)return null;
 const name=product.slug.startsWith('demo-')?product.name.replace(/\s+\u00b7 Collection \d+$/,''):product.name;
 return <aside className='eng-shopping-activity' aria-label={demo?'Demo shopping notification':'Product discovery notification'} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setFocused(false)}}>
  <button className='eng-activity-dismiss' onClick={dismiss} aria-label='Hide shopping notifications'><X size={15}/></button>
  <button className='eng-activity-product' onClick={()=>{setVisible(false);onInspect(product)}} aria-label={'Take a look at '+name}><ProductImage src={productPhoto(product,'256')} alt='' loading='lazy'/><span><small>{demo?<><ShoppingBag size={12}/>Demo order · example only</>:<><Sparkles size={12}/>A good find to explore</>}</small><strong>{name}</strong><span>{money(price(product),currency)}<ArrowUpRight size={15}/></span></span></button>
  {demo&&<p>Preview notification. No real purchase is claimed.</p>}
 </aside>;
}
