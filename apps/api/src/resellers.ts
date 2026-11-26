import {randomUUID} from 'node:crypto';
import {hash,compare} from 'bcryptjs';
import type {FastifyInstance} from 'fastify';
import type {Database,Queryable} from './db';
import {newSession,problem} from './auth';
import {customerLoginSchema,resellerInput} from '../../../packages/shared/src/platform';

export const customerProfile=(u:any)=>({id:u.id,name:u.name,email:u.email,username:u.username||'',accountType:u.account_type||'customer'});
export async function customerTier(db:Queryable,id?:string){
 if(!id)return 'regular' as const;
 const user=(await db.query('SELECT account_type,active FROM customers WHERE id=$1',[id])).rows[0];
 return user?.active&&user.account_type==='reseller'?'reseller' as const:'regular' as const;
}
export function resellerRoutes(app:FastifyInstance,db:Database,audit:(tx:Queryable,user:any,action:string,entity:string,id:string,diff?:any)=>Promise<void>){
 app.post('/api/v1/auth/reseller/login',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async(req,reply)=>{
  const input=customerLoginSchema.parse(req.body);
  return db.transaction(async tx=>{
   const user=(await tx.query("SELECT * FROM customers WHERE account_type='reseller' AND active=true AND (lower(email)=$1 OR lower(username)=$1) FOR UPDATE",[input.email.toLowerCase()])).rows[0];
   if(!user?.password_hash||!await compare(input.password,user.password_hash))problem(401,'Invalid reseller username or password');
   return {user:customerProfile(user),csrf:await newSession(tx,reply,user.id,'customer')};
  });
 });
 app.get('/api/v1/admin/resellers',async()=> (await db.query("SELECT c.id,c.name,c.email,c.username,c.phone,c.active,c.created_at,count(o.id)::int AS orders FROM customers c LEFT JOIN orders o ON o.reseller_id=c.id WHERE c.account_type='reseller' GROUP BY c.id ORDER BY c.created_at DESC")).rows);
 async function save(id:string|undefined,raw:unknown,admin:any){
  const input=resellerInput.parse(raw);if(!id&&!input.password)problem(400,'A password is required for a new reseller');
  const passwordHash=input.password?await hash(input.password,12):undefined;
  return db.transaction(async tx=>{
   const recordId=id||randomUUID();
   if(id){
    const old=(await tx.query("SELECT * FROM customers WHERE id=$1 AND account_type='reseller' FOR UPDATE",[id])).rows[0];if(!old)problem(404,'Reseller not found');
    await tx.query('UPDATE customers SET name=$1,email=$2,username=$3,phone=$4,active=$5,password_hash=$6 WHERE id=$7',[input.name,input.email.toLowerCase()||null,input.username.toLowerCase()||null,input.phone,input.active,passwordHash||old.password_hash,id]);
    if(passwordHash||!input.active||old.email!==(input.email.toLowerCase()||null)||old.username!==(input.username.toLowerCase()||null)){
     await tx.query("DELETE FROM sessions WHERE user_id=$1 AND kind='customer'",[id]);
     await tx.query('DELETE FROM account_reset_tokens WHERE customer_id=$1',[id]);
    }
   }else await tx.query("INSERT INTO customers(id,name,email,username,phone,password_hash,active,account_type) VALUES ($1,$2,$3,$4,$5,$6,$7,'reseller')",[recordId,input.name,input.email.toLowerCase()||null,input.username.toLowerCase()||null,input.phone,passwordHash,input.active]);
   await audit(tx,admin,id?'update':'create','resellers',recordId,{passwordReset:!!passwordHash,active:input.active});
   return {id:recordId};
  });
 }
 app.post('/api/v1/admin/resellers',async req=>save(undefined,req.body,(req as any).admin));
 app.put('/api/v1/admin/resellers/:id',async req=>save((req.params as any).id,req.body,(req as any).admin));
}
