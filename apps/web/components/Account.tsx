'use client';
import {useEffect,useState} from 'react';
import {AlertCircle,Check,Heart,MapPin,Package,Plus,ShieldCheck,Trash2,Truck} from 'lucide-react';
import {request} from '../lib/client-api';
import {money} from '@ms/shared';
import {orderStatusLabel} from '@ms/shared/src/orders';
import type {StoreSettings} from '../lib/catalogue';
import PageHeader from './PageHeader';
import StoreFooter from './StoreFooter';

type Mode='login'|'register'|'forgot'|'reset';
export default function Account({settings,resellerMode=false}:{settings:StoreSettings;resellerMode?:boolean}){
 const [user,setUser]=useState<any>(null),[csrf,setCsrf]=useState(''),[orders,setOrders]=useState<any[]>([]),[addresses,setAddresses]=useState<any[]>([]);
 const [addressForm,setAddressForm]=useState(false),[mode,setMode]=useState<Mode>('login'),[token,setToken]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 async function load(){
  try{const data=await request('auth/me');setUser(data.user);setCsrf(data.csrf);const [accountOrders,savedAddresses]=await Promise.all([request('me/orders'),request('me/addresses')]);setOrders(accountOrders);setAddresses(savedAddresses)}
  catch{setUser(null)}finally{setReady(true)}
 }
 useEffect(()=>{
  const readLink=()=>{const fragment=window.location.hash;if(!resellerMode&&fragment.startsWith('#reset=')){setToken(fragment.slice(7));setMode('reset');setError('');setMessage('');history.replaceState(null,'',window.location.pathname)}};
  readLink();window.addEventListener('hashchange',readLink);void load();return()=>window.removeEventListener('hashchange',readLink);
 },[]);
 useEffect(()=>{
  if(!user)return;let active=true,loading=false;
  const refresh=async()=>{if(loading||document.visibilityState!=='visible')return;loading=true;try{const latest=await request('me/orders');if(active)setOrders(latest)}catch{}finally{loading=false}};
  const visible=()=>{void refresh()};const timer=setInterval(visible,5000);document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible)};
 },[user?.id]);
 function change(next:Mode){setMode(next);setError('');setMessage('')}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setMessage('');const form=new FormData(event.currentTarget);
  try{
   if(mode==='forgot'){const result=await request('auth/forgot-password','POST',{email:form.get('email')});setMessage(result.message)}
   else if(mode==='reset'){
    if(form.get('password')!==form.get('confirm'))throw Error('The two passwords must match.');
    const result=await request('auth/reset-password','POST',{token,password:form.get('password')});
    setToken('');setUser(null);setMode('login');setMessage(result.message);
   }else{await request('auth/'+(resellerMode?'reseller/login':mode==='register'?'register':'login'),'POST',{email:form.get('email'),password:form.get('password'),...(mode==='register'?{name:form.get('name'),phone:form.get('phone')}:{})});localStorage.setItem('ms-session-change',String(Date.now()));await load();setMode('login')}
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function saveAddress(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
  try{await request('me/addresses','POST',Object.fromEntries(form),csrf);setAddresses(await request('me/addresses'));setAddressForm(false);setMessage('Your delivery address is saved.')}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const notices=<>{error&&<div className='account-error' role='alert'><AlertCircle size={18}/>{error}</div>}{message&&<div className='account-success' role='status'><Check size={18}/>{message}</div>}</>;
 return <><main className='server-page account-page'><PageHeader active='account' logo={settings.logo}/>
  {!ready?<div className='empty-state'><UserLoading/><h3>Loading your account</h3></div>:user&&(mode!=='reset'||user.accountType==='reseller')?<>
   <div className='account-heading'><span className='eyebrow'>{user.accountType==='reseller'?'YOUR RESELLER ACCOUNT':'YOUR ACCOUNT'}</span><h1>Welcome back, {user.name.split(' ')[0]}.</h1><div className='account-toolbar'><p className='muted'>{user.email||user.username}</p><button className='text-link' onClick={async()=>{try{await request('auth/logout','POST',{},csrf);setUser(null);setMode('login');setMessage('');setOrders([]);setAddresses([]);localStorage.setItem('ms-session-change',String(Date.now()));location.href=resellerMode?'/reseller':'/account'}catch(e){setError((e as Error).message)}}}>Sign out</button></div></div>
   {notices}{user.accountType==='reseller'&&<div className='reseller-notice'><ShieldCheck size={22}/><div><strong>Reseller pricing is active</strong><p>Your product prices and bag use your reseller rates. Your administrator manages your login and password.</p><a href='/#products' className='text-link'>Shop with reseller prices</a></div></div>}<div className='account-overview'><div><strong>{orders.length}</strong><small>Your orders</small></div><div><strong>{addresses.length}</strong><small>Saved addresses</small></div><div><strong><ShieldCheck size={29}/></strong><small>Private account</small></div></div>
   <section className='account-section'><div className='account-toolbar'><h2>Order history</h2><Package size={22}/></div>
    {orders.length?orders.map(order=><a className='account-order' key={order.id} href={'/orders/'+order.id}><span><strong>{order.number}</strong><small>{new Date(order.created_at).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</small></span><span><strong>{money(order.total,order.currency)}</strong><small className={'order-state '+order.status}>{orderStatusLabel(order.status)} / View tracking</small></span></a>):<div className='care-note'><h2>Your first good find is waiting.</h2><p>Your orders will appear here once you place an order with your account.</p><a className='text-link' href='/#products'>Explore products</a></div>}
   </section>
   <section className='account-section'><div className='account-toolbar'><h2>Delivery addresses</h2><button className='text-link' onClick={()=>setAddressForm(v=>!v)}><Plus size={17}/>{addressForm?'Close form':'Add address'}</button></div>
    {addresses.map(address=><div className='saved-address' key={address.id}><MapPin size={21}/><span><strong>{address.data.name}</strong><small>{address.data.address}<br/>{address.data.city}, {address.data.postal}<br/>{address.data.country} / {address.data.phone}</small></span><button className='icon-button' aria-label={'Remove address '+address.data.name} onClick={async()=>{try{await request('me/addresses/'+address.id,'DELETE',undefined,csrf);setAddresses(items=>items.filter(a=>a.id!==address.id))}catch(e){setError((e as Error).message)}}}><Trash2 size={18}/></button></div>)}
    {!addresses.length&&!addressForm&&<p className='muted'>Save a delivery address for a faster checkout next time.</p>}
    {addressForm&&<form className='checkout-form account-form' onSubmit={saveAddress}><div className='form-row'><label>Full name<input name='name' required maxLength={200} defaultValue={user.name} autoComplete='name'/></label><label>Phone number<input name='phone' type='tel' required minLength={7} maxLength={40} autoComplete='tel'/></label></div><label>Street address<input name='address' required minLength={5} maxLength={1000} autoComplete='street-address'/></label><div className='form-row'><label>City<input name='city' required autoComplete='address-level2'/></label><label>Postal code<input name='postal' required minLength={2} maxLength={30} autoComplete='postal-code'/></label></div><label>Country<input name='country' value={settings.country} readOnly/></label><button className='primary' disabled={busy}>{busy?'Saving...':'Save address'}</button></form>}
   </section><p className='account-security'><ShieldCheck size={18}/>Need help with an order? <a href='/help/contact'>Contact customer support</a></p>
  </>:<div className='account-auth-layout'><section className='account-auth-story'><span className='eyebrow'>{resellerMode?'MS COLLECTION / RESELLER PORTAL':'YOUR MS COLLECTION ACCOUNT'}</span><h1>{resellerMode?<>Your business.<br/>Our collection.</>:<>Your everyday.<br/>A little easier.</>}</h1><p>{resellerMode?'Sign in with the credentials provided by your administrator to access reseller prices and manage your orders.':'Keep your orders, delivery details and favourite finds together in one place.'}</p><div className='account-benefits'><span><Package size={21}/>Follow your orders from checkout to delivery</span><span><Truck size={21}/>Save addresses for a faster checkout</span><span><Heart size={21}/>Keep track of your wishlist</span></div></section>
   <section className='account-auth-card'><h2>{resellerMode?'Reseller sign in':mode==='register'?'Create your account':mode==='forgot'?'Forgot your password?':mode==='reset'?'Choose a new password':'Welcome back'}</h2><p>{resellerMode?'Your account and password are managed by the store administrator.':mode==='forgot'?'Enter your email to request a secure reset link.':mode==='reset'?'Use at least 10 characters to keep your account secure.':mode==='register'?'A few details and you are ready to discover more.':'Sign in to your account to pick up where you left off.'}</p>{notices}
    <form className='checkout-form account-form' onSubmit={submit} key={mode}>
     {mode==='register'&&<><label>Your name<input name='name' required autoComplete='name' maxLength={200}/></label><label>Phone number<input name='phone' type='tel' autoComplete='tel' maxLength={40}/></label></>}
     {mode!=='reset'&&<label>{resellerMode?'Username or email':'Email address'}<input name='email' type={resellerMode?'text':'email'} required autoComplete={resellerMode?'username':'email'} maxLength={200}/></label>}
     {mode!=='forgot'&&<label>{mode==='reset'?'New password':'Password'}<input name='password' type='password' required minLength={mode==='login'?1:10} maxLength={mode==='login'?128:72} autoComplete={mode==='login'?'current-password':'new-password'}/></label>}
     {mode==='reset'&&<label>Confirm new password<input name='confirm' type='password' required minLength={10} maxLength={72} autoComplete='new-password'/></label>}
     <button className='primary full' disabled={busy}>{busy?'Please wait...':mode==='register'?'Create your account':mode==='forgot'?'Send reset link':mode==='reset'?'Update password':'Sign in'}</button>
     {!resellerMode&&mode==='login'&&<button type='button' className='text-link' onClick={()=>change('forgot')}>Forgot your password?</button>}
     {!resellerMode&&<button type='button' className='text-link' onClick={()=>change(mode==='login'?'register':'login')}>{mode==='login'?'New here? Create an account':'Back to sign in'}</button>}
    </form>{!resellerMode&&<a className='text-link' href='/reseller'>Have a reseller account? Sign in here</a>}<p className='account-security'><ShieldCheck size={17}/>Your personal details stay in a secure, private session.</p>
   </section></div>}
 </main><StoreFooter settings={settings}/></>;
}
function UserLoading(){return <ShieldCheck size={35}/>}
