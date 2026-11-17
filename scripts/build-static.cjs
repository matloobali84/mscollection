const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const result=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build'],{cwd:path.join(root,'apps/web'),env:{...process.env,STATIC_EXPORT:'1'},stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
fs.cpSync(path.join(root,'apps/web/out'),path.join(root,'dist'),{recursive:true});
console.log('Static site prepared in dist/');
