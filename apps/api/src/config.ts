import {config} from 'dotenv';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
config({path:resolve(root,'.env'),quiet:true});
export const settings={port:Number(process.env.API_PORT||4000),host:process.env.API_HOST||'127.0.0.1',databaseUrl:process.env.DATABASE_URL,dataDir:resolve(root,process.env.DATA_DIR||'.data/postgres'),mediaDir:resolve(root,'.data/media'),secure:process.env.NODE_ENV==='production',origins:(process.env.APP_ORIGINS||'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,http://localhost:4000,http://127.0.0.1:4000').split(',')};
if(settings.secure&&!settings.databaseUrl)throw new Error('Production requires DATABASE_URL for PostgreSQL');
