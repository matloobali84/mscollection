const fs=require('node:fs/promises');const path=require('node:path');require('dotenv').config({quiet:true});
(async()=>{
 if(process.env.DATABASE_URL)throw new Error('For standalone PostgreSQL use pg_dump with DATABASE_URL; see docs/operations.md.');
 if(await fetch(`http://127.0.0.1:${process.env.API_PORT||4000}/health`,{signal:AbortSignal.timeout(1000)}).then(r=>r.ok).catch(()=>false))throw new Error('Stop the API before making an embedded database backup.');
 const root=path.resolve(__dirname,'..'),source=path.resolve(root,process.env.DATA_DIR||'.data/postgres'),target=path.join(root,'.data/backups',new Date().toISOString().replace(/[:.]/g,'-'));
 const lock=await fs.readFile(source+'.process.lock','utf8').catch(()=>null);if(lock){try{process.kill(Number(lock),0);throw new Error('The database process is still running. Stop it before backing up.')}catch(e){if(e.code!=='ESRCH')throw e;}}
 await fs.cp(source,target,{recursive:true,errorOnExist:true,force:false});console.log(`Backup created: ${target}`);console.log('Restore safely by setting DATA_DIR to this backup directory (or a copy), then starting the API. Never overwrite a running database.');
})().catch(e=>{console.error(e.message);process.exit(1)});
