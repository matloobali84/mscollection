import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {hash} from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import type {Database} from './db';
import {digest,secret,problem} from './auth';
import {settings} from './config';
import {passwordInput} from '../../../packages/shared/src/platform';
const password=passwordInput;
export function recoveryRoutes(app:FastifyInstance,db:Database){
 app.post('/api/v1/auth/forgot-password',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async req=>{
  const {email}=z.object({email:z.email().max(200)}).parse(req.body),origin=process.env.WEB_ORIGIN||'http://localhost:3000';
  if(settings.secure&&!process.env.SMTP_HOST)problem(503,'Account recovery is currently unavailable. Contact support.');
  if(settings.secure&&!origin.startsWith('https://'))problem(503,'Account recovery is being configured. Contact support.');
  const token=secret();
  await db.transaction(async tx=>{
   const user=(await tx.query('SELECT id FROM customers WHERE email=$1',[email.toLowerCase()])).rows[0];
   if(user){await tx.query('DELETE FROM account_reset_tokens WHERE customer_id=$1 AND used_at IS NULL',[user.id]);await tx.query("INSERT INTO account_reset_tokens(token_hash,customer_id,expires_at) VALUES ($1,$2,now()+interval '30 minutes')",[digest(token),user.id]);await tx.query('INSERT INTO outbox(id,kind,payload) VALUES ($1,$2,$3)',[randomUUID(),'password-reset',JSON.stringify({to:email.toLowerCase(),url:`${origin.replace(/\/$/,'')}/account#reset=${token}`})]);}
  });
  return {message:'If this email belongs to a customer account, a password reset link will be sent. Check your inbox and spam folder.'};
 });
 app.post('/api/v1/auth/reset-password',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async req=>{
  const input=z.object({token:z.string().min(32).max(200),password}).parse(req.body),passwordHash=await hash(input.password,12);
  await db.transaction(async tx=>{const record=(await tx.query('UPDATE account_reset_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING customer_id',[digest(input.token)])).rows[0];if(!record)problem(400,'This reset link is invalid or expired. Request a new link.');await tx.query('UPDATE customers SET password_hash=$1 WHERE id=$2',[passwordHash,record.customer_id]);await tx.query("DELETE FROM sessions WHERE user_id=$1 AND kind='customer'",[record.customer_id]);});
  return {message:'Your password has been changed. Sign in with your new password.'};
 });
}
