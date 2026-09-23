/* Same-origin Django authentication and API adapter.
   Public MCQ pages remain readable; account and administration routes are protected. */
window.Auth=(()=>{
 const authRoutes=new Set(['login','register','forgot','reset','verify']);
 const protectedRoutes=new Set(['dashboard','profile','admin','super-admin']);
 let ready=false,user=null,csrf='',checking=null,expiryTimer=null,generation=0;

 function initialRoute(){
  if(location.hash)return;
  let path=location.pathname.replace(/^\/+|\/+$/g,'').replace(/index\.html$/,'').replace(/\.html$/,'');
  const aliases={
   'auth/login':'login','auth/register':'register','auth/forgot-password':'forgot','auth/reset-password':'reset','auth/verify-email':'verify',
   'user-dashboard':'dashboard','user-dashboard/profile':'profile','admin':'admin/overview','super-admin':'super-admin/overview','public':'home','':''
  };
  path=aliases[path]??path.replace(/^public\//,'');
  if(path)history.replaceState(null,'','#/'+path+location.search);
 }
 initialRoute();

 const route=()=>location.hash.replace(/^#\/?/,'')||'home';
 const base=()=>route().split(/[/?]/)[0];
 const authError='Account services are unavailable. Please try again shortly.';
 function destination(value){
  if(typeof value!=='string'||!value||value.length>2000||/^[\/\\]|[\x00-\x1f\\]/.test(value))return null;
  const path=value.split('?')[0];
  return /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9_-]+)*$/i.test(path)&&!authRoutes.has(path.split('/')[0])?value:null;
 }
 function landing(){return user?.roles?.includes('super-admin')?'super-admin/overview':user?.roles?.includes('admin')?'admin/overview':'dashboard';}
 function allowed(value){
  const [b,section]=value.split('?')[0].split('/');
  if(!protectedRoutes.has(b))return true;
  if(!user)return false;
  if(b==='dashboard'||b==='profile')return true;
  if(b==='super-admin')return user.roles?.includes('super-admin');
  if(!user.roles?.some(x=>['admin','super-admin'].includes(x)))return false;
  if(user.roles.includes('super-admin'))return true;
  const permissions={categories:'manage_categories',subcategories:'manage_subcategories',children:'manage_child_categories',papers:'manage_papers',jobs:'manage_jobs',years:'manage_job_years',import:'bulk_import_mcqs',guides:'manage_guides',posts:'manage_posts',reports:'view_reports',analytics:'view_analytics',add:'add_mcq'};
  if(['users','admins','roles','settings','backup','trash','content','seo','duplicates'].includes(section))return false;
  return !permissions[section]||(user.permissions||[]).includes(permissions[section]);
 }
 function clearPrivateState(){
  generation++; clearTimeout(expiryTimer); user=null; csrf=''; MCQ.clearSession();
  if(window.App){App.answers={};App.choices={};App.quickAnswer=null;App.activeQuestionId=null;App.draft=null;App.draftKey=null;App.importRows=null;App.homeRandomIds=[];App.quickTimer?.stop();}
  document.getElementById('modal')?.close();
 }
 let pendingRequests=0;
 function backendLoading(on){
  pendingRequests=Math.max(0,pendingRequests+(on?1:-1));
  const loader=document.getElementById('backend-loader');
  if(loader){loader.hidden=pendingRequests===0;loader.setAttribute('aria-hidden',pendingRequests===0?'true':'false');}
 }
 async function request(path,body){
  backendLoading(true);
  try{
   let response;
   try{
    response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-CSRFToken':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
   }catch{throw Error('Unable to reach MCQ Campus. Check your connection and try again.');}
   if(response.status===401&&!path.startsWith('/auth/')){clearPrivateState();ready=true;throw Error('Your session has ended. Please sign in again.');}
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error(authError);
   const data=await response.json();
   if(!response.ok){const error=Error(data.message||'The request could not be completed.');error.fields=data.fields;throw error;}
   return data;
  }finally{backendLoading(false);}
 }
 function hydrate(snapshot,identity){
  user=identity?{...identity,activeRole:identity.roles?.includes(identity.activeRole)?identity.activeRole:(identity.roles?.includes('super-admin')?'super-admin':identity.roles?.includes('admin')?'admin':'user')}:null;
  MCQ.hydrate(snapshot,user);
  clearTimeout(expiryTimer);
  if(user?.expiresAt&&Number.isFinite(Date.parse(user.expiresAt))){
   expiryTimer=setTimeout(()=>{clearPrivateState();ready=false;check().then(()=>App.render())},Math.min(2147483647,Math.max(1000,Date.parse(user.expiresAt)-Date.now())));
  }
 }
 async function check(){
  if(checking)return checking;
  const own=generation;
  checking=(async()=>{
   try{
    const session=await request('/auth/session');
    if(own!==generation)return;
    csrf=session.csrfToken||'';
    const snapshot=await request('/bootstrap');
    if(own===generation)hydrate(snapshot,session.user||null);
   }catch{
    if(own===generation){clearPrivateState();try{const snapshot=await request('/bootstrap');hydrate(snapshot,null);}catch{}}
   }finally{ready=true;checking=null;}
  })();
  return checking;
 }
 function guard(){
  if(!ready){document.getElementById('app').innerHTML='<main class="session-check" role="status">Loading MCQ Campus…</main>';return false;}
  const current=route(),b=base();
  if(authRoutes.has(b)||!protectedRoutes.has(b))return true;
  if(!user){const next=destination(current);history.replaceState(null,'','#/login'+(next?'?next='+encodeURIComponent(next):''));App.route={path:'login',params:next?{next}:{}};document.getElementById('app').innerHTML=view('login');return false;}
  if(!allowed(current)){history.replaceState(null,'','#/'+landing());return false;}
  return true;
 }

 const field=(name,label,type='text',auto='',extra='')=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" autocomplete="${auto}" ${type==='password'?'minlength="8"':''} ${extra} required></div>`;
 function view(type){
  const params=new URLSearchParams(route().split('?')[1]||''),token=params.get('token');
  const titles={login:'Welcome back',register:'Your next chapter',forgot:'Forgot your password?',reset:'Choose a new password',verify:'Check your email'};
  let form='';
  if(type==='login')form=`<p class="muted small">Sign in with your existing MCQ Campus account.</p><form data-form="auth-login">${field('email','Email address','email','email')}${field('password','Password','password','current-password')}<div class="actions" style="margin-bottom:20px"><label class="check-line"><input type="checkbox" name="remember"> Remember me</label><span class="spacer"></span>${UI.link('forgot','Forgot password?','link')}</div><p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Sign in</button></form><p class="text-center small" style="margin-top:18px">New here? ${UI.link('register','Create an account','link')}</p>`;
  if(type==='register')form=`<p class="small muted">Create your learner account.</p><form data-form="auth-register">${field('name','Full name','text','name')}${field('email','Email address','email','email')}${field('password','Password','password','new-password')}${UI.select('country','Country',[{id:'Pakistan',name:'Pakistan'},{id:'Other',name:'Other'}],'Pakistan',true)}<label class="check-line"><input type="checkbox" name="terms" required> I accept the ${UI.link('terms','terms','link')} and ${UI.link('privacy','privacy policy','link')}</label><p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Create account</button></form><p class="text-center small" style="margin-top:18px">Already registered? ${UI.link('login','Log in','link')}</p>`;
  if(type==='forgot')form=`<p class="muted">Enter your account email and we will prepare a reset link.</p><form data-form="auth-forgot">${field('email','Email address','email','email')}<p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Request reset link</button></form>`;
  if(type==='reset')form=token?`<form data-form="auth-reset">${field('password','New password','password','new-password')}${field('confirm','Confirm new password','password','new-password')}<p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Update password</button></form>`:`<div class="notice warning">Open the password-reset link sent to your email.</div>${UI.link('forgot','Request a new link','btn primary')}`;
  if(type==='verify')form=token?`<p>Confirm your email address to finish registration.</p><form data-form="auth-verify"><p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Verify email</button></form>`:`<p class="muted">Enter your email to request another verification link.</p><form data-form="auth-verify">${field('email','Email address','email','email')}<p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Resend verification</button></form>`;
  return UI.layout(`<div class="container"><div class="auth-layout"><div class="auth-story"><p class="eyebrow">MCQ CAMPUS</p><h2>Make room<br>for progress.</h2><p>Your questions, your pace,<br>your next step forward.</p></div><div class="auth-form"><h1>${titles[type]}</h1>${form}</div></div></div>`);
 }

 const pendingCommands=new Map();
 async function command(action,payload){
  if(!user)throw Error('Sign in to save this activity.');
  const key=JSON.stringify([action,payload]);if(pendingCommands.has(key))return pendingCommands.get(key);
  const task=(async()=>{const own=generation,data=await request('/commands',{action,payload});if(own!==generation)throw Error('The account changed. Please try again.');if(!data.snapshot)throw Error('The server did not confirm the update.');hydrate(data.snapshot,data.user||user);return data.result;})();
  pendingCommands.set(key,task);try{return await task}finally{pendingCommands.delete(key)}
 }
 const originalAttempt=MCQ.attempt;
 MCQ.attempt=(...args)=>user?command('attempt',{args}):originalAttempt(...args);
 for(const name of ['toggleBookmark','savePaper','saveProfile','changePassword'])MCQ[name]=(...args)=>command(name,{args});
 MCQ.report=(id,reason)=>user?command('report',{args:[id,reason]}):request('/report',{id,reason});

 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form^="auth-"]');if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form)),type=form.dataset.form.slice(5),button=form.querySelector('[type=submit]'),box=form.querySelector('[data-auth-error]');
  box.textContent='';button.disabled=true;
  try{
   if(type==='reset'&&values.password!==values.confirm)throw Error('Passwords do not match.');
   const params=new URLSearchParams(route().split('?')[1]||'');
   if(['reset','verify'].includes(type))values.token=params.get('token')||'';
   const endpoint=type==='verify'&&!values.token?'resend-verification':type;
   const data=await request('/auth/'+endpoint,values);
   if(type==='login'){
    csrf=data.csrfToken||csrf;const snapshot=await request('/bootstrap');hydrate(snapshot,data.user);ready=true;
    const next=destination(params.get('next')),target=next&&allowed(next)?next:landing();location.hash='#/'+target;App.render();
   }else{box.textContent=data.message||'Request completed.';form.reset();if(type==='reset'&&data.completed)setTimeout(()=>App.go('login'),800);}
  }catch(error){box.textContent=error.message;}finally{button.disabled=false;}
 },true);

 const writeForms=new Set(['mcq','entity','review','profile','password-change','contact','settings','seo','roles','user','guide','post','config','bulk-hierarchy','pdf','latest-job','ad-config','direct-ad','footer-settings','social-links','legal-page']);
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form||!writeForms.has(form.dataset.form))return;
  event.preventDefault();event.stopImmediatePropagation();if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit],button:not([type])');if(button)button.disabled=true;
  try{
   const fd=new FormData(form),values=Object.fromEntries(fd);
   if(form.dataset.form==='profile')values.interests=fd.getAll('interests');
   if(form.dataset.form==='mcq')Admin.syncDraft();
   if(form.dataset.form==='contact'&&!user)await request('/contact',values);
   else await command('form:'+form.dataset.form,{values,fields:[...fd],context:{...form.dataset},draft:App.draft});
   window.mcqDirty=false;App.draft=null;document.getElementById('modal')?.close();App.render();UI.toast('Saved.');
  }catch(error){let box=form.querySelector('[data-command-error]');if(!box){box=document.createElement('p');box.dataset.commandError='';box.className='auth-error';box.setAttribute('role','alert');form.prepend(box);}box.textContent=error.message;}
  finally{if(button)button.disabled=false;}
 },true);

 const writeActions=new Set(['entity-delete-confirm','entity-bulk-delete','hierarchy-bulk-delete','trash-restore','report-resolve','restore-trash','import-confirm','user-status','post-delete','pdf-delete','latest-job-toggle','latest-job-delete','ad-toggle','ad-delete','bulk-important']);
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||!writeActions.has(el.dataset.action))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
   const extra={...el.dataset,rows:App.importRows};
   if(['entity-bulk-delete','hierarchy-bulk-delete'].includes(el.dataset.action)){const type=el.dataset.type;extra.ids=[...document.querySelectorAll(`.${el.dataset.action==='entity-bulk-delete'?'entity':'hierarchy'}-row-check[data-type="${type}"]:checked`)].map(x=>Number(x.value)).filter(Boolean);if(!extra.ids.length)throw Error('Select at least one record.');}
   if(el.dataset.action==='bulk-important'){
    if(el.dataset.target==='papers'){const paperIds=[...document.querySelectorAll('.entity-row-check[data-type="papers"]:checked')].map(x=>Number(x.value)).filter(Boolean);extra.ids=MCQ.db.mcqs.filter(q=>MCQ.ids(q.paper_id).some(id=>paperIds.includes(id))).map(q=>q.id);}
    else extra.ids=[...document.querySelectorAll('.mcq-row-check:checked')].map(x=>Number(x.value)).filter(Boolean);
    if(!extra.ids.length)throw Error('Select at least one matching MCQ.');
   }
   const result=await command('action:'+el.dataset.action,extra);if(el.dataset.action==='import-confirm')App.importSummary=result;document.getElementById('modal')?.close();App.render();UI.toast('Saved.');
  }
  catch(error){UI.toast(error.message);}
 },true);

 async function switchRole(role){const data=await request('/auth/switch-role',{role});csrf=data.csrfToken||csrf;hydrate(data.snapshot,data.user);return data.user.activeRole;}
 async function logout(){try{await request('/auth/logout',{});}catch{}clearPrivateState();ready=false;await check();location.hash='#/login';App.render();}
 async function start(){await check();App.render();}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user){ready=false;App.render();check().then(()=>App.render());}});
 window.addEventListener('pageshow',event=>{if(event.persisted){ready=false;check().then(()=>App.render());}});
 document.addEventListener('input',event=>{if(event.target.closest('form[data-form="mcq"]'))window.mcqDirty=true;});
 window.addEventListener('beforeunload',event=>{if(window.mcqDirty){event.preventDefault();event.returnValue='';}});
 return {guard,view,start,logout,switchRole,request,command,destination,allowed,get user(){return user;}};
})();
