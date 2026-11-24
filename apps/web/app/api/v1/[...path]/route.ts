import {after} from 'next/server';
import type {HTTPMethods} from 'fastify';
import {getHostedApi} from '../../../../lib/server-api';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

async function handle(request:Request){
 if(!process.env.DATABASE_URL)return Response.json({error:'The store database is not configured'},{status:503});
 try{
  const {app,db}=await getHostedApi(),url=new URL(request.url),readOnly=['GET','HEAD'].includes(request.method);
  const result=await app.inject({method:request.method as HTTPMethods,url:url.pathname+url.search,headers:Object.fromEntries(request.headers),...(!readOnly?{payload:Buffer.from(await request.arrayBuffer())}:{})});
  const headers=new Headers();
  for(const [key,value] of Object.entries(result.headers)){
   if(value===undefined||['connection','content-length','transfer-encoding','keep-alive'].includes(key.toLowerCase()))continue;
   for(const item of Array.isArray(value)?value:[value])headers.append(key,String(item));
  }
  headers.set('cache-control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&process.env.SMTP_HOST)after(async()=>{const {drainOutbox}=await import('../../../../../api/src/worker');await drainOutbox(db)});
  return new Response(request.method==='HEAD'||[204,304].includes(result.statusCode)?null:new Uint8Array(result.rawPayload),{status:result.statusCode,headers});
 }catch(error){console.error('Hosted commerce API:',error instanceof Error?error.message:'Request failed');return Response.json({error:'Service unavailable. Please try again.'},{status:503})}
}

export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE,handle as HEAD,handle as OPTIONS};
