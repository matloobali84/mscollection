const {spawn}=require('node:child_process');const path=require('node:path');
const root=path.resolve(__dirname,'..');require('dotenv').config({path:path.join(root,'.env'),quiet:true});
const next=require.resolve('next/dist/bin/next'),tsx=require.resolve('tsx/cli');
const production=process.argv.includes('--production');
const targets=[['api',tsx,production?['src/server.ts']:['watch','src/server.ts']],['web',next,[production?'start':'dev','--hostname','127.0.0.1','--port','3000']],['admin',next,[production?'start':'dev','--hostname','127.0.0.1','--port','3001']]];
const children=targets.map(([name,bin,args])=>spawn(process.execPath,[bin,...args],{cwd:path.join(root,'apps',name),env:process.env,stdio:'inherit',windowsHide:true}));
let stopping=false;function stop(){if(stopping)return;stopping=true;for(const c of children)c.kill();}process.on('SIGINT',stop);process.on('SIGTERM',stop);children.forEach(c=>c.on('exit',code=>{if(!stopping&&code){stop();process.exitCode=code}}));
console.log('MS Collection: web http://localhost:3000 | admin http://localhost:3001 | API http://localhost:4000/docs');
