const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const frontend=path.join(root,'frontend');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name)}

for(const name of fs.readdirSync(path.join(frontend,'assets/js')).filter(x=>x.endsWith('.js'))){
 const result=cp.spawnSync(process.execPath,['--check',path.join(frontend,'assets/js',name)],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr||result.stdout);
}
test('All frontend JavaScript parses',()=>{});

const html=fs.readFileSync(path.join(frontend,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
test('Frontend entry loads complete source and authentication adapter',()=>{
 assert(scripts.includes('assets/js/public.js'));
 assert(scripts.includes('assets/js/admin.js'));
 assert(scripts.includes('assets/js/seo.js'));
 assert(scripts.includes('assets/js/auth.js'));
 assert(!scripts.includes('assets/js/seed.js'));
 assert(scripts.indexOf('assets/js/auth.js')<scripts.indexOf('assets/js/app.js'));
 for(const file of scripts)assert(fs.existsSync(path.join(frontend,file)),file);
});

const service=fs.readFileSync(path.join(frontend,'assets/js/service.js'),'utf8');
const auth=fs.readFileSync(path.join(frontend,'assets/js/auth.js'),'utf8');
test('Frontend identity comes only from the authenticated API',()=>{
 assert(service.includes('function hydrate(snapshot,user)'));
 assert(!service.includes('localStorage.setItem'));
 assert(auth.includes("credentials:'same-origin'"));
 assert(auth.includes("new Set(['dashboard','profile','admin','super-admin'])"));
});

const snapshot={schemaVersion:4,categories:[{id:1,name:'Computing',icon:'grid',active:true}],subcategories:[],children:[],papers:[],jobs:[],years:[],mcqs:[{id:1,question:'Which value is correct?',option1:'0.5',option2:'0.2',option3:'1',option4:'2',correct_answer:'0.5',description:'A decimal remains text.',category_id:1,subcategory_ids:[],child_subcategory_ids:[],paper_id:[],job_ids:[],job_years_ids:[],status:'approved',important:false}],bookmarks:[],savedPapers:[],attempts:[],recent:[],reports:[],contacts:[],logs:[],trash:[],posts:[],users:[],guides:[],settings:{siteName:'MCQ Campus',description:'',country:'Pakistan',requireReview:true},content:{about:'About',contact:'Contact'},seo:{title:'MCQ Campus',description:'Practice MCQs'},rolePermissions:{admin:{review:false,import:false}},adminPerformance:[]};
const elements={app:{innerHTML:''},modal:{close(){}}};
const listeners={};
const context={console,URLSearchParams,Date,Intl,AbortSignal,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),location:{hash:'#/home',pathname:'/',search:''},history:{replaceState(a,b,url){context.location.hash=url}},document:{getElementById:id=>elements[id],addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)},querySelector:()=>null,querySelectorAll:()=>[]},App:{route:{path:'home',params:{}},answers:{},choices:{},page:()=>1,render(){},quickTimer:{stop(){}},homeRandomIds:[]}};
context.window=context;
context.fetch=async url=>({status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>url.endsWith('/auth/session')?{user:null,csrfToken:'token'}:snapshot});
vm.createContext(context);
for(const name of ['service','importer','ui','public','admin','auth'])vm.runInContext(fs.readFileSync(path.join(frontend,'assets/js',name+'.js'),'utf8'),context,{filename:name+'.js'});

(async()=>{
 await context.Auth.start();
 test('Public MCQ pages remain available without login',()=>{
  for(const route of ['home','categories','papers','mcqs','about','contact']){context.location.hash='#/'+route;assert.equal(context.Auth.guard(),true,route)}
  assert(context.Public.home().includes('<main'));
  assert(context.Public.questionCard(context.MCQ.db.mcqs[0]).includes('0.5'));
 });
 test('Learner and administration pages remain protected',()=>{
  for(const route of ['dashboard','profile','admin/overview','super-admin/overview']){context.location.hash='#/'+route;assert.equal(context.Auth.guard(),false,route);assert(context.location.hash.startsWith('#/login'))}
 });
 test('Authentication screens use the supplied frontend layout',()=>{
  for(const route of ['login','register','forgot','reset','verify'])assert(context.Auth.view(route).includes('auth-layout'));
 });
 test('Learner dashboard exposes preparation, mistakes, performance and history views',()=>{
  const learner={id:7,name:'Test Learner',email:'learner@example.com',role:'user',roles:['user'],activeRole:'user',permissions:[],country:'Pakistan',avatar:''};
  context.MCQ.hydrate({...snapshot,attempts:[{id:1,answer:'0.2',correct:false,at:'2026-09-21T08:00:00Z',by_id:7,by:'Test Learner'}],bookmarks:[1]},learner);
  for(const view of ['overview','practice','important','mistakes','saved','papers','jobs','performance','history','notifications','profile','settings']){
   const html=context.Public.dashboard(view);assert(html.includes('learner-dashboard-shell'),view);
  }
  const overview=context.Public.dashboard('overview');
  assert(overview.includes('MCQs Attempted'));
  assert(overview.includes('Review Mistakes'));
  assert(context.Public.dashboard('mistakes').includes('Which value is correct?'));
  assert(context.Public.dashboard('performance').includes('Category performance'));
 });
 console.log(`\n${count} frontend integration groups passed.`);
})().catch(error=>{console.error(error);process.exitCode=1});
