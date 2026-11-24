const fs=require('node:fs/promises');require('dotenv').config({quiet:true});
(async()=>{
 const text=await fs.readFile('.data/initial-admin.txt','utf8').catch(()=>''),base=`http://127.0.0.1:${process.env.API_PORT||4000}/api/v1/admin/`;
 const email=process.env.ADMIN_EMAIL||text.match(/Email: (.+)/)?.[1].trim(),password=process.env.ADMIN_PASSWORD||text.match(/Password: (.+)/)?.[1].trim();
 if(!email||!password)throw Error('Configure owner credentials to inspect launch readiness.');
 const response=await fetch(base+'login',{method:'POST',headers:{'content-type':'application/json','x-requested-with':'MSCollection'},body:JSON.stringify({email,password})});if(!response.ok)throw Error('Owner login failed: '+response.status);
 const cookie=response.headers.getSetCookie().find(s=>s.startsWith('ms_admin=')).split(';')[0],r=await fetch(base+'launch',{headers:{cookie}});if(!r.ok)throw Error('Launch check failed: '+r.status);const result=await r.json();
 for(const check of result.checks)console.log(`${check.status.toUpperCase()}: ${check.label} — ${check.detail}`);
 console.log(result.ready?'Launch configuration is complete. Verify real delivery, payments and backups on the deployed host.':'Launch configuration still needs the actions above.');
 if(!result.ready)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
