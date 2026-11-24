import type { NextConfig } from 'next';
const config: NextConfig = {
 transpilePackages:['@ms/shared'],
 serverExternalPackages:['@electric-sql/pglite'],
 devIndicators:false,
 async redirects(){return [{source:'/mall',destination:'/',permanent:true},{source:'/model-preview',destination:'/',permanent:true},{source:'/shops/:collection/products/:product',destination:'/products/:product',permanent:true},{source:'/shops/:slug',destination:'/collections/:slug',permanent:true}]},
 async rewrites(){
  if(process.env.VERCEL==='1'&&!process.env.API_INTERNAL_URL)return [];
  const api=process.env.API_INTERNAL_URL||'http://127.0.0.1:4000';
  return [{source:'/api/:path*',destination:`${api}/api/:path*`},{source:'/media/:path*',destination:`${api}/media/:path*`}];
 }
};
export default config;
