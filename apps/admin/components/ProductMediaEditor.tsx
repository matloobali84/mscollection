'use client';
import {useRef,useState} from 'react';
import {Check,ImagePlus,Upload,X} from 'lucide-react';
import type {AdminApi} from './OrderManager';
type Data=Record<string,any>;
const maxImageMB=Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB)||10;
export default function ProductMediaEditor({product,api,onChange,onBusyChange,onError}:{product:Data;api:AdminApi;onChange:(update:(previous:Data)=>Data)=>void;onBusyChange:(busy:boolean)=>void;onError:(message:string)=>void}){
 const [uploading,setUploading]=useState(false),[progress,setProgress]=useState('');const uploadLock=useRef(false);
 const galleryWithMain=(value:Data)=>value.image&&!(value.media||[]).some((image:Data)=>image.url===value.image)?[...(value.media||[]),{url:value.image,alt:value.name||'Product image',variants:{}}]:(value.media||[]);
 const images=[...(product.image&&!(product.media||[]).some((image:Data)=>image.url===product.image)?[{url:product.image,alt:product.name||'Main product image'}]:[]),...(product.media||[])].filter((image:Data,index:number,all:Data[])=>all.findIndex(item=>item.url===image.url)===index);
 async function upload(files:File[]){
  if(uploadLock.current||!files.length)return;
  if(files.some(file=>file.size>maxImageMB*1024*1024)){onError('Each image must be '+maxImageMB+' MB or smaller.');return;}
  if(galleryWithMain(product).length+files.length>12){onError('Use at most 12 gallery images per product.');return;}
  uploadLock.current=true;setUploading(true);onBusyChange(true);onError('');
  try{for(const [index,file]of files.entries()){
   setProgress('Uploading image '+(index+1)+' of '+files.length+'…');const form=new FormData();form.append('file',file);const image=await api('media','POST',form);
   onChange(previous=>({...previous,image:previous.image||image.url,media:[...galleryWithMain(previous),image]}));
  }}catch(error){onError((error as Error).message)}finally{uploadLock.current=false;setUploading(false);setProgress('');onBusyChange(false)}
 }
 function select(url:string){if(galleryWithMain(product).length>12){onError('Remove a photo first so the gallery has at most 12 images.');return;}onChange(previous=>({...previous,media:galleryWithMain(previous),image:url}))}
 function remove(url:string){onChange(previous=>{const media=(previous.media||[]).filter((image:Data)=>image.url!==url);return {...previous,media,image:previous.image===url?(media[0]?.url||''):previous.image}})}
 return <section className='full-field product-photos'><div className='product-photos-heading'><div><h3>Product images</h3><p>Add multiple photos, then select the main image shown on the website. Other photos remain in the product gallery.</p><small>{images.length} / 12 images · JPEG, PNG, WebP or AVIF · up to {maxImageMB} MB each</small></div><label className={'secondary '+(uploading?'disabled':'')}><Upload size={16}/>{uploading?'Uploading…':'Upload images'}<input aria-label='Upload product images' type='file' multiple accept='image/jpeg,image/png,image/webp,image/avif' disabled={uploading} hidden onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void upload(files)}}/></label></div>
  {uploading&&<p className='photo-upload-progress' role='status'>{progress} Wait for the upload to finish before saving.</p>}
  <div className='product-photo-grid'>{images.map((image:Data,index:number)=><figure className={product.image===image.url?'is-main':''} key={image.url}><div className='product-photo-preview'><img src={image.url} alt={image.alt||'Product image '+(index+1)}/><button type='button' className='photo-remove' aria-label={'Remove image '+(index+1)} disabled={uploading} onClick={()=>remove(image.url)}><X size={16}/></button>{product.image===image.url&&<span className='main-image-badge'><Check size={13}/>Main image</span>}</div><figcaption><span>Image {index+1}</span><button type='button' aria-label={'Set image '+(index+1)+' as main'} aria-pressed={product.image===image.url} disabled={uploading} onClick={()=>select(image.url)}>{product.image===image.url?<><Check size={14}/>Selected as main</>:'Set as main image'}</button></figcaption></figure>)}</div>
  {!images.length&&<div className='product-photos-empty'><ImagePlus size={28}/><p>Upload front, back and detail photos of your product.</p></div>}
 </section>;
}
