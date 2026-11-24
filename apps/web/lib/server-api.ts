import type {FastifyInstance} from 'fastify';
import type {Database} from '../../api/src/db';

type HostedApi={app:FastifyInstance;db:Database};
let hosted:Promise<HostedApi>|undefined;

/** Reuse the existing commerce API inside a Node function; bootstrap is a separate deployment step. */
export function getHostedApi():Promise<HostedApi>{
 if(!process.env.DATABASE_URL)throw new Error('Configure production PostgreSQL before opening the store');
 if(!hosted)hosted=(async()=>{
  const [{openPostgresDatabase},{buildApp}]=await Promise.all([import('../../api/src/postgres'),import('../../api/src/app')]);
  const db=openPostgresDatabase(process.env.DATABASE_URL!);
  try{const app=await buildApp(db);await app.ready();return {app,db}}
  catch(error){await db.close();throw error}
 })().catch(error=>{hosted=undefined;throw error});
 return hosted;
}

export async function readHostedCatalogue(path:'catalogue'|'store'){
 const {app}=await getHostedApi(),result=await app.inject({method:'GET',url:`/api/v1/${path}`});
 if(result.statusCode!==200)throw new Error('The catalogue service is unavailable');
 return result.json();
}
