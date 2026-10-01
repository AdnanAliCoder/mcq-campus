/* Same-origin Django authentication and API adapter.
   Public MCQ pages remain readable; account and administration routes are protected. */
window.Auth=(()=>{
 const authRoutes=new Set(['login','register','forgot','reset','verify']);
 const protectedRoutes=new Set(['dashboard','profile','admin','super-admin']);
 let ready=false,user=null,csrf='',checking=null,expiryTimer=null,generation=0;
 const loadedSections=new Set(),sectionLoadedAt=new Map(),loadingSections=new Map();
 const SECTION_TTL=Number.POSITIVE_INFINITY;
 const ADMIN_PAGE_SIZES=[100,500,1000,2000,3000,5000,10000],ADMIN_DEFAULT_PAGE_SIZE=1000;

 function initialRoute(){
  if(location.hash){
   const legacy=location.hash.replace(/^#\/?/,'');const [path,query='']=legacy.split('?'),params=Object.fromEntries(new URLSearchParams(query));history.replaceState(null,'',UI.href(path||'home',params));return;
  }
  let path=location.pathname.replace(/^\/+|\/+$/g,'').replace(/index\.html$/,'').replace(/\.html$/,'');
  const aliases={
   'auth/login':'login','auth/register':'register','auth/forgot-password':'forgot','auth/reset-password':'reset','auth/verify-email':'verify',
   'user-dashboard':'dashboard','user-dashboard/profile':'profile','admin':'admin/overview','super-admin':'super-admin/overview','public':'home','':''
  };
  const mapped=aliases[path]??path.replace(/^public\//,'');
  if(mapped!==path)history.replaceState(null,'',UI.href(mapped||'home',Object.fromEntries(new URLSearchParams(location.search))));
 }
 initialRoute();

 const route=()=>{const path=location.pathname.replace(/^\/+|\/+$/g,'')||'home';return path+location.search};
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
  generation++; clearTimeout(expiryTimer); user=null; csrf='';
  for(const key of [...loadedSections])if(!['core','public-content','resources','catalog','legal'].includes(key)){loadedSections.delete(key);sectionLoadedAt.delete(key)}
  for(const [key] of loadingSections)if(!['core','public-content','resources','catalog','legal'].includes(key))loadingSections.delete(key);
  MCQ.clearSession();
  if(window.App){App.answers={};App.choices={};App.quickAnswer=null;App.activeQuestionId=null;App.draft=null;App.draftKey=null;App.importRows=null;App.importedIds=[];App.homeRandomIds=[];App.quickTimer?.stop();}
  document.getElementById('modal')?.close();
 }
 let pendingRequests=0,loadingFocus=null;
 function backendLoading(on){
  const wasActive=pendingRequests>0;
  pendingRequests=Math.max(0,pendingRequests+(on?1:-1));
  const active=pendingRequests>0,loader=document.getElementById('backend-loader');
  if(active===wasActive||!loader)return;
  if(active){
   UI.closeDropdowns();
   loadingFocus=document.activeElement;
   document.body.classList.add('backend-loading');
   document.getElementById('main-nav')?.classList.remove('open');
   document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded','false');
   document.getElementById('public-smart-sidebar')?.classList.remove('open');
   document.querySelector('.public-sidebar-backdrop')?.classList.remove('open');
   document.querySelector('[data-action="public-sidebar-toggle"]')?.setAttribute('aria-expanded','false');
   if(!loader.open)loader.showModal();
   loader.focus({preventScroll:true});
  }else{
   if(loader.open)loader.close();
   document.body.classList.remove('backend-loading');
   if(loadingFocus?.isConnected)loadingFocus.focus({preventScroll:true});
   loadingFocus=null;
  }
 }
 function setButtonLoading(button,label='Working...'){
  if(!button)return ()=>{};
  if(button.dataset.loading==='true')return ()=>{};
  const original={html:button.innerHTML,disabled:button.disabled,minWidth:button.style.minWidth};
  const width=button.getBoundingClientRect?.().width||0;
  button.dataset.loading='true';
  button.disabled=true;
  button.setAttribute('aria-busy','true');
  if(width)button.style.minWidth=Math.ceil(width)+'px';
  button.innerHTML='<span class="mcq-spinner button-loader-spinner button-spinner" aria-hidden="true"></span><span>'+label+'</span>';
  return ()=>{
   button.innerHTML=original.html;
   button.disabled=original.disabled;
   button.style.minWidth=original.minWidth;
   button.removeAttribute('aria-busy');
   delete button.dataset.loading;
  };
 }
 document.getElementById('backend-loader')?.addEventListener('cancel',event=>event.preventDefault());
 // Only explicit blocking operations use the global overlay.
 for(const type of ['click','dblclick','pointerdown','keydown','keyup','submit','wheel','touchmove']){
  document.addEventListener(type,event=>{if(!pendingRequests)return;event.preventDefault();event.stopImmediatePropagation();},{capture:true,passive:false});
 }
 async function request(path,body,{loading=false,timeout=15000}={}){
  if(loading)backendLoading(true);
  try{
   let response;
   try{
    response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-CSRFToken':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(timeout)});
   }catch{throw Error('Unable to reach MCQ Campus. Check your connection and try again.');}
   if(response.status===401&&!path.startsWith('/auth/')){clearPrivateState();ready=true;throw Error('Your session has ended. Please sign in again.');}
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error(authError);
   const data=await response.json();
   if(!response.ok){const error=Error(data.message||'The request could not be completed.');error.fields=data.fields;throw error;}
   return data;
  }finally{if(loading)backendLoading(false);}
 }
 async function ensureRouteData(path){
  if(!path)return false;
  const clean=String(path).split('?')[0],parts=clean.split('/'),workspace=parts[0],section=parts[1]||'overview',recordId=parts[2]||'',wants=[];
  const routeParams=new URLSearchParams(location.search);
  if(!authRoutes.has(workspace))wants.push('core','resources');
  if(['home','posts','post','search','blog'].includes(workspace))wants.push('public-content');
  if(['home','pdfs','pdf','latest-jobs','latest-job'].includes(workspace)||(workspace==='past-papers'&&section==='pdfs'))wants.push('catalog');
  if(['about','contact','privacy','terms','disclaimer','cookies','advertising'].includes(workspace))wants.push('legal');
  if(user&&(workspace==='dashboard'||workspace==='profile')){
   wants.push('learner');
   if(workspace==='profile'||section==='settings')wants.push('profile');
  }
  if(user&&['admin','super-admin'].includes(workspace)){
   if(section==='overview')wants.push('overview');
   if(['users','admins','admin-records'].includes(section)||(section==='all-mcqs'&&user.roles?.includes('super-admin')))wants.push('users');
   if(['add','edit','all-mcqs','mcqs','paper-mcqs','categories','papers','jobs','years','import'].includes(section))wants.push('core');
   if(['all-mcqs','mcqs','edit','paper-mcqs'].includes(section))wants.push('workspace-mcqs');
   if(section==='reports')wants.push('reports');
   if(section==='trash')wants.push('trash');
   if(section==='logs')wants.push('logs');
   if(['posts','guides','ads'].includes(section))wants.push('content');
   if(['settings','content','seo','page-seo','roles','footer','social','ads'].includes(section))wants.push('resources');
   if(['pdfs','latest-jobs','current-affairs','pdfs-manager','latest-jobs-manager'].includes(section))wants.push('catalog');
   if(['content','legal'].includes(section))wants.push('legal');
  }
  const workspaceEndpoint=()=>{
   const q=new URLSearchParams();
   const requested=ADMIN_PAGE_SIZES.includes(Number(routeParams.get('limit')))?Number(routeParams.get('limit')):ADMIN_DEFAULT_PAGE_SIZE;
   q.set('page',String(Math.max(1,Number(routeParams.get('page'))||1)));
   q.set('page_size',String(section==='edit'?1:requested));
   for(const key of ['status','category','paper','job','year','author','from','to','search']){
    const value=routeParams.get(key);if(value)q.set(key,value);
   }
   if(section==='mcqs')q.set('owner','me');
   if(section==='edit'&&recordId)q.set('id',recordId);
   if(section==='paper-mcqs'&&recordId)q.set('paper',recordId);
   return '/mcqs?'+q.toString();
  };
  let changed=false;
  const load=async key=>{
   let endpoint='/admin/'+key;
   if(key==='core')endpoint='/bootstrap';
   else if(key==='public-content')endpoint='/public/content';
   else if(key==='resources')endpoint='/public/resources';
   else if(key==='catalog')endpoint='/public/catalog';
   else if(key==='legal')endpoint='/public/legal';
   else if(key==='learner')endpoint='/learner/dashboard';
   else if(key==='profile')endpoint='/profile';
   else if(key==='workspace-mcqs')endpoint=workspaceEndpoint();
   const cacheKey=key==='workspace-mcqs'?key+'|'+endpoint:key;
   const fresh=loadedSections.has(cacheKey)&&Date.now()-(sectionLoadedAt.get(cacheKey)||0)<SECTION_TTL;
   if(fresh)return false;
   if(loadingSections.has(cacheKey)){await loadingSections.get(cacheKey);return false}
   const task=(async()=>{
    try{
     const own=generation,data=await request(endpoint);
     if(!['core','public-content','resources','catalog','legal'].includes(key)&&own!==generation)return;
     if(key==='core')MCQ.mergeCore(data);
     if(key==='public-content')MCQ.mergeCore(data);
     if(key==='resources')MCQ.mergeCore(data);
     if(key==='catalog')MCQ.mergeCore(data);
     if(key==='legal')MCQ.mergeCore(data);
     if(key==='learner'){
      if(Array.isArray(data.attempts))MCQ.db.attempts=data.attempts;
      if(Array.isArray(data.bookmarks))MCQ.db.bookmarks=data.bookmarks;
      if(Array.isArray(data.savedPapers))MCQ.db.savedPapers=data.savedPapers;
     }
     if(key==='profile'&&data.user)setIdentity({...user,...data.user});
     if(key==='workspace-mcqs'){
      if(Array.isArray(data.items))MCQ.db.mcqs=data.items;
      MCQ.db.mcqPage={page:data.page,pageSize:data.pageSize,total:data.total,hasNext:data.hasNext,server:true,request:endpoint};
     }
     if(key==='overview')MCQ.db.adminOverview=data||{};
     if(key==='users')MCQ.db.users=Array.isArray(data.items)?data.items:[];
     if(key==='reports'){MCQ.db.reports=Array.isArray(data.items)?data.items:[];MCQ.db.contacts=Array.isArray(data.contacts)?data.contacts:[]}
     if(key==='trash')MCQ.db.trash=Array.isArray(data.items)?data.items:[];
     if(key==='logs')MCQ.db.logs=Array.isArray(data.items)?data.items:[];
     if(key==='content'){
      if(Array.isArray(data.posts))MCQ.db.posts=data.posts;
      if(Array.isArray(data.guides))MCQ.db.guides=data.guides;
      if(Array.isArray(data.ads))MCQ.db.ads=data.ads;
     }
     loadedSections.add(cacheKey);sectionLoadedAt.set(cacheKey,Date.now());changed=true;
    }catch(error){
     if(error?.message)console.warn('Lazy route data unavailable:',key);
    }finally{loadingSections.delete(cacheKey)}
   })();
   loadingSections.set(cacheKey,task);await task;return true;
  };
  const unique=[...new Set(wants)];
  if(unique.includes('core'))await load('core');
  if(unique.includes('workspace-mcqs'))await load('workspace-mcqs');
  await Promise.all(unique.filter(key=>!['core','workspace-mcqs'].includes(key)).map(load));
  return changed;
 }
 function setIdentity(identity){
  user=identity?{...identity,activeRole:identity.roles?.includes(identity.activeRole)?identity.activeRole:(identity.roles?.includes('super-admin')?'super-admin':identity.roles?.includes('admin')?'admin':'user')}:null;
  MCQ.setSession(user);
  clearTimeout(expiryTimer);
  if(user?.expiresAt&&Number.isFinite(Date.parse(user.expiresAt))){
   expiryTimer=setTimeout(()=>{validateSession(true).then(()=>App.render())},Math.min(2147483647,Math.max(1000,Date.parse(user.expiresAt)-Date.now())));
  }
 }
 function hydrate(snapshot,identity){
  const incoming=snapshot||{};
  MCQ.hydrate(incoming,null);
  setIdentity(identity);
  // A lightweight startup snapshot intentionally omits taxonomy/MCQs/catalog.
  // Never keep stale "loaded" markers after replacing the client store with it.
  const sections=[
   ['core',['categories','papers','jobs','years','mcqs']],
   ['public-content',['posts']],
   ['catalog',['pdfs','latestJobs']],
   ['legal',['content']],
   ['resources',['seoIndex']]
  ];
  for(const [section,keys] of sections){
   const supplied=keys.some(key=>Object.prototype.hasOwnProperty.call(incoming,key));
   if(!supplied){loadedSections.delete(section);sectionLoadedAt.delete(section)}
  }
 }
 async function check(){
  if(checking)return checking;
  const own=generation;
  checking=(async()=>{
   backendLoading(true);
   try{
    const data=await request('/startup');
    if(own!==generation)return;
    csrf=data.csrfToken||'';
    hydrate(data.snapshot||{},data.user||null);
   }catch{
    if(own===generation){clearPrivateState();hydrate({},null);}
   }finally{backendLoading(false);ready=true;checking=null;}
  })();
  return checking;
 }
 function guard(){
  if(!ready){document.getElementById('app').setAttribute('aria-busy','true');return false;}
  document.getElementById('app').removeAttribute('aria-busy');
  const current=route(),b=base();
  if(authRoutes.has(b)||!protectedRoutes.has(b))return true;
  if(!user){const next=destination(current);history.replaceState(null,'',UI.href('login',next?{next}:{}));App.route={path:'login',params:next?{next}:{}};document.getElementById('app').innerHTML=view('login');return false;}
  if(!allowed(current)){history.replaceState(null,'',UI.href(landing()));return false;}
  return true;
 }

 let verificationTimer=null;
 const resendKey=email=>'mcq-verify-resend-until:'+String(email||'').toLowerCase();
 const armVerificationTimer=(email,seconds=60)=>{
  const until=Date.now()+Math.max(0,Number(seconds)||0)*1000;
  try{sessionStorage.setItem(resendKey(email),String(until))}catch{}
  syncVerificationTimer(email);
 };
 const syncVerificationTimer=email=>{
  clearInterval(verificationTimer);
  const tick=()=>{
   const button=document.querySelector('[data-auth-resend]');
   const label=document.querySelector('[data-auth-resend-timer]');
   if(!button||!label)return;
   let until=0;try{until=Number(sessionStorage.getItem(resendKey(email))||0)}catch{}
   const left=Math.max(0,Math.ceil((until-Date.now())/1000));
   button.disabled=left>0;
   const mins=Math.floor(left/60),secs=left%60;
   label.textContent=left>0?`Resend code in ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`:'You can request a new code now.';
   if(left<=0){clearInterval(verificationTimer);verificationTimer=null}
  };
  tick();
  verificationTimer=setInterval(tick,1000);
 };
 const field=(name,label,type='text',auto='',extra='',mark=false)=>`<div class="field"><label for="${name}">${label}${mark?' <span class="required-mark" aria-hidden="true">*</span>':''}</label><input id="${name}" name="${name}" type="${type}" autocomplete="${auto}" ${type==='password'?'minlength="8"':''} ${extra} required></div>`;
 function view(type){
  const params=new URLSearchParams(route().split('?')[1]||''),emailParam=params.get('email')||'';
  const titles={login:'Welcome back',register:'Your next chapter',forgot:'Forgot your password?',reset:'Choose a new password',verify:'Email verification'};
  let form='';
  if(type==='login')form=`<p class="muted small">Sign in with your existing MCQ Campus account.</p><form data-form="auth-login">${field('email','Email address','email','email')}${field('password','Password','password','current-password')}<div class="actions" style="margin-bottom:20px"><label class="check-line"><input type="checkbox" name="remember"> Remember me</label><span class="spacer"></span>${UI.link('forgot','Forgot password?','link')}</div><p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Sign in</button></form><p class="text-center small" style="margin-top:18px">New here? ${UI.link('register','Create an account','link')}</p>`;
  if(type==='register')form=`<p class="small muted">Create your learner account. All fields marked * are required.</p><form data-form="auth-register">${field('first_name','First name','text','given-name','',true)}${field('last_name','Last name','text','family-name','',true)}${field('email','Email address','email','email','',true)}${field('password','Password','password','new-password','',true)}${field('confirm','Confirm password','password','new-password','',true)}<label class="check-line"><input type="checkbox" name="terms" required> I accept the ${UI.link('terms','terms','link')} and ${UI.link('privacy','privacy policy','link')} <span class="required-mark" aria-hidden="true">*</span></label><p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Send verification code</button></form><p class="text-center small" style="margin-top:18px">Already registered? ${UI.link('login','Log in','link')}</p>`;
  if(type==='forgot')form=`<p class="muted">Enter your account email and we will send a 6-digit reset code.</p><form data-form="auth-forgot">${field('email','Email address','email','email')}<p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Send reset code</button></form>`;
  if(type==='reset')form=`<p class="muted">Enter the reset code from your email and choose a new password.</p><form data-form="auth-reset">${field('email','Email address','email','email',`value="${UI.esc(emailParam)}"`)}${field('code','6-digit reset code','text','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}"')}${field('password','New password','password','new-password')}${field('confirm','Confirm new password','password','new-password')}<p class="auth-error" role="alert" data-auth-error></p><button class="btn primary" type="submit">Update password</button></form>`;
  if(type==='verify'){form=`<p class="muted">Enter the 6-digit code sent to your email. Your account is created only after successful verification.</p><form data-form="auth-verify">${field('email','Email address','email','email',`value="${UI.esc(emailParam)}"`)}${field('code','6-digit verification code','text','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}"')}<p class="small muted" data-auth-resend-timer>You can request a new code now.</p><p class="auth-error" role="alert" data-auth-error></p><div class="actions"><button class="btn primary" type="submit">Verify & create account</button><button class="btn ghost" type="button" data-auth-resend>Resend code</button></div></form><p class="text-center small" style="margin-top:18px">${UI.link('login','Back to login','link')}</p>`;setTimeout(()=>syncVerificationTimer(emailParam),0)}
  return UI.layout(`<div class="container"><div class="auth-layout"><div class="auth-story"><p class="eyebrow">MCQ CAMPUS</p><h2>Make room<br>for progress.</h2><p>Your questions, your pace,<br>your next step forward.</p></div><div class="auth-form"><h1>${titles[type]}</h1>${form}</div></div></div>`);
 }

 const pendingCommands=new Map();
 function applyCommandResult(action,result,payload){
  const args=payload?.args||[];
  if(action==='attempt'){
   const [id,answer]=args,q=MCQ.get('mcqs',id);
   MCQ.db.attempts.unshift({id:Number(id),answer,correct:!!result,at:new Date().toISOString(),by_id:user?.id||null,by:user?.name||'Unknown'});
   MCQ.db.attempts=MCQ.db.attempts.slice(0,500);return;
  }
  if(action==='toggleBookmark'){
   const id=Number(args[0]);MCQ.db.bookmarks=result?[...new Set([...MCQ.db.bookmarks,id])]:MCQ.db.bookmarks.filter(x=>Number(x)!==id);return;
  }
  if(action==='savePaper'){
   const id=Number(args[0]);MCQ.db.savedPapers=result?[...new Set([...MCQ.db.savedPapers,id])]:MCQ.db.savedPapers.filter(x=>Number(x)!==id);return;
  }
  if(action==='saveProfile'||action==='form:profile'){
   const next=result?.user||result;if(next?.id)setIdentity({...user,...next});return;
  }
  if(action==='report'&&result?.report){MCQ.upsert('reports',result.report);return}
  if(action==='form:mcq'&&result?.mcq){MCQ.upsert('mcqs',result.mcq);return}
  if(action==='form:review'&&Array.isArray(result?.mcqs)){result.mcqs.forEach(row=>MCQ.upsert('mcqs',row));return}
  if(action==='form:entity'&&result?.type&&result?.entity){MCQ.upsert(result.type,result.entity);return}
  if(action==='form:user'&&result?.user){MCQ.upsert('users',result.user);if(Number(result.user.id)===Number(user?.id))setIdentity({...user,...result.user});return}
  if(action==='form:guide'&&result?.guide){MCQ.upsert('guides',result.guide);return}
  if(action==='form:post'&&result?.post){MCQ.upsert('posts',result.post);return}
  if(action==='form:ad'&&result?.ad){MCQ.upsert('ads',result.ad);return}
  if(action==='action:report-resolve'&&result?.report){MCQ.upsert('reports',result.report);return}
  if(action==='action:user-status'&&result?.user){MCQ.upsert('users',result.user);return}
  if(action==='action:ad-toggle'&&result?.ad){MCQ.upsert('ads',result.ad);return}
  if(result?.pageSeo)MCQ.mergeCore({pageSeo:result.pageSeo});
  if(Array.isArray(result?.mcqs))result.mcqs.forEach(row=>MCQ.upsert('mcqs',row));
  if(Array.isArray(result?.pdfs))MCQ.db.pdfs=result.pdfs;
  if(Array.isArray(result?.latestJobs))MCQ.db.latestJobs=result.latestJobs;
  if(result?.deleted?.type){MCQ.remove(result.deleted.type,result.deleted.ids||[]);return}
 }
 function invalidateWorkspaceMcqs(){for(const key of [...loadedSections])if(String(key).startsWith('workspace-mcqs|')){loadedSections.delete(key);sectionLoadedAt.delete(key)}}
 async function command(action,payload){
  if(!user)throw Error('Sign in to save this activity.');
  const key=JSON.stringify([action,payload]);if(pendingCommands.has(key))return pendingCommands.get(key);
  const task=(async()=>{
   const own=generation,data=await request('/commands',{action,payload},{loading:action==='action:import-confirm',timeout:action==='action:import-confirm'?60000:15000});
   if(own!==generation)throw Error('The account changed. Please try again.');
   if(data.user)setIdentity({...user,...data.user});
   if(data.seoIndex)MCQ.mergeCore({seoIndex:data.seoIndex});
   applyCommandResult(action,data.result,payload);
   if(['form:mcq','form:review','action:import-confirm','action:mcq-delete','action:mcq-delete-confirm','action:mcq-bulk-delete','action:trash-restore','action:restore-trash','action:trash-restore-many','action:trash-bulk-restore'].includes(action))invalidateWorkspaceMcqs();
   if(['action:mcq-delete','action:mcq-delete-confirm','action:mcq-bulk-delete','action:trash-restore','action:restore-trash','action:trash-restore-many','action:trash-bulk-restore','action:trash-permanent-delete','action:trash-bulk-delete'].includes(action)){loadedSections.delete('trash');sectionLoadedAt.delete('trash')}
   if(data.refresh==='bootstrap'){
    const snapshot=await request('/bootstrap');
    if(own!==generation)throw Error('The account changed. Please try again.');
    hydrate(snapshot,user);
   }
   return data.result;
  })();
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
  box.textContent='';
  const labels={login:'Signing in...',register:'Creating account...',forgot:'Sending...',reset:'Updating...',verify:'Verifying...'};
  const restoreButton=setButtonLoading(button,labels[type]||'Working...');
  try{
   if((type==='reset'||type==='register')&&values.password!==values.confirm)throw Error('Passwords do not match.');
   const params=new URLSearchParams(route().split('?')[1]||'');
   const data=await request('/auth/'+type,values);
   if(type==='login'){
    csrf=data.csrfToken||csrf;setIdentity(data.user);ready=true;lastSessionValidation=Date.now();
    const next=destination(params.get('next')),target=next&&allowed(next)?next:landing();App.go(target);
   }else if(type==='register'&&data.verificationRequired){
    const verifyEmail=data.email||values.email;
    armVerificationTimer(verifyEmail,data.resendAfter||60);
    App.go('verify',{email:verifyEmail});
   }else if(type==='forgot'){
    box.textContent=data.message||'If an active account matches that email, a reset code has been sent.';
    setTimeout(()=>App.go('reset',{email:values.email||''}),700);
   }else if(type==='verify'&&data.completed){
    box.textContent=data.message||'Email verified. You can now sign in.';
    setTimeout(()=>App.go('login'),700);
   }else if(type==='reset'&&data.completed){
    box.textContent=data.message||'Password updated. You can now sign in.';
    setTimeout(()=>App.go('login'),700);
   }else{
    box.textContent=data.message||'Request completed.';
   }
  }catch(error){
   if(type==='login'&&error?.fields?.verificationRequired){
    App.go('verify',{email:values.email||''});
   }else box.textContent=error.message;
  }finally{restoreButton();}
 },true);

 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-auth-resend]');if(!button)return;
  event.preventDefault();
  const form=button.closest('form[data-form="auth-verify"]'),box=form?.querySelector('[data-auth-error]');
  const email=form?.querySelector('[name="email"]')?.value||'';
  if(!email){if(box)box.textContent='Enter your email address.';return;}
  const restore=setButtonLoading(button,'Sending...');
  try{const data=await request('/auth/resend-verification',{email});armVerificationTimer(email,data.resendAfter||60);if(box)box.textContent=data.message||'If verification is required, a new code has been sent.';}
  catch(error){if(box)box.textContent=error.message;}
  finally{restore();}
 },true);


 function openPasswordChangeStart(){
  const modal=document.getElementById('modal');if(!modal)return;
  modal.innerHTML=`<div class="dialog-content"><div class="dialog-head"><div><p class="eyebrow">ACCOUNT SECURITY</p><h2>Change password</h2></div><button class="btn ghost sm" type="button" data-password-change-close>Close</button></div><p class="small muted">Enter your current password, then choose a new password. The new password must be different from your current password.</p><form data-password-change-step="start">${field('current_password','Current password','password','current-password','',true)}${field('new_password','New password','password','new-password','',true)}${field('confirm_password','Confirm new password','password','new-password','',true)}<p class="auth-error" role="alert" data-password-change-error></p><div class="actions"><button class="btn primary" type="submit">Send verification code</button></div></form></div>`;
  if(!modal.open)modal.showModal();
 }
 function openPasswordChangeCode(message=''){
  const modal=document.getElementById('modal');if(!modal)return;
  modal.innerHTML=`<div class="dialog-content"><div class="dialog-head"><div><p class="eyebrow">EMAIL VERIFICATION</p><h2>Enter verification code</h2></div><button class="btn ghost sm" type="button" data-password-change-close>Close</button></div><p class="small muted">We sent a 6-digit code to your account email. Your password will not change until this code is verified.</p><form data-password-change-step="confirm">${field('code','6-digit verification code','text','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}"',true)}<p class="small muted">Code expires in 10 minutes.</p><p class="auth-error" role="alert" data-password-change-error>${UI.esc(message)}</p><div class="actions"><button class="btn primary" type="submit">Verify & change password</button><button class="btn ghost" type="button" data-password-change-back>Back</button></div></form></div>`;
  if(!modal.open)modal.showModal();
 }
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-password-change-open]')){event.preventDefault();openPasswordChangeStart();return}
  if(event.target.closest('[data-password-change-close]')){event.preventDefault();document.getElementById('modal')?.close();return}
  if(event.target.closest('[data-password-change-back]')){event.preventDefault();openPasswordChangeStart();return}
 });
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-password-change-step]');if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();if(!form.reportValidity())return;
  const box=form.querySelector('[data-password-change-error]'),button=form.querySelector('[type=submit]'),values=Object.fromEntries(new FormData(form));
  if(box)box.textContent='';
  const restore=setButtonLoading(button,form.dataset.passwordChangeStep==='start'?'Checking...':'Verifying...');
  try{
   if(form.dataset.passwordChangeStep==='start'){
    if(values.new_password!==values.confirm_password)throw Error('New passwords do not match.');
    const data=await request('/auth/password-change/start',values);
    openPasswordChangeCode(data.message||'Verification code sent.');
   }else{
    const data=await request('/auth/password-change/confirm',{code:values.code});
    document.getElementById('modal')?.close();
    UI.toast(data.message||'Password changed successfully.');
   }
  }catch(error){if(box)box.textContent=error.message;}
  finally{restore();}
 },true);

 const writeForms=new Set(['mcq','entity','review','profile','password-change','contact','settings','seo','roles','user','guide','post','config','page-seo','bulk-hierarchy','bulk-categories','bulk-pdfs','bulk-latest-jobs','bulk-posts','pdf','latest-job','ad-config','direct-ad','footer-settings','social-links','legal-page']);
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form||!writeForms.has(form.dataset.form))return;
  event.preventDefault();event.stopImmediatePropagation();if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit],button:not([type])');
  const restoreButton=setButtonLoading(button,form.dataset.form==='mcq'?'Saving...':'Saving...');
  try{
   const fd=new FormData(form),values=Object.fromEntries(fd);
   if(form.dataset.form==='profile')values.interests=fd.getAll('interests');
   if(form.dataset.form==='mcq')Admin.syncDraft();
   if(form.dataset.form==='contact'&&!user)await request('/contact',values);
   else await command('form:'+form.dataset.form,{values,fields:[...fd],context:{...form.dataset},draft:App.draft});
   window.mcqDirty=false;App.draft=null;document.getElementById('modal')?.close();App.render();UI.toast('Saved.');
  }catch(error){let box=form.querySelector('[data-command-error]');if(!box){box=document.createElement('p');box.dataset.commandError='';box.className='auth-error';box.setAttribute('role','alert');form.prepend(box);}box.textContent=error.message;}
  finally{restoreButton();}
 },true);

 const writeActions=new Set(['entity-delete-confirm','entity-bulk-delete','hierarchy-bulk-delete','report-resolve','import-confirm','user-status','post-delete','pdf-delete','latest-job-toggle','latest-job-delete','ad-toggle','ad-delete']);
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||!writeActions.has(el.dataset.action))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(el.dataset.loading==='true')return;
  const actionLabels={'entity-delete-confirm':'Deleting...','entity-bulk-delete':'Deleting...','hierarchy-bulk-delete':'Deleting...','trash-restore':'Restoring...','report-resolve':'Updating...','restore-trash':'Restoring...','import-confirm':'Importing...','user-status':'Updating...','post-delete':'Deleting...','pdf-delete':'Deleting...','latest-job-toggle':'Updating...','latest-job-delete':'Deleting...','ad-toggle':'Updating...','ad-delete':'Deleting...'};
  const restoreButton=setButtonLoading(el,actionLabels[el.dataset.action]||'Working...');
  try{
   let selectedImportRows=App.importRows;if(el.dataset.action==='import-confirm'){const selected=[...document.querySelectorAll('.import-row-check:checked')].map(x=>Number(x.value)).filter(Number.isInteger);if(!selected.length)throw Error('Select at least one MCQ to import.');selectedImportRows=selected.map(i=>App.importRows?.[i]).filter(Boolean);if(selectedImportRows.some(r=>!r?.q))throw Error('Selected import row is missing normalized MCQ data. Re-upload the file.');}const extra={...el.dataset,rows:el.dataset.action==='import-confirm'?selectedImportRows.map(r=>r.q):App.importRows};
   if(['entity-bulk-delete','hierarchy-bulk-delete'].includes(el.dataset.action)){const type=el.dataset.type;extra.ids=[...document.querySelectorAll(`.${el.dataset.action==='entity-bulk-delete'?'entity':'hierarchy'}-row-check[data-type="${type}"]:checked`)].map(x=>Number(x.value)).filter(Boolean);if(!extra.ids.length)throw Error('Select at least one record.');}
   const result=await command('action:'+el.dataset.action,extra);if(el.dataset.action==='import-confirm'){
    App.importSummary=result?.summary||result;
    App.importedIds=(result?.mcqs||[]).map(x=>Number(x.id)).filter(Boolean);
    loadedSections.delete('overview');sectionLoadedAt.delete('overview');invalidateWorkspaceMcqs();
    const freshOverview=await request('/admin/overview');
    MCQ.db.adminOverview=freshOverview||{};
    loadedSections.add('overview');sectionLoadedAt.set('overview',Date.now());
    const summary=result?.summary||{};
    const savedCount=Number(summary.imported||0)+Number(summary.updated||0);
    const duplicateCount=Number(summary.duplicates||0);
    if((Number(summary.failed||0)>0||Number(summary.invalid||0)>0)&&savedCount===0){
      const first=summary.errors?.[0]?.message||('No MCQs were imported. Invalid rows: '+Number(summary.invalid||0)+'.');
      throw Error(first);
    }
    if(savedCount>0){
      const parts=[];
      if(Number(summary.imported||0))parts.push(summary.imported+' new');
      if(Number(summary.updated||0))parts.push(summary.updated+' update');
      UI.toast(parts.join(' + ')+' MCQ(s) saved to Pending review.');
    }else if(duplicateCount>0){
      UI.toast(duplicateCount+' MCQ(s) already exist; no duplicate record created.');
    }else{
      UI.toast('No MCQ changes were needed.');
    }
   }else UI.toast('Saved.');document.getElementById('modal')?.close();App.render();
  }
  catch(error){UI.toast(error.message);}
  finally{restoreButton();}
 },true);

 let lastSessionValidation=0;
 async function validateSession(force=false){
  if(!user)return null;
  const now=Date.now();
  if(!force&&now-lastSessionValidation<300000)return user;
  lastSessionValidation=now;
  try{
   const session=await request('/auth/session');
   csrf=session.csrfToken||csrf;
   if(!session.user){clearPrivateState();ready=true;App.render();return null}
   setIdentity({...user,...session.user});
   return user;
  }catch{return user}
 }

 let majorTransition=null;
 async function switchRole(role){
  if(majorTransition)return majorTransition;
  if(!user?.roles?.includes(role))throw Error('This account does not have that workspace.');
  if(user.activeRole===role)return role;
  UI.closeDropdowns();
  backendLoading(true);
  majorTransition=(async()=>{
   try{
    const data=await request('/auth/switch-role',{role});
    csrf=data.csrfToken||csrf;
    setIdentity({...user,activeRole:data.activeRole||role});
    loadedSections.delete('overview');sectionLoadedAt.delete('overview');
    return data.activeRole||role;
   }finally{
    backendLoading(false);
    majorTransition=null;
   }
  })();
  return majorTransition;
 }
 async function logout(){
  if(majorTransition)return majorTransition;
  UI.closeDropdowns();
  backendLoading(true);
  majorTransition=(async()=>{
   try{
    await request('/auth/logout',{});
    clearPrivateState();
    ready=true;
    App.go('login');
   }finally{
    backendLoading(false);
    majorTransition=null;
   }
  })();
  return majorTransition;
 }
 async function start(){const app=document.getElementById('app');if(app)app.innerHTML='';backendLoading(true);try{await check();await ensureRouteData(route());}finally{backendLoading(false)}App.render();}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)validateSession(false).then(()=>App.render());});
 window.addEventListener('pageshow',event=>{if(event.persisted&&user)validateSession(false).then(()=>App.render());});
 document.addEventListener('input',event=>{if(event.target.closest('form[data-form="mcq"]'))window.mcqDirty=true;});
 window.addEventListener('beforeunload',event=>{if(window.mcqDirty){event.preventDefault();event.returnValue='';}});
 return {guard,view,start,logout,switchRole,request,command,ensureRouteData,destination,allowed,ADMIN_PAGE_SIZES,ADMIN_DEFAULT_PAGE_SIZE,get user(){return user;}};
})();

