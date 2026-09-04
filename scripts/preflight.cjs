// Read-only validation. Never prints keys or changes remote configuration.
require('@next/env').loadEnvConfig(process.cwd());
const problems=[];
const env=process.env;
const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
if(!((nodeMajor===22&&nodeMinor>=13)||nodeMajor>=24))problems.push('Use Node 22.13+ (22.x) or Node 24+.');
if(env.NEXT_PUBLIC_DATA_SOURCE!=='supabase')problems.push('NEXT_PUBLIC_DATA_SOURCE must be supabase for launch.');
try{const u=new URL(env.NEXT_PUBLIC_SUPABASE_URL);if(u.protocol!=='https:'||u.hostname==='placeholder.supabase.co')throw Error();}catch{problems.push('Set a real HTTPS NEXT_PUBLIC_SUPABASE_URL.');}
const key=env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
if(!key || key.includes('placeholder') || key.startsWith('sb_secret_')) problems.push('Set a public Supabase anon/publishable key, never a secret key.');
if(key.split('.').length===3){try{const jwt=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());if(jwt.role!=='anon')problems.push('Public Supabase JWT must use the anon role.');}catch{problems.push('Public Supabase JWT is malformed.');}}
try{const u=new URL(env.NEXT_PUBLIC_SITE_URL);if(u.protocol!=='https:'||!['rojdeal.app','www.rojdeal.app'].includes(u.hostname))throw Error();}catch{problems.push('NEXT_PUBLIC_SITE_URL must be https://rojdeal.app or https://www.rojdeal.app for launch.');}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log('Local configuration checks passed. This does NOT verify RLS, mail delivery, OAuth, legal content or deployment.');
