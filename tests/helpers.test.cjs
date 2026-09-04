const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, customRequire=require) {
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, customRequire);
  return module.exports;
}
const { marketplaceHref, expandLocations } = load('src/lib/navigation.ts');
const { notificationLink } = load('src/lib/notification-link.ts');
const { displayDate, adminText } = load('src/lib/admin-display.ts');
const { cleanSearchParams } = load('src/lib/search-params.ts');
const {pageNumber,pageHref,pageSlice,PAGE_SIZE}=load('src/lib/pagination.ts');
const {deletionError,requiresOwnerReview}=load('src/lib/account-deletion.ts');
test('pagination rejects malformed, repeated and unsafe page numbers',()=>{
 for(const input of [undefined,['2'],'-1','0','1.5','NaN','99999999999999'])assert.equal(pageNumber(input),1);
 assert.equal(pageNumber('12'),12);
});
test('pagination preserves every filter and resets first page',()=>{
 const p={q:'شقة',category:'real_estate',locationIds:'1,2',purpose:'wanted',transactionType:'exchange',minPrice:'10',maxPrice:'500',sortBy:'price_asc',page:'3'};
 const url=new URL(pageHref('/ar/search',p,2),'https://rojdeal.app');
 for(const [key,value]of Object.entries(p))if(key!=='page')assert.equal(url.searchParams.get(key),value);
 assert.equal(url.searchParams.get('page'),'2');assert.equal(url.hash,'#results');
 assert.equal(new URL(pageHref('/ar',p,1),'https://rojdeal.app').searchParams.has('page'),false);
});
test('24-item pages cover 1, 24, 25 and 75 items without duplication',()=>{
 for(const count of [1,24,25,75]){
 const items=Array.from({length:count},(_,i)=>i),seen=[];
 for(let page=1;page<=Math.ceil(count/PAGE_SIZE);page++){const rows=pageSlice(items,page);assert.equal(rows.length>PAGE_SIZE,page<Math.ceil(count/PAGE_SIZE));seen.push(...rows.slice(0,PAGE_SIZE));}
 assert.deepEqual(seen,items);
 }
});
test('category switch resets page without losing other filters',()=>{
 const url=new URL(marketplaceHref('de',{page:'4',q:'Auto',minPrice:'10'},'vehicles'),'https://rojdeal.app');
 assert.equal(url.searchParams.has('page'),false);assert.equal(url.searchParams.get('minPrice'),'10');
});
test('staff deletion errors are localized without leaking technical codes',()=>{
 const error={message:'staff_account_requires_owner_review'};assert.ok(requiresOwnerReview(error));
 for(const lang of ['ar','ku','de','en']){const text=deletionError(error,lang,'fallback');assert.notEqual(text,'fallback');assert.ok(!text.includes('staff_account_requires_owner_review'));}
 assert.equal(deletionError({message:'private SQL details'},'ar','safe'),'safe');
});
test('search rejects repeated and invalid parameters',()=>{
 assert.deepEqual(cleanSearchParams({q:['one','two'],category:'invalid',purpose:'invalid',minPrice:'-1',sortBy:'invalid'}),{});
});
test('search deduplicates valid location IDs',()=>assert.equal(cleanSearchParams({locationIds:'1,1,2,-3,abc,0,1.5'}).locationIds,'1,2'));
test('search orders inverted price range',()=>assert.deepEqual(cleanSearchParams({minPrice:'200',maxPrice:'100'}),{minPrice:'100',maxPrice:'200'}));
test('search rejects nonfinite prices',()=>assert.deepEqual(cleanSearchParams({minPrice:'Infinity',maxPrice:'NaN'}),{}));
test('search retains valid terms and categories',()=>assert.deepEqual(cleanSearchParams({q:' شقة ',category:'real_estate',purpose:'wanted'}),{q:'شقة',category:'real_estate',purpose:'wanted'}));
test('admin listing pages overfetch one row and search exact UUID',async()=>{
 const calls=[];const query={select(){return this;},or(value){calls.push(['or',value]);return this;},order(){return this;},range(a,b){calls.push(['range',a,b]);return {data:[],error:null};}};
 const api=load('src/services/admin-operations.ts',()=>({supabase:{from(){return query;}}}));
 await api.adminListings('83f43c66-5885-4529-9ed5-bca933b29238',2);
 assert.deepEqual(calls[1],['range',100,150]);assert.ok(calls[0][1].includes('id.eq.83f43c66'));
});
test('support decisions use the narrow permission-checked RPC',async()=>{
 let called;const api=load('src/services/admin-operations.ts',()=>({supabase:{rpc:async(name,args)=>{called={name,args};return {error:null};}}}));
 await api.updateRequest('support_requests','ticket','resolved','Valid reason');
 assert.equal(called.name,'web_update_support_request');assert.equal(called.args.next_state,'resolved');
});
test('category navigation retains query and locations', () => {
  const url = new URL(marketplaceHref('ar', {q:'شقة',locationIds:'1,2',category:'vehicles'},'real_estate'),'https://rojdeal.app');
  assert.equal(url.pathname,'/ar'); assert.equal(url.searchParams.get('q'),'شقة');
  assert.equal(url.searchParams.get('locationIds'),'1,2'); assert.equal(url.searchParams.get('category'),'real_estate');
});
test('all removes category but preserves search',()=>assert.equal(marketplaceHref('de',{q:'Wohnung',category:'vehicles'}),'/de?q=Wohnung'));
test('locations recursively include descendants only',()=>assert.deepEqual(expandLocations([{id:1,parent_id:null},{id:2,parent_id:1},{id:3,parent_id:2},{id:4,parent_id:null}],[1]),[1,2,3]));
test('location cycles terminate',()=>assert.deepEqual(expandLocations([{id:1,parent_id:2},{id:2,parent_id:1}],[1]),[1,2]));
test('empty locations stays empty',()=>assert.deepEqual(expandLocations([{id:1,parent_id:null}],[]),[]));
const id='83f43c66-5885-4529-9ed5-bca933b29238';
test('support notifications route to appropriate workspace',()=>{
 assert.equal(notificationLink('de','support_request',{support_request_id:id}),`/de/admin?section=support&request=${id}`);
 assert.equal(notificationLink('ar','support_reply',{support_request_id:id}),`/ar/contact?request=${id}`);
});
test('notification links reject untrusted destinations',()=>assert.equal(notificationLink('ar','support_reply',{support_request_id:'https://evil.test',url:'javascript:alert(1)'}),null));
test('listing notification has internal URL',()=>assert.equal(notificationLink('en','listing',{listing_id:id}),`/en/listings/${id}`));
test('invalid audit dates do not crash',()=>assert.equal(displayDate('invalid'),'—'));
test('known audit terms are translated',()=>assert.notEqual(adminText('platform_videos_replaced','ar'),'platform_videos_replaced'));
const {normalizedPhone,changePhoneCountry,getCountries,phoneText,phoneInput}=load('src/lib/phone.ts');
test('phone countries include worldwide dialing codes',()=>{assert.ok(getCountries().length>200);for(const code of ['SY','DE','US','IQ','JP'])assert.ok(getCountries().includes(code));});
test('phone input preserves national digits and normalizes international formats',()=>{
 assert.equal(normalizedPhone('030 12345678','DE'),'+493012345678');
 assert.equal(normalizedPhone('0049 30 12345678','SY'),'+493012345678');
 assert.equal(phoneText('٠٠٤٩٣٠١٢٣٤٥٦٧٨'),'+493012345678');
 assert.equal(changePhoneCountry('+493012345678','DE','SY'),'+9633012345678');
 assert.equal(normalizedPhone('','DE'),'');assert.equal(normalizedPhone('abc','DE'),null);assert.equal(normalizedPhone('123','DE'),null);
});
test('phone input accepts Arabic and Persian digits but removes letters',()=>{
 assert.equal(phoneInput('+٩٦٣ (۹۴۴) abc-12.3'),'+963 (944) -12.3');
});

