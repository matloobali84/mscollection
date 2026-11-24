import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {readFile,mkdir,readdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {settings,root} from './config';
export type Row=Record<string,any>;
export interface Queryable{query<T extends Row=Row>(sql:string,params?:any[]):Promise<{rows:T[]}>}
export interface Database extends Queryable{transaction<T>(fn:(tx:Queryable)=>Promise<T>):Promise<T>;close():Promise<void>}
export async function openDatabase(memory=false):Promise<Database>{
 if(settings.databaseUrl&&!memory){const pool=new pg.Pool({connectionString:settings.databaseUrl,max:10});return {query:async(sql,params)=>pool.query(sql,params),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}},close:()=>pool.end()};}
 let lockPath:string|undefined;
 if(!memory){await mkdir(settings.dataDir,{recursive:true});lockPath=settings.dataDir+'.process.lock';
  try{const handle=await open(lockPath,'wx');await handle.writeFile(String(process.pid));await handle.close();}
  catch(e:any){if(e.code!=='EEXIST')throw e;const previous=Number(await readFile(lockPath,'utf8'));let alive=false;try{if(Number.isInteger(previous)&&previous>0){process.kill(previous,0);alive=true}}catch(error:any){if(error.code!=='ESRCH')throw error}if(alive)throw new Error('The embedded database is already open in another API process. Stop it before running database tools.');await unlink(lockPath);const handle=await open(lockPath,'wx');await handle.writeFile(String(process.pid));await handle.close();}
 }

 const db=new PGlite(memory?'memory://':settings.dataDir);
 await db.waitReady;
 return {query:async<T extends Row=Row>(sql:string,params?:any[])=>db.query<T>(sql,params),transaction:fn=>db.transaction(tx=>fn({query:async<T extends Row=Row>(sql:string,params?:any[])=>tx.query<T>(sql,params)})),close:async()=>{await db.close();if(lockPath)await unlink(lockPath).catch(()=>{})}};
}
export async function migrate(db:Database){
 await db.query('CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 const directory=resolve(root,'apps/api/migrations');
 for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort()){
  if((await db.query('SELECT name FROM migrations WHERE name=$1',[name])).rows.length)continue;
  const sql=await readFile(resolve(directory,name),'utf8');
  await db.transaction(async tx=>{for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.query(statement);await tx.query('INSERT INTO migrations(name) VALUES ($1) ON CONFLICT DO NOTHING',[name]);});
 }
}
