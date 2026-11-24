import {settings} from './config';import {openDatabase} from './db';import {startWorker} from './worker';
if(!settings.databaseUrl)throw new Error('A separate worker process requires standalone PostgreSQL. Local embedded mode runs the worker inside the API.');
const db=await openDatabase();const stop=startWorker(db);console.log('Mail worker running');const alive=setInterval(()=>{},60000);async function close(){clearInterval(alive);await stop();await db.close();process.exit(0)}process.on('SIGINT',close);process.on('SIGTERM',close);