test('public query filters before paging and hides deleted rows',async()=>{
 const calls=[];const query={then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};
 for(const method of ['select','is','in','eq','contains','gte','lte','or','order','range','limit'])query[method]=(...args)=>{calls.push([method,...args]);return query;};
 const {SupabaseListingAdapter}=load('src/services/supabase-adapter.ts',name=>name.includes('supabase')?{supabase:{from:()=>query}}:name.includes('navigation')?{expandLocations}:name.includes('pagination')?{PAGE_SIZE,pageSlice}:{activeLocations:async()=>[{id:1,parent_id:null,names:{de:'Berlin'}}]});
 await new SupabaseListingAdapter().getListings({page:2,category:'vehicles',minPrice:10,maxPrice:100,locationNodeIds:[1],sortBy:'price_asc'});
 assert.ok(calls.some(c=>c[0]==='is'&&c[1]==='deleted_at'&&c[2]===null));
 assert.deepEqual(calls.at(-1),['range',24,48]);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='category'&&c[2]==='vehicle'));
 assert.ok(calls.findIndex(c=>c[0]==='or')>=0&&calls.findIndex(c=>c[0]==='or')<calls.findIndex(c=>c[0]==='range'));
});
test('ranked search sorts full candidate set before paging',async()=>{
 const rows=Array.from({length:60},(_,i)=>({id:String(i),price:i,title:String(i),listing_media:[]}));
 const query={then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}};
 for(const method of ['select','is','in','order','limit'])query[method]=()=>query;
 const {SupabaseListingAdapter}=load('src/services/supabase-adapter.ts',name=>name.includes('supabase')?{supabase:{from:()=>query,rpc:async()=>({data:rows.map(r=>({listing_id:r.id,relevance:Number(r.id)})),error:null})}}:name.includes('navigation')?{expandLocations}:name.includes('pagination')?{PAGE_SIZE,pageSlice}:{});
 const adapter=new SupabaseListingAdapter();
 const data=await adapter.getListings({page:2,query:'home'});assert.equal(data.length,25);assert.equal(data[0].id,'35');assert.equal(data[23].id,'12');
 const newest=await adapter.getListings({page:1,query:'home',sortBy:'newest'});assert.equal(newest[0].id,'0');
});
const {locationPath}=load('src/lib/location-path.ts');
test('location paths follow actual parents without duplicates or loops',()=>{
 const nodes=[{id:1,parent_id:null,names:{de:'Berlin',ar:'برلين'}},{id:2,parent_id:1,names:{de:'Berlin',ar:'برلين'}},{id:3,parent_id:2,names:{de:'Mitte',ar:'ميته'}}];
 assert.equal(locationPath(nodes,3,'de'),'Berlin — Mitte');assert.equal(locationPath(nodes,3,'ar'),'برلين — ميته');assert.equal(locationPath(nodes,99,'de'),'');
 assert.equal(locationPath([{id:1,parent_id:2,names:{en:'A'}},{id:2,parent_id:1,names:{en:'B'}}],1,'en'),'B — A');
});

