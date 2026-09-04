// Apply this review to the existing project; never replace deployment or secret settings.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=path.resolve(__dirname,'..');
const arg=process.argv[2];
if(!arg){console.error('Usage: node scripts/apply-review.cjs /absolute/existing/RojDeal-Web [--apply]');process.exit(1);}
const target=fs.realpathSync(path.resolve(arg));
if(target===fs.realpathSync(source))throw new Error('Choose your existing project, not the unpacked review directory.');
const pkg=JSON.parse(fs.readFileSync(path.join(target,'package.json'),'utf8'));
if(pkg.name!=='rojdeal-web')throw new Error('The target is not a RojDeal website project.');
const manifestBytes=fs.readFileSync(path.join(source,'docs/REVIEW-CHANGES.json'));
const manifest=JSON.parse(manifestBytes);
const entries=[...manifest.files,{path:'docs/REVIEW-CHANGES.json',before:manifest.previousManifest??null,previous:manifest.previousManifests??[],after:hash(manifestBytes)}];
function safe(root,relative){
 if(typeof relative!=='string'||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').some(p=>p==='..'||p==='.'||!p))throw new Error('Invalid review path.');
 if(relative.split('/').some(p=>p.startsWith('.env')||['.git','node_modules','.next','.open-next','.wrangler'].includes(p))||/^(wrangler\.|next\.config\.)/.test(relative))throw new Error('Protected configuration cannot be updated.');
 let current=root;for(const part of relative.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error(`Symlink not allowed: ${relative}`);}
 return current;
}
const plans=[];let unchanged=0;
for(const item of entries){
 const from=safe(source,item.path),to=safe(target,item.path),bytes=fs.readFileSync(from);
 if(hash(bytes)!==item.after)throw new Error(`Review file changed: ${item.path}`);
 const old=fs.existsSync(to)?fs.readFileSync(to):null,current=old?hash(old):null;
 if(current===item.after){unchanged++;continue;}
 const accepted=[item.before,...(Array.isArray(item.previous)?item.previous.filter(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)):[])];
 if(!accepted.includes(current))throw new Error(`Your file differs from the reviewed source; nothing applied. Merge this file first: ${item.path}`);
 plans.push({item,to,bytes,old,expected:current});
}
console.log(`${plans.length} targeted files to update; ${unchanged} already current. Secrets and deployment configuration are preserved.`);
for(const p of plans)console.log(p.item.path);
if(!process.argv.includes('--apply')){console.log('Preview only. Add --apply to apply these exact changes.');process.exit(0);}
if(!plans.length)process.exit(0);
const backup=path.join(target,'rojdeal-review-backups',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});
for(const p of plans)if(p.old){const dest=path.join(backup,p.item.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,p.old);}
fs.writeFileSync(path.join(backup,'CHANGES.json'),JSON.stringify(plans.map(p=>({path:p.item.path,existed:p.old!==null})),null,2));
const applied=[];
try{
 for(const p of plans){
  const now=fs.existsSync(p.to)?fs.readFileSync(p.to):null;
  if((now?hash(now):null)!==p.expected)throw new Error(`Target changed while applying: ${p.item.path}`);
  fs.mkdirSync(path.dirname(p.to),{recursive:true});const tmp=p.to+`.rojdeal-review-${process.pid}`;
  fs.writeFileSync(tmp,p.bytes);fs.renameSync(tmp,p.to);applied.push(p);
 }
}catch(error){for(const p of applied.reverse()){if(p.old)fs.writeFileSync(p.to,p.old);else fs.unlinkSync(p.to);}throw error;}
console.log(`Updated the existing project. Backup: ${backup}`);
console.log('Next: npm ci && npm run typecheck && npm run lint && npm test && npm run build');
console.log('No deployment, database change, or configuration change was performed.');
