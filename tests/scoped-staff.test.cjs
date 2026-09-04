const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function fixture({existing=[],denied=false,readDenied=false,users=[{id:'person',email:'person@example.test'}]}={}){
 const calls=[];
 const supabase={rpc:async(name,args)=>{calls.push([name,args]);return name==='list_admin_user_accounts_v2'?{data:users,error:null}:{data:'assignment',error:denied?{code:'42501'}:null};},from(table){const q={then(resolve){return Promise.resolve({data:table==='staff_roles'?[{id:'role',role_key:'support'}]:existing,error:table==='staff_assignments'&&readDenied?{code:'42501'}:null}).then(resolve);}};for(const method of ['select','eq','order'])q[method]=(...args)=>{calls.push([table,method,...args]);return q;};return q;}};
 const code=ts.transpileModule(fs.readFileSync('src/services/admin-operations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,m={exports:{}};new Function('module','exports','require',code)(m,m.exports,()=>({supabase}));return{api:m.exports,calls};
}
test('scoped staff creation resolves exact email and preserves every scope in the permission-checked RPC',async()=>{
 const f=fixture();await f.api.assignScopedStaff(' Person@example.test ','support',{marketId:'market',locationId:12,categoryId:'category',expiresAt:'2099-01-01T00:00:00Z'},' note ');
 assert.deepEqual(f.calls.find(c=>c[0]==='assign_scoped_staff_role'),['assign_scoped_staff_role',{target_user:'person',target_role_key:'support',target_market:'market',target_location:12,target_category:'category',assignment_expires_at:'2099-01-01T00:00:00Z',note:'note'}]);
 assert.equal(f.calls.some(c=>c[0]==='remove_staff_assignment'),false);
});
test('retry confirms identical scoped assignment but never silently changes existing expiration or note',async()=>{
 const f=fixture({existing:[{market_id:'market',location_node_id:null,category_id:null,expires_at:null,note:'note'}]});await f.api.assignScopedStaff('person@example.test','support',{marketId:'market'},'note');assert.equal(f.calls.some(c=>c[0]==='assign_scoped_staff_role'),false);
 await assert.rejects(f.api.assignScopedStaff('person@example.test','support',{marketId:'market',expiresAt:'2099-01-01'},'note'),/already_exists/);
});
test('scoped assignment rejects denied reads, denied RPCs, ambiguous users and invalid scopes without removing roles',async()=>{
 for(const options of [{readDenied:true},{denied:true},{users:[]},{users:[{id:'one',email:'person@example.test'},{id:'two',email:'person@example.test'}]}]){const f=fixture(options);await assert.rejects(f.api.assignScopedStaff('person@example.test','support',{marketId:'market'},''));assert.equal(f.calls.some(c=>c[0]==='remove_staff_assignment'),false);}
 for(const scope of [{},{locationId:-1},{locationId:NaN},{expiresAt:'invalid'},{expiresAt:'2000-01-01'}]){const f=fixture();await assert.rejects(f.api.assignScopedStaff('person@example.test','support',scope,''));assert.equal(f.calls.length,0);}
});
