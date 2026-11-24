import pg from 'pg';
import type {Database} from './db';

/** PostgreSQL-only connection for serverless hosts; no embedded database or filesystem bootstrap. */
export function openPostgresDatabase(connectionString:string):Database{
 const pool=new pg.Pool({connectionString,max:5,idleTimeoutMillis:10000,connectionTimeoutMillis:15000});
 return {
  query:async(sql,params)=>pool.query(sql,params),
  transaction:async fn=>{
   const client=await pool.connect();
   try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}
   catch(error){await client.query('ROLLBACK');throw error}
   finally{client.release()}
  },
  close:()=>pool.end()
 };
}
