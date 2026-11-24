import {openDatabase,migrate} from './db';import {seed} from './seed';import {buildApp} from './app';import {settings} from './config';import {startWorker} from './worker';
const db=await openDatabase();await migrate(db);await seed(db);const app=await buildApp(db);const stopWorker=process.env.RUN_WORKER==='false'?async()=>{}:startWorker(db);await app.listen({port:settings.port,host:settings.host});
let stopping=false;async function stop(){if(stopping)return;stopping=true;await app.close();await stopWorker();await db.close();process.exit(0)}process.on('SIGINT',stop);process.on('SIGTERM',stop);
