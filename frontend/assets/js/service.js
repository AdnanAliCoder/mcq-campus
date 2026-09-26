/* Frontend view model hydrated by auth.js from the Django API.
   Authentication and persistent writes are handled by the server adapter. */
window.MCQ = (() => {
 const clone=x=>JSON.parse(JSON.stringify(x));
 const emptyData=()=>({schemaVersion:9,categories:[],subcategories:[],children:[],papers:[],jobs:[],years:[],mcqs:[]});
 const legalDefaults=()=>({
  about:{title:'About MCQ Campus',content:'',lastUpdated:'',published:true,seoTitle:'',metaDescription:''},
  contact:{title:'Contact Us',content:'',lastUpdated:'',published:true,seoTitle:'',metaDescription:''},
  privacy:{title:'Privacy Policy',content:'',lastUpdated:'',published:true,seoTitle:'',metaDescription:''},
  terms:{title:'Terms & Conditions',content:'',lastUpdated:'',published:true,seoTitle:'',metaDescription:''},
  disclaimer:{title:'Disclaimer',content:'',lastUpdated:'',published:true,seoTitle:'',metaDescription:''},
  cookies:{title:'Cookie Policy',content:'',lastUpdated:'',published:false,seoTitle:'',metaDescription:''},
  advertising:{title:'Advertising Policy',content:'',lastUpdated:'',published:false,seoTitle:'',metaDescription:''}
 });
 const footerDefaults=()=>({"description":"","copyrightText":"MCQ Campus. All rights reserved.","showCountryText":true,"countryText":"Pakistan | India","footerLogoUrl":"","showAbout":true,"showContact":true,"showPrivacy":true,"showTerms":true,"showDisclaimer":true,"showCookiePolicy":false,"showAdvertisingPolicy":false,"showFaq":false,"showSitemap":true});
 const socialDefaults=()=>({"facebook":{"url":"","enabled":true,"icon":"facebook"},"youtube":{"url":"","enabled":true,"icon":"youtube"},"instagram":{"url":"","enabled":true,"icon":"instagram"},"linkedin":{"url":"","enabled":true,"icon":"linkedin"}});
 const contactDefaults=()=>({"supportEmail":"","advertisingContact":""});
 const initial=()=>({...emptyData(),bookmarks:[],savedPapers:[],attempts:[],recent:[],reports:[],contacts:[],logs:[],trash:[],posts:[],users:[],guides:[],pdfs:[],tests:[],latestJobs:[],currentAffairsConfig:{dailyMode:'auto',monthlyMode:'auto',dailyIds:[],monthlyIds:[]},ads:[],adSettings:{enabled:true,adsenseClient:'',analyticsId:'',slots:{}},adminPerformance:[],adminOverview:{},settings:{siteName:'MCQ Campus',description:'Explore subjects, practise MCQs and prepare with past papers.',country:'Pakistan',mcqEntryCountry:'Pakistan',requireReview:true,cleanRoutesEnabled:false,footer:footerDefaults(),socialLinks:socialDefaults(),contact:contactDefaults()},content:{about:'',contact:'',legalPages:legalDefaults()},seo:{title:'MCQ Campus',description:'Explore subjects, practise MCQs and prepare with past papers.'},rolePermissions:{admin:{review:false,import:false,defaultsVersion:3,permissions:Object.fromEntries(permissionCatalog.map(k=>[k,['add_mcq','edit_own_mcq'].includes(k)]))}},session:null});
 const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
 const permissionCatalog=['super_admin_permission','add_mcq','edit_own_mcq','edit_any_mcq','delete_own_mcq','delete_any_mcq','review_mcq','approve_mcq','reject_mcq','bulk_import_mcqs','manage_categories','manage_papers','manage_jobs','manage_job_years','manage_guides','delete_guides','manage_posts','publish_posts','delete_posts','manage_pdfs','delete_pdfs','manage_latest_jobs','delete_latest_jobs','manage_current_affairs','view_reports','resolve_reports','view_analytics','manage_users','manage_admins','assign_roles','change_permissions','manage_settings','manage_footer','manage_legal_pages','manage_social_links','manage_ads','backup','restore_backup'];
 const isDevelopment=()=>{try{return typeof location!=='undefined'&&(location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')}catch{return false}};
 const slug=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'item';
 function hasPermission(name){const accountRole=db.session?.role,elevated=role()==='super-admin'||(db.session?.permissions||[]).includes('super_admin_permission');return !!db.session&&(elevated||(accountRole==='admin'&&['add_mcq','edit_own_mcq'].includes(name)))}
 function contentQuality(q){const checks=[['Question',q.question],['Four options',[1,2,3,4].every(i=>String(q['option'+i]||'').trim())],['Correct answer',q.correct_answer],['Explanation',q.description],['Category',q.category_id],['Paper',ids(q.paper_id).length],['Job',ids(q.job_ids).length],['Job Year',ids(q.job_years_ids).length]];return {score:checks.filter(([,v])=>!!v).length,total:checks.length,checks:checks.map(([label,v])=>({label,ok:!!v}))}}

 const ids=v=>{if(v==null||v==='')return [];let values=v;if(!Array.isArray(values)){try{values=JSON.parse(values)}catch{}values=Array.isArray(values)?values:[values]}return [...new Set(values.filter(x=>typeof x==='number'||typeof x==='string'&&x.trim()!=='').map(Number).filter(x=>Number.isSafeInteger(x)&&x>0))]};
 let topCache=null;
 let db=initial(); db.users=[]; db.guides=[]; db.posts=db.posts||[];
 function persist(){topCache=null;}
 if((db.schemaVersion||0)<3){db.schemaVersion=3;persist();}
 const get=(type,id)=>db[type]?.find(x=>Number(x.id)===Number.parseInt(String(id),10));
 const role=()=>db.session?.activeRole||db.session?.role;
 const permissionGroups={content:['add_mcq','edit_own_mcq','edit_any_mcq'],add:['add_mcq'],edit:['edit_own_mcq','edit_any_mcq'],delete:['delete_own_mcq','delete_any_mcq'],globalMcqs:['edit_any_mcq','review_mcq','approve_mcq','reject_mcq'],review:['review_mcq','approve_mcq','reject_mcq'],approve:['approve_mcq'],reject:['reject_mcq'],import:['bulk_import_mcqs'],taxonomy:['manage_categories','manage_papers','manage_jobs','manage_job_years'],categories:['manage_categories'],papers:['manage_papers'],jobs:['manage_jobs'],years:['manage_job_years'],guides:['manage_guides'],guideDelete:['delete_guides'],posts:['manage_posts','publish_posts'],postDelete:['delete_posts'],pdfs:['manage_pdfs'],pdfDelete:['delete_pdfs'],latestJobs:['manage_latest_jobs'],latestJobDelete:['delete_latest_jobs'],currentAffairs:['manage_current_affairs'],reports:['view_reports','resolve_reports'],analytics:['view_analytics'],users:['manage_users'],admins:['manage_admins'],settings:['manage_settings'],footer:['manage_footer','manage_settings'],legal:['manage_legal_pages','manage_settings'],social:['manage_social_links','manage_settings'],ads:['manage_ads'],backup:['backup'],restore:['restore_backup'],system:['manage_settings','manage_footer','manage_legal_pages','manage_social_links','manage_ads','backup','restore_backup','manage_users','manage_admins','view_reports','resolve_reports','view_analytics','manage_guides','delete_guides','manage_posts','publish_posts','delete_posts','manage_pdfs','delete_pdfs','manage_latest_jobs','delete_latest_jobs','manage_current_affairs']};
 const allowed=a=>role()==='super-admin'||(db.session?.permissions||[]).includes('super_admin_permission')||(permissionGroups[a]||[]).some(hasPermission);
 const assert=a=>{if(!allowed(a))throw Error('Your account does not have permission for this action.')};
 const log=(action,detail)=>{db.logs.unshift({id:Date.now(),action,detail,by:db.session?.name||'Visitor',by_id:db.session?.id||null,at:new Date().toISOString()});db.logs=db.logs.slice(0,300)};
 const save=()=>persist();
 function setSession(user){
  db.session=user?clone(user):null;
  if(user&&Array.isArray(db.users)&&db.users.length){
   const i=db.users.findIndex(x=>Number(x.id)===Number(user.id));
   if(i>=0)db.users[i]={...db.users[i],...clone(user)};
  }
  persist();return db.session;
 }
 function upsert(type,row){
  if(!row||!Array.isArray(db[type]))return row;
  const i=db[type].findIndex(x=>Number(x.id)===Number(row.id));
  if(i>=0)db[type].splice(i,1,{...db[type][i],...clone(row)});else db[type].unshift(clone(row));
  persist();return row;
 }
 function remove(type,idsToRemove){
  if(!Array.isArray(db[type]))return;
  const set=new Set((idsToRemove||[]).map(Number));db[type]=db[type].filter(x=>!set.has(Number(x.id)));persist();
 }
 function loginByEmail(){throw Error('Use the authenticated API.');} function switchRole(r){if(!db.session)throw Error('Sign in first.');const roles=db.session.roles||[db.session.role||'user'];if(!roles.includes(r))throw Error('This account does not have that workspace.');db.session.activeRole=r;const u=db.users.find(x=>x.id===db.session.id);if(u)u.activeRole=r;persist();return r} function saveProfile(values){if(!db.session)throw Error('Sign in first.');const u=db.users.find(x=>x.id===db.session.id);if(!u)throw Error('Account not found.');Object.assign(u,values);db.session={...clone(u),activeRole:db.session.activeRole||u.activeRole||u.role};persist();return db.session} function changePassword(){if(!db.session)throw Error('Sign in first.');const u=db.users.find(x=>x.id===db.session.id);if(u)u.passwordChangedAt=new Date().toISOString();db.session.passwordChangedAt=u?.passwordChangedAt;persist()}
 function list(type,q=''){return (db[type]||[]).filter(x=>x.active!==false&&(type!=='categories'||!x.legacy)&&norm(x.name||x.question).includes(norm(q)))}
 // Client-side scoping mirrors the server permissions; Django remains authoritative.
 function managedRows(type){const rows=db[type]||[];if(role()==='super-admin')return rows;if(role()!=='admin'||!db.session?.id)return [];return rows.filter(x=>Number(type==='logs'?x.by_id:x.created_by_id)===Number(db.session.id));}
 function ownsMcq(q){return !!q&&Number(q.created_by_id)===Number(db.session?.id)}
 function canEditMcq(q){if(!q)return false;if(role()==='super-admin')return true;if(role()!=='admin')return false;return hasPermission('edit_any_mcq')||(ownsMcq(q)&&hasPermission('edit_own_mcq'))}
 function canReviewMcq(q){return !!q&&(role()==='super-admin'||role()==='admin'&&allowed('review'))}
 function canDeleteMcq(q){if(!q)return false;if(role()==='super-admin')return true;if(role()!=='admin')return false;return hasPermission('delete_any_mcq')||(ownsMcq(q)&&hasPermission('delete_own_mcq'))}
 function managedMcq(id,mode='edit'){const q=get('mcqs',id);const ok=mode==='review'?canReviewMcq(q):mode==='delete'?canDeleteMcq(q):canEditMcq(q);if(!ok)throw Error('Question not found or unavailable in this workspace.');return q;}
 function categoryCounts(publicOnly=false){const counts={};for(const t of ['categories','subcategories','children'])counts[t]=(db[t]||[]).filter(x=>!x.deleted_at&&(!publicOnly||x.active!==false)&&(t!=='categories'||!x.legacy)).length;counts.total=counts.categories;return counts;}
 function publicMcqs(){return db.mcqs.filter(x=>x.status==='approved')}
 // The supplied data has an editorial important flag, not global view/attempt metrics.
 // Cache the shortlist, and invalidate it on repository writes. Never rank by this browser's attempts.
 function isImportant(q){if(!q)return false;const jobs=new Set(ids(q.job_ids));return jobs.size>=2}
 function topMcqs(){
  if(!topCache||Date.now()-topCache.at>=300000){
   const rows=publicMcqs().filter(q=>isImportant(q))
    .sort((a,b)=>Number(isImportant(b))-Number(isImportant(a))||a.id-b.id).slice(0,4);
   topCache={at:Date.now(),rows};
  }
  return topCache.rows.slice();
 }
 function trashCounts(){
  const sets=Object.fromEntries(['mcqs','papers','jobs','years','categories','subcategories','children','guides'].map(t=>[t,new Set()]));
  for(const item of db.trash||[]){
   for(const q of item.mcqs||[])sets.mcqs.add(+q.id);
   for(const [type,rows] of Object.entries(item.entities||{}))if(sets[type])for(const row of rows)sets[type].add(+row.id);
  }
  return Object.fromEntries(Object.entries(sets).map(([type,ids])=>[type,ids.size]));
 }

 function validate(q){const errors=[];if(!String(q.question||'').trim())errors.push('Question is required.');if(!String(q.description||'').trim())errors.push('Explanation / description is required.');const opts=[1,2,3,4].map(i=>String(q['option'+i]??'').trim());if(opts.some(v=>!v))errors.push('Four non-empty options are required.');if(new Set(opts.map(norm)).size!==4)errors.push('Options must be distinct.');if(!opts.includes(String(q.correct_answer??'')))errors.push('Correct answer must exactly match an option.');if(!get('categories',q.category_id))errors.push('Choose a valid category.');if(!ids(q.paper_id).length)errors.push('Paper is required.');if(!ids(q.job_ids).length)errors.push('Job is required.');if(!ids(q.job_years_ids).length)errors.push('Job Year is required.');for(const i of ids(q.paper_id))if(!get('papers',i))errors.push('Unknown paper.');for(const i of ids(q.job_ids)){const job=get('jobs',i);if(!job)errors.push('Unknown job.');else if(ids(q.paper_id).length&&!ids(q.paper_id).includes(job.paper_id))errors.push('Job does not belong to a selected paper.');}for(const i of ids(q.job_years_ids)){const year=get('years',i);if(!year)errors.push('Unknown job year.');else if(ids(q.job_ids).length&&!ids(q.job_ids).includes(year.job_id))errors.push('Job year does not belong to a selected job.');}return [...new Set(errors)]}
 const editableFields=['question','option1','option2','option3','option4','correct_answer','description','category_id','subcategory_ids','child_subcategory_ids','paper_id','job_ids','job_years_ids','country','source','seo_description','current_affairs','current_affairs_date'];
 const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
 function changes(before,after){return editableFields.filter(k=>!same(before[k],after[k])).map(k=>({field:k,before:clone(before[k]),after:clone(after[k])}))}
 function normalizeRow(q){const row={...q};row.category_id=+q.category_id;delete row.bps;row.slug=slug(row.question);row.seo_title=String(row.question||'').trim();row.seo_description=String(row.description||'').replace(/\s+/g,' ').trim().slice(0,155);for(const k of ['subcategory_ids','child_subcategory_ids','paper_id','job_ids','job_years_ids'])row[k]=ids(row[k]);return row}
 function saveMcq(q){
  if(q.id)managedMcq(q.id,'edit');else if(role()!=='super-admin'&&!hasPermission('add_mcq'))throw Error('Your account does not have permission to add MCQs.');q=normalizeRow(q);const err=validate(q);if(err.length)throw Error(err.join(' '));const dup=db.mcqs.find(x=>norm(x.question)===norm(q.question)&&x.id!==+q.id);if(dup){const e=Error('A matching question already exists. Open it if available in your workspace, or contact a reviewer.');e.existing=canEditMcq(dup)?dup:{restricted:true};throw e}
  const old=get('mcqs',q.id),now=new Date().toISOString(),actor=db.session||{};
  if(old&&old.status==='approved'){
   const proposed={...clone(old),...q,created_by:old.created_by,created_by_id:old.created_by_id??null,created_at:old.created_at,updated_at:now,updated_by:actor.name,updated_by_id:actor.id};delete proposed.pending_update;const diff=changes(old,proposed);if(!diff.length)return old;
   old.pending_update={proposed,changes:diff,submitted_by:actor.name||'Unknown',submitted_by_id:actor.id||null,submitted_at:now,approval_status:'pending',reason:''};old.updated_at=now;old.submission_type='update';log('Submitted MCQ update',old.question);persist();return old;
  }
  const row={...old,...q,id:old?.id||Math.max(0,...db.mcqs.map(x=>x.id))+1,created_at:old?.created_at||now,updated_at:now,updated_by:actor.name,updated_by_id:actor.id,created_by:old?.created_by||actor.name||'Unknown',created_by_id:old?(old.created_by_id??null):(actor.id??null),status:'pending',source:old?.source||'Entered from MCQ Campus admin',submitted_by:actor.name||'Unknown',submitted_by_id:actor.id||null,submitted_at:now,submission_type:old?'update':'new',audit_history:old?.audit_history||[]};
  if(old)db.mcqs.splice(db.mcqs.indexOf(old),1,row);else db.mcqs.unshift(row);log(old?'Updated pending MCQ':'Added MCQ',row.question);persist();return row
 }
 function review(selected,status,reason=''){
  assert('review');if(!['approved','rejected','pending'].includes(status))throw Error('Invalid review status.');if(status!=='approved'&&!reason.trim())throw Error('A reason is required.');const actor=db.session||{},now=new Date().toISOString();
  if(status==='approved'&&!allowed('approve'))throw Error('Your account cannot approve MCQs.');if(status==='rejected'&&!allowed('reject'))throw Error('Your account cannot reject MCQs.');selected.forEach(id=>managedMcq(id,'review'));
  for(const id of selected){const q=get('mcqs',id);if(!q)continue;
   if(q.pending_update){const pu=q.pending_update;if(status==='approved'){const history={type:'update',changed_by:pu.submitted_by,changed_by_id:pu.submitted_by_id,changed_at:pu.submitted_at,reviewed_by:actor.name,reviewed_by_id:actor.id,reviewed_at:now,approval_status:'approved',changes:clone(pu.changes)};Object.assign(q,pu.proposed);q.audit_history=[history,...(q.audit_history||[])];q.status='approved';q.reviewed_by=actor.name;q.approved_by=actor.name;q.rejection_reason='';delete q.pending_update;}else if(status==='rejected'){q.audit_history=[{type:'update',changed_by:pu.submitted_by,changed_by_id:pu.submitted_by_id,changed_at:pu.submitted_at,reviewed_by:actor.name,reviewed_by_id:actor.id,reviewed_at:now,approval_status:'rejected',reason,changes:clone(pu.changes)},...(q.audit_history||[])];delete q.pending_update;q.rejection_reason=reason;}else{q.pending_update.approval_status='correction';q.pending_update.reason=reason;}q.updated_at=now;log('MCQ update '+status,q.question);continue}
   q.status=status;q.reviewed_by=actor.name;q.reviewed_by_id=actor.id||null;q.approved_by=status==='approved'?actor.name:'';q.rejection_reason=status==='approved'?'':reason;q.updated_at=now;q.audit_history=[{type:q.submission_type||'new',changed_by:q.submitted_by||q.created_by,changed_by_id:q.submitted_by_id||q.created_by_id,changed_at:q.submitted_at||q.created_at,reviewed_by:actor.name,reviewed_by_id:actor.id,reviewed_at:now,approval_status:status,reason},...(q.audit_history||[])];log('MCQ '+status,q.question)
  }persist()
 }
 const parents={subcategories:['categories','category_id'],children:['subcategories','subcategory_id'],jobs:['papers','paper_id'],years:['jobs','job_id']};
 function duplicate(type,name,parentValue,excludeId,country){const parent=parents[type];return db[type].find(x=>x.id!==+excludeId&&norm(x.name)===norm(name)&&(!parent||x[parent[1]]===+parentValue)&&(type!=='categories'&&type!=='papers'||!country||String(x.country||'Both')===String(country)))}
 function saveEntity(type,record){assert(type);if(!['categories','subcategories','children','papers','jobs','years'].includes(type))throw Error('Invalid entity.');if(!record.name.trim())throw Error('Name is required.');const parent=parents[type];if(parent&&!get(parent[0],record[parent[1]]))throw Error('Select a valid parent.');const dup=duplicate(type,record.name,parent&&record[parent[1]],record.id,record.country);if(dup)return {existing:dup};const old=get(type,record.id);const now=new Date().toISOString(),actor=db.session;const x={...old,...record,slug:slug(record.name),seo_title:String(record.name||'').trim(),created_at:old?old.created_at:now,created_by:old?old.created_by:actor?.name,created_by_id:old?old.created_by_id:actor?.id,updated_at:now,updated_by:actor?.name,updated_by_id:actor?.id,id:old?.id||Math.max(0,...db[type].map(x=>x.id))+1,icon:String(record.icon||old?.icon||'').trim()||'grid',active:record.active!==false};if(parent)x[parent[1]]=+record[parent[1]];if(old)db[type].splice(db[type].indexOf(old),1,x);else db[type].push(x);log(old?'Updated '+type:'Added '+type,x.name);persist();return {record:x}}
 function deleteImpact(type,id){assert(type);id=+id;const root=get(type,id);if(!root)throw Error('Record not found.');const sets={categories:new Set(),subcategories:new Set(),children:new Set(),papers:new Set(),jobs:new Set(),years:new Set()};sets[type].add(id);
  if(type==='categories'){db.subcategories.filter(x=>x.category_id===id).forEach(x=>sets.subcategories.add(x.id));db.children.filter(x=>sets.subcategories.has(x.subcategory_id)).forEach(x=>sets.children.add(x.id));}
  if(type==='subcategories')db.children.filter(x=>x.subcategory_id===id).forEach(x=>sets.children.add(x.id));
  if(type==='papers'){db.jobs.filter(x=>x.paper_id===id).forEach(x=>sets.jobs.add(x.id));db.years.filter(x=>sets.jobs.has(x.job_id)).forEach(x=>sets.years.add(x.id));}
  if(type==='jobs')db.years.filter(x=>x.job_id===id).forEach(x=>sets.years.add(x.id));
  const affected=db.mcqs.filter(q=>sets.categories.has(+q.category_id)||ids(q.subcategory_ids).some(x=>sets.subcategories.has(x))||ids(q.child_subcategory_ids).some(x=>sets.children.has(x))||ids(q.paper_id).some(x=>sets.papers.has(x))||ids(q.job_ids).some(x=>sets.jobs.has(x))||ids(q.job_years_ids).some(x=>sets.years.has(x)));
  return {root,sets,mcqs:affected};
 }
 function softDeleteEntity(type,id){const impact=deleteImpact(type,id),actor=db.session||{},now=new Date().toISOString(),entities={};for(const t of Object.keys(impact.sets)){entities[t]=db[t].filter(x=>impact.sets[t].has(+x.id)).map(clone);if(entities[t].length)db[t]=db[t].filter(x=>!impact.sets[t].has(+x.id));}const mcqs=impact.mcqs.map(clone);const mcqIds=new Set(mcqs.map(x=>+x.id));db.mcqs=db.mcqs.filter(x=>!mcqIds.has(+x.id));const item={id:Date.now(),type,root_id:+id,name:impact.root.name,entities,mcqs,deleted_at:now,deleted_by:actor.name||'Unknown',deleted_by_id:actor.id||null};db.trash.unshift(item);log('Deleted '+type,`${impact.root.name} · ${mcqs.length} MCQ(s) moved to recovery`);persist();return item}
 function restoreTrash(id){assert('restore');const item=db.trash.find(x=>+x.id===+id);if(!item)throw Error('Recovery item not found.');for(const [t,rows] of Object.entries(item.entities||{})){for(const row of rows){if(!db[t].some(x=>+x.id===+row.id))db[t].push(clone(row));}}for(const q of item.mcqs||[]){if(!db.mcqs.some(x=>+x.id===+q.id))db.mcqs.push(clone(q));}db.trash=db.trash.filter(x=>+x.id!==+id);log('Recovered '+item.type,`${item.name} · ${(item.mcqs||[]).length} MCQ(s) restored`);persist();return item}

 function toggleBookmark(id){if(!get('mcqs',id))throw Error('Question not found.');id=+id;db.bookmarks=db.bookmarks.includes(id)?db.bookmarks.filter(x=>x!==id):[...db.bookmarks,id];persist();return db.bookmarks.includes(id)}
 function attempt(id,answer){const q=get('mcqs',id);if(!q||q.status!=='approved')throw Error('Question not available.');db.attempts.unshift({id:+id,answer,correct:q.correct_answer===answer,at:new Date().toISOString(),by_id:db.session?.id||null,by:db.session?.name||'Visitor'});persist();return q.correct_answer===answer}
 function recent(id){db.recent=[+id,...db.recent.filter(x=>x!==+id)].slice(0,15);persist()}
 function savePaper(id){id=+id;db.savedPapers=db.savedPapers.includes(id)?db.savedPapers.filter(x=>x!==id):[...db.savedPapers,id];persist();return db.savedPapers.includes(id)}
 function report(id,reason){if(!get('mcqs',id)||!reason.trim())throw Error('Enter a report reason.');db.reports.unshift({id:Date.now(),mcq_id:+id,reason,status:'open',by_id:db.session?.id||null,by:db.session?.name||'Visitor',at:new Date().toISOString()});persist()}
 function exportData(){assert('backup');return clone(db)}
 function reset(){throw Error('Local reset is disabled in production.');}
 function hydrate(snapshot,user){const seed=initial(),incoming=clone(snapshot||{}),pages=Object.fromEntries(Object.entries(seed.content.legalPages).map(([key,value])=>[key,{...value,...(incoming.content?.legalPages?.[key]||{})}]));db={...seed,...incoming,settings:{...seed.settings,...(incoming.settings||{}),footer:{...seed.settings.footer,...(incoming.settings?.footer||{})},socialLinks:{...seed.settings.socialLinks,...(incoming.settings?.socialLinks||{})},contact:{...seed.settings.contact,...(incoming.settings?.contact||{})}},content:{...seed.content,...(incoming.content||{}),legalPages:pages},seo:{...seed.seo,...(incoming.seo||{})},adSettings:{...seed.adSettings,...(incoming.adSettings||{}),slots:{...seed.adSettings.slots,...(incoming.adSettings?.slots||{})}},currentAffairsConfig:{...seed.currentAffairsConfig,...(incoming.currentAffairsConfig||{}),dailyIds:ids(incoming.currentAffairsConfig?.dailyIds||[]),monthlyIds:ids(incoming.currentAffairsConfig?.monthlyIds||[])},tests:Array.isArray(incoming.tests)?incoming.tests:seed.tests,pdfs:Array.isArray(incoming.pdfs)?incoming.pdfs:seed.pdfs,latestJobs:Array.isArray(incoming.latestJobs)?incoming.latestJobs:seed.latestJobs,session:clone(user)};topCache=null;}
 function mergeCore(snapshot){
  const incoming=clone(snapshot||{});
  for(const key of ['categories','subcategories','children','papers','jobs','years','mcqs','posts','guides','ads','pdfs','latestJobs','tests']){
   if(Array.isArray(incoming[key]))db[key]=incoming[key];
  }
  if(incoming.mcqPage)db.mcqPage=clone(incoming.mcqPage);
  if(incoming.settings)db.settings={...db.settings,...incoming.settings,footer:{...db.settings.footer,...(incoming.settings.footer||{})},socialLinks:{...db.settings.socialLinks,...(incoming.settings.socialLinks||{})},contact:{...db.settings.contact,...(incoming.settings.contact||{})}};
  if(incoming.content){const legal=Object.fromEntries(Object.entries(db.content.legalPages||{}).map(([key,value])=>[key,{...value,...(incoming.content?.legalPages?.[key]||{})}]));db.content={...db.content,...incoming.content,legalPages:legal}}
  if(incoming.seo)db.seo={...db.seo,...incoming.seo};
  if(incoming.rolePermissions)db.rolePermissions=clone(incoming.rolePermissions);
  if(incoming.adSettings)db.adSettings={...db.adSettings,...incoming.adSettings,slots:{...db.adSettings.slots,...(incoming.adSettings.slots||{})}};
  if(incoming.currentAffairsConfig)db.currentAffairsConfig={...db.currentAffairsConfig,...incoming.currentAffairsConfig,dailyIds:ids(incoming.currentAffairsConfig.dailyIds||[]),monthlyIds:ids(incoming.currentAffairsConfig.monthlyIds||[])};
  topCache=null;persist();return db;
 }
 function clearSession(){
  db.session=null;db.bookmarks=[];db.savedPapers=[];db.attempts=[];db.recent=[];db.reports=[];db.contacts=[];db.logs=[];db.trash=[];db.users=[];db.adminPerformance=[];db.adminOverview={};topCache=null;
 }
 return {hydrate,mergeCore,clearSession,upsert,remove,get db(){return db},clone,norm,slug,isImportant,isDevelopment,permissionCatalog,hasPermission,contentQuality,ids,get,managedRows,managedMcq,canEditMcq,canReviewMcq,canDeleteMcq,categoryCounts,role,allowed,assert,save,log,list,validate,saveMcq,review,parents,duplicate,saveEntity,deleteImpact,softDeleteEntity,restoreTrash,trashCounts,publicMcqs,topMcqs,setSession,loginByEmail,switchRole,saveProfile,changePassword,changes,logout(){db.session=null;persist()},toggleBookmark,attempt,recent,savePaper,report,exportData,reset};
})();
