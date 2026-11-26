import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {FastifyRequest,FastifyReply} from 'fastify';
import type {Queryable,Database} from './db';
import {settings} from './config';
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export function problem(status:number,message:string):never{throw Object.assign(new Error(message),{statusCode:status})}
export async function session(db:Queryable,req:FastifyRequest,kind:'admin'|'customer'){
 const token=req.cookies[kind==='admin'?'ms_admin':'ms_customer'];if(!token)return null;
 const table=kind==='admin'?'admin_users':'customers';
 const rows=(await db.query(`SELECT u.*,s.csrf,s.token_hash FROM sessions s JOIN ${table} u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.kind=$2 AND s.expires_at>now() AND u.active=true`,[digest(token),kind])).rows;
 return rows[0]||null;
}
export async function newSession(db:Queryable,reply:FastifyReply,userId:string,kind:'admin'|'customer'){
 const token=secret(),csrf=secret();await db.query("INSERT INTO sessions(token_hash,user_id,kind,csrf,expires_at) VALUES ($1,$2,$3,$4,now()+interval '7 days')",[digest(token),userId,kind,csrf]);
 reply.setCookie(kind==='admin'?'ms_admin':'ms_customer',token,{httpOnly:true,secure:settings.secure,sameSite:'lax',path:'/',maxAge:604800});return csrf;
}
export function checkCsrf(req:FastifyRequest,user:any){if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers['x-csrf-token']!==user.csrf)problem(403,'Invalid CSRF token. Refresh and try again.');}
export async function cartId(db:Database,req:FastifyRequest,reply:FastifyReply){
 const user=await session(db,req,'customer');
 const id=await db.transaction(async tx=>{
  if(user)await tx.query('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[user.id]);
  const current=req.cookies.ms_cart?(await tx.query('SELECT * FROM carts WHERE id=$1',[req.cookies.ms_cart])).rows[0]:null;
  if(user){
   const saved=(await tx.query('SELECT * FROM carts WHERE customer_id=$1 ORDER BY created_at LIMIT 1',[user.id])).rows[0];
   if(saved){
    if(current&&!current.customer_id&&current.id!==saved.id){
     for(const item of (await tx.query('SELECT * FROM cart_items WHERE cart_id=$1',[current.id])).rows)await tx.query('INSERT INTO cart_items(id,cart_id,variant_id,quantity) VALUES ($1,$2,$3,$4) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=least(20,cart_items.quantity+EXCLUDED.quantity)',[randomUUID(),saved.id,item.variant_id,item.quantity]);
     await tx.query('DELETE FROM cart_items WHERE cart_id=$1',[current.id]);
    }
    return saved.id;
   }
   if(current&&!current.customer_id){await tx.query('UPDATE carts SET customer_id=$1 WHERE id=$2',[user.id,current.id]);return current.id;}
  }else if(current&&!current.customer_id)return current.id;
  const next=secret();await tx.query('INSERT INTO carts(id,customer_id) VALUES ($1,$2)',[next,user?.id||null]);return next;
 });
 if(id!==req.cookies.ms_cart)reply.setCookie('ms_cart',id,{httpOnly:true,secure:settings.secure,sameSite:'lax',path:'/',maxAge:2592000});
 return id;
}
