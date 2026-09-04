const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,deps={}){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};new Function('module','exports','require',code)(m,m.exports,n=>deps[n]??require(n));return m.exports;}
const staff=load('src/lib/staff-display.ts');
test('markets are created only as drafts; state transitions use the audited permission-checked RPC',async()=>{
 const f=service('src/services/markets.ts',{queryResult:{data:[{id:'market'}],error:null}});await f.api.addMarket(' de ',{de:'Deutschland',ar:'ألمانيا'},'eur');const values=f.calls.find(c=>c[0]==='insert')[1];assert.equal(values.status,'draft');assert.equal(values.code,'DE');assert.equal(values.created_by,'tester');await f.api.changeMarketStatus('market','active','Approved local test');assert.deepEqual(f.calls.find(c=>c[0]==='rpc'),['rpc','set_market_status',{target_market:'market',new_status:'active',change_reason:'Approved local test'}]);await assert.rejects(f.api.changeMarketStatus('market','active','no'));const denied=service('src/services/markets.ts',{rpcResult:{data:null,error:{code:'42501'}}});await assert.rejects(denied.api.changeMarketStatus('market','active','test reason'),e=>e.code==='42501');
});
test('future, expired, malformed and inactive staff assignments are not displayed as active',()=>{
 const now=Date.parse('2026-09-03T12:00:00Z'),base={is_active:true,starts_at:'2026-09-01T00:00:00Z',expires_at:null};
 assert.equal(staff.activeAssignment(base,now),true);
 for(const change of [{is_active:false},{starts_at:'2027-01-01'},{starts_at:'invalid'},{expires_at:'2026-09-03T12:00:00Z'},{expires_at:'invalid'}])assert.equal(staff.activeAssignment({...base,...change},now),false);
 for(const lang of ['ar','ku','de','en'])assert.notEqual(staff.permissionLabel('staff.assign',lang),'staff.assign');
});
const audit=load('src/lib/admin-display.ts');
test('queued notifications and deletion reasons are translated without claiming delivery',()=>{
 assert.match(audit.adminText('direct_message_queued','en'),/queued/);
 assert.match(audit.auditDetails({reason:'deleted_by_listing_owner',retention_days:60,archive_delete_after:'invalid'},'en'),/Deleted by listing owner.*Retention in days: 60.*Archive deletion after: —/);
});
function service(file,{error=null,user='tester',rpcResult={data:'report-id',error:null},queryResult={data:null,error:null}}={}){
 const calls=[],q={then(ok,bad){return Promise.resolve(queryResult).then(ok,bad)}};
 for(const key of ['select','eq','insert','update','maybeSingle','single','order','in','upsert','delete','range','ilike'])q[key]=(...args)=>{calls.push([key,...args]);return q};
 const supabase={auth:{getUser:async()=>({data:{user:user?{id:user}:null},error})},from:t=>{calls.push(['from',t]);return q},rpc:async(...args)=>{calls.push(['rpc',...args]);return rpcResult}};
 return{api:load(file,{'@/lib/supabase':{supabase}}),calls};
}
test('report submission uses the authenticated shared RPC and preserves submitted details',async()=>{
 const {api,calls}=service('src/services/safety.ts');await api.reportContent('listing','id','fraud','  Details  ');
 assert.deepEqual(calls,[['rpc','submit_safety_report',{report_target_type:'listing',report_target_id:'id',report_reason:'fraud',report_details:'Details'}]]);
 await assert.rejects(api.reportContent('user','id','other',' '));assert.equal(calls.length,1);
});
test('report denial is propagated and blocking always binds to the current user',async()=>{
 const denied=service('src/services/safety.ts',{rpcResult:{data:null,error:{code:'42501'}}});await assert.rejects(denied.api.reportContent('user','id','spam',''),e=>e.code==='42501');
 const {api,calls}=service('src/services/safety.ts');await api.blockSeller('seller');assert.deepEqual(calls.find(c=>c[0]==='insert')[1],{blocker_id:'tester',blocked_id:'seller'});await assert.rejects(api.blockSeller('tester'));
 const guest=service('src/services/safety.ts',{user:null});await assert.rejects(guest.api.blockSeller('seller'),/authentication_required/);assert.equal(guest.calls.length,0);
});
test('a failed conversation lookup never inserts a duplicate and a network failure is not a logout',async()=>{
 const network=new TypeError('Failed to fetch');let f=service('src/services/web-features.ts',{error:network});await assert.rejects(f.api.openConversation('listing','seller'),e=>e===network);assert.equal(f.calls.length,0);
 f=service('src/services/web-features.ts',{queryResult:{data:null,error:{code:'42501'}}});await assert.rejects(f.api.openConversation('listing','seller'),e=>e.code==='42501');assert.equal(f.calls.some(c=>c[0]==='insert'),false);
});
test('a profile read uses the privacy RPC and refuses a different account response',async()=>{
 const f=service('src/services/account.ts',{rpcResult:{data:{id:'tester',phone:'+491234567'},error:null}});assert.equal((await f.api.ownProfile('tester')).phone,'+491234567');assert.deepEqual(f.calls,[['rpc','get_visible_profile',{target_user:'tester'}]]);await assert.rejects(f.api.ownProfile('other'));
});
test('paid marketing is enabled only by an explicit true flag and failed reads stay errors',async()=>{
 for(const value of [false,null,undefined,'true']){const f=service('src/services/account.ts',{queryResult:{data:{tier_upgrades_enabled:value},error:null}});assert.equal(await f.api.tierUpgradesEnabled(),false);}
 assert.equal(await service('src/services/account.ts',{queryResult:{data:{tier_upgrades_enabled:true},error:null}}).api.tierUpgradesEnabled(),true);
 await assert.rejects(service('src/services/account.ts',{queryResult:{data:null,error:{code:'42501'}}}).api.tierUpgradesEnabled());
});
const feedback=load('src/lib/auth-feedback.ts');
test('authentication errors are localized and unknown server details are not exposed',()=>{for(const lang of ['ar','ku','de','en']){const generic=feedback.authFeedback({message:'private database code'},lang);assert.ok(!generic.includes('private'));assert.notEqual(feedback.authFeedback({code:'invalid_credentials'},lang),generic);assert.notEqual(feedback.authFeedback({code:'email_not_confirmed'},lang),generic);}});
test('legal saves use the shared permission-checked RPC; acceptance is recorded as web',async()=>{
 const f=service('src/services/legal-documents.ts');const row={document_type:'terms',version:'1',language:'de',title:'Terms',content:'Provided by owner',public_url:'',effective_at:'2026-09-03T00:00:00Z',is_active:false,requires_acceptance:false};await f.api.saveLegalDocument(row);const call=f.calls[0];assert.equal(call[1],'save_legal_document');assert.equal(call[2].target_is_active,false);assert.equal(call[2].target_document,null);
 await f.api.acceptLegalDocument('document');assert.equal(f.calls[1][2].acceptance_source,'web');
 await assert.rejects(f.api.saveLegalDocument({...row,public_url:'javascript:alert(1)'}));assert.equal(f.calls.length,2);
 const denied=service('src/services/legal-documents.ts',{rpcResult:{data:null,error:{code:'42501'}}});await assert.rejects(denied.api.saveLegalDocument(row),e=>e.code==='42501');
});
test('deleted messages never sign or reveal attachment links; readable attachments use private signed URLs',async()=>{
 const signed=[],q={select(){return q},eq(){return q},order(){return q},then(ok){return Promise.resolve({data:[{id:'deleted',sender_id:'other',body:'secret',deleted_for_everyone_at:'2026-09-01',message_attachments:[{id:'a',storage_path:'secret',upload_state:'complete',deleted_at:null}]},{id:'visible',sender_id:'other',body:'hello',message_attachments:[{id:'b',storage_path:'allowed',upload_state:'complete',deleted_at:null,original_name:'photo.jpg',kind:'image'},{id:'c',storage_path:'incomplete',upload_state:'uploading',deleted_at:null}]}],error:null}).then(ok)}};
 const supabase={auth:{getUser:async()=>({data:{user:{id:'me'}},error:null})},from:()=>q,rpc:async()=>({error:null}),storage:{from:bucket=>({createSignedUrl:async(path,seconds)=>{signed.push([bucket,path,seconds]);return {data:{signedUrl:'https://example.invalid/signed'},error:null}}})}};
 const api=load('src/services/web-features.ts',{'@/lib/supabase':{supabase}}),rows=await api.messages('conversation');assert.equal(rows[0].body,'');assert.deepEqual(rows[0].attachments,[]);assert.deepEqual(signed,[['chat-attachments','allowed',3600]]);assert.equal(rows[1].attachments.length,1);
});
test('analytics enrichment stays owner-scoped and failed enrichment preserves authorized counters',async()=>{
 const row={listing_id:'id',listing_title:'old',view_count:7};let f=service('src/services/account.ts',{rpcResult:{data:[row],error:null},queryResult:{data:[{id:'id',title:'New title',public_code:'RD-1',state:'published',listing_media:[{kind:'image',storage_path:'cover',sort_order:0}]}],error:null}});
 const enriched=await f.api.ownMetrics('tester');assert.equal(enriched[0].listing_title,'New title');assert.equal(enriched[0].view_count,7);assert.equal(enriched[0].listing_image_path,'cover');assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='owner_id'&&c[2]==='tester'));
 f=service('src/services/account.ts',{rpcResult:{data:[row],error:null},queryResult:{data:null,error:{code:'42501'}}});const fallback=await f.api.ownMetrics('tester');assert.equal(fallback[0].view_count,7);assert.equal(fallback[0].details_unavailable,true);
});
test('wanted price bounds reach the database as overlap filters before pagination',async()=>{
 const calls=[],q={then(ok){return Promise.resolve({data:[],error:null}).then(ok)}};for(const m of ['select','is','in','eq','or','gte','lte','order','range'])q[m]=(...a)=>{calls.push([m,...a]);return q};
 const api=load('src/services/supabase-adapter.ts',{'@/lib/supabase':{supabase:{from:()=>q}},'@/lib/navigation':{},'./locations':{},'@/lib/location-path':{},'@/lib/pagination':{PAGE_SIZE:24}});const adapter=new api.SupabaseListingAdapter();
 await adapter.getListings({purpose:'wanted',minPrice:0,maxPrice:100,page:2});assert.ok(calls.some(c=>c[0]==='or'&&c[1]==='budget_max.is.null,budget_max.gte.0'));assert.ok(calls.some(c=>c[0]==='or'&&c[1]==='budget_min.is.null,budget_min.lte.100'));assert.deepEqual(calls.at(-1),['range',24,48]);await assert.rejects(adapter.getListings({minPrice:Infinity}));
});

