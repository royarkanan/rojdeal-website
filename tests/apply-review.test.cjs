const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('review updater accepts known intermediate revisions only and preserves their actual backup',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rojdeal-review-intermediate-'));try{
 const source=path.join(root,'review'),target=path.join(root,'existing');for(const dir of [path.join(source,'scripts'),path.join(source,'docs'),path.join(target,'docs')])fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync('scripts/apply-review.cjs',path.join(source,'scripts/apply-review.cjs'));fs.writeFileSync(path.join(source,'one.txt'),'newest');fs.writeFileSync(path.join(target,'package.json'),'{"name":"rojdeal-web"}');fs.writeFileSync(path.join(target,'one.txt'),'intermediate');fs.writeFileSync(path.join(target,'docs/REVIEW-CHANGES.json'),'previous manifest');
 fs.writeFileSync(path.join(source,'docs/REVIEW-CHANGES.json'),JSON.stringify({previousManifests:[sha('previous manifest')],files:[{path:'one.txt',before:sha('original'),previous:[sha('intermediate')],after:sha('newest')}]}));
 const run=()=>spawnSync(process.execPath,[path.join(source,'scripts/apply-review.cjs'),target,'--apply'],{encoding:'utf8'});
 fs.writeFileSync(path.join(target,'one.txt'),'user change');assert.notEqual(run().status,0);assert.equal(fs.readFileSync(path.join(target,'one.txt'),'utf8'),'user change');fs.writeFileSync(path.join(target,'one.txt'),'intermediate');assert.equal(run().status,0);const backup=fs.readdirSync(path.join(target,'rojdeal-review-backups'))[0];assert.equal(fs.readFileSync(path.join(target,'rojdeal-review-backups',backup,'one.txt'),'utf8'),'intermediate');assert.equal(run().status,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('review updater preserves secrets, backs up changes, is idempotent and rejects conflicts before any write',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rojdeal-review-test-'));try{
 const source=path.join(root,'review'),target=path.join(root,'existing');for(const dir of [path.join(source,'scripts'),path.join(source,'docs'),target])fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync('scripts/apply-review.cjs',path.join(source,'scripts/apply-review.cjs'));fs.writeFileSync(path.join(source,'one.txt'),'new');fs.writeFileSync(path.join(source,'two.txt'),'second');
 fs.writeFileSync(path.join(source,'docs/REVIEW-CHANGES.json'),JSON.stringify({files:[{path:'one.txt',before:sha('old'),after:sha('new')},{path:'two.txt',before:null,after:sha('second')}]}));
 fs.writeFileSync(path.join(target,'package.json'),'{"name":"rojdeal-web"}');fs.writeFileSync(path.join(target,'one.txt'),'old');fs.writeFileSync(path.join(target,'.env.local'),'private test marker');fs.writeFileSync(path.join(target,'wrangler.jsonc'),'existing domain');
 const run=(apply=true)=>spawnSync(process.execPath,[path.join(source,'scripts/apply-review.cjs'),target,...(apply?['--apply']:[])],{encoding:'utf8'});
 assert.equal(run(false).status,0);assert.equal(fs.readFileSync(path.join(target,'one.txt'),'utf8'),'old');
 fs.writeFileSync(path.join(target,'two.txt'),'concurrent edit');assert.notEqual(run().status,0);assert.equal(fs.readFileSync(path.join(target,'one.txt'),'utf8'),'old');fs.unlinkSync(path.join(target,'two.txt'));
 assert.equal(run().status,0);assert.equal(fs.readFileSync(path.join(target,'.env.local'),'utf8'),'private test marker');assert.equal(fs.readFileSync(path.join(target,'wrangler.jsonc'),'utf8'),'existing domain');assert.equal(fs.readFileSync(path.join(target,'one.txt'),'utf8'),'new');assert.ok(fs.existsSync(path.join(target,'docs/REVIEW-CHANGES.json')));assert.equal(run().status,0);
 const backup=fs.readdirSync(path.join(target,'rojdeal-review-backups'))[0];assert.equal(fs.readFileSync(path.join(target,'rojdeal-review-backups',backup,'one.txt'),'utf8'),'old');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
