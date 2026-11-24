export default function PageHeader({active}:{active?:'account'|'help'}){
 return <nav className='page-header' aria-label='Store navigation'><a className='brand' href='/' aria-label='MS Collection home'><span className='brand-mark'>MS<span/></span><span className='brand-name'>COLLECTION<small>EVERYDAY, ELEVATED.</small></span></a><div className='page-header-links'><a href='/#products'>Continue shopping</a><a href='/collections'>Collections</a><a href={active==='account'?'/help/contact':'/account'}>{active==='account'?'Need help?':'Your account'}</a></div></nav>;
}
