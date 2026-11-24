const fs=require('node:fs');const path=require('node:path');const {randomBytes}=require('node:crypto');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
(async()=>{
 const env=path.join(root,'.env');if(!fs.existsSync(env)){let text=fs.readFileSync(path.join(root,'.env.example'),'utf8');text+=`\nPOSTGRES_PASSWORD=${randomBytes(24).toString('base64url')}\nMINIO_ROOT_USER=mscollection\nMINIO_ROOT_PASSWORD=${randomBytes(24).toString('base64url')}\n`;fs.writeFileSync(env,text,{mode:0o600});console.log('Created local .env. It is ignored by Git.');}
 require('dotenv').config({path:env,quiet:true});
 const running=await fetch(`http://127.0.0.1:${process.env.API_PORT||4000}/health`,{signal:AbortSignal.timeout(1000)}).then(r=>r.ok).catch(()=>false);
 if(running){console.log('The API is already running; its database is ready.');return;}
 const result=spawnSync(process.execPath,[require.resolve('tsx/cli'),'src/manage.ts','seed'],{cwd:path.join(root,'apps/api'),stdio:'inherit',env:process.env,windowsHide:true});if(result.status)process.exit(result.status);
 console.log('Setup complete. Run npm run dev. Admin login: .data/initial-admin.txt');
})().catch(e=>{console.error(e.message);process.exit(1)});
