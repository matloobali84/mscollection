import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
import type {Database,Queryable} from '../apps/api/src/db';

async function main(){
 const production=parse(await readFile(resolve('.data/vercel-production.env')));
 const connectionString=production.DATABASE_URL_UNPOOLED||production.DATABASE_URL;
 if(!/^postgres(?:ql)?:\/\//.test(connectionString||''))throw Error('Pull the storefront production environment into the ignored release environment file.');
 const client=new pg.Client({connectionString,connectionTimeoutMillis:15000});await client.connect();
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const migrations=(await client.query('SELECT name FROM migrations ORDER BY name')).rows.map(row=>row.name as string);
  const names=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row=>row.tablename as string);
  const tables:Record<string,unknown[]>={};for(const name of names)tables[name]=(await client.query('SELECT * FROM "'+name.replaceAll('"','""')+'"')).rows;
  const migrationSql:Record<string,string>={};for(const name of migrations)migrationSql[name]=await readFile(resolve('apps/api/migrations',name),'utf8');
  const createdAt=new Date().toISOString(),backup=JSON.stringify({version:1,createdAt,migrations,migrationSql,tables});
  const directory=resolve('.data/backups');await mkdir(directory,{recursive:true});
  const filename=resolve(directory,'production-before-release-'+createdAt.replace(/[:.]/g,'-')+'.json');await writeFile(filename,backup,{mode:0o600});
  const checksum=createHash('sha256').update(backup).digest('hex');await writeFile(filename+'.sha256',checksum+'\n',{mode:0o600});
  if(createHash('sha256').update(await readFile(filename)).digest('hex')!==checksum)throw Error('Backup checksum mismatch');
  await client.query('COMMIT');console.log('Private database backup verified:',filename);
  Object.assign(process.env,production,{NODE_ENV:'production',DATABASE_URL:connectionString,VERCEL:'1'});
  const {migrate}=await import('../apps/api/src/db');
  await client.query('BEGIN');
  try{
   await client.query("SET LOCAL lock_timeout='15s'");await client.query("SELECT pg_advisory_xact_lock(hashtext('mscollection-schema-release'))");
   const tx:Queryable={query:async(sql,params)=>client.query(sql,params)};
   const transactional:Database={...tx,transaction:async fn=>fn(tx),close:async()=>{}};
   await migrate(transactional);
   await client.query(await readFile(resolve('deploy/legacy-checkout-compatibility.sql'),'utf8'));
   for(const name of names){const count=Number((await client.query('SELECT count(*) AS count FROM "'+name.replaceAll('"','""')+'"')).rows[0].count);if(count<tables[name].length)throw Error('Existing records were lost from '+name);}
   if(Number((await client.query('SELECT count(*) AS count FROM orders WHERE original_total IS NULL')).rows[0].count))throw Error('Missing original order totals');
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  console.log('Production schema upgraded; existing records preserved; legacy checkout remains compatible.');
  console.log('Applied migrations:',(await client.query('SELECT name FROM migrations ORDER BY name')).rows.map(row=>row.name));
 }finally{await client.end()}
}
main().catch(()=>{console.error('Database release failed. Production credentials and customer data were not printed.');process.exitCode=1});
