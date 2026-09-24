const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const frontend=path.join(root,'frontend');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name)}

for(const name of fs.readdirSync(path.join(frontend,'assets/js')).filter(x=>x.endsWith('.js'))){
 const result=cp.spawnSync(process.execPath,['--check',path.join(frontend,'assets/js',name)],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr||result.stdout);
}
test('All frontend JavaScript parses',()=>{});

const html=fs.readFileSync(path.join(root,'templates/index.html'),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
test('Final frontend and backend adapter load in the required order',()=>{
 const required=['assets/js/service.js','assets/js/ui.js','assets/js/public-layout.js','assets/js/public.js','assets/js/admin.js','assets/js/motion.js','assets/js/enhancements.js','assets/js/auth.js','assets/js/app.js'];
 for(const file of required){assert(scripts.includes(file),file+' missing');assert(fs.existsSync(path.join(frontend,file)),file+' not found')}
 assert(scripts.indexOf('assets/js/public-layout.js')<scripts.indexOf('assets/js/public.js'));
 assert(scripts.indexOf('assets/js/auth.js')<scripts.indexOf('assets/js/app.js'));
 assert(!html.includes('demo-data.js'));
 assert(!html.includes('demo-adapter.js'));
});

test('Backend loader uses the supplied WebM in a top-layer dialog',()=>{
 assert(html.includes('id="backend-loader"'));
 assert(html.includes('assets/images/Loading.webm'));
 const loader=path.join(frontend,'assets/images/Loading.webm');
 assert(fs.existsSync(loader),'loader video missing');
 assert(fs.statSync(loader).size>100000,'loader video is empty or a placeholder');
 const css=fs.readFileSync(path.join(frontend,'assets/css/styles.css'),'utf8');
 assert(css.includes('.backend-loader'));
 assert(html.includes('<dialog id="backend-loader"'));
 assert(css.includes('backdrop-filter:blur(7px)'));
 assert(!css.includes('transform:scale(.975)'));
 assert(!html.includes('Loading MCQ Campus…'));
});

const service=fs.readFileSync(path.join(frontend,'assets/js/service.js'),'utf8');
const auth=fs.readFileSync(path.join(frontend,'assets/js/auth.js'),'utf8');
test('Database API is authoritative for authentication and persistent writes',()=>{
 assert(service.includes('function hydrate(snapshot,user)'));
 assert(auth.includes("credentials:'same-origin'"));
 assert(auth.includes("'/bootstrap'"));
 assert(auth.includes("'/commands'"));
 assert(auth.includes('backendLoading(true)'));
});

test('No demo data/adapters or Render configuration are packaged',()=>{
 const forbidden=['demo/demo-data.js','demo/demo-adapter.js','render.yaml','private-data/seed.json','core/management/commands/import_seed.py'];
 for(const rel of forbidden)assert(!fs.existsSync(path.join(root,rel)),rel+' should not exist');
});

console.log(`\n${count} integration groups passed.`);

