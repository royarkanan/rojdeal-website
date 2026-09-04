const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function assertLocalUrl(value,port){const u=new URL(value);if(u.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.port!==String(port)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('Refusing a non-local or unexpected test endpoint');return u.href.replace(/\/$/,'');}
function settings(root){
 const lab=path.join(root,'test-lab'),manifest=JSON.parse(fs.readFileSync(path.join(lab,'LOCAL-LAB.json'),'utf8'));
 if(manifest.localOnly!==true||manifest.projectId!=='rojdeal-parity-local')throw new Error('Local lab identity mismatch');
 if(fs.existsSync(path.join(lab,'supabase/.temp/project-ref')))throw new Error('Refusing a linked lab');
 const result=cp.spawnSync('supabase',['status','--workdir',lab,'--output','json'],{encoding:'utf8'});
 if(result.error||result.status!==0)throw new Error('Local Supabase is not running. Install/start Docker and the Supabase CLI on your Mac.');
 let data;try{data=JSON.parse(result.stdout);}catch{throw new Error('Cannot read local Supabase status; no credentials were displayed.');}assertLocalUrl(data.API_URL,54381);
 if(!data.ANON_KEY||!data.SERVICE_ROLE_KEY)throw new Error('Local test keys missing');
 return data;
}
module.exports={assertLocalUrl,settings};
if(require.main===module){try{settings(path.resolve(__dirname,'..'));console.log('Local-only Supabase endpoint verified. No keys printed and no data changed.');}catch(error){console.error(error.message);process.exit(1);}}
