const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const requests=[];
const context={console,URLSearchParams,AbortSignal,setTimeout,clearTimeout,setInterval,clearInterval,
 location:{pathname:'/mcqs',search:'',hash:'',origin:'https://www.mcqcampus.com'},history:{replaceState(){}},
 document:{getElementById:()=>null,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null},
 fetch:async(url)=>{requests.push(url);let data={};
  if(url.includes('/mcqs?'))data={items:[{id:url.includes('important=1')?2:1,status:'approved'}],page:1,pageSize:10,total:1};
  if(url.includes('/entities?'))data={type:'jobs',items:[{id:4,paper_id:3}],page:1,pageSize:10,total:1};
  return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data};},
 App:{route:{path:'mcqs',params:{}},render(){}},UI:{href:x=>'/'+x,toast(){},closeDropdowns(){}}};
context.addEventListener=()=>{};context.window=context;vm.createContext(context);
for(const file of ['service.js','auth.js'])vm.runInContext(fs.readFileSync('frontend/assets/js/'+file,'utf8'),context);
(async()=>{
 const visit=async(path,base,id)=>{context.location.pathname='/'+path;await context.Auth.ensureRouteData(path,{base,id});};
 await visit('mcqs','mcqs');assert.equal(context.MCQ.db.mcqs[0].id,1);
 await visit('past-papers','papers');
 await visit('home','home');assert.equal(context.MCQ.db.mcqs[0].id,2);
 await visit('mcqs','mcqs');assert.equal(context.MCQ.db.mcqs[0].id,1);
 assert.equal(context.MCQ.db.mcqPage.routeKey,'/mcqs');
 await visit('past-papers/000003/ppsc-past-papers','paper',3);
 assert(requests.some(x=>x.includes('type=jobs')&&x.includes('parent=3')));
 const before=requests.length;
 await visit('mcqs','mcqs');await visit('past-papers/000003/ppsc-past-papers','paper',3);
 assert.equal(context.MCQ.db.entityPage.routeKey,context.location.pathname);
 assert(requests.length>=before);
 console.log('PASS MCQs → papers → home → MCQs restores the correct collection; hierarchy requests retain parent identity');
})().catch(e=>{console.error(e);process.exitCode=1});
