const {spawnSync}=require('node:child_process');const path=require('node:path');
for(const app of ['web','admin']){const result=spawnSync(process.execPath,[require.resolve('next/dist/bin/next'),'build'],{cwd:path.resolve('apps',app),stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status||1);}
