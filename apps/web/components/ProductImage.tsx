'use client';
import type {ImgHTMLAttributes} from 'react';
export default function ProductImage(props:ImgHTMLAttributes<HTMLImageElement>){return <img {...props} src={typeof props.src==='string'&&props.src.trim()?props.src:'/product-placeholder.svg'} onError={event=>{const img=event.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='true';img.src='/product-placeholder.svg'}}/>}
