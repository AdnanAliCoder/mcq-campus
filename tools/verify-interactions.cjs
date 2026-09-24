// Behavioral regression checks. Native layout/top-layer rendering needs a real browser.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),listeners={},windowListeners={},requests=[];
function element(){const classes=new Set();return {open:false,isConnected:true,style:{overflow:'',paddingRight:''},dataset:{},setAttribute(){},removeAttribute(){},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},addEventListener(){},focus(){document.activeElement=this},showModal(){this.open=true;this.shows=(this.shows||0)+1},close(){this.open=false},querySelector(){return null}}}
const loader=element(),modal=element(),app=element(),focus=element();
const document={activeElement:focus,body:element(),documentElement:element(),getElementById:id=>({'backend-loader':loader,modal,app}[id]||null),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(t,f,o)=>{(listeners[t]??=[]).push({f,capture:o===true||o?.capture})}};
const context={console,document,location:{hash:'#/home',pathname:'/',search:''},history:{replaceState(){}},URLSearchParams,AbortSignal,setTimeout,clearTimeout,setInterval,clearInterval,scrollX:0,scrollY:240,innerWidth:1200,CSS:{supports:()=>true},getComputedStyle:()=>({paddingRight:'0'}),localStorage:{removeItem(){}},navigator:{},fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
context.window=context;context.addEventListener=(t,f)=>(windowListeners[t]??=[]).push(f);context.scrollTo=()=>{};vm.createContext(context);
function run(file){vm.runInContext(fs.readFileSync(path.join(root,'frontend/assets/js',file),'utf8'),context,{filename:file})}
function respond(req,data={}){req.resolve({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data})}
run('service.js');context.App={route:{path:'home',params:{}}};run('ui.js');run('public-layout.js');run('auth.js');
(async()=>{
 for(const [route,expected] of [['categories','categories'],['category/1','categories'],['papers','papers'],['paper/1','papers'],['jobs-exams','jobs-exams'],['post/1','posts']]){
  context.App.route.path=route;
  const html=context.UI.header('papers'),active=[...html.matchAll(/<a class="active" href="#\/([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(active,[expected]);
 }
 console.log('PASS route-specific header selection ignores stale active hints');
 let menu={open:true};document.querySelectorAll=s=>s.startsWith('details.')?[menu]:[];
 context.UI.closeDropdowns();assert.equal(menu.open,false);document.querySelectorAll=()=>[];
 const p1=context.Auth.request('/first',undefined,{loading:true}),p2=context.Auth.request('/second',undefined,{loading:true});
 assert(loader.open);assert.equal(loader.shows,1);assert(document.body.classList.contains('backend-loading'));
 const blocked={preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};
 listeners.keydown.filter(x=>x.capture).at(-1).f(blocked);assert(blocked.prevented&&blocked.stopped);
 respond(requests.shift());await p1;assert(loader.open);
 requests.shift().reject(Error('offline'));await assert.rejects(p2,/Unable to reach/);
 assert(!loader.open);assert(!document.body.classList.contains('backend-loading'));assert.equal(document.activeElement,focus);
 console.log('PASS explicit blocking requests share the CSS overlay; failure restores focus and access');
 context.App.render=()=>{};
 const start=context.Auth.start();respond(requests.shift(),{csrfToken:'test',snapshot:{schemaVersion:9},user:{id:1,name:'Test',role:'user',roles:['user'],activeRole:'user',permissions:[]}});
 await start;
 const answer=context.MCQ.attempt(1,'A');assert(!loader.open);const attemptReq=requests.shift();assert.equal(JSON.parse(attemptReq.options.body).action,'attempt');respond(attemptReq,{success:true,result:true});await answer;
 console.log('PASS signed-in answer persistence does not open loader');
 const p3=context.Auth.request('/modal',undefined,{loading:true});assert(loader.open);const shows=loader.shows;context.UI.modal('Add MCQ','<form></form>');assert(modal.open&&loader.open);assert.equal(loader.shows,shows+1);respond(requests.shift());await p3;
 console.log('PASS opening a form during loading re-promotes the loader');
 context.Auth.start=()=>{};context.McqCarousel={create:()=>({stop(){},sync(){}})};run('app.js');
 const q={id:1,status:'approved',question:'Test',option1:'A',option2:'B',option3:'C',option4:'D',correct_answer:'A'};context.MCQ.hydrate({mcqs:[q]},null);
 let finish,calls=0,rendered=0;context.MCQ.attempt=()=>{calls++;return new Promise(resolve=>finish=resolve)};
 const card={dataset:{},classList:{contains:()=>false},set outerHTML(value){rendered++}};
 document.querySelector=s=>s.startsWith('[data-question=')?card:null;context.Public={questionCard:()=>'<article>Answer</article>'};
 const target={dataset:{action:'choose',id:'1',option:'1'},closest:s=>s==='[data-action]'?target:null};
 const callback=listeners.click.filter(x=>x.f.constructor.name==='AsyncFunction').at(-1).f;
 const pending=callback({target});assert(context.App.answers[1]);assert.equal(rendered,1);await callback({target});assert.equal(calls,1);finish();await pending;
 console.log('PASS answer renders before persistence resolves; repeated clicks do not submit twice');
 const links=context.PublicLayout.linkList([['categories','Categories'],['papers','Papers']]);assert.equal((links.match(/<svg /g)||[]).length,2);
 console.log('PASS contextual sidebar links include SVG icons');
})().catch(error=>{console.error(error);process.exitCode=1});
