import {openDatabase,migrate} from './db';import {seed} from './seed';
const db=await openDatabase();try{await migrate(db);if(process.argv[2]==='seed')await seed(db);console.log('Database ready.')}finally{await db.close()}
