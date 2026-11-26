'use client';
import {useEffect,useMemo,useState} from 'react';
import {ChevronRight,Download,Package,Search,Trash2,Upload} from 'lucide-react';
import {money} from '@ms/shared';
import {resolveProductPrice} from '@ms/shared/src/pricing';

type Data=Record<string,any>;
type Group={key:string;name:string;products:Data[]};
export default function ProductListings({products,collections,categories,onEdit,onRemove,onExport,onImport}:{products:Data[];collections:Data[];categories:Data[];onEdit:(product:Data)=>void;onRemove:(product:Data)=>void;onExport:()=>Promise<void>;onImport:(file:File)=>Promise<void>}){
 const [query,setQuery]=useState(''),[type,setType]=useState('all'),[status,setStatus]=useState('all'),[limits,setLimits]=useState<Record<string,number>>({}),[transfer,setTransfer]=useState(false);
 const collectionMap=useMemo(()=>new Map([...products.map(product=>[product.shopId,{id:product.shopId,name:product.collectionName,category:product.collectionCategory}] as [string,Data]),...collections.map(collection=>[collection.id,collection] as [string,Data])]),[collections,products]);
 const categoryMap=useMemo(()=>new Map(categories.map(category=>[category.id,category])),[categories]);
 const groups=useMemo(()=>{
  const grouped=new Map<string,Group>();
  const familyNames=new Set([...collectionMap.values()].map(collection=>String(collection.category||'').trim().toLowerCase()));
  for(const product of products){
   const collection=collectionMap.get(product.shopId),category=categoryMap.get(product.categoryId);
   let root=category;const seen=new Set<string>();while(root?.parent_id||root?.parentId){if(seen.has(root.id))break;seen.add(root.id);const parent=categoryMap.get(root.parent_id||root.parentId);if(!parent)break;root=parent;}
   const explicitFamily=root&&(root.id!==category?.id||familyNames.has(String(root.name).trim().toLowerCase())||/^(footwear|shoes)$/i.test(root.name));
   let name=String((explicitFamily?root?.name:collection?.category)||root?.name||collection?.name||'Uncategorised').trim()||'Uncategorised';
   if(/^(footwear|shoes)$/i.test(name))name='Shoes';
   const key=name.toLocaleLowerCase();const group=grouped.get(key)||{key,name,products:[]};group.products.push(product);grouped.set(key,group);
  }
  return [...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}));
 },[products,collectionMap,categoryMap]);
 useEffect(()=>setLimits({}),[query,type,status]);
 useEffect(()=>{if(type!=='all'&&!groups.some(group=>group.key===type))setType('all')},[groups,type]);
 const needle=query.trim().toLowerCase();
 const visible=groups.filter(group=>type==='all'||group.key===type).map(group=>({...group,products:group.products.filter(product=>
  (status==='all'||product.status===status)&&(!needle||[product.name,product.slug,group.name,collectionMap.get(product.shopId)?.name,categoryMap.get(product.categoryId)?.name,...(product.variants||[]).map((variant:Data)=>variant.sku)].join(' ').toLowerCase().includes(needle))
 )})).filter(group=>group.products.length);
 const matching=visible.reduce((sum,group)=>sum+group.products.length,0);
 async function runTransfer(action:()=>Promise<void>){setTransfer(true);try{await action()}finally{setTransfer(false)}}
 return <div className='product-listing-workspace'>
  <section className='card product-listing-controls'><div className='product-listing-intro'><div><h2>Listings by product type</h2><p>Shoes, clothing and other products appear under their matching heading. Choose a type to focus on its listings.</p></div><strong>{products.length}<small>total products</small></strong></div>
   <div className='product-listing-filters'><label className='product-listing-search'><Search size={17}/><input aria-label='Search products' value={query} onChange={event=>setQuery(event.target.value)} placeholder='Search product, category or SKU'/></label><label>Product type<select aria-label='Filter product type' value={type} onChange={event=>setType(event.target.value)}><option value='all'>All product types</option>{groups.map(group=><option value={group.key} key={group.key}>{group.name} ({group.products.length})</option>)}</select></label><label>Listing status<select aria-label='Filter product status' value={status} onChange={event=>setStatus(event.target.value)}><option value='all'>All statuses</option><option value='active'>Active</option><option value='draft'>Draft</option><option value='archived'>Archived</option></select></label></div>
   <div className='product-listing-tools'><span>{matching} matching products / {visible.length} types</span><div><button type='button' className='text-link' disabled={transfer} onClick={()=>void runTransfer(onExport)}><Download size={15}/>Export CSV</button><label className={'text-link '+(transfer?'disabled':'')}><Upload size={15}/>Import CSV<input type='file' accept='.csv,text/csv' aria-label='Import product CSV' hidden disabled={transfer} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void runTransfer(()=>onImport(file))}}/></label></div></div>
  </section>
  {visible.map(group=>{const limit=limits[group.key]||12;return <section className='card product-type-group' aria-label={'Product type '+group.name} key={group.key}>
   <header className='product-type-heading'><div><span className='product-type-icon'><Package size={23}/></span><h2>{group.name}</h2></div><span>{group.products.length} {group.products.length===1?'listing':'listings'}</span></header>
   <div className='table-scroll'><table><thead><tr><th>Product</th><th>Collection / category</th><th>Price / stock</th><th>Status</th><th>Manage</th></tr></thead><tbody>{group.products.slice(0,limit).map(product=>{
    const regular=resolveProductPrice({...product,price:product.price}).unitPrice;
    return <tr key={product.id}><td><div className='record-name'>{product.image&&<img src={product.image} alt='' loading='lazy'/>}<span><strong>{product.name}</strong><small>{product.variants?.[0]?.sku||product.slug}</small></span></div></td><td>{collectionMap.get(product.shopId)?.name||'Collection unavailable'}<small className='cell-small'>{categoryMap.get(product.categoryId)?.name||product.category||'No category selected'}</small></td><td><strong>{money(regular,product.currency)}</strong>{regular<product.price&&<small className='cell-small'><del>{money(product.price,product.currency)}</del></small>}<small className='cell-small'>{product.stock||0} in stock / {product.variants?.length||0} variants</small></td><td><span className={'badge '+product.status}>{product.status}</span></td><td><div className='row-actions'><button onClick={()=>onEdit(product)}>Edit <ChevronRight size={13}/></button><button title={'Remove '+product.name} aria-label={'Remove '+product.name} onClick={()=>onRemove(product)}><Trash2 size={14}/></button></div></td></tr>;
   })}</tbody></table></div>
   {group.products.length>limit&&<div className='product-type-more'><span>Showing {limit} of {group.products.length}</span><button className='secondary' onClick={()=>setLimits(previous=>({...previous,[group.key]:limit+12}))}>Show more {group.name.toLowerCase()}</button></div>}
  </section>})}
  {!visible.length&&<section className='card empty'><Package size={30}/><h3>{products.length?'No matching listings':'No products listed yet'}</h3><p>{products.length?'Try another product type, status or search.':'Add a product and it will appear under its product type.'}</p>{(query||type!=='all'||status!=='all')&&<button className='secondary' onClick={()=>{setQuery('');setType('all');setStatus('all')}}>Clear filters</button>}</section>}
 </div>;
}
