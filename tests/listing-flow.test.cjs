const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps={}) {
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,n=>deps[n]??require(n));return module.exports;
}
const auth=load('src/lib/auth-return.ts');
test('listing login destinations retain locale and reject unsafe or repeated redirects',()=>{
 const id='83f43c66-5885-4529-9ed5-bca933b29238';
 for(const lang of ['ar','ku','de','en']){
  assert.equal(auth.authReturnPath(lang,`/${lang}/listings/new`),`/${lang}/listings/new`);
  assert.equal(auth.authReturnPath(lang,`/${lang}/listings/${id}/edit`),`/${lang}/listings/${id}/edit`);
  for(const next of [undefined,[],[`/${lang}/listings/new`],'https://evil.test','//evil.test',`/${lang}/../evil`,`/${lang}/listings/new?next=evil`,`/${lang}/auth`,`/${lang}\\evil`,`/${lang}/%2e%2e/evil`])assert.equal(auth.authReturnPath(lang,next),`/${lang}/account`);
 }
});
test('network and permission failures are not diagnosed as signed out',()=>{
 for(const e of [new TypeError('Failed to fetch'),{code:'42501'},{message:'session statistics unavailable'},{message:'JWT service temporarily unavailable'}])assert.equal(auth.needsListingLogin(e),false);
 assert.equal(auth.needsListingLogin({code:'session_not_found'}),true);
 assert.equal(auth.needsListingLogin({name:'AuthSessionMissingError'}),true);
});
const feedback=load('src/lib/listing-feedback.ts',{'./auth-return':auth});
test('listing errors are actionable and localized without exposing server details',()=>{
 for(const lang of ['ar','ku','de','en']){
  const t=feedback.listingFeedback[lang];
  assert.equal(feedback.listingError({code:'42501',message:'secret schema name'},lang),t.permission);
  assert.equal(feedback.listingError(new TypeError('Failed to fetch'),lang),t.network);
  assert.equal(feedback.listingError(new Error('image_limit'),lang),t.image);
  assert.equal(feedback.listingError(new Error('private SQL details'),lang),t.failed);
 }
});
function fixture(){
 const db={listings:[],listing_media:[],profiles:[{id:'owner',display_name:'Tester'}],platform_content:[{id:true,listing_video_policy:'review'}],listing_categories_config:['property','vehicle','other'].map(category_key=>({id:`category-${category_key}`,category_key,is_active:true}))};
 const uploads=new Map();const calls=[];let fail=null;let owner='owner';
 function query(table){const filters=[];let action='select',values;let single=false;
 const q={select(){return q},eq(k,v){filters.push([k,v]);return q},limit(){return q},single(){single=true;return q},maybeSingle(){single=true;return q},insert(v){action='insert';values=v;return q},update(v){action='update';values=v;return q},delete(){action='delete';return q},in(){return q},then(ok,bad){
  return Promise.resolve().then(()=>{
   calls.push({table,action,values,filters});
   const hit=fail&&fail({table,action,values,filters});
   if(hit&&!hit.after)return {data:null,error:hit.error};
   let selected=(db[table]??[]).filter(r=>filters.every(([k,v])=>r[k]===v));
   if(action==='insert'){if(db[table].some(r=>r.id===values.id)&&values.id)return{data:null,error:{code:'23505'}};db[table].push({...values});selected=[values];}
   if(action==='update')selected.forEach(r=>Object.assign(r,values));
   if(hit)return{data:null,error:hit.error};
   return{data:single?(selected[0]??null):selected,error:null};
  }).then(ok,bad);
 }};return q;}
 const supabase={auth:{getUser:async()=>({data:{user:owner?{id:owner,email:'test@example.invalid'}:null},error:null})},from:query,rpc:async(name,args)=>{
   const call={table:'rpc',action:name,values:args};calls.push(call);const hit=fail&&fail(call);if(hit&&!hit.after)return {data:null,error:hit.error};
   if(name==='replace_own_listing_video'){
     const previous=db.listing_media.find(r=>r.listing_id===args.target_listing&&r.kind==='video');
     db.listing_media=db.listing_media.filter(r=>r.listing_id!==args.target_listing||r.kind!=='video');
     if(args.new_storage_path)db.listing_media.push({id:crypto.randomUUID(),listing_id:args.target_listing,owner_id:owner,kind:'video',storage_path:args.new_storage_path});
     return {data:hit?null:[{old_storage_path:previous?.storage_path??null}],error:hit?.error??null};
   }return {data:1,error:null};
 },storage:{from:()=>({upload:async(path,file)=>{calls.push({table:'storage',action:'upload',values:{path,file}});const hit=fail&&fail({table:'storage',action:'upload',values:{path,file}});if(hit)return{error:hit.error};if(uploads.has(path))return{error:{statusCode:'409'}};uploads.set(path,file);return{error:null}},remove:async(paths)=>{calls.push({table:'storage',action:'remove',values:{paths}});paths.forEach(p=>uploads.delete(p));return{error:null}}})}};
 const api=load('src/services/listing-editor.ts',{'@/lib/supabase':{supabase},'./locations':{}});
 return{api,db,calls,uploads,setFailure:f=>fail=f,setOwner:v=>owner=v};
}
const draft={title:'House',description:'A house',category:'property',categoryTypeId:null,direction:'offer',transactionType:'sale',customTransaction:'',price:100,priceType:'fixed',currency:'USD',locationNodeId:1,phone:'',directCall:false,whatsapp:false,chat:true,attributes:{rooms:2}};
const file=()=>new File(['image'],'photo.jpg',{type:'image/jpeg'});
test('listing coordinates round-trip through create/edit and invalid or incomplete pairs are rejected',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress();await f.api.createListing({...draft,latitude:0,longitude:0},[],null,p);assert.equal(f.db.listings[0].latitude,0);assert.equal(f.calls.find(c=>c.table==='rpc'&&c.action==='resolve_listing_city').values.selected_latitude,0);await f.api.updateListing(p.listingId,{...draft,latitude:36.9,longitude:38.3},[],null,p);assert.equal(f.db.listings[0].longitude,38.3);
 for(const coordinates of [{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:0,longitude:null},{latitude:NaN,longitude:0}])assert.throws(()=>f.api.draftCoordinates(coordinates),/invalid_coordinates/);
 assert.deepEqual(f.api.draftCoordinates({}),{latitude:null,longitude:null});
});
test('map links never use unsafe strings or nonfinite coordinates',()=>{const {coordinateMapUrl}=load('src/lib/geo.ts');assert.match(coordinateMapUrl(0,0),/^https:\/\/www.openstreetmap.org\//);for(const pair of [[null,1],['javascript:alert(1)',0],[Infinity,1],[91,0],[0,-181]])assert.equal(coordinateMapUrl(...pair),null);});
test('video replacement uses the app RPC and retains the old video if the transaction fails',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress();await f.api.createListing(draft,[],null,p);f.db.listing_media.push({id:'old',listing_id:p.listingId,owner_id:'owner',kind:'video',storage_path:`owner/${p.listingId}/old.mp4`});
 const video={file:new File(['video'],'clip.mp4',{type:'video/mp4'}),duration:8};f.setFailure(c=>c.table==='rpc'&&c.action==='replace_own_listing_video'?{error:{code:'42501'}}:null);await assert.rejects(f.api.updateListing(p.listingId,draft,[],video,p));assert.equal(f.db.listing_media[0].id,'old');assert.equal(f.calls.some(c=>c.table==='storage'&&c.action==='remove'),false);
 f.setFailure(null);await f.api.updateListing(p.listingId,draft,[],video,p);assert.equal(f.db.listing_media.length,1);assert.notEqual(f.db.listing_media[0].id,'old');assert.equal(f.calls.filter(c=>c.table==='listing_media'&&c.action==='insert').length,0);
});
test('a lost video RPC response is recovered by its committed path without reapplying replacement',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress();await f.api.createListing(draft,[],null,p);const video={file:new File(['video'],'clip.mp4',{type:'video/mp4'}),duration:8};let failed=false;f.setFailure(c=>{if(!failed&&c.table==='rpc'&&c.action==='replace_own_listing_video'){failed=true;return {after:true,error:new Error('network')}}return null;});await assert.rejects(f.api.updateListing(p.listingId,draft,[],video,p));await f.api.updateListing(p.listingId,draft,[],video,p);assert.equal(f.db.listing_media.length,1);assert.equal(f.calls.filter(c=>c.table==='rpc'&&c.action==='replace_own_listing_video').length,1);
});
test('catalog image limits replace the old hard-coded twelve without silently dropping files',async()=>{
 const f=fixture();f.db.listing_categories_config[0].max_images=15;await f.api.createListing(draft,Array.from({length:13},file));assert.equal(f.db.listing_media.length,13);
 const limited=fixture();limited.db.listing_categories_config[0].max_images=1;await assert.rejects(limited.api.createListing(draft,[file(),file()]),e=>e.problem?.message==='image_limit');assert.equal(limited.db.listing_media.length,0);
});
test('catalog errors are not ignored and globally disabled videos cannot be uploaded',async()=>{
 const f=fixture();f.setFailure(c=>c.table==='listing_categories_config'?{error:{code:'42501'}}:null);await assert.rejects(f.api.createListing(draft,[]),e=>e.code==='42501');assert.equal(f.db.listings.length,0);
 const blocked=fixture();blocked.db.platform_content[0].listing_video_policy='hidden';await assert.rejects(blocked.api.createListing(draft,[],{file:new File(['video'],'clip.mp4',{type:'video/mp4'}),duration:10}),/video_disabled/);assert.equal(blocked.db.listings.length,0);
});
test('media settings use app-compatible bounds and type policy cannot bypass a global video ban',()=>{
 const {api}=fixture();assert.deepEqual(api.catalogMediaLimits({max_images:31,max_video_seconds:2000,settings:{video_compression:{max_upload_bytes:1}}}),{maxImages:30,maxVideoSeconds:1800,maxVideoBytes:8*1024*1024});
 const category={videoPolicy:'review',platformVideoPolicy:'direct',types:[{id:'type',videoPolicy:'direct'}]};assert.equal(api.listingVideoPolicy(category,'type'),'direct');assert.equal(api.listingVideoPolicy({...category,platformVideoPolicy:'hidden'},'type'),'hidden');assert.equal(api.listingVideoPolicy(category,null),'review');
});
test('publish denial keeps one draft and recorded images; corrected values can be retried',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress(),files=[file(),file()];
 f.setFailure(c=>c.table==='listings'&&c.action==='update'&&c.values.state==='published'?{error:{code:'42501'}}:null);
 await assert.rejects(f.api.createListing(draft,files,null,p),e=>e instanceof f.api.SavedDraftError&&e.problem.code==='42501');
 assert.equal(f.db.listings.length,1);assert.equal(f.db.listing_media.length,2);
 f.setFailure(null);await f.api.createListing({...draft,title:'Corrected'},files,null,p);
 assert.equal(f.db.listings.length,1);assert.equal(f.db.listings[0].state,'published');assert.equal(f.db.listings[0].title,'Corrected');assert.equal(f.uploads.size,2);
});
test('failed second image resumes without reuploading the first image',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress(),files=[file(),file()];
 f.setFailure(c=>c.table==='storage'&&c.values.file===files[1]?{error:{message:'network'}}:null);
 await assert.rejects(f.api.createListing(draft,files,null,p));
 f.setFailure(null);await f.api.createListing(draft,files,null,p);
 assert.equal(f.db.listings.length,1);assert.equal(f.db.listing_media.length,2);assert.equal(f.calls.filter(c=>c.table==='storage'&&c.values.file===files[0]).length,1);
});
test('lost creation and media acknowledgements reuse stable IDs',async()=>{
 for(const table of ['listings','listing_media']){
  const f=fixture(),p=f.api.listingSaveProgress(),files=[file()];let once=true;
  f.setFailure(c=>{if(once&&c.table===table&&c.action==='insert'){once=false;return{after:true,error:{message:'network'}}}return null});
  await assert.rejects(f.api.createListing(draft,files,null,p));
  await f.api.createListing(draft,files,null,p);
  assert.equal(f.db.listings.length,1);assert.equal(f.db.listing_media.length,1);
 }
});
test('lost publish acknowledgement does not create another listing',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress(),files=[file()];let once=true;
 f.setFailure(c=>{if(once&&c.table==='listings'&&c.values?.state==='published'){once=false;return{after:true,error:{message:'network'}}}return null});
 await assert.rejects(f.api.createListing(draft,files,null,p));await f.api.createListing({...draft,title:'Corrected after lost response'},files,null,p);assert.equal(f.db.listings.length,1);assert.equal(f.db.listing_media.length,1);assert.equal(f.db.listings[0].title,'Corrected after lost response');assert.equal(f.db.listings[0].state,'published');
});
test('a retained draft cannot be reused by a different account',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress(),files=[file()];f.setFailure(c=>c.table==='storage'?{error:{message:'network'}}:null);
 await assert.rejects(f.api.createListing(draft,files,null,p));const before=f.calls.length;
 f.setOwner('another');await assert.rejects(f.api.createListing(draft,files,null,p),/draft_owner_changed/);assert.equal(f.calls.length,before);
});
test('editing retains listing state and does not repeat acknowledged images on retry',async()=>{
 const f=fixture(),p=f.api.listingSaveProgress(),files=[file(),file()];f.db.listings.push({id:'existing',owner_id:'owner',state:'reserved'});
 f.setFailure(c=>c.table==='storage'&&c.values.file===files[1]?{error:{message:'network'}}:null);
 await assert.rejects(f.api.updateListing('existing',draft,files,null,p));f.setFailure(null);
 await f.api.updateListing('existing',draft,files,null,p);assert.equal(f.db.listing_media.length,2);assert.equal(f.db.listings[0].state,'reserved');
});
test('a retry cannot resurrect a removed or moderated draft',async()=>{
 for(const state of ['hidden','rejected','removed',null]){
  const f=fixture(),p=f.api.listingSaveProgress(),files=[file()];f.setFailure(c=>c.table==='storage'?{error:{message:'network'}}:null);await assert.rejects(f.api.createListing(draft,files,null,p));f.setFailure(null);
  if(state)f.db.listings[0].state=state;else f.db.listings.length=0;
  const before=f.calls.filter(c=>c.action==='insert'||c.action==='update').length;
  await assert.rejects(f.api.createListing(draft,files,null,p),/draft_unavailable/);
  assert.equal(f.calls.filter(c=>c.action==='insert'||c.action==='update').length,before);
 }
});
test('editing saves changed category, location and transaction without changing moderation state',async()=>{
 const f=fixture();f.db.listings.push({id:'existing',owner_id:'owner',state:'reserved'});await f.api.updateListing('existing',{...draft,category:'vehicle',direction:'wanted',transactionType:'rent',locationNodeId:12},[]);
 const row=f.db.listings[0];assert.equal(row.category,'vehicle');assert.equal(row.listing_direction,'wanted');assert.equal(row.purpose,'rent');assert.equal(row.location_node_id,12);assert.equal(row.state,'reserved');
});
test('an ad without photos is accepted like the app and disabling calls hides stored phone',async()=>{
 const f=fixture();await f.api.createListing({...draft,phone:'+491234567890',directCall:false,whatsapp:false,email:' TEST@Example.invalid '},[]);assert.equal(f.db.listings[0].state,'published');assert.equal(f.db.listings[0].contact_phone,null);assert.equal(f.db.listings[0].contact_email,'test@example.invalid');assert.equal(f.uploads.size,0);
});
