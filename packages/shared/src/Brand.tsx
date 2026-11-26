export default function Brand({logo,administration=false}:{logo?:string;administration?:boolean}){
 return <span className='brand-identity'>{logo?<img className='brand-logo' src={logo} alt='MS Collection'/>:<><span className='brand-mark' aria-hidden='true'>MS<span/></span><span className='brand-name'>COLLECTION<small>{administration?'STORE ADMINISTRATION':'EVERYDAY, ELEVATED.'}</small></span></>}</span>;
}
