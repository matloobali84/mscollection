'use client';
import { useEffect, useState } from 'react';
import LaunchReadiness from './LaunchReadiness';
const maxImageMB=Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB)||10;
const storefrontOrigin = (process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, '');
import { LayoutDashboard, Store, Package, Layers, ShoppingBag, Users, Tag, Settings, LogOut, Plus, Search, ArrowUpRight, ChevronRight, X, RefreshCw, ShieldCheck, FileText, Mail, Upload, CheckCircle2, AlertCircle, Trash2, Save, Menu } from 'lucide-react';
type RecordData = Record<string, any>;
type Field = {
    key: string;
    label: string;
    type?: string;
    options?: string[];
    required?: boolean;
};
const sections = [{ key: 'dashboard', label: 'Overview', icon: LayoutDashboard }, { key: 'shops', label: 'Collections', icon: Store }, { key: 'products', label: 'Products', icon: Package }, { key: 'categories', label: 'Categories', icon: Tag }, { key: 'sales', label: 'Sales & offers', icon: Tag }, { key: 'orders', label: 'Orders', icon: ShoppingBag }, { key: 'customers', label: 'Customers', icon: Users }, { key: 'users', label: 'Team & access', icon: ShieldCheck }, { key: 'launch', label: 'Launch readiness', icon: ShieldCheck }, { key: 'settings', label: 'Store settings', icon: Settings }, { key: 'audit-logs', label: 'Activity log', icon: FileText }, { key: 'email-jobs', label: 'Email deliveries', icon: Mail }];
const config: Record<string, Field[]> = {
    customers: [{ key: 'name', label: 'Customer name', required: true }, { key: 'email', label: 'Email address', type: 'email', required: true }, { key: 'phone', label: 'Phone number' }],
    shops: [{ key: 'name', label: 'Collection name', required: true }, { key: 'slug', label: 'URL slug', required: true }, { key: 'tagline', label: 'Tagline' }, { key: 'category', label: 'Category label' }, { key: 'color', label: 'Brand colour', type: 'color' }, { key: 'logo', label: 'Logo URL' }, { key: 'active', label: 'Active collection', type: 'checkbox' }],
    categories: [{ key: 'name', label: 'Category name', required: true }, { key: 'slug', label: 'URL slug', required: true }, { key: 'parentId', label: 'Parent category', type: 'categories' }, { key: 'sortOrder', label: 'Display order', type: 'number' }, { key: 'active', label: 'Active category', type: 'checkbox' }],
    products: [{ key: 'name', label: 'Product name', required: true }, { key: 'slug', label: 'URL slug', required: true }, { key: 'shopId', label: 'Collection', type: 'shops' }, { key: 'categoryId', label: 'Category', type: 'categories' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'price', label: 'Base price (whole currency units)', type: 'number' }, { key: 'currency', label: 'Currency code', required: true }, { key: 'image', label: 'Primary image URL' }, { key: 'status', label: 'Product status', options: ['draft', 'active', 'archived'] }, { key: 'gender', label: 'Gender tag', options: ['women', 'men', 'boys', 'girls', 'unisex', 'baby'] }, { key: 'ageGroup', label: 'Age group', options: ['baby', 'child', 'teen', 'adult'] }, { key: 'displayOrder', label: 'Display order', type: 'number' }, { key: 'displayGroup', label: 'Show on homepage clothing rail', type: 'hanger' }, { key: 'featured', label: 'Featured piece', type: 'checkbox' }],
    sales: [{ key: 'productId', label: 'Product', type: 'products' }, { key: 'price', label: 'Sale price', type: 'number' }, { key: 'startsAt', label: 'Starts at (local time)', type: 'datetime-local' }, { key: 'endsAt', label: 'Ends at (local time)', type: 'datetime-local' }, { key: 'pinned', label: 'Feature this offer', type: 'checkbox' }, { key: 'active', label: 'Enable scheduled sale', type: 'checkbox' }],
    users: [{ key: 'name', label: 'Full name', required: true }, { key: 'email', label: 'Email address', type: 'email', required: true }, { key: 'password', label: 'New password (12+ characters; leave blank to keep)', type: 'password' }, { key: 'role', label: 'Role', options: ['super_admin', 'manager', 'editor'] }, { key: 'active', label: 'Account active', type: 'checkbox' }],
    settings: [{ key: 'storeMode', label: 'Store mode', options: ['demo', 'live'] }, { key: 'supportWhatsApp', label: 'Support WhatsApp (international number)' }, { key: 'supportEmail', label: 'Support email', type: 'email' }, { key: 'businessAddress', label: 'Business address', type: 'textarea' }, { key: 'deliveryPolicy', label: 'Delivery policy', type: 'textarea' }, { key: 'returnsPolicy', label: 'Returns policy', type: 'textarea' }, { key: 'privacyPolicy', label: 'Privacy policy', type: 'textarea' }, { key: 'termsPolicy', label: 'Terms of service', type: 'textarea' }, { key: 'name', label: 'Store name', required: true }, { key: 'logo', label: 'Logo URL' }, { key: 'primaryColor', label: 'Primary brand colour', type: 'color' }, { key: 'currency', label: 'Currency code', required: true }, { key: 'country', label: 'Delivery country', required: true }, { key: 'shippingFee', label: 'Delivery fee', type: 'number' }, { key: 'freeShippingThreshold', label: 'Free delivery threshold', type: 'number' }, { key: 'taxPercent', label: 'Tax percentage', type: 'number' }, { key: 'guestCheckout', label: 'Allow guest checkout', type: 'checkbox' }]
};
const defaults: Record<string, RecordData> = { customers: { name: '', email: '', phone: '' }, shops: { name: '', slug: '', tagline: '', category: '', color: '#4d6358', logo: '', active: false }, categories: { name: '', slug: '', parentId: null, sortOrder: 0, active: true }, products: { name: '', slug: '', shopId: 'clothing', categoryId: null, description: '', price: 100, currency: 'PKR', status: 'draft', gender: 'unisex', ageGroup: 'adult', displayGroup: 'rack', displayOrder: 0, featured: false, image: '', media: [], variants: [{ sku: '', size: 'One size', color: 'Natural', stock: 0, priceOverride: null }] }, sales: { productId: '', price: 100, startsAt: '', endsAt: '', pinned: false, active: true }, users: { name: '', email: '', password: '', role: 'editor', active: true } };
export default function Admin() {
    const [user, setUser] = useState<RecordData | null>(null), [csrf, setCsrf] = useState(''), [section, setSection] = useState('dashboard'), [rows, setRows] = useState<RecordData[]>([]), [dashboard, setDashboard] = useState<RecordData>({}), [lookups, setLookups] = useState<Record<string, RecordData[]>>({}), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1), [editing, setEditing] = useState<RecordData | null>(null), [saving, setSaving] = useState(false), [loginBusy, setLoginBusy] = useState(false), [menu, setMenu] = useState(false), [order, setOrder] = useState<RecordData | null>(null), [storeSettings, setStoreSettings] = useState<RecordData>({});
    async function api(path: string, method = 'GET', body?: unknown) { const isForm = body instanceof FormData; const res = await fetch(`/api/v1/admin/${path}`, { method, credentials: 'include', headers: { 'x-requested-with': 'MSCollection', ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(!isForm && body ? { 'content-type': 'application/json' } : {}) }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined }); const data = await res.json(); if (!res.ok) {
        if (res.status === 401)
            setUser(null);
        throw new Error(data.error + (data.details ? ' · ' + data.details.map((x: any) => `${x.path}: ${x.message}`).join('; ') : ''));
    } return data; }
    useEffect(() => { fetch('/api/v1/admin/me').then(r => r.ok ? r.json() : null).then(d => { if (d) {
        setUser(d.user);
        setSection(d.user.role === 'editor' ? 'products' : 'dashboard');
        setCsrf(d.csrf);
    } }).catch(() => setError('The API is unavailable. Start the backend and try again.')).finally(() => setLoading(false)); }, []);
    useEffect(() => { if (!notice)
        return; const t = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(t); }, [notice]);
    async function load() { setLoading(true); setError(''); try {
        if (section === 'dashboard')
            setDashboard(await api('dashboard'));
        else if (section === 'launch')
            setDashboard(await api('launch'));
        else if (section === 'settings')
            setEditing(await api('settings'));
        else
            setRows(await api(section));
        const keys = user?.role === 'editor' ? ['products', 'categories'] : ['shops', 'categories', 'products'];
        const values = await Promise.all(keys.map(k => api(k)));
        setLookups(Object.fromEntries(keys.map((k, i) => [k, values[i]])));
        if (user?.role === 'super_admin')
            setStoreSettings(await api('settings'));
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { if (user) {
        if (user.role === 'editor' && !['products', 'categories', 'sales'].includes(section)) {
            setSection('products');
            return;
        }
        void load();
    } }, [user, section]);
    async function login(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setLoginBusy(true); setError(''); const f = new FormData(e.currentTarget); try {
        const d = await api('login', 'POST', { email: f.get('email'), password: f.get('password') });
        setCsrf(d.csrf);
        setSection(d.user.role === 'editor' ? 'products' : 'dashboard');
        setUser(d.user);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setLoginBusy(false);
    } }
    function edit(row?: RecordData) {
        setError('');
        if(!row){setEditing(structuredClone({...defaults[section],...(section==='products'?{currency:storeSettings.currency||'PKR'}:{})}));return;}
        const d={...row};
        for(const [camel,snake] of Object.entries({parentId:'parent_id',productId:'product_id',sortOrder:'sort_order',startsAt:'starts_at',endsAt:'ends_at'}))if(d[camel]===undefined)d[camel]=d[snake];
        if(section==='sales')for(const key of ['startsAt','endsAt']){const date=new Date(d[key]);d[key]=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
        if(section==='users')d.password='';
        setEditing(d);
    }
    async function save(e: React.FormEvent) { e.preventDefault(); if (!editing)
        return; setSaving(true); setError(''); try {
        const d = { ...editing };
        if (section === 'users' && !d.password)
            delete d.password;
        if (section === 'sales')
            for (const key of ['startsAt', 'endsAt'])
                d[key] = new Date(d[key]).toISOString();
        await api(section + (section !== 'settings' && d.id ? `/${d.id}` : ''), section === 'settings' || d.id ? 'PUT' : 'POST', d);
        setNotice('Changes saved to the store.');
        if (section !== 'settings')
            setEditing(null);
        await load();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setSaving(false);
    } }
    async function remove(row: RecordData) { if (!window.confirm(`Remove ${row.name || row.label || 'this record'}? Products and orders are retained.`))
        return; try {
        await api(`${section}/${row.databaseId || row.id}`, 'DELETE');
        setNotice('Record removed.');
        await load();
    }
    catch (e) {
        setError((e as Error).message);
    } }
    const nav = sections.filter(s => user?.role === 'editor' ? ['products', 'categories', 'sales'].includes(s.key) : user?.role === 'manager' ? !['users', 'settings', 'launch'].includes(s.key) : true);
    useEffect(() => setPage(1), [query, section]);
    const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
    const title = sections.find(s => s.key === section)?.label || section;
    const editable = !!config[section] && section !== 'settings';
    const format = (n: number, currency = storeSettings.currency || 'PKR') => `${currency} ${Number(n || 0).toLocaleString()}`;
    function field(f:Field){
        if(!editing)return null;
        const value=editing[f.key]??'',options=lookups[f.type||'']?.filter(r=>f.key!=='parentId'||r.id!==editing.id);
        const change=(value:any)=>setEditing({...editing,[f.key]:value,...(f.key==='name'&&!editing.id?{slug:String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}:{})});
        if(f.type==='hanger')return <label className="check-field" key={f.key}><input type="checkbox" checked={value==='hanger'} onChange={e=>change(e.target.checked?'hanger':'rack')}/><span>{f.label}<small className="rail-admin-help">Use a front-facing garment photo on a transparent background. Display order controls its position.</small></span></label>;
        if(f.type==='checkbox')return <label className="check-field" key={f.key}><input type="checkbox" checked={!!value} onChange={e=>change(e.target.checked)}/><span>{f.label}</span></label>;
        return <label key={f.key} className={f.type==='textarea'?'full-field':''}>{f.label}{f.type==='textarea'?<textarea aria-label={f.label} value={value} rows={4} onChange={e=>change(e.target.value)}/>:f.options||options?<select aria-label={f.label} value={value} required={f.required||['shopId','productId'].includes(f.key)} onChange={e=>change(e.target.value||null)}>{options&&<option value="">{['parentId','categoryId'].includes(f.key)?'None':'Choose?'}</option>}{f.options?.map(o=><option key={o}>{o}</option>)}{options?.map(o=><option key={o.id} value={o.id}>{o.name||o.label}</option>)}</select>:<input aria-label={f.label} type={f.type||'text'} value={value} required={f.required} min={f.type==='number'?0:undefined} step={f.type==='number'?(f.key==='taxPercent'?'.01':'1'):undefined} autoComplete={f.type==='password'?'new-password':undefined} onChange={e=>change(f.type==='number'?Number(e.target.value):e.target.value)}/>}</label>;
    }
    const modalOpen=!!order||!!editing&&section!=='settings'||menu;
    useEffect(()=>{
        if(!modalOpen)return;
        const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
        const dialogs=document.querySelectorAll<HTMLElement>('[role=dialog]'),dialog=dialogs[dialogs.length-1];
        const frame=requestAnimationFrame(()=>dialog?.querySelector<HTMLElement>('button,input,select,textarea,a[href]')?.focus());
        const keys=(event:KeyboardEvent)=>{if(event.key==='Escape'){setEditing(null);setOrder(null);setMenu(false)}if(event.key!=='Tab'||!dialog)return;const controls=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(el=>el.getClientRects().length>0);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first?.focus()}};
        document.addEventListener('keydown',keys);return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keys);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus()};
    },[modalOpen]);
    if (!user)
        return <main className="login-page"><div className="login-story"><a className="wordmark" href={storefrontOrigin || '/'}>MS <span>COLLECTION</span></a><span className="story-tag">MS COLLECTION / STORE ADMIN</span><h1>Your store.<br /><em>Under control.</em></h1><p>Manage your products, fulfil orders and keep your store moving.</p><span className="story-foot">YOUR COLLECTION. YOUR CONTROL.</span></div><div className="login-form"><div className="mini-brand">MS / ADMINISTRATION</div><h2>Welcome back.</h2><p>Sign in to manage your collection.</p>{error && <div className="error"><AlertCircle size={17}/>{error}</div>}<form onSubmit={login}><label>Username or email<input name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button className="primary" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in to your store'}</button></form><span className="login-note"><ShieldCheck size={15}/>Your store is protected with secure session access.</span></div></main>;
    return <div className="admin-layout">{menu&&<button className="admin-menu-backdrop" aria-label="Close admin navigation" onClick={()=>setMenu(false)}/>}<aside className={`sidebar ${menu ? 'open' : ''}`} role={menu?'dialog':undefined} aria-modal={menu?true:undefined} aria-label="Administration navigation"><a className="wordmark" href={storefrontOrigin||'/'} target="_blank">MS <span>COLLECTION<small>STORE ADMINISTRATION</small></span></a><button className="sidebar-close" aria-label="Close navigation" onClick={()=>setMenu(false)}><X size={22}/></button><div className="workspace"><span>MS</span><div><strong>Your online store</strong><small>Store management</small></div><span className="online-dot"/></div><div className="nav-label">WORKSPACE</div><nav>{nav.map(s => <button key={s.key} className={section === s.key ? 'active' : ''} onClick={() => { setSection(s.key); setEditing(null); setQuery(''); setMenu(false); }}><s.icon size={17}/>{s.label}{s.key === 'orders' && dashboard.pending > 0 && <b>{dashboard.pending}</b>}</button>)}</nav><a className="view-store" href={storefrontOrigin||'/'} target="_blank">Visit your store </a><div className="user-box"><span>{user.name[0]}</span><div><strong>{user.name}</strong><small>{user.role.replace('_', ' ')}</small></div><button title="Sign out" onClick={async () => { await api('logout', 'POST'); setUser(null); setCsrf(''); }}><LogOut size={16}/></button></div></aside><div className="admin-main"><header><div className="breadcrumb"><button className="menu-button" aria-label="Toggle admin navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={19}/></button>Workspace <ChevronRight size={13}/><strong>{title}</strong></div><div className="header-right"><span className="connected"><i />Connected to your store</span><button title="Refresh" onClick={load}><RefreshCw size={17}/></button></div></header><main><div className="page-heading"><div><span className="overline">YOUR STORE, AT A GLANCE</span><h1>{section === 'dashboard' ? 'Store overview' : title}</h1><p>{section === 'dashboard' ? 'Manage products, orders and customers from one workspace.' : `Manage your ${title.toLowerCase()} with care. Changes are saved to your database.`}</p></div>{editable && <button className="primary" onClick={() => edit()}><Plus size={16}/>Add {section === 'shops' ? 'collection' : section === 'categories' ? 'category' : section === 'sales' ? 'sale' : section === 'users' ? 'team member' : section.slice(0, -1)}</button>}{section === 'dashboard' && <a className="secondary" href={storefrontOrigin||'/'} target="_blank">Explore your store </a>}</div>{error && <div className="error"><AlertCircle size={17}/>{error}<button onClick={() => setError('')}><X size={15}/></button></div>}{loading ? <div className="loading"><RefreshCw size={20}/>Gathering your collection…</div> : section === 'dashboard' ? <><div className="stat-grid">{[{ label: 'Collected revenue', value: format(dashboard.revenue), icon: ShoppingBag, note: 'Delivered orders paid in cash' }, { label: 'Total orders', value: dashboard.orders || 0, icon: Package, note: 'Every discovery, accounted for' }, { label: 'Awaiting fulfilment', value: dashboard.pending || 0, icon: Store, note: 'Orders ready for your attention' }, { label: 'Active collections', value: lookups.shops?.filter(s => s.active).length || 0, icon: Layers, note: 'Collections available to customers' }].map(s => <div className="stat" key={s.label}><div><span>{s.label}</span><s.icon size={18}/></div><strong>{s.value}</strong><small>{s.note}</small></div>)}</div><div className="dashboard-grid"><section className="card"><div className="card-title"><div><h3>Recent orders</h3><p>Your most recent orders.</p></div><button className="text-link" onClick={() => setSection('orders')}>View all </button></div>{dashboard.recentOrders?.length ? <table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>{dashboard.recentOrders.map((o: any) => <tr key={o.id} onClick={() => { setSection('orders'); }}><td className="strong">{o.number}</td><td>{o.email}</td><td>{format(o.total, o.currency)}</td><td><span className={`badge ${o.status}`}>{o.status}</span></td></tr>)}</tbody></table> : <div className="empty"><ShoppingBag size={30}/><h3>No orders yet</h3><p>New orders will appear here.</p></div>}</section><section className="card"><div className="card-title"><div><h3>Inventory alerts</h3><p>Products that need a stock check.</p></div><Package size={18}/></div>{dashboard.lowStock?.length ? dashboard.lowStock.slice(0, 8).map((p: any) => <div className="stock-row" key={p.id}><span><strong>{p.name}</strong><small>{p.sku}</small></span><b>{p.stock} left</b></div>) : <div className="empty"><CheckCircle2 size={28}/><h3>Stock is looking good</h3><p>No low stock alerts right now.</p></div>}</section></div><div className="admin-banner"><div><span className="overline">YOUR CATALOGUE</span><h2>Keep your catalogue up to date.</h2><p>Add products, update stock and organise your collections.</p></div><button className="primary" onClick={() => setSection('products')}>Manage your collection </button></div></> : section === 'launch' ? <LaunchReadiness data={dashboard} onSettings={() => setSection('settings')}/> : section === 'settings' ? <section className="card settings-card"><h3>The details that make it yours</h3><p className="subtle">Currency changes update checkout and future orders. Existing orders retain their purchase currency.</p><form className="record-form" onSubmit={save}>{config.settings.map(field)}<div className="form-actions"><button className="primary" disabled={saving}><Save size={16}/>{saving ? 'Saving…' : 'Save store settings'}</button></div></form></section> : <section className="card"><div className="table-toolbar"><label><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} aria-label={'Search '+title.toLowerCase()} placeholder={'Search '+title.toLowerCase()}/></label><div className="table-extra">{section === 'products' && <><button type="button" className="text-link" onClick={async () => { try {
        const res = await fetch('/api/v1/admin/products/export');
        if (!res.ok)
            throw new Error('Export failed');
        const blob = await res.blob(), url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
    catch (e) {
        setError((e as Error).message);
    } }}>Export CSV</button><label className="text-link">Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; try {
        const result = await api('products/import', 'POST', { csv: await file.text() });
        setNotice(`${result.imported} products imported.`);
        await load();
    }
    catch (e) {
        setError((e as Error).message);
    } }}/></label></>}<span>{filtered.length} records</span></div></div><div className="table-scroll"><table><thead><tr><th>{['orders', 'audit-logs', 'email-jobs'].includes(section) ? 'Reference' : 'Name'}</th><th>Details</th><th>{section === 'products' ? 'Price / stock' : 'Status'}</th><th>Manage</th></tr></thead><tbody>{filtered.slice((page - 1) * 25, page * 25).map((r, i) => <tr key={r.id || i}><td><div className="record-name">{r.image && <img src={r.image} alt=""/>}<span><strong>{r.name || r.number || r.kind || r.action || r.label || r.key}</strong><small>{r.slug || r.email || r.sku || r.entity_id || r.id}</small></span></div></td><td>{section === 'shops' ? (r.category || 'Collection') : section === 'products' ? lookups.shops?.find(s => s.id === r.shopId)?.name : section === 'sales' ? `${lookups.products?.find(p => p.id === r.product_id)?.name || ''} · ${format(r.price)}` : section === 'orders' ? format(r.total, r.currency) : section === 'audit-logs' ? `${r.admin_name} · ${r.entity}` : section === 'email-jobs' ? `${r.attempts} attempts${r.error ? ' · ' + r.error : ''}` : section === 'users' ? r.role : r.phone || r.level || r.parent_id || new Date(r.created_at || Date.now()).toLocaleDateString()}</td><td>{section === 'products' ? <span>{format(r.salePrice || r.price, r.currency)}<small className="cell-small">{r.stock} in stock · {r.status}</small></span> : <span className={`badge ${r.status || ((r.active ?? true) ? 'active' : 'hidden')}`}>{r.status || (r.active === false ? 'Hidden' : section === 'sales' ? (new Date(r.ends_at) < new Date() ? 'Expired' : new Date(r.starts_at) > new Date() ? 'Scheduled' : 'Active') : 'Active')}</span>}</td><td><div className="row-actions">{editable && <button onClick={() => edit(r)}>Edit <ChevronRight size={13}/></button>}{editable && !['users', 'customers'].includes(section) && <button title="Remove record" onClick={() => remove(r)}><Trash2 size={14}/></button>}{section === 'orders' && <button onClick={async () => setOrder(await api(`orders/${r.id}`))}>View order <ChevronRight size={13}/></button>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty"><Package size={28}/><h3>Nothing here just yet.</h3><p>{editable ? 'Add your first record to get started.' : 'New activity will appear here.'}</p></div>}</div>{filtered.length > 25 && <div className="table-pagination"><span>Showing {(page - 1) * 25 + 1} - {Math.min(page * 25, filtered.length)} of {filtered.length}</span><div><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 25 >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</button></div></div>}</section>}</main><footer>MS Collection <span>Thoughtfully managed.</span><span>Secure workspace · {user.role.replace('_', ' ')}</span></footer></div>
 {editing && section !== 'settings' && <div className="overlay" onClick={() => setEditing(null)}><section className="editor" role="dialog" aria-modal="true" aria-label={`${editing.id ? 'Edit' : 'Add'} ${section}`} onClick={e => e.stopPropagation()}><div className="editor-header"><div><span className="overline">THE DETAILS MATTER</span><h2>{editing.id ? 'Edit' : 'Add'} {section === 'shops' ? 'collection' : section === 'categories' ? 'category' : section === 'sales' ? 'sale' : section.slice(0, -1)}</h2></div><button aria-label="Close editor" onClick={() => setEditing(null)}><X size={22}/></button></div>{error && <div className="error">{error}</div>}<form className="record-form" onSubmit={save}>{config[section]?.map(field)}{section === 'products' && <><div className="full-field upload-box"><span><strong>Product photography</strong><small>Front facing, plain background. JPEG, PNG, WebP or AVIF, up to {maxImageMB} MB. Images are resized and compressed automatically.</small></span><label className="secondary"><Upload size={15}/>Upload image<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={async (e) => { const files = Array.from(e.target.files || []); if(files.some(file=>file.size>maxImageMB*1024*1024)){setError(`Each image must be ${maxImageMB} MB or smaller.`);return;} if ((editing.media?.length || 0) + files.length > 12) {
        setError('Use at most 12 images per product.');
        return;
    } try {
        for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            const d = await api('media', 'POST', form);
            setEditing(previous => previous ? { ...previous, image: previous.image || d.url, media: [...(previous.media || []), d] } : null);
        }
    }
    catch (e) {
        setError((e as Error).message);
    } }}/></label></div><div className="full-field media-thumbs">{editing.media?.map((m: any, i: number) => <button type="button" key={m.url} title="Remove this image" onClick={() => setEditing({ ...editing, media: editing.media.filter((_: any, n: number) => n !== i), image: editing.image === m.url ? editing.media.find((_: any, n: number) => n !== i)?.url || '' : editing.image })}><img src={m.url} alt={m.alt || 'Product image'}/><X size={12}/></button>)}</div><div className="full-field variants"><div className="variant-heading"><h3>Variants & inventory</h3><button type="button" className="text-link" onClick={() => setEditing({ ...editing, variants: [...editing.variants, { sku: '', size: 'One size', color: 'Natural', stock: 0, priceOverride: null }] })}><Plus size={14}/>Add variant</button></div>{editing.variants.map((v: any, i: number) => <div className="variant-row" key={i}>{[{ key: 'sku', label: 'SKU' }, { key: 'size', label: 'Size' }, { key: 'color', label: 'Colour' }, { key: 'stock', label: 'Stock', type: 'number' }, { key: 'priceOverride', label: 'Price override', type: 'number' }].map(f => <label key={f.key}>{f.label}<input aria-label={f.label} required={f.key !== 'priceOverride'} type={f.type || 'text'} min={0} value={v[f.key] ?? ''} onChange={e => setEditing({ ...editing, variants: editing.variants.map((x: any, n: number) => n === i ? { ...x, [f.key]: f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value } : x) })}/></label>)}<button type="button" title="Remove variant" disabled={editing.variants.length === 1} onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_: any, n: number) => n !== i) })}><Trash2 size={15}/></button></div>)}</div></>}<div className="form-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button><button className="primary" disabled={saving}><Save size={16}/>{saving ? 'Saving…' : 'Save changes'}</button></div></form></section></div>}
 {order && <div className="overlay" onClick={() => setOrder(null)}><section className="editor order-editor" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}><div className="editor-header"><div><span className="overline">A CUSTOMER’S LITTLE DISCOVERIES</span><h2>{order.number}</h2></div><button onClick={() => setOrder(null)}><X size={22}/></button></div><div className="order-summary"><span><strong>{order.shipping_address.name}</strong>{order.email}<br />{order.shipping_address.phone}</span><span>{order.shipping_address.address}<br />{order.shipping_address.city}, {order.shipping_address.postal}<br />{order.shipping_address.country}</span></div>{order.items.map((i: any) => <div className="order-line" key={i.id}><span><strong>{i.name_snapshot}</strong><small>{i.variant_snapshot} · Qty {i.quantity}</small></span><b>{format(i.price_snapshot * i.quantity, order.currency)}</b></div>)}<div className="order-total"><span>Total · {order.payment_method} / {order.payment_status}</span><strong>{format(order.total, order.currency)}</strong></div><label className="notes">Order notes<textarea value={order.notes || ''} onChange={e => setOrder({ ...order, notes: e.target.value })}/></label><div className="form-actions"><label>Order status<select value={order.status} onChange={e => setOrder({ ...order, status: e.target.value })}>{['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'].map(s => <option key={s}>{s}</option>)}</select></label><button className="primary" onClick={async () => { try {
        await api(`orders/${order.id}`, 'PATCH', { status: order.status, notes: order.notes });
        setOrder(null);
        setNotice('Order updated.');
        await load();
    }
    catch (e) {
        setError((e as Error).message);
    } }}>Update order</button></div>{error && <div className="error">{error}</div>}</section></div>}
 {notice && <div className="notice" role="status"><CheckCircle2 size={17}/>{notice}</div>}
 </div>;
}
