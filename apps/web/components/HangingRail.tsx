'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Plus} from 'lucide-react';
import {money,price,productPhoto} from '@ms/shared';
import type {LiveProduct} from '../lib/catalogue';
import ProductImage from './ProductImage';

const label=(product:LiveProduct)=>product.slug.startsWith('demo-')?product.name.replace(/\s+\u00b7 Collection \d+$/,''):product.name;

export default function HangingRail({products,currency,onInspect}:{products:LiveProduct[];currency:string;onInspect:(product:LiveProduct)=>void}){
 const track=useRef<HTMLDivElement>(null);
 const [previous,setPrevious]=useState(false),[next,setNext]=useState(false);
 const items=useMemo(()=>{
  const curated=products.filter(product=>product.displayGroup==='hanger');
  const candidates=[...(curated.length?curated:products)].filter(product=>product.image&&product.stock>0).sort((a,b)=>curated.length?(a.displayOrder||0)-(b.displayOrder||0):Number(b.slug.startsWith('demo-'))-Number(a.slug.startsWith('demo-'))||(a.displayOrder||0)-(b.displayOrder||0));
  const photos=new Set<string>();
  return candidates.filter(product=>{if(photos.has(product.image))return false;photos.add(product.image);return true}).slice(0,12);
 },[products]);
 useEffect(()=>{
  const element=track.current;if(!element)return;
  const update=()=>{setPrevious(element.scrollLeft>2);setNext(element.scrollLeft+element.clientWidth<element.scrollWidth-2)};
  const observer=new ResizeObserver(update);observer.observe(element);element.addEventListener('scroll',update,{passive:true});update();
  return()=>{observer.disconnect();element.removeEventListener('scroll',update)};
 },[items]);
 function move(direction:number){const element=track.current;if(element)element.scrollBy({left:direction*element.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
 if(!items.length)return null;
 return <section className='hanging-edit' aria-labelledby='clothing-rail-heading'>
  <div className='section-heading'><div><span className='eyebrow'>THE CLOTHING RAIL</span><h2 id='clothing-rail-heading'>Good style. Just hanging.</h2><p>A closer look at pieces for your everyday wardrobe.</p></div><div className='rail-controls'><button className='icon-button' aria-label='Previous hanging products' disabled={!previous} onClick={()=>move(-1)}><ChevronLeft size={21}/></button><button className='icon-button' aria-label='Next hanging products' disabled={!next} onClick={()=>move(1)}><ChevronRight size={21}/></button></div></div>
  <div className='hanging-showroom'><div className='clothing-rod' aria-hidden='true'/>
   <div className='hanger-track' ref={track} role='list' aria-label='Hanging clothing products' aria-describedby='rail-instructions' tabIndex={0} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}}}>
    {items.map(product=><article className='hanging-product' role='listitem' key={product.id}>
     <button className='hanger-look' aria-label={'Quick view hanging '+label(product)} onClick={()=>onInspect(product)}>
      <svg className='clothes-hanger' viewBox='0 0 220 130' fill='none' aria-hidden='true'><path d='M110 44V35c0-8 14-9 14-19a14 14 0 0 0-28 0' stroke='#68706a' strokeWidth='3.5' strokeLinecap='round'/><path d='m110 43-92 53c-8 5-5 13 3 13h178c8 0 11-8 3-13L110 43Z' stroke='#887452' strokeWidth='8' strokeLinejoin='round'/><path d='m110 44-91 53M110 44l91 53' stroke='#c6b58d' strokeWidth='2' strokeLinecap='round'/></svg>
      <ProductImage src={productPhoto(product,'512')} alt={label(product)} loading='lazy' draggable={false}/>
      <span className='hanging-price-tag'><small>MS COLLECTION</small>{money(price(product),currency)}</span>
     </button>
     <div className='hanging-product-info'><a href={'/products/'+product.slug}>{label(product)}</a><span>{product.colors.slice(0,2).join(' / ')}{product.colors.length>2?' +'+(product.colors.length-2):''}</span><button onClick={()=>onInspect(product)}>Choose options<Plus size={15}/></button></div>
    </article>)}
   </div>
  </div>
  <div className='rail-footnote'><p id='rail-instructions'>Swipe the rail or use the arrows to explore.</p><span>{items.length} pieces to discover</span></div>
 </section>;
}
