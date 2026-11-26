import Brand from '@ms/shared/src/Brand';
export default function PageHeader({active,logo}:{active?:'account'|'help';logo?:string}){
 return <nav className='page-header' aria-label='Store navigation'><a className='brand' href='/' aria-label='MS Collection home'><Brand logo={logo}/></a><div className='page-header-links'><a href='/#products'>Continue shopping</a><a href='/collections'>Collections</a><a href={active==='account'?'/help/contact':'/account'}>{active==='account'?'Need help?':'Your account'}</a></div></nav>;
}
