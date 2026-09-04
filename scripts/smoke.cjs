const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const port=Number(process.env.SMOKE_PORT||3187);
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-H','127.0.0.1','-p',String(port)],{env:{...process.env,NEXT_PUBLIC_DATA_SOURCE:'mock'},stdio:'ignore'});
async function main(){
 try{
  let ready=false;
  for(let i=0;i<60;i++){
   try{const r=await fetch(`http://127.0.0.1:${port}/ar`);if(r.status===200){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,'server did not start');
  let count=0;
  for(const lang of ['ar','ku','de','en'])for(const page of ['','/search?category=vehicles','/search?q=one&q=two&locationIds=1&locationIds=2','/search?category=invalid&minPrice=-20&maxPrice=NaN','/legal-documents','/auth','/auth/reset','/contact','/imprint','/admin','/listings/new']){
   const r=await fetch(`http://127.0.0.1:${port}/${lang}${page}`);
   assert.equal(r.status,200,`${lang}${page}`);
   const html=await r.text();assert.ok(html.includes('RojDeal'));count++;
  }
  for(const lang of ['ar','ku','de','en']){
   for(const page of ['account','account/edit','account/saved-searches','account/blocked-users','account/analytics','account/subscription','account/help','account/ad-privacy']){
    const r=await fetch(`http://127.0.0.1:${port}/${lang}/${page}`);
    assert.equal(r.status,200,`${lang}/${page}`);
    assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
    assert.ok((await r.text()).includes('RojDeal'));count++;
   }
   const missing=await fetch(`http://127.0.0.1:${port}/${lang}/account/not-a-section`);
   assert.equal(missing.status,404);count++;
  }
  const guide=await fetch(`http://127.0.0.1:${port}/guides/RojDeal_User_Guide_All_Languages.pdf`);
  assert.equal(guide.status,200);assert.ok(Buffer.from(await guide.arrayBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')));count++;
  console.log(`${count} HTTP route checks passed with mock data. No authenticated workflows or visual layout verified.`);
 }finally{server.kill('SIGTERM');}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