const savedHelpers = load('src/lib/saved-search.ts', name => name==='./search-params'?{cleanSearchParams}:require(name));
test('app saved search opens with correct website category, purpose, city and zero price',()=>{
 assert.deepEqual(savedHelpers.savedSearchParams({query:'شقة',category:'property',category_key:'property',purpose:'sale',city_slug:'kobani',min_price:0,max_price:500}),{q:'شقة',city:'kobani',minPrice:'0',maxPrice:'500',category:'real_estate',purpose:'sell'});
 for(const [app,web] of [['vehicle','vehicles'],['other','miscellaneous']])assert.equal(savedHelpers.savedSearchParams({category:app}).category,web);
});
test('saved search round trips shared filters between app and web',()=>{
 const params={q:'Auto',category:'vehicles',purpose:'rent',city:'kobani',minPrice:'0',maxPrice:'300'};
 assert.deepEqual(savedHelpers.savedSearchParams(savedHelpers.sharedSearchFilters(params)),params);
});
test('saved search does not silently broaden unsupported app filters',()=>{
 for(const filters of [{category_key:'custom-kind'},{category_key:'constructor'},{min_price:'bad'},{purpose:'wanted'},{query:'car',location_ids:[1,2]},{query:'car',radius:20}])assert.equal(savedHelpers.savedSearchParams(filters),null);
 for(const params of [{locationIds:'1,2'},{transactionType:'lease'},{purpose:'wanted'},{governorate:'Aleppo'},{sortBy:'price_asc'}])assert.equal(savedHelpers.sharedSearchFilters(params),null);
});

function accountService(result){
 const calls=[];
 const query={then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
 for(const method of ['select','eq','order','update','delete','insert','maybeSingle'])query[method]=(...args)=>{calls.push([method,...args]);return query;};
 const client={from(table){calls.push(['from',table]);return query;},rpc(name,args){calls.push(['rpc',name,args]);return Promise.resolve(result);}};
 return {calls,service:load('src/services/account.ts',name=>name==='@/lib/supabase'?{supabase:client}:require(name))};
}
test('saved search changes and unblock are constrained to their owner',async()=>{
 const {calls,service}=accountService({data:[{id:'search-1'}],error:null});
 await service.changeSavedSearch('search-1','owner-1',false);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner-1'));
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]==='search-1'));
 calls.length=0;await service.unblock('owner-1','blocked-1');
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='blocker_id'&&c[2]==='owner-1'));
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='blocked_id'&&c[2]==='blocked-1'));
});
test('account read errors do not become empty success and denied updates fail',async()=>{
 const failure={message:'permission denied'};
 const {service}=accountService({data:null,error:failure});
 await assert.rejects(service.savedSearches('owner'),e=>e===failure);
 await assert.rejects(service.blockedUsers(),e=>e===failure);
 await assert.rejects(service.ownMetrics(),e=>e===failure);
 await assert.rejects(accountService({data:[],error:null}).service.changeSavedSearch('id','owner'),/Change not applied/);
});
test('profile cannot be replaced by a different account response',async()=>{
 await assert.rejects(accountService({data:{id:'other'},error:null}).service.ownProfile('owner'),/Profile unavailable/);
});