test('catalog edits whitelist fields and detect stale or denied updates',async()=>{
 const f=service('src/services/catalog-admin.ts',{queryResult:{data:[{id:'row'}],error:null}});
 await f.api.saveCatalogRow('categories',{id:'row',updated_at:'old',names:{de:'Titel'},is_active:true,video_policy:'direct',max_images:30,owner_id:'attacker'});
 const values=f.calls.find(c=>c[0]==='update')[1];assert.deepEqual(values.names,{de:'Titel'});assert.equal(values.updated_by,'tester');for(const key of ['owner_id','max_images','video_policy'])assert.equal(key in values,false);assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='old'));
 await assert.rejects(f.api.saveCatalogRow('categories',{category_key:'new'}),/top_level/);
 const denied=service('src/services/catalog-admin.ts',{queryResult:{data:[],error:null}});await assert.rejects(denied.api.saveCatalogRow('types',{id:'row',names:{ar:'نوع'}}),/changed_or_denied/);
});
test('catalog field options bind to their parent without nonexistent audit columns',async()=>{
 const f=service('src/services/catalog-admin.ts',{queryResult:{data:[{id:'option'}],error:null}});await f.api.saveCatalogRow('options',{option_key:'red',labels:{en:'Red'},is_active:false},'field');const values=f.calls.find(c=>c[0]==='insert')[1];assert.equal(values.field_id,'field');assert.equal(values.is_active,false);assert.equal('updated_at' in values,false);assert.equal('created_by' in values,false);
 await assert.rejects(f.api.saveCatalogRow('options',{option_key:'red'},''));
});
test('text overrides preserve all languages, inactive state and server denials',async()=>{
 const row={text_key:'listing_title',values:{ar:'عنوان',ku:'Sernav',de:'Titel',en:'Title'},is_active:false};const f=service('src/services/text-overrides.ts',{queryResult:{data:[{text_key:row.text_key}],error:null}});await f.api.saveTextOverride(row);const values=f.calls.find(c=>c[0]==='upsert')[1];assert.deepEqual(values.values,row.values);assert.equal(values.is_active,false);assert.equal(values.updated_by,'tester');await assert.rejects(f.api.saveTextOverride({...row,text_key:'bad/key'}));
 const denied=service('src/services/text-overrides.ts',{queryResult:{data:null,error:{code:'42501'}}});await assert.rejects(denied.api.saveTextOverride(row),e=>e.code==='42501');await assert.rejects(denied.api.removeTextOverride(row.text_key),e=>e.code==='42501');
});
