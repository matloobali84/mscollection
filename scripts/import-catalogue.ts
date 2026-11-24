import {readFile} from 'node:fs/promises';
import {openDatabase,migrate} from '../apps/api/src/db';
import {settings} from '../apps/api/src/config';
import {restoreCatalogue} from '../apps/api/src/catalogue-transfer';
async function main(){
 if(!settings.databaseUrl)throw Error('Catalogue import requires the fresh standalone PostgreSQL deployment. The local embedded database is preserved.');
 if(!process.argv[2])throw Error('Pass the exported catalogue.json path.');
 const bundle=JSON.parse(await readFile(process.argv[2],'utf8')),db=await openDatabase();
 try{await migrate(db);console.log('Imported catalogue:',await restoreCatalogue(db,bundle));}finally{await db.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
