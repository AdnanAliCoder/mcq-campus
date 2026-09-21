const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../frontend'),read=f=>fs.readFileSync(path.join(root,'assets/js',f+'.js'),'utf8');
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name)}
const storage={},c={console,URLSearchParams,Date,performance,setTimeout,clearTimeout,localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},App:{route:{path:'home',params:{}},answers:{},choices:{},page:()=>1,draftKey:null},document:{}};
c.window=c;vm.createContext(c);for(const f of ['seed','service','importer','ui','public','admin','carousel'])vm.runInContext(read(f),c,{filename:f+'.js'});
const M=c.MCQ,P=c.Public;
check('Relationship normalization preserves order and deduplicates numeric IDs',()=>{
 assert.equal(JSON.stringify(M.ids('[1,"1",2,2,null,"",false,"oops",-1,0]')),'[1,2]');
 assert.equal(JSON.stringify(M.ids(1)),'[1]');assert.equal(JSON.stringify(M.ids([1,'1',2])),'[1,2]');
});
for(const size of [10,20])check(`${size} year associations render once, without Paper/Job/Category metadata`,()=>{
 const original={papers:M.db.papers,jobs:M.db.jobs,years:M.db.years};
 try{
  for(const type of Object.keys(original))M.db[type]=Array.from({length:size},(_,i)=>({id:8000+i,name:`${type} fixture ${i}`}));
  const ids=M.db.papers.map(x=>x.id),q={...M.db.mcqs[0],paper_id:[...ids,...ids],job_ids:JSON.stringify([...ids,...ids]),job_years_ids:[...ids,...ids],description:'Keep this explanation exactly. Paper and Job are words in the teaching material.'};
  for(const answered of [false,true]){
   c.App.answers[q.id]=answered;const html=P.questionCard(q);
   assert.equal((html.match(/href="#\/year\//g)||[]).length,answered?size:0);for(const route of ['paper','job','category','subcategory','topic'])assert.equal((html.match(new RegExp(`href="#/${route}/`,'g'))||[]).length,0);
   if(answered){assert(html.includes(q.description));assert(html.includes('mcq-answer-years'));assert(html.includes('years fixture 0'))}else{assert(!html.includes('mcq-answer-years'));assert(!html.includes('years fixture 0'))}
  }
 }finally{Object.assign(M.db,original);c.App.answers={};M.save()}
});
check('Featured shortlist uses important approved valid MCQs, not local attempts',()=>{
 const expected=M.db.mcqs.filter(q=>q.status==='approved'&&q.important).sort((a,b)=>a.id-b.id).slice(0,4).map(q=>q.id);
 assert.equal(JSON.stringify(M.topMcqs().map(q=>q.id)),JSON.stringify(expected));
 const candidate=M.topMcqs()[0],original=candidate.correct_answer;
 candidate.correct_answer='not an option';M.save();assert(!M.topMcqs().some(q=>q.id===candidate.id));candidate.correct_answer=original;M.save();
 const first=M.topMcqs();first.pop();assert.equal(M.topMcqs().length,4);
});
check('Trash counters count distinct resources, including cascade children',()=>{
 const original=M.db.trash;M.db.trash=[{mcqs:[{id:1},{id:2}],entities:{papers:[{id:3}],jobs:[{id:4}],years:[{id:5}]}},{mcqs:[{id:2}],entities:{papers:[{id:3}]}}];
 try{const n=M.trashCounts();assert.equal(n.mcqs,2);assert.equal(n.papers,1);assert.equal(n.jobs,1);assert.equal(n.years,1);M.setSession('super-admin');assert(c.Admin.render('trash').includes('Deleted MCQs'))}finally{M.db.trash=original}
});
check('Super admin filters match creator ID, dates, paper and job',()=>{
 M.setSession('super-admin');const q=M.db.mcqs[0],original=q.created_by_id;q.created_by_id=3;
 try{c.App.route={path:'super-admin/mcqs',params:{author:'3',paper:String(M.ids(q.paper_id)[0]),job:String(M.ids(q.job_ids)[0]),from:q.created_at.slice(0,10),to:q.created_at.slice(0,10)}};assert(c.Admin.render('mcqs').includes(c.UI.esc(q.question)));c.App.route.params.author='999999';assert(c.Admin.render('mcqs').includes('No matching questions'))}finally{q.created_by_id=original;c.App.route={path:'home',params:{}}}
});
check('Editing a legacy pending row does not guess its original creator',()=>{
 const original=M.clone(M.db.mcqs.find(q=>q.status==='pending')),draft=M.clone(original);draft.description+=' QA';M.setSession('super-admin');
 const saved=M.saveMcq(draft);assert.equal(saved.created_by_id,null);M.db.mcqs.splice(M.db.mcqs.findIndex(q=>q.id===saved.id),1,original);M.save();
});
check('Stored timestamp formatting is exact, timezone-consistent and handles unknown legacy time',()=>{
 assert.match(c.UI.date('2026-09-19T11:27:09Z'),/19 Sept? 2026, 04:27:09 pm PKT/);
 assert.equal(c.UI.date('2026-09-19T16:27:09+05:00'),c.UI.date('2026-09-19T11:27:09Z'));
 assert.equal(c.UI.date(null),'—');assert.equal(c.UI.date('invalid'),'Timestamp timezone unavailable');
 assert.match(c.UI.date('2026-09-19'),/time unavailable/);
});
check('Compact public counters never exaggerate and preserve an exact accessible value',()=>{
 assert.equal(c.UI.count(17),'17');assert.equal(c.UI.count(999),'999');assert.equal(c.UI.count(1000),'1K');assert.equal(c.UI.count(1100),'1.1K');assert.equal(c.UI.count(1251),'1.2K+');assert.equal(c.UI.count(1000000),'1M');assert(c.UI.counter(1251).includes('1,251'));
});
check('17 main categories include legacy records; add, reload, delete and restore recalculate',()=>{
 M.setSession('super-admin');const before=M.categoryCounts();assert.equal(before.categories,17);assert.equal(before.total,17+45+563);
 const row=M.saveEntity('categories',{name:'QA count lifecycle'}).record;assert.equal(M.categoryCounts().categories,18);assert(row.created_at&&row.created_by_id===3);assert.equal(row.created_at,row.updated_at);
 const originalCreated=row.created_at;const edit=M.saveEntity('categories',{id:row.id,name:'QA count lifecycle edited'}).record;assert.equal(edit.created_at,originalCreated);assert(edit.updated_at&&edit.updated_by_id===3);
 const reloaded={console,localStorage:c.localStorage};reloaded.window=reloaded;vm.createContext(reloaded);for(const f of ['seed','service'])vm.runInContext(read(f),reloaded);assert.equal(reloaded.MCQ.categoryCounts().categories,18);
 const item=M.softDeleteEntity('categories',row.id);assert.equal(M.categoryCounts().categories,17);M.restoreTrash(item.id);assert.equal(M.categoryCounts().categories,18);
 M.db.categories=M.db.categories.filter(x=>x.id!==row.id);M.save();assert.equal(M.categoryCounts().categories,17);
 assert(P.home().includes('Main categories'));
});
check('Two demo admins see separate rows/activity; global cards and manual foreign-record edits are blocked',()=>{
 const snapshot=M.clone({mcqs:M.db.mcqs,logs:M.db.logs,users:M.db.users,session:M.db.session});
 try{
  M.db.users.push({id:400,name:'QA Admin B',email:'qa-b@example.com',role:'admin',roles:['admin'],status:'active'});
  M.setSession('admin');const a={...M.clone(M.db.mcqs[0]),id:undefined,question:'QA Admin A unique question'};const own=M.saveMcq(a);
  assert.equal(own.created_by_id,2);assert(own.created_at&&own.updated_at);const creation=own.created_at;
  const edited=M.saveMcq({...M.clone(own),description:'Own revised explanation'});assert.equal(edited.created_at,creation);assert.equal(edited.updated_by_id,2);
  M.loginByEmail('qa-b@example.com');const other=M.saveMcq({...a,question:'QA Admin B unique question'});assert.equal(other.created_by_id,400);
  for(const [email,id,mine,theirs] of [['editor@example.com',2,own,other],['qa-b@example.com',400,other,own]]){
   M.loginByEmail(email);assert(M.managedRows('mcqs').every(q=>q.created_by_id===id));assert(M.managedRows('logs').every(x=>x.by_id===id));
   c.App.route={path:'admin/overview',params:{}};const html=c.Admin.render('overview');assert(html.includes(mine.question));assert(!html.includes(theirs.question));for(const forbidden of ['Content at a glance','Total MCQs','<span>Admins</span>','<span>Learners</span>','Top papers','My papers','My jobs','My job years','My edits in retained activity'])assert(!html.includes(forbidden));
   assert.throws(()=>M.managedMcq(theirs.id));assert.throws(()=>M.saveMcq({...theirs,question:'Tampered foreign record'}));
   assert(c.Admin.render('edit',theirs.id).includes('Question not found'));
   c.App.route={path:'admin/mcqs',params:{author:String(theirs.created_by_id)}};assert(!c.Admin.render('mcqs').includes(theirs.question));
   M.db.rolePermissions.admin.review=true;assert.throws(()=>M.review([theirs.id],'approved'));M.db.rolePermissions.admin.review=false;
  }
  M.setSession('super-admin');c.App.route={path:'super-admin/overview',params:{}};assert(c.Admin.render('overview').includes('<span>Admins</span>'));assert(M.managedRows('mcqs').some(q=>q.id===own.id)&&M.managedRows('mcqs').some(q=>q.id===other.id));
 }finally{Object.assign(M.db,snapshot);c.App.route={path:'home',params:{}};M.save()}
});
// Deterministic clock drives the real app event handlers and countdown, without wall-clock sleeps.
let now=0,nextTimer=0;const timers=new Map(),events={},windowEvents={};
c.performance={now:()=>now};c.setTimeout=(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id};c.clearTimeout=id=>timers.delete(id);c.clearInterval=()=>{};
function tick(ms){const target=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;now=next[1].at;timers.delete(next[0]);next[1].fn()}now=target}
const appNode={innerHTML:''},quickNode={outerHTML:''},meta={content:''};
c.location={hash:'#/home'};c.sessionStorage={getItem:()=>null,setItem:()=>{}};c.addEventListener=(n,fn)=>windowEvents[n]=fn;c.scrollTo=()=>{};
c.document={addEventListener:(n,fn)=>(events[n]??=[]).push(fn),getElementById:id=>id==='app'?appNode:id==='modal'?{close(){}}:null,querySelector:s=>s==='meta[name="description"]'?meta:s==='.hero-quick'?quickNode:null,querySelectorAll:()=>[]};
vm.runInContext(read('app'),c,{filename:'app.js'});
check('Initial slide stays for 9,999ms and advances at 10,000ms',()=>{assert.equal(c.App.homeQuickIndex,0);assert.equal(timers.size,1);tick(9999);assert.equal(c.App.homeQuickIndex,0);tick(1);assert.equal(c.App.homeQuickIndex,1);assert.equal(timers.size,1)});
check('Unrelated render keeps deadline and only one timer',()=>{tick(5000);c.App.render();c.App.render();assert.equal(timers.size,1);tick(4999);assert.equal(c.App.homeQuickIndex,1);tick(1);assert.equal(c.App.homeQuickIndex,2)});
(async()=>{
 tick(6000);const q=M.topMcqs()[2];const option=[1,2,3,4].find(n=>q['option'+n]===q.correct_answer);const el={dataset:{action:'home-quick-choose',id:String(q.id),option:String(option)}};
 for(const handler of events.click)await handler({target:{closest:s=>s==='[data-action]'?el:null}});
 check('Correct-answer click preserves result and restarts a full 10 seconds',()=>{assert.equal(c.App.quickAnswer.id,q.id);assert(quickNode.outerHTML.includes('quick-answer'));assert.equal(c.App.answers[q.id],undefined);assert.equal(c.App.homeQuickIndex,2);assert.equal(timers.size,1);tick(9999);assert.equal(c.App.homeQuickIndex,2);tick(1);assert.equal(c.App.homeQuickIndex,3);assert.equal(c.App.quickAnswer,null)});
 check('Four slides loop continuously with one timer',()=>{tick(10000);assert.equal(c.App.homeQuickIndex,0);tick(40000);assert.equal(c.App.homeQuickIndex,0);assert.equal(timers.size,1)});
 const historyBefore=M.db.attempts.length;
 c.App.answers[123456]=true;c.App.choices[123456]='Persist regular practice state';
 for(let cycle=0;cycle<12;cycle++){
  const active=M.topMcqs()[c.App.homeQuickIndex],button={dataset:{action:'home-quick-choose',id:String(active.id),option:'1'}};
  for(const handler of events.click)await handler({target:{closest:s=>s==='[data-action]'?button:null}});
  assert.equal(c.App.quickAnswer.id,active.id);assert.equal(timers.size,1);tick(10000);assert.equal(c.App.quickAnswer,null);
 }
 check('Repeated answers expire across 12 slides without growing temporary state or deleting history',()=>{
  assert.equal(M.db.attempts.length,historyBefore+12);assert.equal(c.App.answers[123456],true);assert.equal(Object.keys(c.App.answers).length,1);assert.equal(c.App.quickAnswer,null);assert.equal(timers.size,1);
 });
 const active=M.topMcqs()[c.App.homeQuickIndex],answerButton={dataset:{action:'home-quick-choose',id:String(active.id),option:'1'}};
 for(const handler of events.click)await handler({target:{closest:s=>s==='[data-action]'?answerButton:null}});
 const jump={dataset:{action:'home-quick-jump',index:'0'}};
 for(const handler of events.click)await handler({target:{closest:s=>s==='[data-action]'?jump:null}});
 check('Manual slide navigation immediately resets the previous answer',()=>{assert.equal(c.App.quickAnswer,null);assert(!quickNode.outerHTML.includes('quick-answer'));assert.equal(timers.size,1)});
 check('Leaving homepage and pagehide cancel countdown; return starts fresh',()=>{c.location.hash='#/categories';c.App.render();assert.equal(timers.size,0);tick(30000);assert.equal(c.App.homeQuickIndex,0);c.location.hash='#/home';c.App.render();assert.equal(timers.size,1);windowEvents.pagehide();assert.equal(timers.size,0);windowEvents.pageshow({persisted:true});assert.equal(timers.size,1);tick(9999);assert.equal(c.App.homeQuickIndex,0);tick(1);assert.equal(c.App.homeQuickIndex,1);c.App.quickTimer.stop()});
 console.log(`\n${count} targeted regression groups passed. These are frontend tests, not backend authorization tests.`);
})().catch(error=>{console.error(error);process.exitCode=1});
