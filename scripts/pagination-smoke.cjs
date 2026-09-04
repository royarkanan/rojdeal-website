const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const port=Number(process.env.SMOKE_PORT||3189);let count=0;
async function run(size){
 const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-H','127.0.0.1','-p',String(port)],{env:{...process.env,NEXT_PUBLIC_DATA_SOURCE:'mock',ROJDEAL_TEST_LISTING_COUNT:String(size)},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;
 const get=async(path)=>{const r=await fetch(base+path);assert.equal(r.status,200,path);count++;return {html:await r.text(),response:r};};
 try{
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(base+'/ar')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'server did not start');
  for(const lang of ['ar','ku','de','en'])for(const route of ['', '/search']){
   const seen=[];
   for(let page=1;page<=Math.ceil(size/24);page++){
    const {html}=await get(`/${lang}${route}?page=${page}`);
    const ids=[...html.matchAll(new RegExp(`href="/${lang}/listings/(fixture-\\d+)"`,'g'))].map(m=>m[1]);
    assert.equal(ids.length,Math.min(24,size-(page-1)*24),`${lang}${route} page${page} card count`);
    assert.ok(html.indexOf('id="site-footer"')>html.lastIndexOf(`href="/${lang}/listings/fixture-`),'footer follows results');seen.push(...ids);
    const footer=html.slice(html.indexOf('<footer id="site-footer"'),html.indexOf('</footer>',html.indexOf('<footer id="site-footer"')));
    for(const path of ['safety','contact','how-to','community-rules','about','terms','privacy','imprint','account-deletion'])assert.ok(footer.includes(`href="/${lang}/${path}"`),`footer ${path}`);
    assert.ok(footer.includes('mailto:support@rojdeal.app'));
   }
   assert.equal(new Set(seen).size,size,'no duplicate/missing listings across pages');
  }
  if(size===75){
   for(const lang of ['ar','ku','de','en'])for(const route of ['/auth','/auth/reset','/admin','/listings/new','/safety','/contact','/how-to','/community-rules','/about','/terms','/privacy','/imprint','/account-deletion']){
    const {html,response}=await get(`/${lang}${route}`);assert.ok(html.includes('RojDeal'));
    if(['/admin','/auth','/auth/reset','/listings/new'].includes(route))assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
   }
  }
 }finally{server.kill('SIGTERM');if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));}
}
(async()=>{for(const size of [1,24,25,75])await run(size);console.log(`${count} mock HTTP checks passed: four languages; 1/24/25/75 listings; pagination; footer links; private-page noindex. Not visual or authenticated tests.`);})().catch(e=>{console.error(e);process.exitCode=1;});
