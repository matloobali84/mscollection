import nodemailer from 'nodemailer';
import {orderStatusLabel} from '../../../packages/shared/src/orders';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Queue,Worker} from 'bullmq';
import type {Database} from './db';import {root,settings} from './config';
function createWorker(db:Database){
 let busy=false,stopped=false;
 const transport=process.env.SMTP_HOST?nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||1025),secure:process.env.SMTP_SECURE==='true',...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{})}):nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 async function deliver(id:string){
 const job=(await db.query("UPDATE outbox SET status='processing',locked_at=now(),attempts=attempts+1 WHERE id=$1 AND status='pending' AND attempts<5 RETURNING *",[id])).rows[0];if(!job)return;
 try{
  if(settings.secure&&!process.env.SMTP_HOST)throw new Error('SMTP is required in production');
  const p=job.payload;
  const subject=job.kind==='order-approved'?`Order ${p.number}: final bill approved`:job.kind==='password-reset'?'Reset your MS Collection password':job.kind==='order-status'?`Order ${p.number}: ${orderStatusLabel(p.status)}`:`Order ${p.number} confirmation`;
  const text=job.kind==='order-approved'?`Your order ${p.number} has been confirmed.\nOriginal amount: ${p.currency} ${p.originalTotal}\nDiscount: ${p.currency} ${p.discount}\nFinal payable: ${p.currency} ${p.total}\n${p.paymentMethod==='online'?'Pay the approved bill from your private order details page.':'Pay the approved final amount on delivery.'}`:job.kind==='password-reset'?`Use this link to set a new password:\n\n${p.url}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.`:job.kind==='order-status'?`Your order ${p.number} is now ${orderStatusLabel(p.status).toLowerCase()}.${p.courier?'\nCourier: '+p.courier:''}${p.trackingId?'\nTracking ID: '+p.trackingId:''}`:`Order ${p.number} has been received for review. Initial quote: ${p.currency} ${p.total}. Our team will confirm the final bill before payment or dispatch. Payment: ${p.paymentMethod==='online'?'online payment after bill approval':'approved amount due on delivery'}.`;
  const result=await transport.sendMail({from:process.env.EMAIL_FROM||'MS Collection <store@mscollection.local>',to:p.to,subject,text});
  if(!process.env.SMTP_HOST){await mkdir(resolve(root,'.data/mail'),{recursive:true});await writeFile(resolve(root,'.data/mail',`${job.id}.eml`),(result as any).message);}
  await db.query("UPDATE outbox SET status='sent',sent_at=now(),error=null,locked_at=null WHERE id=$1",[id]);
 }catch(e){await db.query("UPDATE outbox SET error=$1,locked_at=null,status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END WHERE id=$2",[e instanceof Error?e.message:'Delivery error',id]);}
 }
 let queue:Queue|undefined,worker:Worker|undefined;
 if(process.env.REDIS_URL){const url=new URL(process.env.REDIS_URL);const connection={host:url.hostname,port:Number(url.port||6379),username:url.username||undefined,password:url.password||undefined,...(url.protocol==='rediss:'?{tls:{}}:{})};queue=new Queue('ms-emails',{connection});worker=new Worker('ms-emails',job=>deliver(job.data.id),{connection,concurrency:2});queue.on('error',e=>console.error('Email queue:',e.message));worker.on('error',e=>console.error('Email worker:',e.message));}
 async function tick(){if(busy||stopped)return;busy=true;try{
  await db.query("UPDATE outbox SET status='pending',locked_at=null WHERE status='processing' AND locked_at<now()-interval '10 minutes'");
  const jobs=(await db.query("SELECT id FROM outbox WHERE status='pending' AND attempts<5 ORDER BY created_at LIMIT 10")).rows;
  for(const job of jobs){if(queue)await queue.add('deliver',{id:job.id},{jobId:job.id,removeOnComplete:true,removeOnFail:true});else await deliver(job.id)}
  await db.query('DELETE FROM sessions WHERE expires_at<now()');
  await db.query("DELETE FROM account_reset_tokens WHERE expires_at<now()-interval '1 day'");
 }catch(e){console.error('Outbox worker:',e instanceof Error?e.message:e)}finally{busy=false}}
 return {tick,close:async()=>{stopped=true;while(busy)await new Promise(r=>setTimeout(r,25));await worker?.close();await queue?.close();transport.close()}};
}
export function startWorker(db:Database){const worker=createWorker(db);const timer=setInterval(worker.tick,5000);timer.unref();void worker.tick();return async()=>{clearInterval(timer);await worker.close()};}
export async function drainOutbox(db:Database){const worker=createWorker(db);try{await worker.tick()}finally{await worker.close()}}
