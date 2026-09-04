// Builds a LOCAL ONLY test workspace from the app's existing schema history.
// No CLI command, database connection, production credentials, or remote link.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function prepare(appRoot,projectRoot){
 const app=fs.realpathSync(appRoot),root=fs.realpathSync(projectRoot),lab=path.join(root,'test-lab');
 const inputs=['schema.sql','city_upgrade.sql','professional_admin_upgrade.sql'].map((name,i)=>({source:path.join(app,'supabase',name),target:`supabase/migrations/2026010100000${i}_bootstrap_${name}`}));
 const migrations=path.join(app,'supabase/migrations');
 const excluded='20260811002422_add_platform_owners.sql';
 for(const name of fs.readdirSync(migrations).filter(n=>/^\d{14}_.*\.sql$/.test(n)).sort())if(name!==excluded)inputs.push({source:path.join(migrations,name),target:`supabase/migrations/${name}`});
 const support=path.join(root,'supabase/migrations/20260901140000_web_support_threads.sql');
 if(fs.existsSync(support))inputs.push({source:support,target:'supabase/migrations/20260901140000_web_support_threads.sql'});
 const files=inputs.map(item=>({...item,bytes:fs.readFileSync(item.source)}));
 const manifest={localOnly:true,projectId:'rojdeal-parity-local',excluded:[{file:excluded,reason:'Production account IDs only; no schema change. Never create copies of production owners in the lab.'}],inputs:files.map(f=>({file:f.target,sha256:sha(f.bytes)}))};
 const config=`project_id = "rojdeal-parity-local"\n[api]\nport = 54381\nschemas = ["public", "graphql_public"]\nextra_search_path = ["public", "extensions"]\n[db]\nport = 54382\nshadow_port = 54380\nmajor_version = 15\n[db.seed]\nenabled = false\n[studio]\nport = 54383\n[inbucket]\nport = 54384\n[auth]\nsite_url = "http://127.0.0.1:3002"\nadditional_redirect_urls = ["http://localhost:3002/**", "http://127.0.0.1:3002/**"]\n[auth.email]\nenable_signup = true\nenable_confirmations = false\n`;
 files.push({target:'supabase/config.toml',bytes:Buffer.from(config)},{target:'LOCAL-LAB.json',bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n')});
 // Preflight every destination before writing, preserving an existing lab.
 for(const f of files){const target=path.join(lab,f.target);let current=lab;for(const part of f.target.split('/')){if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error('Lab symlinks are not allowed');current=path.join(current,part);}if(fs.existsSync(target)&&(!fs.lstatSync(target).isFile()||sha(fs.readFileSync(target))!==sha(f.bytes)))throw new Error(`Local lab differs; nothing changed: ${f.target}`);}
 for(const f of files){const target=path.join(lab,f.target);if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,f.bytes,{flag:'wx'});}}
 return {lab,migrationCount:inputs.length,excluded:manifest.excluded};
}
module.exports={prepare};
if(require.main===module){
 if(!process.argv[2]){console.error('Usage: node scripts/prepare-local-lab.cjs /absolute/RojDeal-App');process.exit(1);}
 const result=prepare(process.argv[2],path.resolve(__dirname,'..'));
 console.log(`Local-only lab prepared: ${result.lab} (${result.migrationCount} schema files). Not started or tested against PostgreSQL yet.`);
 console.log('Production-owner seed excluded. Production schema files and website settings unchanged.');
 console.log('Next, with Docker and Supabase CLI installed: supabase start --workdir test-lab');
}
