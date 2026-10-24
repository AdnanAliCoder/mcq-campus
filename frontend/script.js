/* MCQCampus unified first-party script. Modules retained in dependency order; Django remains the data/auth API. */

/* SOURCE: frontend/js/admin-loader.js */
/* Admin modules are bundled into this one file. Never request deleted split-module assets. */
(function(g){const allowed=new Set(["importer.js","enhancements.js","admin.js"]);g.MCQCampusLoadBundledModule=async n=>{if(!allowed.has(n))throw Error("Unknown bundled module: "+n);return true}})(window);


/* SOURCE: frontend/js/integrations.js */
/* Optional provider integrations are configured through the Django API, not injected into HTML. */
(function (global) {
  let analyticsStarted = '';
  let adsenseStarted = '';

  global.MCQCampusApplyOptionalIntegrations = function (settings = {}) {
    const analyticsId = settings.analyticsEnabled ? String(settings.googleAnalyticsId || '').trim() : '';
    if (analyticsId && !analyticsStarted) {
      analyticsStarted = analyticsId;
      global.dataLayer = global.dataLayer || [];
      global.gtag = function () { global.dataLayer.push(arguments); };
      global.gtag('js', new Date());
      global.gtag('config', analyticsId);
      const analytics = document.createElement('script');
      analytics.async = true;
      analytics.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(analyticsId);
      document.head.appendChild(analytics);
    }

    const adsenseId = settings.adsenseEnabled ? String(settings.adsenseClientId || '').trim() : '';
    if (adsenseId && !adsenseStarted) {
      adsenseStarted = adsenseId;
      const adsense = document.createElement('script');
      adsense.async = true;
      adsense.crossOrigin = 'anonymous';
      adsense.src = 'https://pagead2.googlesyndication.com/pagead/js?client=' + encodeURIComponent(adsenseId);
      document.head.appendChild(adsense);
    }
  };
})(window);

;


/* SOURCE: frontend/js/modules/service.js */
/* ===== MCQCAMPUS MODULE: service.js ===== */
/* Frontend view model hydrated by auth.js from the Django API.
   Authentication and persistent writes are handled by the server adapter. */
window.MCQ = (() => {
 const clone=x=>JSON.parse(JSON.stringify(x));
 const emptyData=()=>({schemaVersion:14,categories:[],subcategories:[],children:[],papers:[],jobs:[],years:[],mcqs:[],seoIndex:{next:1,items:{}},pageSeo:{}});
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
 const initial=()=>({...emptyData(),bookmarks:[],savedPapers:[],attempts:[],recent:[],reports:[],contacts:[],logs:[],trash:[],posts:[],users:[],guides:[],pdfs:[],tests:[],latestJobs:[],pinnedEntities:{categories:[],papers:[],jobs:[],years:[]},currentAffairsConfig:{dailyMode:'auto',monthlyMode:'auto',dailyIds:[],monthlyIds:[]},ads:[],adSettings:{enabled:true,adsenseClient:'',analyticsId:'',slots:{}},adminPerformance:[],adminOverview:{},settings:{siteName:'MCQ Campus',description:'Explore subjects, practise MCQs and prepare with past papers.',country:'Pakistan',mcqEntryCountry:'Pakistan',requireReview:true,cleanRoutesEnabled:false,footer:footerDefaults(),socialLinks:socialDefaults(),contact:contactDefaults()},content:{about:'',contact:'',legalPages:legalDefaults()},seo:{title:'MCQ Campus',description:'Explore subjects, practise MCQs and prepare with past papers.'},rolePermissions:{admin:{review:false,import:false,defaultsVersion:3,permissions:Object.fromEntries(permissionCatalog.map(k=>[k,['add_mcq','edit_own_mcq'].includes(k)]))}},session:null});
 const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
 const permissionCatalog=['super_admin_permission','add_mcq','edit_own_mcq','edit_any_mcq','delete_own_mcq','delete_any_mcq','review_mcq','approve_mcq','reject_mcq','bulk_import_mcqs','manage_categories','manage_papers','manage_jobs','manage_job_years','manage_guides','delete_guides','manage_posts','publish_posts','delete_posts','manage_pdfs','delete_pdfs','manage_latest_jobs','delete_latest_jobs','manage_current_affairs','view_reports','resolve_reports','view_analytics','manage_users','manage_admins','assign_roles','change_permissions','manage_settings','manage_footer','manage_legal_pages','manage_social_links','manage_ads','backup','restore_backup'];
 const isDevelopment=()=>{try{return typeof location!=='undefined'&&(location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')}catch{return false}};
 const slug=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'item';
 function hasPermission(name){const accountRole=db.session?.role,elevated=role()==='super-admin'||(db.session?.permissions||[]).includes('super_admin_permission');return !!db.session&&(elevated||(accountRole==='admin'&&['add_mcq','edit_own_mcq'].includes(name)))}
 function contentQuality(q){const checks=[['Question',q.question],['Four options',[1,2,3,4].every(i=>String(q['option'+i]||'').trim())],['Correct answer',q.correct_answer],['Explanation',q.description],['Category',q.category_id],['Organization / Board',ids(q.paper_id).length],['Past Paper',ids(q.job_years_ids).length]];return {score:checks.filter(([,v])=>!!v).length,total:checks.length,checks:checks.map(([label,v])=>({label,ok:!!v}))}}

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
 function isImportant(q){if(!q)return false;const jobs=new Set(ids(q.job_ids)),years=new Set(ids(q.job_years_ids));return q.important===true||jobs.size>=2||years.size>=2}
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

 function validate(q){const errors=[];if(!String(q.question||'').trim())errors.push('Question is required.');if(!String(q.description||'').trim())errors.push('Explanation / description is required.');const opts=[1,2,3,4].map(i=>String(q['option'+i]??'').trim());if(opts.some(v=>!v))errors.push('Four non-empty options are required.');if(new Set(opts.map(norm)).size!==4)errors.push('Options must be distinct.');if(!opts.includes(String(q.correct_answer??'')))errors.push('Correct answer must exactly match an option.');if(!get('categories',q.category_id))errors.push('Choose a valid category.');if(!ids(q.paper_id).length)errors.push('Organization / Board is required.');if(!ids(q.job_years_ids).length)errors.push('Past Paper is required.');for(const i of ids(q.paper_id))if(!get('papers',i))errors.push('Unknown paper.');for(const i of ids(q.job_years_ids)){const year=get('years',i);if(!year)errors.push('Unknown past paper.');else{const paperId=Number(year.paper_id)||Number(get('jobs',year.job_id)?.paper_id)||0;if(!paperId)errors.push('Past Paper has no organization / board assigned.');else if(ids(q.paper_id).length&&!ids(q.paper_id).includes(paperId))errors.push('Past Paper does not belong to a selected organization / board.');}}return [...new Set(errors)]}
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
 const parents={subcategories:['categories','category_id'],children:['subcategories','subcategory_id'],jobs:['papers','paper_id'],years:['papers','paper_id']};
 const pinTypes=new Set(['categories','papers','jobs','years']);
 const pinIndex=(type,id)=>{const rows=db.pinnedEntities?.[type]||[],i=rows.map(Number).indexOf(Number(id));return i<0?999:i};
 const sortPinned=(type,rows)=>[...rows].sort((a,b)=>{if(!pinTypes.has(type))return String(a.name||'').localeCompare(String(b.name||''));const ai=pinIndex(type,a.id),bi=pinIndex(type,b.id);return ai-bi||String(a.name||'').localeCompare(String(b.name||''))});

 function duplicate(type,name,parentValue,excludeId,country){const parent=parents[type];return db[type].find(x=>x.id!==+excludeId&&norm(x.name)===norm(name)&&(!parent||x[parent[1]]===+parentValue)&&(type!=='categories'&&type!=='papers'||!country||String(x.country||'Both')===String(country)))}
 function saveEntity(type,record){assert(type);if(!['categories','subcategories','children','papers','jobs','years'].includes(type))throw Error('Invalid entity.');if(!record.name.trim())throw Error('Name is required.');const parent=parents[type];if(parent&&!get(parent[0],record[parent[1]]))throw Error('Select a valid parent.');const dup=duplicate(type,record.name,parent&&record[parent[1]],record.id,record.country);if(dup)return {existing:dup};const old=get(type,record.id);const now=new Date().toISOString(),actor=db.session;const x={...old,...record,slug:slug(record.name),seo_title:String(record.name||'').trim(),created_at:old?old.created_at:now,created_by:old?old.created_by:actor?.name,created_by_id:old?old.created_by_id:actor?.id,updated_at:now,updated_by:actor?.name,updated_by_id:actor?.id,id:old?.id||Math.max(0,...db[type].map(x=>x.id))+1,icon:String(record.icon||old?.icon||'').trim()||'grid',active:record.active!==false};if(parent)x[parent[1]]=+record[parent[1]];if(old)db[type].splice(db[type].indexOf(old),1,x);else db[type].push(x);log(old?'Updated '+type:'Added '+type,x.name);persist();return {record:x}}
 function deleteImpact(type,id){assert(type);id=+id;const root=get(type,id);if(!root)throw Error('Record not found.');const sets={categories:new Set(),subcategories:new Set(),children:new Set(),papers:new Set(),jobs:new Set(),years:new Set()};sets[type].add(id);
  if(type==='categories'){db.subcategories.filter(x=>x.category_id===id).forEach(x=>sets.subcategories.add(x.id));db.children.filter(x=>sets.subcategories.has(x.subcategory_id)).forEach(x=>sets.children.add(x.id));}
  if(type==='subcategories')db.children.filter(x=>x.subcategory_id===id).forEach(x=>sets.children.add(x.id));
  if(type==='papers'){db.jobs.filter(x=>x.paper_id===id).forEach(x=>sets.jobs.add(x.id));db.years.filter(x=>Number(x.paper_id)===id||sets.jobs.has(x.job_id)).forEach(x=>sets.years.add(x.id));}
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
  for(const key of ['countries','categories','subcategories','children','papers','jobs','years','mcqs','posts','guides','ads','pdfs','latestJobs','tests']){
   if(Array.isArray(incoming[key]))db[key]=incoming[key];
  }
  if(incoming.mcqPage)db.mcqPage=clone(incoming.mcqPage);
  if(Object.prototype.hasOwnProperty.call(incoming,'activeCountry'))db.activeCountry=String(incoming.activeCountry||'');
  if(incoming.siteCounts)db.siteCounts=clone(incoming.siteCounts);
  if(incoming.entityPage)db.entityPage=clone(incoming.entityPage);
  if(incoming.settings)db.settings={...db.settings,...incoming.settings,footer:{...db.settings.footer,...(incoming.settings.footer||{})},socialLinks:{...db.settings.socialLinks,...(incoming.settings.socialLinks||{})},contact:{...db.settings.contact,...(incoming.settings.contact||{})}};
  if(incoming.content){const legal=Object.fromEntries(Object.entries(db.content.legalPages||{}).map(([key,value])=>[key,{...value,...(incoming.content?.legalPages?.[key]||{})}]));db.content={...db.content,...incoming.content,legalPages:legal}}
  if(incoming.seo)db.seo={...db.seo,...incoming.seo};
  if(incoming.rolePermissions)db.rolePermissions=clone(incoming.rolePermissions);
  if(incoming.adSettings)db.adSettings={...db.adSettings,...incoming.adSettings,slots:{...db.adSettings.slots,...(incoming.adSettings.slots||{})}};
  if(incoming.pinnedEntities)db.pinnedEntities={categories:[],papers:[],jobs:[],years:[],...clone(incoming.pinnedEntities)};
  if(incoming.seoIndex)db.seoIndex={next:Number(incoming.seoIndex.next||1),items:{...(db.seoIndex?.items||{}),...(incoming.seoIndex.items||{})}};
  if(incoming.pageSeo)db.pageSeo={...(incoming.pageSeo||{})};
  if(incoming.currentAffairsConfig)db.currentAffairsConfig={...db.currentAffairsConfig,...incoming.currentAffairsConfig,dailyIds:ids(incoming.currentAffairsConfig.dailyIds||[]),monthlyIds:ids(incoming.currentAffairsConfig.monthlyIds||[])};
  topCache=null;persist();return db;
 }
 function clearSession(){
  db.session=null;db.bookmarks=[];db.savedPapers=[];db.attempts=[];db.recent=[];db.reports=[];db.contacts=[];db.logs=[];db.trash=[];db.users=[];db.adminPerformance=[];db.adminOverview={};topCache=null;
 }
 return {hydrate,mergeCore,clearSession,upsert,remove,get db(){return db},clone,norm,slug,isImportant,isDevelopment,permissionCatalog,hasPermission,contentQuality,ids,get,managedRows,managedMcq,canEditMcq,canReviewMcq,canDeleteMcq,categoryCounts,role,allowed,assert,save,log,list,validate,saveMcq,review,parents,pinIndex,sortPinned,duplicate,saveEntity,deleteImpact,softDeleteEntity,restoreTrash,trashCounts,publicMcqs,topMcqs,setSession,loginByEmail,switchRole,saveProfile,changePassword,changes,logout(){db.session=null;persist()},toggleBookmark,attempt,recent,savePaper,report,exportData,reset};
})();

/* ===== END MODULE: service.js ===== */

;


/* SOURCE: frontend/js/modules/ui.js */
/* ===== MCQCAMPUS MODULE: ui.js ===== */
window.UI=(()=>{
 const assetUrl=src=>{
  const value=String(src||'').trim();
  if(!value||!(/^(?:\/?assets\/|\/(?:favicon\.ico|favicon\.svg|site\.webmanifest)(?:$|\?))/i.test(value)))return value;
  if(/[?&]v=/.test(value))return value;
  const version=document.querySelector('meta[name="mcq-asset-version"]')?.content;
  return version?value+(value.includes('?')?'&':'?')+'v='+encodeURIComponent(version):value;
 };
 const paths={search:'M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0',arrow:'M5 12h14m-6-6 6 6-6 6',book:'M12 6c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1v15',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',paper:'M5 2h10l4 4v16H5zM14 2v5h5M8 12h8M8 16h8',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',user:'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2m12-15a4 4 0 1 1-8 0 4 4 0 0 1 8 0',menu:'M3 6h18M3 12h18M3 18h18',check:'m5 12 4 4L19 6',home:'m3 10 9-7 9 7v11h-6v-7H9v7H3z',bookmark:'M6 3h12v19l-6-4-6 4z',clock:'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0',code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 6 5 12 0 18-5-6-5-12 0-18',chart:'M4 3v18h18M8 16v-4M13 16V8M18 16V5',bolt:'m13 2-9 12h7l-1 8 10-13h-7z',cpu:'M6 6h12v12H6zM9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5M10 10h4v4h-4z',leaf:'M20 3C6 2 2 7 5 15c8 7 17 0 15-12M3 22 16 8',science:'M9 2h6m-5 0v7L3 20q0 2 3 2h12q3 0 3-2l-7-11V2M7 15h10',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 4l2 2m12 12 2 2M2 12h4m12 0h4M4 20l2-2M18 6l2-2M12 2v4m0 12v4',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',edit:'m15 3 6 6M4 14 16 2l6 6-12 12-8 2z',close:'m6 6 12 12M6 18 18 6',shield:'m12 2 9 4v6c0 5-5 9-9 11-4-2-9-6-9-11V6z',copy:'M8 8h13v13H8zM16 8V3H3v13h5',share:'M16 5 6 11m0 2 10 6M6 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6m13-7a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6',flag:'M4 22V3c6-4 10 4 16 0v10c-6 4-10-4-16 0',plus:'M12 4v16M4 12h16',logout:'M9 3H3v18h6m-2-9h15m-5-5 5 5-5 5',facebook:'M14 8h4V4h-4c-3 0-5 2-5 5v3H6v4h3v6h4v-6h4l1-4h-5V9c0-1 .5-1 1-1z',youtube:'M21 8c-.2-1.3-1-2.3-2.3-2.5C17 5 12 5 12 5s-5 0-6.7.5C4 5.7 3.2 6.7 3 8c-.2 1.2-.3 2.5-.3 4s.1 2.8.3 4c.2 1.3 1 2.3 2.3 2.5C7 19 12 19 12 19s5 0 6.7-.5C20 18.3 20.8 17.3 21 16c.2-1.2.3-2.5.3-4S21.2 9.2 21 8zM10 15V9l5 3-5 3z',instagram:'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6-1h.01',mail:'M4 5h16v14H4zM4 7l8 6 8-6',linkedin:'M5 9v10M5 5v.01M9 19V9h4v2c1-2 6-3 6 3v5M13 14c0-2 1-3 3-3',briefcase:'M9 6V4h6v2m-11 3h16v10H4zM3 10h18M10 13h4',history:'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l4 2',archive:'M3 6h18v4H3zM5 10v10h14V10M10 14h4',trash:'M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6m4-6v6',target:'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6','eye-off':'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-4 4.7M6.2 6.2C3.6 7.8 2 12 2 12s4 7 10 7a10 10 0 0 0 4-.8'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Shared, reusable markup is kept in index.html; this fills slots with runtime data.
  function templateMarkup(id, values={}) {
   const template=document.getElementById(id);
   if(!template)return null;
   let markup=template.innerHTML.trim();
   for(const [key,value] of Object.entries(values)){
    const safe=String(value??'');
    markup=markup.replaceAll('<!-- SLOT:'+key+' -->',safe).replaceAll('__SLOT_'+key+'__',safe);
   }
   return markup.replace(/<!-- SLOT:[A-Z_]+ -->/g,'').replace(/__SLOT_[A-Z_]+__/g,'');
  }
 const icon=(name='book')=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
 const countryFlag=country=>{
  const key=String(country||'').trim().toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ');
  const flags={
   'pakistan':'🇵🇰','india':'🇮🇳','usa':'🇺🇸','us':'🇺🇸','united states':'🇺🇸','united states of america':'🇺🇸',
   'uk':'🇬🇧','united kingdom':'🇬🇧','great britain':'🇬🇧','britain':'🇬🇧','england':'🏴',
   'canada':'🇨🇦','australia':'🇦🇺','new zealand':'🇳🇿','united arab emirates':'🇦🇪','uae':'🇦🇪',
   'bangladesh':'🇧🇩','sri lanka':'🇱🇰','nepal':'🇳🇵','afghanistan':'🇦🇫','china':'🇨🇳',
   'saudi arabia':'🇸🇦','malaysia':'🇲🇾','indonesia':'🇮🇩','nigeria':'🇳🇬','south africa':'🇿🇦',
   'germany':'🇩🇪','france':'🇫🇷','philippines':'🇵🇭','egypt':'🇪🇬','qatar':'🇶🇦','oman':'🇴🇲',
   'kuwait':'🇰🇼','turkey':'🇹🇷','türkiye':'🇹🇷','japan':'🇯🇵','singapore':'🇸🇬','italy':'🇮🇹',
   'spain':'🇪🇸','brazil':'🇧🇷','ireland':'🇮🇪','kenya':'🇰🇪','iran':'🇮🇷','iraq':'🇮🇶'
  };
  return flags[key]||'🏳️';
 };
 const prettyPath=path=>{const parts=String(path||'').replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);if(parts[0]==='home'&&parts.length===1)return '';
  if(window.SEO){
   if(parts.length===1&&parts[0]==='important')return 'mcqs/important-mcqs';
    if(parts[0]==='paper'&&parts[2]==='year'&&/^[0-9]+$/.test(parts[3]||''))return SEO.cleanPath('year',Number(parts[3])).slice(1);
   if(parts[0]==='paper'&&parts[2]==='job'&&parts[4]==='year'&&/^\d+$/.test(parts[5]||''))return SEO.cleanPath('year',Number(parts[5])).replace(/^\//,'');
   if(parts[0]==='paper'&&parts[2]==='job'&&/^\d+$/.test(parts[3]||''))return SEO.cleanPath('job',Number(parts[3])).replace(/^\//,'');
   if(['mcq','practice','category','paper','job','year','pdf','latest-job','post'].includes(parts[0])&&/^\d+$/.test(parts[1]||''))return SEO.cleanPath(parts[0],Number(parts[1])).replace(/^\//,'');
   if(parts.length===1&&parts[0]==='papers')return 'past-papers';
   if(parts.length===1&&parts[0]==='pdfs')return 'past-papers/pdfs';
   if(parts.length===1&&parts[0]==='posts')return 'blog';
  }
  return parts.join('/')};
 const href=(path,params={})=>'/'+prettyPath(path)+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
 const link=(path,label,cls='',params={})=>`<a class="${cls}" href="${esc(href(path,params))}" ${String(label).startsWith('<svg')&&String(label).endsWith('</svg>')?'aria-label="'+esc(path==='search'?'Search':'Open '+path.replaceAll('/',' '))+'"':''}>${label}</a>`;
 const brand=()=>link('home',`<span class="logo-crop"><img src="${esc(assetUrl('/assets/genfavicon-48.png'))}" srcset="${esc(assetUrl('/assets/genfavicon-48.png'))} 1x, ${esc(assetUrl('/assets/genfavicon-64.png'))} 2x" width="42" height="42" alt=""></span><span>MCQCampus</span>`,'brand');
 const btn=(label,action,cls='',extra='')=>`<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
 const empty=(title,description='',action='')=>templateMarkup('mcq-empty-template',{EMPTY_ICON:icon('search'),EMPTY_TITLE:esc(title),EMPTY_DESCRIPTION:esc(description),EMPTY_ACTION:action})||('<div class="empty">'+icon('search')+'<h3>'+esc(title)+'</h3><p>'+esc(description)+'</p>'+action+'</div>');
 const heading=(title,desc='',actions='')=>templateMarkup('mcq-page-heading-template',{HEADING_TITLE:esc(title),HEADING_DESCRIPTION:desc?'<p>'+esc(desc)+'</p>':'',HEADING_ACTIONS:actions})||('<div class="page-heading"><div class="section-head"><div><h1>'+esc(title)+'</h1>'+(desc?'<p>'+esc(desc)+'</p>':'')+'</div>'+actions+'</div></div>');
 const crumbs=items=>{const inner=link('home','Home')+items.map(([label,path])=>'<span aria-hidden="true">/</span>'+(path?link(path,esc(label)):'<span aria-current="page">'+esc(label)+'</span>')).join('');return templateMarkup('mcq-breadcrumbs-template',{BREADCRUMB_ITEMS:inner})||('<nav class="breadcrumbs" aria-label="Breadcrumb">'+inner+'</nav>');};
 const badge=(s,tone=s)=>`<span class="badge ${esc(tone)}">${esc(s[0]?.toUpperCase()+s.slice(1))}</span>`;
 const field=(name,label,value='',type='text',required=false,extra='')=>`<div class="field"><label for="${name}">${esc(label)}${required?' *':''}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${extra}></div>`;
 const textarea=(name,label,value='',required=false)=>`<div class="field"><label for="${name}">${esc(label)}${required?' *':''}</label><textarea id="${name}" name="${name}" ${required?'required':''}>${esc(value)}</textarea></div>`;
 const select=(name,label,items,selected='',required=false)=>`<div class="field"><label for="${name}">${esc(label)}</label><select name="${name}" id="${name}" ${required?'required':''}><option value="">Choose ${esc(label.toLowerCase())}</option>${items.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`;
 const search=(placeholder='Search…',value='',name='q')=>{const suggestions=name==='q'&&window.MCQ?[...new Set([...MCQ.db.categories.map(x=>x.name),...MCQ.db.papers.map(x=>x.name),...MCQ.db.jobs.map(x=>x.name),...(MCQ.db.posts||[]).map(x=>x.title),...(MCQ.db.pdfs||[]).map(x=>x.title||x.name)])].filter(Boolean).slice(0,40):[];const list=suggestions.length?'global-search-suggestions':'';return `<div class="searchbox">${icon('search')}<input aria-label="${esc(placeholder)}" name="${name}" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" ${list?`list="${list}"`:''}><button class="btn primary" type="submit">Search</button>${list?`<datalist id="${list}">${suggestions.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`:''}</div>`};
 const publicSearch=(placeholder='Search MCQs, Organizations, Past Papers, PDFs, Blog...',value='',name='q')=>`<div class="searchbox public-searchbox"><span class="public-search-icon" aria-hidden="true">${icon('search')}</span><input aria-label="${esc(placeholder)}" name="${name}" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off"><button class="btn primary public-search-submit" type="submit">Search</button></div>`;
 function pager(total,page,size=10,params={},path=App.route.path){
  const count=Math.max(0,Number(total)||0),n=Math.max(1,Math.ceil(count/Math.max(1,Number(size)||10))),current=Math.max(1,Math.min(Number(page)||1,n));
  if(n<=1)return `<div class="small muted pagination-count">${count.toLocaleString('en-GB')} total</div>`;
  const start=Math.floor((current-1)/5)*5+1,end=Math.min(n,start+4);
  const pages=Array.from({length:end-start+1},(_,i)=>start+i);
  const numbers=pages.map(p=>link(path,String(p),`btn sm ${p===current?'current':''}`,{...params,page:p})).join('');
  return `<nav class="pagination" aria-label="Pagination">${current>1?link(path,'‹ Previous','btn sm',{...params,page:current-1}):'<span></span>'}<div class="page-numbers">${numbers}</div>${current<n?link(path,'Next ›','btn sm primary',{...params,page:current+1}):'<span></span>'}<span class="small muted pagination-count">${count.toLocaleString('en-GB')} total · Page ${current} of ${n}</span></nav>`
}
 // Render stored timestamps only; never substitute the current clock for missing data.
 const date=s=>{if(!s)return '—';const value=String(s);if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))return 'Timestamp timezone unavailable';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(d)+' PKT';};
 const count=n=>{n=Math.max(0,Math.floor(Number(n)||0));if(n<1000)return n.toLocaleString();const unit=n>=1000000?1000000:1000,label=unit===1000000?'M':'K',scaled=Math.floor(n/unit*10)/10,base=Number.isInteger(scaled)?String(scaled):scaled.toFixed(1);return base+label+(n>scaled*unit?'+':'');};
 const counter=n=>`<span title="${Number(n).toLocaleString('en-GB')}" aria-label="${Number(n).toLocaleString('en-GB')}">${count(n)}</span>`;

 const statCard=({title,value,iconName='book',tone='primary',subtitle='',path='',params={},className='',loading=false}={})=>{
  const toneName=['primary','success','info','warning','danger','neutral'].includes(tone)?tone:'primary';
  const formatted=loading?'':(typeof value==='number'?value.toLocaleString('en-GB'):esc(value??'—'));
  const content=templateMarkup('mcq-stat-card-content-template',{STAT_TITLE:esc(title||'Statistic'),STAT_TONE:toneName,STAT_ICON:icon(iconName),STAT_VALUE:formatted,STAT_SUBTITLE:subtitle?'<span class="stat-card-subtitle">'+esc(subtitle)+'</span>':'',STAT_SKELETON:loading?'<span class="stat-card-skeleton" aria-hidden="true"></span>':''});
  const cls=`card stat-card tone-${toneName}${path?' stat-card-link clickable':''}${loading?' is-loading':''}${className?' '+className:''}`;
  return path?link(path,content,cls,params):`<div class="${cls}"${loading?' aria-busy="true"':''}>${content}</div>`;
 };

 const catIcons=['chart','globe','bolt','code','cpu','grid','cpu','science','chart','leaf'];
 const inheritedPaperIcon=x=>{if(!x||!window.MCQ)return '';if(x.paper_id){const p=MCQ.get('papers',x.paper_id);if(p?.icon)return p.icon}if(x.job_id){const j=MCQ.get('jobs',x.job_id),p=j&&MCQ.get('papers',j.paper_id);if(p?.icon)return p.icon}return ''};
 const entityIcon=(x,fallback='grid')=>{const v=String(inheritedPaperIcon(x)||x?.icon||x?.paper_icon||fallback).trim();const dataImage=/^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml);/i.test(v),remoteImage=/^https?:\/\//i.test(v),fileImage=/^(?:\/(?:media|static|assets|uploads)\/|\.\.?\/)[^?#]+/i.test(v)||/\.(?:png|jpe?g|webp|gif|avif|svg)(?:[?#].*)?$/i.test(v);if(dataImage||remoteImage||fileImage)return `<img class="entity-icon-img" src="${esc(v)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.hidden=true">`;if(/^[a-z][a-z0-9-]*$/i.test(v))return icon(v);return v?`<span class="entity-emoji" aria-hidden="true">${esc(v.slice(0,4))}</span>`:icon(fallback)};
 function showcaseCard(path,x,{badgeText='',title='',titleHtml='',subtitle='',meta='',fallback='grid'}={}){
   const content=templateMarkup('mcq-showcase-card-template',{SHOWCASE_ICON:entityIcon(x,fallback),SHOWCASE_BADGE:esc(badgeText),SHOWCASE_TITLE:titleHtml||esc(title||x?.name||''),SHOWCASE_SUBTITLE:esc(subtitle),SHOWCASE_META_ICON:icon('briefcase'),SHOWCASE_META:esc(meta),SHOWCASE_ARROW:icon('arrow')});return link(path,content||('<div class="entity-card-media"><span class="entity-card-image">'+entityIcon(x,fallback)+'</span></div><div class="entity-card-body"><span class="entity-card-badge">'+esc(badgeText)+'</span><h3>'+(titleHtml||esc(title||x?.name||''))+'</h3><p>'+esc(subtitle)+'</p><div class="entity-card-meta"><span>'+icon('briefcase')+' '+esc(meta)+'</span></div></div><span class="entity-card-arrow" aria-hidden="true">'+icon('arrow')+'</span>'),'card clickable entity-showcase-card');
 }
 function card(type,x,index=0){
  const conf={categories:['category',null,null,'MCQs'],subcategories:['subcategory','children','subcategory_id','topics'],children:['topic',null,null,'MCQs'],papers:['paper','years','paper_id','past papers'],jobs:['job','years','job_id','past papers'],years:['year',null,null,'MCQs']}[type];
  let count=!['papers','jobs'].includes(type)&&Number.isFinite(Number(x?.mcq_count))?Number(x.mcq_count):null;
  if(count===null){if(type==='categories')count=MCQ.publicMcqs().filter(q=>+q.category_id===+x.id).length;else count=conf[1]?MCQ.db[conf[1]].filter(y=>y[conf[2]]===x.id).length:MCQ.publicMcqs().filter(q=>MCQ.ids(q[type==='children'?'child_subcategory_ids':'job_years_ids']).includes(x.id)).length}
  const title=x.name;
  if(['categories','papers','jobs','years'].includes(type)){
   const parentJob=type==='years'&&x.job_id?MCQ.get('jobs',x.job_id):null,parentPaper=type==='jobs'?MCQ.get('papers',x.paper_id):type==='years'?(MCQ.get('papers',x.paper_id)||(parentJob?MCQ.get('papers',parentJob.paper_id):null)):null;
   const data={
    categories:{badgeText:'Category',subtitle:'Practice approved MCQs in this category.',meta:`${count} MCQs`,fallback:catIcons[index%catIcons.length]},
    papers:{badgeText:x.country||MCQ.db.settings.country||'Pakistan',subtitle:'Past papers for this Organization / Board.',meta:`${count} past paper${count===1?'':'s'}`,fallback:'paper'},
    jobs:{badgeText:parentPaper?.name||'Recruitment',subtitle:'Legacy hierarchy record.',meta:`${count} past paper${count===1?'':'s'}`,fallback:'briefcase'},
    years:{badgeText:parentPaper?.name||'Past Paper',subtitle:'Open this past paper to practise linked MCQs.',meta:`${count} MCQs`,fallback:'paper'}
   }[type];
   const entityPath=type==='papers'&&window.SEO?SEO.cleanPath('paper',x.id):type==='jobs'&&parentPaper&&window.SEO?SEO.cleanPath('job',x.id):type==='years'&&parentPaper&&window.SEO?SEO.cleanPath('year',x.id):type==='years'&&parentPaper?'paper/'+parentPaper.id+'/year/'+x.id:conf[0]+'/'+x.id;
   return showcaseCard(entityPath,x,{...data,title});
  }
  return link(conf[0]+'/'+x.id,`<span class="tile-icon tint-${index%5}">${entityIcon(x,catIcons[index%catIcons.length])}</span><h3>${esc(title)}</h3><div class="card-foot"><span>${count} ${conf[3]}</span>${icon('arrow')}</div>`,'card clickable')
 }
 function toast(msg){const e=document.getElementById('toast');e.textContent=msg;e.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>e.classList.remove('show'),4200)}
 // One delegated close policy for navigation menus and searchable pickers.
 function closeDropdowns(except=null){
  document.querySelectorAll('details.user-menu[open],details.dropdown[open],details[data-dropdown][open]').forEach(menu=>{if(menu!==except)menu.open=false});
  document.querySelectorAll('.picker-results').forEach(panel=>{if(!except?.contains(panel))panel.classList.add('hidden')});
  document.querySelectorAll('[data-picker-input]').forEach(input=>{if(!except?.contains(input))input.setAttribute('aria-expanded','false')});
 }
 document.addEventListener('click',event=>{
  const menu=event.target.closest('details.user-menu,details.dropdown,details[data-dropdown],.picker');
  const selected=event.target.closest('a[href],button[data-action],[role="menuitem"]');
  closeDropdowns(selected?null:menu);
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){
  const menu=document.activeElement?.closest('details.user-menu[open],details.dropdown[open],details[data-dropdown][open]');
  closeDropdowns();menu?.querySelector('summary')?.focus({preventScroll:true});
 }},true);
 window.addEventListener('hashchange',()=>closeDropdowns());
 let focusBefore;
 function modal(title,body){const d=document.getElementById('modal');focusBefore=document.activeElement;d.innerHTML=`<div class="dialog-content"><div class="dialog-head"><h2>${esc(title)}</h2>${btn(icon('close'),'close','ghost','aria-label="Close dialog"')}</div>${body}</div>`;if(!d.open)d.showModal();const loader=document.getElementById('backend-loader');if(loader?.open){loader.close();loader.showModal();loader.focus({preventScroll:true})}d.addEventListener('close',()=>focusBefore?.focus(),{once:true})}
 function download(filename,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 function adSlot(placement){
  const cfg=MCQ.db.adSettings||{};if(cfg.enabled===false)return '';
  const now=new Date().toISOString().slice(0,10),safe=u=>/^https?:\/\//i.test(String(u||''));
  const ad=(MCQ.db.ads||[]).find(x=>x&&x.enabled!==false&&x.placement===placement&&x.provider!=='adsense'&&(!x.start_date||x.start_date<=now)&&(!x.end_date||x.end_date>=now));
  if(!ad)return '';
if(ad.provider==='custom_code'&&String(ad.code||'').trim()){const encoded=btoa(unescape(encodeURIComponent(String(ad.code))));return '<aside class="ad-slot ad-slot-'+esc(placement)+' custom-code-ad" data-ad-slot="'+esc(placement)+'" data-ad-code="'+encoded+'" aria-label="Advertisement"><div class="custom-code-ad-body"></div></aside>';}
  const image=safe(ad.image_url)?`<img src="${esc(ad.image_url)}" alt="${esc(ad.brand||'Sponsored advertisement')}">`:'';
  const body=`<span class="ad-label">Sponsored</span>${image}<span class="ad-copy"><strong>${esc(ad.brand||'Advertisement')}</strong>${ad.text?`<small>${esc(ad.text)}</small>`:''}</span>`;
  return `<aside class="ad-slot ad-slot-${esc(placement)}" data-ad-slot="${esc(placement)}" aria-label="Sponsored advertisement">${safe(ad.destination_url)?`<a href="${esc(ad.destination_url)}" target="_blank" rel="sponsored noopener noreferrer">${body}</a>`:body}</aside>`
}
 function mountCustomAds(root=document){const scope=root&&root.querySelectorAll?root:document;scope.querySelectorAll('.custom-code-ad[data-ad-code]').forEach(slot=>{if(slot.dataset.adMounted==='true')return;const body=slot.querySelector('.custom-code-ad-body');if(!body)return;let code='';try{code=decodeURIComponent(escape(atob(slot.dataset.adCode||'')))}catch{return}slot.dataset.adMounted='true';const template=document.createElement('template');template.innerHTML=code;const nodes=[...template.content.childNodes],scripts=[];nodes.forEach(node=>{if(node.nodeType===1&&node.tagName==='SCRIPT')scripts.push(node);else body.appendChild(node)});scripts.forEach(source=>{const script=document.createElement('script');for(const attr of source.attributes)script.setAttribute(attr.name,attr.value);script.text=source.textContent||'';body.appendChild(script)})});}
 function userMenu(){const s=MCQ.db.session;if(!s)return link('login','Log in','btn primary header-login');const roles=s.roles||[s.role||'user'];const avatar=s.avatar?`<img src="${esc(s.avatar)}" alt="">`:`<span>${esc((s.name||'U').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`;const switches=[];if(roles.includes('user'))switches.push(btn(icon('book')+' Learner dashboard','workspace-switch','user-menu-item user-menu-button',`data-role="user"`));if(roles.includes('admin'))switches.push(btn(icon('edit')+' Admin workspace','workspace-switch','user-menu-item user-menu-button',`data-role="admin"`));if(roles.includes('super-admin'))switches.push(btn(icon('shield')+' Super admin','workspace-switch','user-menu-item user-menu-button',`data-role="super-admin"`));return `<details class="user-menu"><summary class="header-user-avatar" aria-label="Open account menu">${avatar}</summary><div class="user-menu-panel"><div class="user-menu-head"><strong>${esc(s.name||'Account')}</strong><span>${esc(s.email||'')}</span></div>${switches.join('')}${link('dashboard/settings',icon('settings')+' Settings','user-menu-item')}${link('dashboard/downloads',icon('download')+' My Downloads','user-menu-item')}${btn(icon('logout')+' Log out','logout','user-menu-item user-menu-button')}</div></details>`} function header(active=''){
  const current=String(App.route?.path||'home').split('/')[0];
  const currentQuery=current==='search'?(App.route?.params?.q||''):'';
  const mobileMenu=MCQ.db.session?btn(icon('menu'),'menu','ghost menu-toggle','aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav"'):'';
  return templateMarkup('mcq-header-template',{HEADER_AUTH_LINK:MCQ.db.session?link('dashboard',icon('user')+'<span>My learning</span>','mobile-menu-auth'):link('login',icon('user')+'<span>Log in</span>','mobile-menu-auth'),HEADER_SEARCH:publicSearch('Search MCQs, papers, categories, jobs...',currentQuery),HEADER_USER_MENU:userMenu(),HEADER_MOBILE_MENU:mobileMenu})||'';
}
 function footer(){
  const settings=MCQ.db.settings||{},cfg=settings.footer||{},pages=MCQ.db.content?.legalPages||{},coreHelpPages=new Set(['about','contact','privacy','terms','disclaimer']),safeUrl=u=>/^https?:\/\//i.test(String(u||''));
  const visible=(key,toggle)=>cfg[toggle]!==false&&(coreHelpPages.has(key)||pages[key]?.published!==false);
  const socials=settings.socialLinks||{},footerEmail=socials.email||{},emailAddress=String(footerEmail.address||'').trim(),emailHtml=footerEmail.enabled===true&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)?`<a class="footer-email" href="mailto:${esc(emailAddress)}">${icon('mail')}<span>${esc(emailAddress)}</span></a>`:'';
  const socialDefs=[['facebook','Facebook'],['youtube','YouTube'],['instagram','Instagram'],['linkedin','LinkedIn']];
  const socialHtml=socialDefs.map(([key,label])=>{const x=socials[key]||{},url=String(x.url||settings[key+'Url']||'').trim(),custom=/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(x.iconData||'')),mark=custom?`<img class="footer-social-custom-icon" src="${esc(x.iconData)}" alt="">`:icon(x.icon||key);return x.enabled!==false&&safeUrl(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${mark}</a>`:''}).filter(Boolean).join('');
  const footerBrand=brand();
  const help=[];if(visible('about','showAbout'))help.push(['about','About Us']);if(visible('contact','showContact'))help.push(['contact','Contact Us']);if(visible('privacy','showPrivacy'))help.push(['privacy','Privacy Policy']);if(visible('terms','showTerms'))help.push(['terms','Terms & Conditions']);if(visible('disclaimer','showDisclaimer'))help.push(['disclaimer','Disclaimer']);if(visible('cookies','showCookiePolicy'))help.push(['cookies','Cookie Policy']);if(visible('advertising','showAdvertisingPolicy'))help.push(['advertising','Advertising Policy']);if(cfg.showFaq&&pages.faq?.published!==false)help.push(['faq','FAQ']);
  const description=cfg.description||'Practice MCQs, solve past papers, discover exam opportunities, and prepare confidently for competitive examinations.';const country=cfg.showCountryText!==false&&cfg.countryText?`<p class="footer-country">${esc(cfg.countryText)}</p>`:'';
  const bottom=[];if(cfg.showSitemap!==false)bottom.push(link('sitemap','Sitemap'));
  const copy=String(cfg.copyrightText||`${settings.siteName||'MCQ Campus'}. All rights reserved.`).replace(/^©\s*\d{4}\s*/,'');
  const mobileLinks=[['home','home','Home'],['mcqs','book','MCQs'],['papers','paper','Papers'],['latest-jobs','briefcase','Updates'],['dashboard','user','Profile']].map(([p,i,l])=>link(p,icon(i)+l,(App.route.path||'').split('/')[0]===p?'active':'')).join('');
  return templateMarkup('mcq-footer-template',{
   FOOTER_BRAND:footerBrand,
   FOOTER_DESCRIPTION:esc(description),
   FOOTER_EMAIL:emailHtml,
   FOOTER_SOCIALS:socialHtml?'<div class="footer-social" aria-label="MCQ Campus social media">'+socialHtml+'</div>':'',
   FOOTER_COUNTRY:country,
   FOOTER_QUICK_LINKS:link('mcqs','MCQs')+link('papers','Past Papers')+link('pdfs','PDFs')+link('latest-jobs','Latest Jobs'),
   FOOTER_HELP_LINKS:help.map(([p,l])=>link(p,l)).join(''),
   FOOTER_YEAR:new Date().getFullYear(),
   FOOTER_COPY:esc(copy),
   FOOTER_BOTTOM_LINKS:bottom.length?'<span class="footer-bottom-links">'+bottom.join('')+'</span>':'',
   FOOTER_MOBILE_LINKS:mobileLinks
  })||'';
}
 function ensureLinkNames(root=document){
  if(!root||typeof root.querySelectorAll!=='function')return;
  const routeLabels={
   home:'Home',mcqs:'MCQs',important:'Important MCQs','past-papers':'Past Papers',papers:'Past Papers',
   categories:'Categories',category:'Category',subcategory:'Subcategory',topic:'Topic',pdfs:'PDFs',pdf:'PDF',
   'latest-jobs':'Latest Jobs','latest-job':'Job details',posts:'Blog',post:'Blog post',tests:'Tests',test:'Practice test',
   search:'Search',login:'Log in',register:'Sign up',dashboard:'My learning',profile:'Profile',admin:'Admin panel','super-admin':'Super Admin panel'
  };
  root.querySelectorAll('a[href]').forEach(anchor=>{
   if(anchor.getAttribute('aria-label')?.trim()||anchor.getAttribute('aria-labelledby')?.trim()||anchor.getAttribute('title')?.trim()||anchor.textContent?.trim())return;
   const imageLabel=[...anchor.querySelectorAll('img[alt]')].map(image=>(image.getAttribute('alt')||'').trim()).filter(Boolean).join(' ');
   if(imageLabel){anchor.setAttribute('aria-label',imageLabel);return;}
   const href=String(anchor.getAttribute('href')||'').trim();
   if(/^mailto:/i.test(href)){anchor.setAttribute('aria-label','Send email');return;}
   if(/^tel:/i.test(href)){anchor.setAttribute('aria-label','Call phone number');return;}
   if(href.startsWith('#')){anchor.setAttribute('aria-label',href.length>1?'Go to '+href.slice(1).replace(/[-_]+/g,' '):'Open linked section');return;}
   let pathname=href;
   try{pathname=new URL(href,window.location.href).pathname;}catch(_){}
   const route=pathname.split('/').filter(Boolean)[0]||'home';
   anchor.setAttribute('aria-label',routeLabels[route]||(/^https?:\/\//i.test(href)?'Open external resource':'Open linked resource'));
  });
 }
 const layout=(body,active='')=>templateMarkup('mcq-layout-template',{LAYOUT_HEADER:header(active),LAYOUT_HEADER_AD:adSlot('header_ad'),LAYOUT_BODY:body,LAYOUT_FOOTER_AD:adSlot('footer_ad'),LAYOUT_FOOTER:footer()})||('<main id="main" tabindex="-1">'+body+'</main>');
 return {templateMarkup,closeDropdowns,esc,icon,countryFlag,href,assetUrl,link,brand,btn,empty,heading,crumbs,badge,field,textarea,select,search,publicSearch,pager,date,count,counter,statCard,showcaseCard,card,toast,modal,download,entityIcon,adSlot,ensureLinkNames,mountCustomAds,userMenu,header,footer,layout};
})();

/* ===== END MODULE: ui.js ===== */

;


/* SOURCE: frontend/js/modules/public-layout.js */
/* ===== MCQCAMPUS MODULE: public-layout.js ===== */
window.PublicLayout=(()=>{
 const {esc:e,icon,link,btn,heading,crumbs}=UI;
 const clean=a=>String(a||'').trim();
 const module=(title,body,cls='')=>body?`<section class="card smart-sidebar-card ${cls}"><h3>${e(title)}</h3>${body}</section>`:'';
 const sidebarIcon=path=>({home:'home',category:'grid',categories:'grid',mcqs:'book',paper:'paper',papers:'paper',job:'briefcase',jobs:'briefcase',year:'clock',tests:'check',test:'check',guides:'book',guide:'book',posts:'edit',post:'edit',dashboard:'user',pdfs:'download','latest-jobs':'briefcase',settings:'settings'}[String(path).split('/')[0]]||'book');
 const linkList=(items,cls='sidebar-link-list')=>`<div class="${cls}">${items.filter(Boolean).map(x=>Array.isArray(x)?link(x[0],(x[3]||icon(sidebarIcon(x[0])))+'<span>'+e(x[1])+'</span>','smart-sidebar-link',x[2]||{}):x).join('')}</div>`;
 const ad=slot=>UI.adSlot(slot);
 const activeParams=(omit=[])=>Object.fromEntries(Object.entries(App.route?.params||{}).filter(([k,v])=>v&&!omit.includes(k)));
 function categoryLinks(limit=6){return MCQ.db.categories.filter(x=>x.active!==false&&!x.legacy).slice(0,limit).map(x=>['mcqs',x.name,{...activeParams(['page','category']),category:x.id},`<span class="smart-sidebar-brand-icon">${UI.entityIcon(x,'grid')}</span>`]);}
 function paperLinks(limit=5){return MCQ.db.papers.filter(x=>x.active!==false).slice(0,limit).map(x=>['paper/'+x.id,x.name,{},`<span class="smart-sidebar-brand-icon">${UI.entityIcon(x,'paper')}</span>`]);}
 function articleLinks(kind,limit=5){
  if(kind==='guides')return (MCQ.db.guides||[]).slice(-limit).reverse().map(x=>['guide/'+x.id,x.name]);
  if(kind==='posts')return (MCQ.db.posts||[]).filter(x=>x.published!==false).slice(0,limit).map(x=>['post/'+x.id,x.title]);
  return [];
 }
 function smart(kind,ctx={}){
  const out=[],p=App.route?.params||{},cats=MCQ.db.categories.filter(x=>x.active!==false&&!x.legacy),papers=MCQ.db.papers.filter(x=>x.active!==false),years=MCQ.db.years.filter(x=>x.active!==false);
  out.push(ad('sidebar_top')||ad('sidebar_ad'));
  if(kind==='mcqs'){
   const session=MCQ.db.session;if(session){const attempts=(MCQ.db.attempts||[]).filter(a=>!a.by_id||+a.by_id===+session.id),correct=attempts.filter(a=>a.correct).length,accuracy=attempts.length?Math.round(correct/attempts.length*100):0,saved=(MCQ.db.bookmarks||[]).length,daily=Number(session.daily_goal||25);const learning=`<div class="sidebar-learning-grid"><div><strong>${attempts.length}</strong><span>Attempted</span></div><div><strong>${accuracy}%</strong><span>Accuracy</span></div><div><strong>${saved}</strong><span>Saved</span></div><div><strong>${daily}</strong><span>Daily goal</span></div></div>${link('dashboard',icon('user')+'<span>Open My Learning</span>','smart-sidebar-link')}`;out.push(module('My Learning',learning,'smart-learning-card'));}
   out.push(module('Related Categories',linkList(categoryLinks(5))));
   out.push(ad('sidebar_middle'));
   out.push(module('Related Past Papers',linkList(paperLinks(3))));
  } else if(kind==='category'){
   const record=ctx.record;
   out.push(module('Other Categories',linkList(cats.filter(x=>x.id!==record?.id).slice(0,7).map(x=>['category/'+x.id,x.name,{},`<span class="smart-sidebar-brand-icon">${UI.entityIcon(x,'grid')}</span>`]))));
   out.push(ad('sidebar_middle'));
   out.push(module('Exam Preparation',linkList([...paperLinks(3),['pdfs','PDF Resources']])));
  } else if(kind==='papers'){
   const parent=ctx.parent,type=ctx.type,countries=[...new Set(['Pakistan','India',...papers.map(x=>x.country).filter(Boolean)])];
   let hierarchy=[];
   if(type==='job'&&parent){const paper=MCQ.get('papers',parent.paper_id);hierarchy=years.filter(x=>x.job_id===parent.id).slice(0,8).map(x=>[paper?'paper/'+paper.id+'/year/'+x.id:'year/'+x.id,x.name]);}
   else hierarchy=paperLinks(7);
   if(type==='job')out.push(module('Years / Papers',linkList(hierarchy)));
   if(type==='paper'&&parent){const country=parent.country||MCQ.db.settings.country||'Pakistan';const paperCount=years.filter(y=>Number(y.paper_id)===Number(parent.id)||(!y.paper_id&&Number(MCQ.get('jobs',y.job_id)?.paper_id)===Number(parent.id))).length;out.push(module('Organization / Board',`<p class="small muted">${e(country)} · ${paperCount.toLocaleString('en-GB')} past papers</p>`));}
   out.push(ad('paper_sidebar')||ad('sidebar_middle'));
   out.push(module('Related Resources',linkList([['mcqs','Related MCQs'],['pdfs','Related PDFs']])));
  } else if(kind==='jobs'){
   out.push(ad('jobs_sidebar')||ad('sidebar_middle'));
   out.push(module('Preparation',linkList([['mcqs','Related MCQs'],['papers','Past Papers']])));
  } else if(kind==='pdfs'){
   out.push(ad('pdf_sidebar')||ad('sidebar_middle'));
   out.push(module('Related Resources',linkList([['papers','Past Papers'],['posts','Blog'],['latest-jobs','Latest Jobs']])));
  } else if(kind==='articles'){
   const subtype=ctx.subtype||'posts';
   const recent=articleLinks(subtype,5);if(recent.length)out.push(module(subtype==='posts'?'Recent Blog Posts':'Recent Articles',linkList(recent)));
   out.push(module('Preparation Links',linkList([['mcqs','Practice MCQs'],['papers','Past Papers'],['latest-jobs','Latest Jobs']])));
   out.push(ad('article_inline')||ad('sidebar_middle'));
  } else if(kind==='search'){
   out.push(module('Popular Categories',linkList(categoryLinks(6))));
   out.push(ad('sidebar_middle'));
  } else if(kind==='mcq-detail'){
   const q=ctx.question,cat=q&&MCQ.get('categories',q.category_id),yrs=q?MCQ.ids(q.job_years_ids).map(id=>MCQ.get('years',id)).filter(Boolean):[];
   if(cat)out.push(module('Question Category',linkList([['category/'+cat.id,cat.name]])));
   if(yrs.length)out.push(module('Related Past Papers',linkList(yrs.slice(0,7).map(x=>{const paper=MCQ.get('papers',x.paper_id)||MCQ.get('papers',MCQ.get('jobs',x.job_id)?.paper_id);return [paper?'paper/'+paper.id+'/year/'+x.id:'year/'+x.id,x.name]}))));
   out.push(ad('sidebar_middle'));
   out.push(module('Keep Practising',linkList([['mcqs','Browse MCQs'],['papers','Past Papers']])));
  } else if(kind==='legal'){
   const cfg=MCQ.db.settings?.footer||{},pages=MCQ.db.content?.legalPages||{},coreHelpPages=new Set(['about','contact','privacy','terms','disclaimer']),visible=(k,t)=>cfg[t]!==false&&(coreHelpPages.has(k)||pages[k]?.published!==false);
   const items=[];if(visible('about','showAbout'))items.push(['about','About Us']);if(visible('contact','showContact'))items.push(['contact','Contact Us']);if(visible('privacy','showPrivacy'))items.push(['privacy','Privacy Policy']);if(visible('terms','showTerms'))items.push(['terms','Terms & Conditions']);if(visible('disclaimer','showDisclaimer'))items.push(['disclaimer','Disclaimer']);if(cfg.showCookiePolicy&&pages.cookies?.published!==false)items.push(['cookies','Cookie Policy']);if(cfg.showAdvertisingPolicy&&pages.advertising?.published!==false)items.push(['advertising','Advertising Policy']);
   out.push(module('Help & Legal',linkList(items)));
   out.push(module('Preparation',linkList([['mcqs','MCQs'],['papers','Past Papers']])));
  }
  out.push(ad('sidebar_bottom'));
  return out.filter(Boolean).join('');
 }
 function selectionBar(items=[],label='Browse',className=''){
  const visible=items.filter(x=>x&&x.label&&x.hidden!==true);if(visible.length<2)return '';
  return `<nav class="selection-bar ${e(className)}" aria-label="${e(label)}">${visible.map(x=>link(x.path||App.route.path,e(x.label),'selection-chip '+(x.active?'active':''),x.params||{})).join('')}</nav>`;
 }
 function selectionStack(rows=[]){const visible=rows.filter(x=>x&&x.html);return visible.length?`<div class="selection-stack">${visible.map(x=>`${x.title?`<span class="selection-row-label">${e(x.title)}</span>`:''}${x.html}`).join('')}</div>`:'';}

  function page({trail=[],title='',desc='',actions='',pre='',main='',sidebar='',active='',className='',sidebarLabel='Related / Browse'}){
   const has=clean(sidebar),sidebarId='public-smart-sidebar';
   const common={PUBLIC_CLASS:e(className),PUBLIC_BREADCRUMBS:crumbs(trail),PUBLIC_HEADING:heading(title,desc,actions),PUBLIC_PRE:pre,PUBLIC_MAIN:main};
   let body;
   if(has){
    body=UI.templateMarkup('mcq-public-page-sidebar-template',{...common,PUBLIC_TOGGLE:btn(icon('menu')+' '+e(sidebarLabel),'public-sidebar-toggle','','aria-expanded="false" aria-controls="'+sidebarId+'"'),PUBLIC_SIDEBAR_ID:sidebarId,PUBLIC_SIDEBAR_LABEL:e(sidebarLabel),PUBLIC_CLOSE_BUTTON:btn(icon('close'),'public-sidebar-close','ghost','aria-label="Close sidebar"'),PUBLIC_SIDEBAR:sidebar});
   }else{
    body=UI.templateMarkup('mcq-public-page-full-template',common);
   }
   return UI.layout(body||('<div class="container page public-page '+e(className)+'">'+crumbs(trail)+heading(title,desc,actions)+pre+'<main class="public-main public-main-full">'+main+'</main></div>'),active);
  }
 return {page,smart,module,linkList,selectionBar,selectionStack};
})();


/* ===== END MODULE: public-layout.js ===== */

;


/* SOURCE: frontend/js/modules/public.js */
/* ===== MCQCAMPUS MODULE: public.js ===== */
window.Public=(()=>{
 const {templateMarkup,esc:e,icon,link,btn,card,heading,crumbs,empty,badge,field,textarea,select}=UI;
 const yearPath=x=>{const p=x&&(MCQ.get('papers',x.paper_id)||MCQ.get('papers',MCQ.get('jobs',x.job_id)?.paper_id));return p?'paper/'+p.id+'/year/'+x.id:'year/'+x.id};
 const jobPath=x=>{const p=x&&MCQ.get('papers',x.paper_id);return p?'paper/'+p.id+'/job/'+x.id:'job/'+x.id};
 const pageCopy=(kind,key,title,desc)=>{const row=(MCQ.db.pageSeo||{})[kind+':'+String(key)]||{};return {title:String(row.title||title||''),desc:String(row.description||desc||'')}};
 const staticCopy=(key,title,desc)=>pageCopy('static',key,title,desc);
 const fixedPublicCountry=()=>{
  const user=window.Auth?.user||MCQ.db.session||{};
  if(String(user.activeRole||'')==='super-admin'&&(user.roles||[]).includes('super-admin'))return String(MCQ.db.activeCountry||'').trim();
  return String(user.country||MCQ.db.settings.country||'Pakistan').trim();
 };
 const publicCountryNames=()=>{
  const fixed=fixedPublicCountry();if(fixed)return [fixed];
  const configured=(MCQ.db.countries||[]).filter(x=>x&&x.active!==false).map(x=>String(x.name||'').trim()).filter(Boolean);
  const paperCountries=(MCQ.db.papers||[]).filter(x=>x.active!==false).map(x=>String(x.country||'').trim()).filter(Boolean);
  const names=[...new Set([...configured,...paperCountries])].filter(x=>x.toLowerCase()!=='both');
  return names.length?names:['Pakistan'];
 };
 const activeServerMcqPage=()=>{const p=MCQ.db.mcqPage||{};return p.server===true&&p.scope==='public'&&p.routeKey===location.pathname+location.search?p:null};
 const activeEntityPage=()=>{const p=MCQ.db.entityPage||{};return p.server===true&&p.routeKey===location.pathname+location.search?p:null};
 const pastPapersPath=x=>{const org=MCQ.get('papers',x.paper_id);return org?(window.SEO?SEO.cleanPath('paper',org.id):'paper/'+org.id):'papers'};
  const latestJobCard=x=>{const safe=u=>/^https?:\/\//i.test(String(u||'')),org=MCQ.get('papers',x.paper_id),logo=org?UI.entityIcon(org,'briefcase'):icon('briefcase'),slug=x.slug||MCQ.slug(x.title||'job'),path=window.SEO?SEO.cleanPath('latest-job',x.id):'latest-job/'+slug,apply=safe(x.apply_url)?'<a class="btn sm" href="'+e(x.apply_url)+'" target="_blank" rel="noopener" data-auth-action="apply-job">Apply</a>':'',prep=(/^(https?:\/\/|\/(?!\/))/i.test(String(x.prep_url||'')))?'<a class="btn sm" href="'+e(x.prep_url)+'" target="_blank" rel="noopener">Past Papers</a>':(org?link(pastPapersPath(x),'Past Papers','btn sm'):''),actions=apply||prep?'<div class="latest-job-action"><div class="actions">'+apply+prep+'</div></div>':'',markup=UI.templateMarkup('mcq-latest-job-card-template',{JOB_LOGO:logo,JOB_ORGANIZATION:e(org?.name||'Organization'),JOB_TITLE_LINK:link(path,e(x.title||'Job opportunity')),JOB_DESCRIPTION:x.description?'<p>'+e(x.description)+'</p>':'',JOB_LAST_DATE:e(UI.date(x.last_date)),JOB_DETAILS_LINK:link(path,'View job details'),JOB_ACTIONS:actions});return markup||''};
  const pdfResourceCard=x=>{const safeLink=u=>/^https?:\/\//i.test(String(u||''))||/^data:application\/pdf;base64,/i.test(String(u||'')),safeImage=u=>/^https?:\/\//i.test(String(u||''))||/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(u||'')),href=String(x.download_url||'').trim(),title=x.title||x.name||'PDF resource',slug=x.slug||MCQ.slug(title),path=window.SEO?SEO.cleanPath('pdf',x.id):'pdf/'+slug,download=safeLink(href)?'<a class="btn primary" href="'+e(href)+'" data-auth-action="download-pdf" data-auth-download-name="'+e(MCQ.slug(title||'mcq-campus'))+'.pdf" '+(/^data:/i.test(href)?'download="'+e(MCQ.slug(title||'mcq-campus'))+'.pdf"':'target="_blank" rel="noopener"')+'>Download PDF</a>':'<span class="btn disabled" aria-disabled="true">Download unavailable</span>',cover=x.cover&&safeImage(x.cover)?'<img src="'+e(x.cover)+'" alt="'+e(title)+'" loading="lazy" decoding="async">':'',description=x.description?'<p>'+e(x.description)+'</p>':'',markup=UI.templateMarkup('mcq-pdf-resource-card-template',{PDF_COVER:cover,PDF_TITLE_LINK:link(path,e(title)),PDF_DESCRIPTION:description,PDF_OPEN_LINK:link(path,'Open PDF details'),PDF_DOWNLOAD:download});return markup||''};
  const blogPostCard=post=>{const safeUrl=u=>/^(https?:\/\/|#\/)/i.test(String(u||'')),source=(post.links||[]).find(x=>x.label==='__blog_url'&&safeUrl(x.url)),href=source?String(source.url):UI.href('post/'+post.id),target=source&&/^https?:\/\//i.test(source.url)?'target="_blank" rel="noopener"':'',excerpt=post.excerpt?'<p>'+e(post.excerpt)+'</p>':'',media=post.featured_image?'<img src="'+e(post.featured_image)+'" alt="" loading="lazy" decoding="async">':'<span class="content-fallback content-fallback-blue">'+icon('edit')+'</span>',markup=UI.templateMarkup('mcq-blog-post-card-template',{BLOG_HREF:e(href),BLOG_TARGET:target,BLOG_CATEGORY:e(post.category||'UPDATE'),BLOG_TITLE:e(post.title),BLOG_EXCERPT:excerpt,BLOG_CALENDAR_ICON:icon('calendar'),BLOG_DATE:e(UI.date(post.updated_at||post.created_at)),BLOG_ARROW_ICON:icon('arrow'),BLOG_MEDIA:media});return markup||''};
 function relationships(q,contextYearId=null){let years=MCQ.ids(q.job_years_ids).map(id=>MCQ.get('years',id)).filter(Boolean);if(contextYearId)years=years.filter(x=>+x.id===+contextYearId);if(!years.length)return '';return `<div class="mcq-answer-years" aria-label="Years"><span class="mcq-years-label">Years</span><div class="chips">${years.map(x=>link(yearPath(x),`<span class="mcq-year-icon" aria-hidden="true">${UI.entityIcon(x,'grid')}</span><span>${e(x.name)}</span>`,'chip mcq-year-chip')).join('')}</div></div>`}
 function questionCountry(q){const direct=String(q.country||'').trim();if(direct)return direct;const paperId=MCQ.ids(q.paper_id)[0],paper=paperId?MCQ.get('papers',paperId):null;return String(paper?.country||MCQ.db.settings.country||'Pakistan').trim()||'Pakistan'}
 function isCurrentAffairs(q){if(q.current_affairs===true||q.current_affairs==='true')return true;const cat=MCQ.get('categories',q.category_id),subs=MCQ.ids(q.subcategory_ids).map(id=>MCQ.get('subcategories',id)).filter(Boolean),children=MCQ.ids(q.child_subcategory_ids).map(id=>MCQ.get('children',id)).filter(Boolean),text=[cat?.name,...subs.map(x=>x.name),...children.map(x=>x.name),q.tags,q.topic].filter(Boolean).join(' ');return /current\s*affairs?/i.test(text)}
 function questionTags(q,{featured=false}={}){const country=questionCountry(q),bps=String(q.bps||'').trim();return `<div class="mcq-question-tags">${featured?'<span class="badge mcq-featured-badge">Featured MCQ</span>':''}${MCQ.isImportant(q)?badge('important'):''}${bps?`<span class="badge">${e(bps)}</span>`:''}<span class="badge mcq-country-badge">${e(country)}</span></div>`}
 function relatedMcqs(q,limit=5){const score=x=>{let n=0;if(q.category_id===x.category_id)n+=6;if(MCQ.ids(q.paper_id).some(id=>MCQ.ids(x.paper_id).includes(id)))n+=4;if(MCQ.ids(q.job_ids).some(id=>MCQ.ids(x.job_ids).includes(id)))n+=4;if(MCQ.ids(q.job_years_ids).some(id=>MCQ.ids(x.job_years_ids).includes(id)))n+=5;return n};return MCQ.publicMcqs().filter(x=>x.id!==q.id).map(x=>({x,s:score(x)})).filter(r=>r.s>0).sort((a,b)=>b.s-a.s||a.x.id-b.x.id).slice(0,limit).map(r=>r.x)}
 function mcq(id){
  const q=MCQ.publicMcqs().find(x=>x.id===+id);if(!q)return notFound();
  const cat=MCQ.get('categories',q.category_id),related=relatedMcqs(q),copy=pageCopy('mcq',q.id,(cat?.name||'MCQ')+' Question',q.description||'Practice this question, check the answer, and review its explanation.');
  const main=`${questionCard(q,1)}<section class="card related-box"><div class="section-head"><div><p class="eyebrow">KEEP PRACTISING</p><h2>Related MCQs</h2></div></div>${related.length?related.map((x,i)=>mini(x,i)).join(''):empty('No close matches yet','Explore the broader category for more practice.',cat?link('category/'+cat.id,'Browse category','btn'):link('mcqs','Browse MCQs','btn'))}</section>`;
  return PublicLayout.page({trail:[['MCQs','mcqs'],[q.question]],title:copy.title,desc:copy.desc,main,sidebar:PublicLayout.smart('mcq-detail',{question:q}),active:'mcqs',sidebarLabel:'Browse / Related'});
 }


 function questionCard(q,number=1,compact=false,contextYearId=null){
  const answer=App.answers[q.id],chosen=App.choices[q.id];
  const rows=MCQ.publicMcqs(),globalIndex=rows.findIndex(x=>x.id===q.id),next=globalIndex>=0&&globalIndex<rows.length-1?rows[globalIndex+1]:rows[0];
  const bookmark=btn(icon('bookmark'),'bookmark','ghost','data-id="'+q.id+'" aria-label="'+(MCQ.db.bookmarks.includes(q.id)?'Remove bookmark':'Bookmark question')+'" aria-pressed="'+MCQ.db.bookmarks.includes(q.id)+'"');
  const nextLink=compact&&next?link('practice/'+next.id,icon('arrow'),'btn ghost quick-next'):'';
  const options=[1,2,3,4].map((n,i)=>{
   const text=q['option'+n];
   const state=answer?(text===q.correct_answer?'correct':text===chosen?'wrong':''):text===chosen?'selected':'';
   return btn('<span class="letter">'+'ABCD'[i]+'</span><span class="option-text">'+e(text)+'</span><span class="option-indicator" aria-hidden="true"></span>','choose','option '+state,'data-id="'+q.id+'" data-option="'+n+'" aria-pressed="'+(text===chosen)+'" '+(answer?'disabled':''));
  }).join('');
  const explanation=answer?'<div class="explanation mcq-verified-answer" role="status"><div class="verified-answer-head"><span class="verified-check" aria-hidden="true">✓</span><strong>Correct Answer: <b>'+e(q.correct_answer)+'</b></strong></div><p>'+e(q.description||'No explanation has been added yet.')+'</p>'+relationships(q,contextYearId)+'</div>':'';
  const hint=!answer?'<span class="small muted">Select an option to check your answer instantly.</span>':'';
  const shareButton=btn(icon('share'),'share','ghost','data-id="'+q.id+'" aria-label="Share question"');
  const copyButton=btn(icon('copy'),'copy','ghost','data-id="'+q.id+'" aria-label="Copy question link"');
  const reportButton=btn(icon('flag'),'report','ghost','data-id="'+q.id+'" aria-label="Report question"');
  return templateMarkup('mcq-question-card-template',{
   QUESTION_ID:String(Number(q.id)||0),
   COMPACT_CLASS:compact?'mcq-card-compact':'',
   QUESTION_TAGS:questionTags(q),
   QUESTION_BOOKMARK:bookmark,
   QUESTION_NEXT_LINK:nextLink,
   QUESTION_LINK:link('mcq/'+q.id,e(q.question),'mcq-question-link'),
   QUESTION_OPTIONS:options,
   QUESTION_EXPLANATION:explanation,
   QUESTION_PRE_ANSWER_HINT:hint,
   QUESTION_SHARE_BUTTON:shareButton,
   QUESTION_COPY_BUTTON:copyButton,
   QUESTION_REPORT_BUTTON:reportButton
  })||('<article class="card mcq-card mcq-reference-card '+(compact?'mcq-card-compact':'')+'" data-question="'+q.id+'"><div class="mcq-top"><div class="mcq-question-label">'+questionTags(q)+'</div><div class="mcq-top-actions">'+bookmark+nextLink+'</div></div><div class="mcq-question-panel"><h2>'+link('mcq/'+q.id,e(q.question),'mcq-question-link')+'</h2></div><div class="options mcq-reference-options" role="group" aria-label="Answer options">'+options+'</div>'+explanation+'<div class="actions mcq-reference-actions">'+hint+'<span class="spacer"></span>'+shareButton+copyButton+reportButton+'</div></article>');
 }

 function countryLanding(type='login'){
  const countries=(MCQ.db.countries||[{name:'Pakistan',active:true},{name:'India',active:true}]).filter(item=>item&&item.active!==false&&String(item.name||'').trim());
  const title=type==='register'?'Choose your country to create an account':'Choose your country';
  const description=type==='register'?'Select your country to continue creating your MCQCampus learner account.':'Select your country to continue to your MCQCampus account.';
  const cards=countries.map(item=>{
   const name=String(item.name||'').trim();
   const label='<span class="country-choice-flag">'+UI.countryFlag(name)+'</span><span class="country-choice-copy"><strong>'+e(name)+'</strong><small>Continue '+(type==='register'?'to sign up':'to sign in')+'</small></span>'+icon('arrow');
   return link(type,label,'card country-choice-card',{country:name});
  }).join('');
  const body=UI.templateMarkup('mcq-country-landing-template',{COUNTRY_TITLE:e(title),COUNTRY_DESCRIPTION:e(description),COUNTRY_CARDS:cards||empty('No countries available','Please try again later.'),COUNTRY_BACK_LINK:link('home','Return to home','link')})||'';
  return UI.layout(body);
 }
 function mini(q,number=0){
  if(!q)return '';
  return questionCard(q,Math.max(1,Number(number)+1),true);
 }
 function quickCard(){
  const rows=MCQ.topMcqs(),total=rows.length,index=total?Math.max(0,Math.min(Number(App.homeQuickIndex||0),total-1)):0,q=rows[index];
  if(!q)return '<section class="hero-quick card">'+empty('No quick questions available yet','Explore all approved MCQs to start practising.',link('mcqs','Browse MCQs','btn primary'))+'</section>';
  return '<section class="hero-quick"><div class="hero-quick-heading"><p class="eyebrow">QUICK PRACTICE</p><span class="small muted">Question '+(index+1)+' of '+total+'</span></div>'+questionCard(q,index+1,true)+'</section>';
 }

 function home(){
  const server=activeServerMcqPage(),site=MCQ.db.siteCounts||{},pageSize=10,page=server?Math.max(1,Number(server.page)||1):1,rows=server?MCQ.publicMcqs():[],importantTotal=server?Number(server.total||0):Number(site.importantMcqs||0),cats=MCQ.sortPinned('categories',MCQ.db.categories.filter(c=>c.active!==false&&!c.legacy)).slice(0,7),categoryCounts=site.categoryMcqs||{};
  const heroActions=`<div class="home-hero-actions">${link('mcqs','Practice All MCQs '+icon('arrow'),'btn primary')}${link('important','Important MCQs','btn')}${link('papers','Browse Past Papers','btn')}</div>`;
  const activeOrganizations=MCQ.db.papers.filter(x=>x.active!==false&&(!fixedPublicCountry()||(x.country||MCQ.db.settings.country||'Pakistan')===fixedPublicCountry())),organizationIds=new Set(activeOrganizations.map(x=>Number(x.id))),activePastPapers=MCQ.db.years.filter(x=>x.active!==false&&organizationIds.has(Number(x.paper_id)||Number(MCQ.get('jobs',x.job_id)?.paper_id)||0)),activeCategories=MCQ.db.categories.filter(c=>c.active!==false&&!c.legacy&&(!fixedPublicCountry()||(c.country||'Both')==='Both'||(c.country||MCQ.db.settings.country||'Pakistan')===fixedPublicCountry()));
  const homeStats=[
   {title:'MCQs',value:Number(site.approvedMcqs||0),iconName:'book',tone:'primary',subtitle:'Approved practice questions',path:'mcqs'},
   {title:'Organizations / Boards / Agencies',value:activeOrganizations.length,iconName:'landmark',tone:'neutral',subtitle:'Exam organizations, boards and agencies',path:'papers'},
   {title:'Past Papers',value:activePastPapers.length,iconName:'paper',tone:'neutral',subtitle:'Past-paper records',path:'papers'},
   {title:'Categories',value:activeCategories.length,iconName:'grid',tone:'neutral',subtitle:'Preparation subjects',path:'categories'}
  ];
  const homeSeo=staticCopy('home','Practice smarter. Prepare with purpose.','Start with important MCQs, then explore past papers, categories and exam-focused preparation.');

   const importantList=rows.length?rows.map((q,i)=>questionCard(q,(page-1)*pageSize+i+1,true)).join(''):empty(server?'No important MCQs available yet':'Loading important MCQs…','Important MCQs are requested from the database 10 at a time.');
   const categoryList=cats.map(c=>'<div class="home-cat-group"><div class="home-cat-title">'+link('category/'+c.id,'<span class="home-cat-icon">'+UI.entityIcon(c,'grid')+'</span><span>'+e(c.name)+'</span>'+icon('arrow'))+'</div><div class="home-sub-list"><span class="home-sub-link">'+Number(categoryCounts[String(c.id)]||0).toLocaleString('en-GB')+' MCQs</span></div></div>').join('');
   const body=UI.templateMarkup('mcq-home-template',{
    HOME_TITLE:e(homeSeo.title),
    HOME_DESCRIPTION:e(homeSeo.desc),
    HOME_HERO_ACTIONS:heroActions,
    HOME_STATS:homeStats.map(x=>UI.statCard(x)).join(''),
    HOME_TOP_AD:UI.adSlot('home_top_ad'),
    HOME_IMPORTANT_COUNT:importantTotal.toLocaleString('en-GB'),
    HOME_IMPORTANT_LINK:link('mcqs','Browse all MCQs','link'),
    HOME_MCQ_LIST:importantList,
    HOME_PAGER:UI.pager(importantTotal,page,pageSize,App.route.params,'home'),
    HOME_CATEGORY_LIST:categoryList,
    HOME_ALL_CATEGORIES_LINK:link('categories','View all categories '+icon('arrow'),'btn home-cat-more'),
    HOME_MIDDLE_AD:UI.adSlot('home_middle_ad')
   });
   return UI.layout(body||'', 'home');
 }

 function browse(type,id){
  if(type==='subcategory'){
   const sub=MCQ.get('subcategories',id);if(!sub)return notFound();const cat=MCQ.get('categories',sub.category_id),server=activeServerMcqPage(),p=App.route.params,pageSize=10;
   const rows=server?MCQ.publicMcqs():MCQ.publicMcqs().filter(q=>MCQ.ids(q.subcategory_ids).some(x=>+x===+sub.id)),total=server?Number(server.total||0):rows.length,page=server?Math.max(1,Number(server.page)||1):App.page(total,pageSize);
   const children=MCQ.db.children.filter(x=>x.active!==false&&+x.subcategory_id===+sub.id).sort((a,b)=>a.name.localeCompare(b.name));
   const pre=children.length?`<div class="section-head"><div><p class="eyebrow">TOPICS</p><h2>Explore ${e(sub.name)}</h2></div></div><div class="chips">${children.map(x=>link('topic/'+x.id,e(x.name),'chip')).join('')}</div>`:'';
   const shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
   const main=`<p class="small muted result-count">${total.toLocaleString('en-GB')} MCQs in ${e(sub.name)} · 10 per page</p>${shown.length?shown.map((q,i)=>questionCard(q,(page-1)*pageSize+i+1)).join(''):empty(server?'No MCQs in this subcategory yet':'Loading MCQs…','Choose a related topic or browse the parent category.',cat?link('category/'+cat.id,'Browse '+e(cat.name),'btn primary'):link('categories','Browse categories','btn primary'))}${UI.pager(total,page,pageSize,p,'subcategory/'+sub.id)}`;
   return PublicLayout.page({trail:[['Categories','categories'],...(cat?[[cat.name,'category/'+cat.id]]:[]),[sub.name]],title:sub.name,desc:'Practice approved '+sub.name+' MCQs with answers and explanations.',pre,main,sidebar:PublicLayout.smart('category',{record:sub,type:'subcategory'}),active:'categories',sidebarLabel:'Related / Browse'});
  }
  if(type==='category'){
   const cat=MCQ.get('categories',id);if(!cat)return notFound();const server=activeServerMcqPage(),p=App.route.params,pageSize=10,rows=server?MCQ.publicMcqs():MCQ.publicMcqs().filter(q=>+q.category_id===+cat.id),total=server?Number(server.total||0):rows.length,page=server?Math.max(1,Number(server.page)||1):App.page(total,pageSize);
   const subs=MCQ.db.subcategories.filter(x=>x.active!==false&&+x.category_id===+cat.id).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
   const pre=subs.length?`<section class="card seo-related-block"><div class="section-head"><div><p class="eyebrow">EXPLORE TOPICS</p><h2>${e(cat.name)} Subcategories</h2></div></div><div class="chips">${subs.map(x=>link('subcategory/'+x.id,e(x.name),'chip')).join('')}</div></section>`:'';
   const shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
   const main=`<p class="small muted result-count">${total.toLocaleString('en-GB')} MCQs in ${e(cat.name)} · 10 per page</p>${shown.length?shown.map((q,i)=>questionCard(q,(page-1)*pageSize+i+1)).join(''):empty(server?'No MCQs in this category yet':'Loading MCQs…','Choose a subcategory or browse all MCQs.',link('mcqs','Browse all MCQs','btn primary'))}${UI.pager(total,page,pageSize,p,'category/'+cat.id)}`;
   const copy=pageCopy('category',cat.id,cat.name+' MCQs','Practice '+cat.name+' MCQs with correct answers and explanations, and explore related subcategories.');
   return PublicLayout.page({trail:[['Categories','categories'],[cat.name]],title:copy.title,desc:copy.desc,pre,main,sidebar:PublicLayout.smart('category',{record:cat,type:'category'}),active:'categories',sidebarLabel:'Related / Browse'});
  }
  const map={categories:['categories','All categories','Choose a category to open its MCQ collection.'],papers:['papers','Organizations / Boards','Browse organizations and boards, then choose a Past Paper.'],paper:['years','Past Papers','Select a past paper to practise its linked MCQs.']};
  const conf=map[type];if(!conf)return notFound();let [collection,title,desc]=conf;
  let rows=MCQ.db[collection].filter(x=>x.active!==false&&(collection!=='categories'||!x.legacy)),trail=[],name=title,parent;
  const params=App.route.params,lockedCountry=fixedPublicCountry(),country=lockedCountry||'';
  if(id){
   if(type!=='paper')return notFound();
   parent=MCQ.get('papers',id);if(!parent)return notFound();
   name=parent.name;
   rows=rows.filter(x=>(Number(x.paper_id)||Number(MCQ.get('jobs',x.job_id)?.paper_id)||0)===Number(parent.id));
   trail=[['Past Papers','papers']];
   const displayName=String(parent.name||'').replace(/[\\[\\]()]+/g,' ').replace(/\\s+/g,' ').trim();
   title=displayName+' Past Papers';
   desc='Browse '+displayName+' past papers and select an exam year to practise linked MCQs with correct answers and explanations.';
  }
  if(type==='papers'&&country)rows=rows.filter(x=>(x.country||MCQ.db.settings.country||'Pakistan')===country);
  if(type==='categories'&&country)rows=rows.filter(x=>(x.country||'Both')==='Both'||(x.country||MCQ.db.settings.country||'Pakistan')===country);
  rows=['categories','papers','years'].includes(collection)?MCQ.sortPinned(collection,rows):[...rows].sort((a,b)=>a.name.localeCompare(b.name));
  let page=App.page(rows.length);
  let pre='';
  if(type==='paper'&&parent){
   const short=window.SEO&&SEO.shortName?SEO.shortName(parent.name):String(parent.name||'').replace(/[\\[\\]()]+/g,' ').replace(/\\s+/g,' ').trim();
   pre+=`<section class="card seo-related-block"><div class="section-head"><div><p class="eyebrow">EXAM PREPARATION</p><h2>${e(short)} Past Papers</h2></div></div><p>Choose the exact past-paper year, practise its linked MCQs, review answers and explanations, and continue with Important MCQs or subject categories.</p><div class="chips">${link('important','Important MCQs','chip')}${link('categories','Browse MCQ Categories','chip')}${link('pdfs','Preparation PDFs','chip')}</div></section>`;
  }
  const entityServer=activeEntityPage(),useServer=!!(entityServer&&entityServer.type===collection),pageSize=['papers','categories','years'].includes(collection)?12:10,total=useServer?Number(entityServer.total||0):rows.length;
  if(useServer){rows=Array.isArray(entityServer.items)?entityServer.items:[];page=Math.max(1,Number(entityServer.page)||1)}
  const shown=useServer?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const main=`${UI.adSlot('public_page_top')}<p class="small muted result-count">${total.toLocaleString('en-GB')} ${collection==='years'?'past-paper records':collection} · ${pageSize} per page</p>${shown.length?`<div class="grid ${['papers','years'].includes(collection)?'paper-grid':''}">${shown.map((x,i)=>card(collection,x,(page-1)*pageSize+i)).join('')}</div>${UI.pager(total,page,pageSize,params)}`:empty(type==='papers'&&country?'No organizations or past papers for '+country:'No records available here','Try another section or return to the previous page.',type==='papers'?link('papers','Browse organizations / boards','btn primary'):link('categories','Browse categories','btn primary'))}`;
  let finalTitle=typeof title==='string'&&title!==conf?.[1]?title:name,finalDesc=desc;
  if(type==='paper'&&parent){const copy=pageCopy('paper',parent.id,finalTitle,finalDesc);finalTitle=copy.title;finalDesc=copy.desc}
  else if(type==='papers'){const copy=staticCopy('past-papers',finalTitle,finalDesc);finalTitle=copy.title;finalDesc=copy.desc}
  else if(type==='categories'){const copy=staticCopy('categories',finalTitle,finalDesc);finalTitle=copy.title;finalDesc=copy.desc}
  return PublicLayout.page({trail:[...trail,[name]],title:finalTitle,desc:finalDesc,pre,main,sidebar:PublicLayout.smart('papers',{parent,record:parent,type}),active:'papers',sidebarLabel:'Related / Browse'});
 }
  function searchResults(){
  const p=App.route.params,q=String(p.q||'').trim(),wanted=String(p.type||'all');const results=[];
  const add=(type,label,path,title,summary,text,record=null)=>{if(!q||MCQ.norm(text||title).includes(MCQ.norm(q)))results.push({type,label,path,title,summary,record})};
  if(q){
   MCQ.publicMcqs().forEach(x=>add('mcq','MCQ','mcq/'+x.id,x.question,MCQ.get('categories',x.category_id)?.name||'Practice question',x.question+' '+[1,2,3,4].map(i=>x['option'+i]).join(' ')+' '+(x.description||''),x));
   MCQ.db.categories.filter(x=>x.active!==false&&!x.legacy).forEach(x=>add('category','Category','category/'+x.id,x.name,'Browse category',x.name,x));
   MCQ.db.papers.filter(x=>x.active!==false).forEach(x=>add('paper','Past Paper / Exam','paper/'+x.id,x.name,x.country||'Past paper organization',x.name+' '+(x.country||''),x));
   MCQ.db.years.filter(x=>x.active!==false).forEach(x=>{const pa=MCQ.get('papers',x.paper_id)||MCQ.get('papers',MCQ.get('jobs',x.job_id)?.paper_id);add('year','Past Paper',yearPath(x),((pa?.name||'')+' · '+x.name).trim(),pa?.name||'Past Paper',x.name+' '+(pa?.name||''),x)});
   (MCQ.db.pdfs||[]).filter(x=>x.active!==false).forEach(x=>add('pdf','PDF',window.SEO?SEO.cleanPath('pdf',x.id):'pdfs',x.title||x.name||'PDF resource',x.description||'PDF resource',(x.title||x.name||'')+' '+(x.description||''),x));
   (MCQ.db.posts||[]).filter(x=>x.published!==false).forEach(x=>add('post','Blog','post/'+x.id,x.title,x.excerpt||'MCQ Campus update',(x.title||'')+' '+(x.excerpt||'')+' '+(x.body||'')+' '+(x.category||''),x));
   (MCQ.db.latestJobs||[]).filter(x=>x.published!==false).forEach(x=>{const org=MCQ.get('papers',x.paper_id);add('latestjob','Latest Job',window.SEO?SEO.cleanPath('latest-job',x.id):'latest-jobs',x.title||'Job opportunity',(org?.name||'')+' · Last date '+(x.last_date||''),(x.title||'')+' '+(org?.name||'')+' '+(x.last_date||''),x)});
  }
  const types=[...new Set(results.map(x=>x.type))],filtered=wanted==='all'?results:results.filter(x=>x.type===wanted),pageSize=12,page=App.page(filtered.length,pageSize);
  const labels={mcq:'MCQs',category:'Categories',paper:'Organizations / Boards',year:'Past Papers',job:'Organizations / Boards',pdf:'PDFs',post:'Blog',latestjob:'Latest Jobs'};
  const typeBar=q&&types.length?PublicLayout.selectionBar([{label:'All',path:'search',params:{q},active:wanted==='all'},...types.map(t=>({label:labels[t]||t,path:'search',params:{q,type:t},active:wanted===t}))],'Search result types','search-type-selection'):'';
  const pre=typeBar;
  const cards=filtered.slice((page-1)*pageSize,page*pageSize).map((x,i)=>{
   if(x.type==='mcq')return x.record?questionCard(x.record,(page-1)*pageSize+i+1,true):'';
   if(x.type==='paper'&&x.record)return UI.card('papers',x.record,i);
   if(x.type==='job'&&x.record)return UI.card('jobs',x.record,i);
   if(x.type==='year'&&x.record)return UI.card('years',x.record,i);
   if(x.type==='category'&&x.record)return UI.card('categories',x.record,i);
   if(x.type==='pdf'&&x.record)return pdfResourceCard(x.record);
   if(x.type==='post'&&x.record)return blogPostCard(x.record);
   if(x.type==='latestjob'&&x.record)return latestJobCard(x.record);
   return link(x.path,`<span class="badge">${e(x.label)}</span><h2>${e(x.title)}</h2><p>${e(x.summary||'')}</p><div class="card-foot"><span>Open ${e(x.label.toLowerCase())}</span>${icon('arrow')}</div>`,'card search-result-card clickable');
  }).join('');
  const main=!q?empty('Search MCQ Campus','Use the search bar in the header to find MCQs, organizations, past papers, categories, PDFs, latest jobs and blog posts.'):filtered.length?`<p class="small muted result-count">${filtered.length} matching result${filtered.length===1?'':'s'}</p><div class="search-results-list">${cards}</div>${UI.pager(filtered.length,page,pageSize,p,'search')}`:empty('No matching results','Try a shorter or different search phrase.',link('search','Clear search','btn primary'));
  return PublicLayout.page({trail:[['Search']],title:q?'Search results for “'+q+'”':'Search MCQ Campus',desc:'Search public preparation content directly. Result types keep the same design used on their main public pages.',pre,main,sidebar:PublicLayout.smart('search'),sidebarLabel:'Related / Browse'});
 }
 function listing(type,id){
  if(type==='search')return searchResults();
  const server=activeServerMcqPage(),routeParams=App.route.params,fixedCountry=fixedPublicCountry(),p=fixedCountry?{page:routeParams.page,country:fixedCountry}:{page:routeParams.page},site=MCQ.db.siteCounts||{},pageSize=10;
  let rows=server?MCQ.publicMcqs():MCQ.publicMcqs(),title=type==='important'?'Important MCQs':'Practice MCQs',desc='Browse approved practice MCQs with correct answers and explanations.',trail=[['MCQs']],record;let listHeader='';
  if(type==='mcqs'){const copy=staticCopy('mcqs',title,desc);title=copy.title;desc=copy.desc}
  if(type==='topic'){
   record=MCQ.get('children',id);if(!record)return notFound();const su=MCQ.get('subcategories',record.subcategory_id),ca=su&&MCQ.get('categories',su.category_id);
   if(!server)rows=rows.filter(q=>MCQ.ids(q.child_subcategory_ids).includes(+id));title=record.name+' MCQs';desc='Practice '+record.name+' MCQs with correct answers and explanations.';
   trail=[['Categories','categories'],...(ca?[[ca.name,'category/'+ca.id]]:[]),...(su?[[su.name,'subcategory/'+su.id]]:[]),[record.name]];
  }
  if(type==='year'){
    record=MCQ.get('years',id);if(!record)return notFound();
    const paperId=Number(record.paper_id)||Number(MCQ.get('jobs',record.job_id)?.paper_id)||0,pa=MCQ.get('papers',paperId);
    if(!pa)return notFound();
    title=pa.name+' '+record.name;
    desc='Practice '+pa.name+' '+record.name+' MCQs with correct answers and explanations.';
    const copy=pageCopy('year',record.id,title,desc);title=copy.title;desc=copy.desc;
    if(!server)rows=rows.filter(q=>MCQ.ids(q.job_years_ids).includes(+id));
    trail=[['Past Papers','papers'],[pa.name,window.SEO?SEO.cleanPath('paper',pa.id):'paper/'+pa.id],[record.name,yearPath(record)]];
    listHeader=`<section class="card seo-related-block"><p class="eyebrow">PAST PAPER</p><h2>${e(title)}</h2><p class="small muted">${e(desc)}</p></section>${btn(icon('bookmark')+' '+(MCQ.db.savedPapers.includes(+id)?'Remove saved paper':'Save paper'),'save-paper','',`data-id="${id}"`)}`
   }
   const view=type==='important'?'important':(p.view||'all');
  if(!server){
   if(view==='important')rows=rows.filter(q=>MCQ.isImportant(q));
   if(view==='repeated')rows=rows.filter(q=>MCQ.ids(q.job_years_ids).length>=2);
   if(view==='latest')rows=[...rows].sort((a,b)=>(String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||''))||b.id-a.id));
   if(p.category)rows=rows.filter(q=>+q.category_id===+p.category);
   if(p.paper)rows=rows.filter(q=>MCQ.ids(q.paper_id).includes(+p.paper));
   if(p.job)rows=rows.filter(q=>MCQ.ids(q.job_ids).includes(+p.job));
   if(p.year)rows=rows.filter(q=>MCQ.ids(q.job_years_ids).includes(+p.year));
   if(p.country)rows=rows.filter(q=>questionCountry(q)===p.country);
  }
  const total=server?Number(server.total||0):rows.length,page=server?Math.max(1,Number(server.page)||1):App.page(total,pageSize),shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
  let pre='';
  const label=view==='important'?'important MCQs':view==='repeated'?'repeated MCQs':'MCQs';
  const main=`${listHeader}${UI.adSlot('mcq_top_ad')}<p class="small muted mcq-count">${total.toLocaleString('en-GB')} total ${label} · only 10 load per page</p>${shown.length?shown.map((q,i)=>`${questionCard(q,(page-1)*pageSize+i+1,false,type==='year'?+id:null)}${i===4?UI.adSlot('mcq_inline_ad'):''}`).join(''):empty(server?(view==='repeated'?'No repeated MCQs found':'No MCQs found for this selection.'):'Loading MCQs…','Choose another option or browse all MCQs.',link('mcqs','Browse All MCQs','btn primary'))}${UI.adSlot('mcq_bottom_ad')}${UI.pager(total,page,pageSize,p,App.route.path)}`;
  let sidebarKind='mcqs',ctx={};if(type==='year'){sidebarKind='papers';ctx={parent:record,type}};
  return PublicLayout.page({trail,title,desc,pre,main,sidebar:PublicLayout.smart(sidebarKind,ctx),active:type==='year'?'papers':'mcqs',sidebarLabel:'Related / Browse'});
 }
 function practice(id){
  const q=MCQ.publicMcqs().find(x=>x.id===+id);if(!q)return notFound();MCQ.recent(id);const rows=MCQ.publicMcqs(),i=rows.indexOf(q);const cat=MCQ.get('categories',q.category_id);
  const main=`${questionCard(q,i+1)}<div class="actions practice-nav">${i?link('practice/'+rows[i-1].id,'← Previous','btn'):''}<span class="spacer"></span><span class="spacer"></span>${i<rows.length-1?link('practice/'+rows[i+1].id,'Next question '+icon('arrow'),'btn primary'):link('dashboard','View progress','btn primary')}</div>`;
  return PublicLayout.page({trail:[['MCQs','mcqs'],['Practice Question '+id]],title:'Practice MCQ',desc:(cat?.name?cat.name+' · ':'')+'Focus on the answer and explanation, then continue your practice.',main,sidebar:PublicLayout.smart('mcq-detail',{question:q}),active:'mcqs',sidebarLabel:'Browse / Related'});
 }
 function posts(id){
  const safeUrl=u=>/^(https?:\/\/|#\/)/i.test(String(u||''));const all=(MCQ.db.posts||[]).filter(x=>x.published!==false);
  if(id){const post=all.find(x=>+x.id===+id);if(!post)return notFound();const postTitle=post.seo_title||post.title,postDesc=post.seo_description||post.excerpt||'MCQ Campus blog post',seenLinks=new Set(),links=(post.links||[]).filter(x=>x.label!=='__blog_url').filter(x=>safeUrl(x.url)).filter(x=>{const key=String(x.url||'').trim().replace(/\/+$/,'').toLowerCase();if(!key||seenLinks.has(key))return false;seenLinks.add(key);return true});const main=`<article class="article public-article"><p class="eyebrow">BLOG</p>${post.featured_image?`<div class="article-hero-image"><img src="${e(post.featured_image)}" alt=""></div>`:''}${post.excerpt?`<p class="post-lead">${e(post.excerpt)}</p>`:''}${String(post.body||'').split(/\n\n+/).filter(Boolean).map(t=>`<p>${e(t)}</p>`).join('')}${UI.adSlot('article_ad')}${links.length?`<div class="post-links"><h3>Useful links</h3><div class="post-links-list">${links.map((x,i)=>`<a class="btn post-link-row" href="${e(x.url)}" ${/^https?:/i.test(x.url)?'target="_blank" rel="noopener"':''}><span class="post-link-index">${i+1}</span><span>${e(x.label||x.url)}</span>${icon('arrow')}</a>`).join('')}</div></div>`:''}<div class="post-practice-cta">${link('mcqs','Practice MCQs '+icon('arrow'),'btn primary')} ${link('important','Important MCQs','btn')}</div></article>`;return PublicLayout.page({trail:[['Blog','posts'],[post.title]],title:postTitle,desc:postDesc,main,sidebar:PublicLayout.smart('articles',{subtype:'posts'}),active:'posts',sidebarLabel:'Related / Browse'});}
  const p=App.route.params,category=String(p.category||''),categories=[...new Set(all.map(x=>x.category).filter(Boolean))];let rows=[...all].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));if(category)rows=rows.filter(x=>x.category===category);const pageSize=10,page=App.page(rows.length,pageSize);
  const pre=PublicLayout.selectionBar([{label:'All',path:'posts',params:{},active:!category},...categories.map(x=>({label:x,path:'posts',params:{category:x},active:category===x}))],'Update categories');
  const main=rows.length?`<div class="content-showcase-grid">${rows.slice((page-1)*pageSize,page*pageSize).map(blogPostCard).join('')}</div>${UI.pager(rows.length,page,pageSize,p,'posts')}`:empty('No updates in this section','Choose another update category.',link('posts','View all updates','btn primary'));
  const copy=staticCopy('blog','Blog','Preparation articles, exam information and useful learning resources.');
  return PublicLayout.page({trail:[['Blog']],title:copy.title,desc:copy.desc,pre,main,sidebar:PublicLayout.smart('articles',{subtype:'posts'}),active:'posts',sidebarLabel:'Related / Browse'});
 }
 function dashboard(view='overview'){
  const d=MCQ.db,s=d.session;
  if(view==='profile')view='settings';const allowedViews=['overview','practice','important','mistakes','saved','papers','tests','performance','history','notifications','downloads','settings'];
  if(!allowedViews.includes(view))view='overview';
  const attempts=(d.attempts||[]).slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))),publicMcqs=MCQ.publicMcqs(),correct=attempts.filter(x=>x.correct).length,wrong=attempts.length-correct,accuracy=attempts.length?Math.round(correct/attempts.length*100):0;
  const uniqueAttempts=[...new Set(attempts.map(a=>+a.id))],attemptedSet=new Set(uniqueAttempts);
  const savedMcqs=(d.bookmarks||[]).map(id=>MCQ.get('mcqs',id)).filter(Boolean);
  const mistakes=[];for(const a of attempts){if(a.correct||mistakes.some(x=>x.id===+a.id))continue;const q=MCQ.get('mcqs',a.id);if(q)mistakes.push(q)}
  const categoryStats=d.categories.map(cat=>{const rows=attempts.filter(a=>MCQ.get('mcqs',a.id)?.category_id===cat.id),ok=rows.filter(a=>a.correct).length;return {cat,total:rows.length,correct:ok,wrong:rows.length-ok,accuracy:rows.length?Math.round(ok/rows.length*100):0}}).filter(x=>x.total);
  const weak=categoryStats.filter(x=>x.total>=3).sort((a,b)=>a.accuracy-b.accuracy||b.total-a.total).slice(0,4);
  const recentAttempt=attempts[0],recentQ=recentAttempt&&MCQ.get('mcqs',recentAttempt.id);
  const avatar=s?.avatar?`<img class="profile-photo" src="${e(s.avatar)}" alt="">`:`<span class="avatar">${e((s?.name||'Learner').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`;
  const nav=[
   ['overview','Dashboard','grid'],['practice','Practice MCQs','book'],['important','Important MCQs','flag'],['mistakes','My Mistakes','flag'],['saved','Bookmarks / Saved MCQs','bookmark'],['papers','Past Papers','paper'],
   ['tests','My Tests / Results','check'],['performance','My Performance','grid'],['history','Practice History','history'],['notifications','Notifications','bell'],['downloads','My Downloads','download'],['settings','Settings','settings']
  ];
  const side=`<aside class="learner-side card" id="learner-sidebar"><div class="learner-side-head"><strong>My Learning</strong><span class="small muted">Personal preparation center</span></div><nav>${nav.map(([id,label,ic])=>link('dashboard/'+id,`${icon(ic)}<span>${label}</span>`,view===id?'active':'' )).join('')}</nav></aside>`;
  const summary=`<div class="learner-metrics">${[
   {title:'MCQs Attempted',value:attempts.length,iconName:'book',tone:'info',subtitle:'Practice history',path:'dashboard/history'},
   {title:'Correct',value:correct,iconName:'check',tone:'success',subtitle:'Correct answers',path:'dashboard/performance'},
   {title:'Wrong',value:wrong,iconName:'close',tone:'danger',subtitle:'Needs review',path:'dashboard/mistakes'},
   {title:'Accuracy',value:accuracy+'%',iconName:'chart',tone:'primary',subtitle:'Overall accuracy',path:'dashboard/performance'},
   {title:'Saved MCQs',value:savedMcqs.length,iconName:'bookmark',tone:'neutral',subtitle:'Bookmarked questions',path:'dashboard/saved'},
   {title:'Saved Papers',value:(d.savedPapers||[]).length,iconName:'paper',tone:'warning',subtitle:'Saved for later',path:'dashboard/papers'}
  ].map(UI.statCard).join('')}</div>`;
  const quick=`<div class="learner-quick-actions">${link('mcqs','Practice MCQs','btn primary')}${link('papers','Attempt Past Paper','btn')}${link('dashboard/mistakes','Review Mistakes','btn')}</div>`;
  let body='';
  if(view==='overview'){
   const recentActivities=attempts.slice(0,5).map(a=>{const q=MCQ.get('mcqs',a.id),cat=MCQ.get('categories',q?.category_id);return `<div class="learner-activity-row"><span class="status-dot ${a.correct?'ok':'bad'}"></span><div><strong>${e(q?.question||'MCQ attempt')}</strong><span>${e(cat?.name||'Practice')} · ${a.correct?'Correct':'Incorrect'} · ${UI.date(a.at)}</span></div></div>`}).join('');
   body=`${summary}<section class="card learner-continue"><div><p class="eyebrow">CONTINUE PREPARATION</p><h2>${recentQ?e(recentQ.question):'Start your first preparation session.'}</h2><p class="small muted">${recentQ?'Return to your most recently attempted question and keep practising.':'Choose any category or past paper to begin tracking your progress.'}</p></div>${recentQ?link('practice/'+recentQ.id,'Continue Preparation '+icon('arrow'),'btn primary'):link('mcqs','Start practising '+icon('arrow'),'btn primary')}</section>${quick}<div class="learner-home-grid"><section class="card"><div class="section-head"><div><p class="eyebrow">WEEKLY / OVERALL PROGRESS</p><h2>Category progress</h2></div>${link('dashboard/performance','Full performance','link')}</div>${categoryStats.slice(0,6).map(x=>`<div class="bar-row"><div class="row"><span>${e(x.cat.name)}</span><span>${x.correct} / ${x.total} · ${x.accuracy}%</span></div><div class="progress-track"><span style="width:${x.accuracy}%"></span></div></div>`).join('')||empty('No activity yet','Your subject progress appears after you answer MCQs.')}</section><section class="card"><div class="section-head"><div><p class="eyebrow">WEAK AREAS</p><h2>Needs more practice</h2></div></div>${weak.length?weak.map(x=>`<div class="weak-row"><span>${e(x.cat.name)}</span><strong>${x.accuracy}%</strong></div>`).join('')+link('dashboard/mistakes','Practice weak areas','btn sm'):empty('No weak areas yet','Answer at least 3 questions in a category before it is evaluated.')}</section><section class="card"><div class="section-head"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>Latest practice</h2></div>${link('dashboard/history','View history','link')}</div>${recentActivities||empty('No recent activity','Your preparation history will appear here.')}</section></div>`;
  }
  if(view==='practice'){
   const unattempted=publicMcqs.filter(q=>!attemptedSet.has(q.id)).slice(0,20);
   body=`${heading('Practice MCQs','Choose where to continue your preparation.')}${quick}<div class="card"><h2>Unattempted MCQs</h2>${unattempted.length?unattempted.map((q,i)=>mini(q,i)).join(''):empty('You have explored every available MCQ','Revisit your mistakes or try random practice.')}</div>`;
  }
  if(view==='important'){const rows=publicMcqs.filter(q=>MCQ.isImportant(q));body=`${heading('Important MCQs','High-priority questions selected by the content team.')}${rows.length?rows.slice(0,30).map((q,i)=>mini(q,i)).join(''):empty('No important MCQs available','Check again when important questions are published.')}`}
  if(view==='mistakes')body=`${heading('My Mistakes','Questions you answered incorrectly. Retry them until they become strengths.')}${mistakes.length?mistakes.map((q,i)=>mini(q,i)).join(''):empty('No mistakes to review','Incorrect answers will appear here automatically.',link('mcqs','Practice MCQs','btn primary'))}`;
  if(view==='saved')body=`${heading('Saved MCQs','Your bookmarked revision list.')}${savedMcqs.length?savedMcqs.map((q,i)=>mini(q,i)).join(''):empty('No saved MCQs yet','Bookmark questions while practising to keep them here.',link('mcqs','Browse MCQs','btn primary'))}`;
  if(view==='papers'){const rows=(d.savedPapers||[]).map(id=>MCQ.get('papers',id)||MCQ.get('years',id)).filter(Boolean);body=`${heading('Past Papers','Saved papers and paper-based preparation.')}${rows.length?`<div class="grid paper-grid">${rows.map((x,i)=>card(MCQ.get('papers',x.id)?'papers':'years',x,i)).join('')}</div>`:empty('No saved papers yet','Browse past papers and save the ones you want to revisit.',link('papers','Explore papers','btn primary'))}`}
  if(view==='tests'){
   const testsTaken=Number(s?.testsTaken||0),last=s?.lastTestSummary;
   body=`${heading('My Tests / Results','Your test activity and latest result summary.')}${testsTaken?`<div class="learner-metrics profile-test-metrics">${[{title:'Tests Taken',value:testsTaken,iconName:'check',tone:'primary',subtitle:'Completed tests',path:'tests'},{title:'Latest Score',value:last?last.correct+' / '+last.total:'—',iconName:'chart',tone:'success',subtitle:last?Math.round((last.correct/Math.max(1,last.total))*100)+'% accuracy':'Take a test to see results',path:'tests'}].map(UI.statCard).join('')}</div>`:empty('No tests taken yet','Complete a test and your results will appear here.',link('tests','Browse Tests','btn primary'))}`;
  }
  if(view==='performance'){
   body=`${heading('My Performance','Learner-specific analytics from your actual attempts.')}${summary}<div class="card"><h2>Category performance</h2>${categoryStats.length?`<div class="table-wrap"><table><thead><tr><th>Category</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Accuracy</th></tr></thead><tbody>${categoryStats.map(x=>`<tr><td>${e(x.cat.name)}</td><td>${x.total}</td><td>${x.correct}</td><td>${x.wrong}</td><td>${x.accuracy}%</td></tr>`).join('')}</tbody></table></div>`:empty('No performance data yet','Answer MCQs to build your performance report.')}</div>`;
  }
  if(view==='history'){
   body=`${heading('Practice History','Your latest MCQ attempts, newest first.')}${attempts.length?`<div class="card table-wrap"><table><thead><tr><th>Date</th><th>Question</th><th>Category</th><th>Result</th><th>Action</th></tr></thead><tbody>${attempts.slice(0,100).map(a=>{const q=MCQ.get('mcqs',a.id),cat=MCQ.get('categories',q?.category_id);return `<tr><td>${UI.date(a.at)}</td><td>${e(q?.question||'Question')}</td><td>${e(cat?.name||'—')}</td><td><span class="badge ${a.correct?'approved':'rejected'}">${a.correct?'Correct':'Wrong'}</span></td><td>${q?link('practice/'+q.id,'Retry','link'):''}</td></tr>`}).join('')}</tbody></table></div>`:empty('No practice history yet','Your preparation history will appear here.')}`;
  }
  if(view==='notifications')body=`${heading('Notifications','Updates relevant to your account and preparation.')}${empty('No notifications','The current backend has no learner-notification model yet, so this page intentionally does not show fake alerts.')}`;
  if(view==='downloads'){
   const rows=(d.pdfs||[]).filter(x=>MCQ.ids(x.authorized_user_ids).includes(s?.id));
   body=`${heading('My Downloads','Resources your account is authorized to download.')}${rows.length?`<div class="grid pdf-grid">${rows.map(x=>`<div class="card"><h3>${e(x.title||x.name)}</h3><p class="small muted">Authorized resource</p></div>`).join('')}</div>`:empty('No downloads available yet.','Purchased or assigned PDFs will appear here when the backend grants access.')}`;
  }
  if(view==='settings')body=profileForm();
  return UI.layout(UI.templateMarkup('mcq-learner-dashboard-template',{LEARNER_MENU_ICON:icon('menu'),LEARNER_SIDE:side,LEARNER_AVATAR:avatar,LEARNER_NAME:e(s?.name||'learner'),LEARNER_BODY:body})||('<div class="container page learner-dashboard-shell"><div class="learner-mobile-head"><button class="btn ghost" type="button" data-action="learner-sidebar-toggle">'+icon('menu')+' Learning menu</button></div><div class="learner-shell">'+side+'<main class="learner-content"><div class="profile-band compact-profile-band">'+avatar+'<div><p class="eyebrow">YOUR LEARNING SPACE</p><h2>Welcome back, '+e(s?.name||'learner')+'</h2><span class="small muted">Practice, review mistakes, explore past papers, and track progress.</span></div></div>'+body+'</main></div></div>'));
 }
 function profileForm(){
  const s=MCQ.db.session;if(!s)return `<div class="card">${heading('Profile','Sign in to manage your profile.')} ${link('login','Log in','btn primary')}</div>`;
  const attempts=(MCQ.db.attempts||[]).filter(a=>!a.by_id||+a.by_id===+s.id),correct=attempts.filter(a=>a.correct).length,accuracy=attempts.length?Math.round(correct/attempts.length*100):0;
  const dates=[...new Set(attempts.map(a=>String(a.at||'').slice(0,10)).filter(Boolean))].sort().reverse();let streak=0;if(dates.length){let cursor=new Date();cursor.setHours(0,0,0,0);const latest=new Date(dates[0]+'T00:00:00');const gap=Math.round((cursor-latest)/86400000);if(gap<=1){cursor=latest;for(const d of dates){const dt=new Date(d+'T00:00:00');if(Math.round((cursor-dt)/86400000)===0){streak++;cursor=new Date(cursor.getTime()-86400000)}else break}}}
  const avatar=s.avatar?`<img class="profile-photo" src="${e(s.avatar)}" alt="Current profile photo">`:`<span class="profile-photo profile-photo-fallback">${e((s.name||'U').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`;
  const goals=['PPSC','FPSC','NTS','CSS','PMS','Other'],interests=['Pakistan Affairs','Current Affairs','General Knowledge','Computer Science','English','Mathematics','Everyday Science','Islamic Studies'],selected=new Set(Array.isArray(s.interests)?s.interests:[]);
  const snapshot=`<div class="profile-learning-snapshot">${[{title:'Questions Attempted',value:attempts.length,iconName:'book',tone:'info',subtitle:'Practice history',path:'dashboard/history'},{title:'Accuracy',value:accuracy+'%',iconName:'chart',tone:'success',subtitle:'Overall accuracy',path:'dashboard/performance'},{title:'Tests Taken',value:Number(s.testsTaken||0),iconName:'check',tone:'primary',subtitle:'Completed tests',path:'dashboard/tests'},{title:'Current Streak',value:'🔥 '+streak,iconName:'history',tone:'warning',subtitle:'Day streak',path:'dashboard/history'}].map(UI.statCard).join('')}</div>`;
  return `<div class="learner-profile-page"><section class="card profile-header-card"><div class="profile-photo-row">${avatar}<div class="profile-header-copy"><p class="eyebrow">LEARNER PROFILE</p><h2>${e(s.name||'Learner')}</h2><p>${e(s.email||'')}</p><label class="btn sm" for="profile-image">Change photo</label><input class="visually-hidden" id="profile-image" type="file" accept="image/png,image/jpeg,image/webp"></div></div></section>${snapshot}<form data-form="profile" class="profile-sections"><section class="card"><div class="section-head"><div><p class="eyebrow">PERSONAL INFORMATION</p><h2>About your preparation</h2></div></div><div class="form-grid">${field('name','Full name',s.name||'','text',true)}${field('email','Email',s.email||'','email',true)}${select('country','Country',[{id:'Pakistan',name:'Pakistan'},{id:'India',name:'India'},{id:'Other',name:'Other'}],s.country||'Pakistan',true)}${select('exam_goal','Preferred Exam / Preparation Goal',goals.map(x=>({id:x,name:x})),s.exam_goal||'PPSC',true)}</div><div class="field full"><span>Preparation Interests</span><div class="profile-interest-grid">${interests.map(x=>`<label class="interest-choice"><input type="checkbox" name="interests" value="${e(x)}" ${selected.has(x)?'checked':''}><span>${e(x)}</span></label>`).join('')}</div></div></section><section class="card"><div class="section-head"><div><p class="eyebrow">PREFERENCES</p><h2>Learning preferences</h2></div></div><div class="form-grid profile-preferences-grid">${select('daily_goal','Daily MCQ Goal',[10,25,50,100].map(x=>({id:String(x),name:x+' MCQs'})),String(s.daily_goal||25),true)}</div></section><div class="profile-save-row"><button class="btn primary" type="submit">Save profile</button></div></form><section class="card profile-security-card"><div class="section-head"><div><p class="eyebrow">ACCOUNT & SECURITY</p><h2>Password & security</h2></div></div><p class="small muted">For your security, password changes require your current password and a 6-digit email verification code.</p><button class="btn primary" type="button" data-password-change-open>Change password</button></section><section class="card danger-zone"><div><p class="eyebrow">DANGER ZONE</p><h2>Delete account</h2><p class="small muted">Account deletion requests should be handled through support so server data is not removed accidentally.</p></div>${link('contact','Contact support','btn danger')}</section></div>`;
 } function managedPageContent(value){
  const strong=x=>e(x).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>'),lines=String(value||'').replace(/\r/g,'').split('\n'),out=[];let items=[];
  const flush=()=>{if(items.length){out.push('<ul>'+items.map(x=>'<li>'+strong(x)+'</li>').join('')+'</ul>');items=[]}};
  for(const raw of lines){const line=raw.trim();if(!line){flush();continue}if(line.startsWith('- ')){items.push(line.slice(2));continue}flush();if(line.startsWith('### '))out.push('<h3>'+strong(line.slice(4))+'</h3>');else if(line.startsWith('## '))out.push('<h2>'+strong(line.slice(3))+'</h2>');else out.push('<p>'+strong(line)+'</p>')}
  flush();return out.join('')
 }
 function info(type){
  const d=MCQ.db,pages=d.content?.legalPages||{},page=pages[type],footer=d.settings?.footer||{},coreHelpPages=new Set(['about','contact','privacy','terms','disclaimer']),fallbackTitles={about:'About MCQ Campus',contact:'Contact Us',faq:'Frequently Asked Questions',privacy:'Privacy Policy',terms:'Terms & Conditions',disclaimer:'Disclaimer',cookies:'Cookie Policy',advertising:'Advertising Policy'};
  if(type==='faq'&&footer.showFaq!==true)return notFound();if(type==='cookies'&&footer.showCookiePolicy!==true)return notFound();if(type==='advertising'&&footer.showAdvertisingPolicy!==true)return notFound();if(page&&page.published===false&&!coreHelpPages.has(type))return notFound();let title=page?.title||fallbackTitles[type]||'Information',body='';
  if(type==='faq')body='<div class="faq-list"><details open><summary>What is MCQ Campus?</summary><p>MCQ Campus is an educational preparation platform where learners can practise MCQs, review past papers, take tests, explore current affairs, and access exam and job-related preparation resources.</p></details><details><summary>Do I need an account?</summary><p>Some public content may be available without an account. Saved learning activity, personalized progress, downloads, and account preferences may require registration.</p></details><details><summary>Can MCQ answers contain mistakes?</summary><p>Errors can occur. Use the question report control or Contact Us page to submit a correction with the MCQ ID when available.</p></details><details><summary>Are jobs and exam dates official?</summary><p>MCQ Campus may summarize or link to public information. Always verify eligibility, dates, advertisements, and application instructions with the relevant official authority.</p></details><details><summary>Does MCQ Campus guarantee exam or job results?</summary><p>No. The platform provides preparation resources and does not guarantee examination success, selection, rankings, or employment outcomes.</p></details></div>';
  else if(type==='contact'){
   const p=App.route.params||{},categories=['General Inquiry','Report Incorrect MCQ','Report Incorrect Answer','Report Technical Issue','Job/Exam Information Correction','PDF/Purchase Issue','Advertising Inquiry','Other'],selected=categories.includes(p.subject)?p.subject:'',mcqId=String(p.mcq||'').replace(/[^0-9]/g,''),pageUrl=String(p.url||'').slice(0,500),contact=d.settings?.contact||{};
   const details=[contact.supportEmail?`<p><strong>Support:</strong> <a class="link" href="mailto:${e(contact.supportEmail)}">${e(contact.supportEmail)}</a></p>`:'',contact.advertisingContact?`<p><strong>Advertising:</strong> ${e(contact.advertisingContact)}</p>`:''].filter(Boolean).join('');
   body=`${managedPageContent(page?.content||d.content.contact)}${details?`<div class="contact-details card">${details}</div>`:''}<form data-form="contact" class="contact-form">${field('name','Name','','text',true)}${field('email','Email','','email',true)}${select('subject','Subject / Category',categories.map(x=>({id:x,name:x})),selected,true)}${mcqId?field('mcq_id','MCQ ID',mcqId,'text',false,'readonly'):''}${pageUrl?field('page_url','Page URL',pageUrl,'text',false,'readonly'):''}${textarea('message','Message','',true)}<button class="btn primary">Send message</button></form>`;
  }else body=managedPageContent(page?.content||'');
  const updated=page?.lastUpdated?`<p class="policy-updated">Last Updated: ${e(page.lastUpdated)}</p>`:'';
  const main=`<article class="article legal-article public-article">${updated}${body}</article>`;
  return PublicLayout.page({trail:[[title]],title,desc:type==='contact'?'Contact MCQ Campus for support, corrections, technical issues, PDF questions, or advertising inquiries.':'MCQ Campus information and policy page.',main,sidebar:PublicLayout.smart('legal'),sidebarLabel:'Help & Legal'});
}
 function testView(rows,key,title){
  const questions=rows.slice(0,Math.min(20,rows.length)),started=Date.now();
  if(App.testResult?.key===key){const r=App.testResult;return PublicLayout.page({trail:[['Tests','tests'],[title]],title,desc:'Test result',main:`<div class="card test-result-card"><p class="eyebrow">RESULT</p><h2>${r.correct} / ${r.total} correct</h2><div class="metric-grid"><div class="card"><strong>${r.correct}</strong><span>Correct</span></div><div class="card"><strong>${r.wrong}</strong><span>Wrong</span></div><div class="card"><strong>${r.unanswered}</strong><span>Unanswered</span></div></div><div class="actions">${btn('Try again','test-retry','primary',`data-kind="${e(key)}"`)}${link('tests','All tests','btn')}</div></div>`,sidebar:PublicLayout.smart('tests'),active:'tests'});}
  const form=questions.length?UI.templateMarkup('mcq-test-form-template',{TEST_KEY:e(key),TEST_STARTED_AT:String(started),TEST_QUESTIONS:questions.map((q,i)=>UI.templateMarkup('mcq-test-question-template',{TEST_QUESTION_NUMBER:String(i+1),TEST_QUESTION_TEXT:e(q.question),TEST_QUESTION_OPTIONS:[1,2,3,4].map(n=>'<label><input type="radio" name="test_q_'+q.id+'" value="'+e(q['option'+n])+'"><span>'+'ABCD'[n-1]+'. '+e(q['option'+n])+'</span></label>').join('')})).join('')})||'':empty('No MCQs available','This test does not have approved MCQs yet.',link('tests','Back to tests','btn'));
  return PublicLayout.page({trail:[['Tests','tests'],[title]],title,desc:`${questions.length} MCQs in this test.`,main:form,sidebar:PublicLayout.smart('tests'),active:'tests'});
 }
 function stableTestScore(id,seed){let h=2166136261;for(const ch of String(id)+':'+String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
 function automaticTestPlan(){
  const rows=MCQ.publicMcqs(),days=2,period=Math.floor(Date.now()/(days*86400000)),groups={important:[],category:[],paper:[]};
  const important=rows.filter(q=>MCQ.isImportant(q));if(important.length)groups.important.push({type:'important',id:'important',name:'Important MCQs',rows:important});
  for(const c of MCQ.db.categories.filter(x=>x.active!==false&&!x.legacy)){const qs=rows.filter(q=>+q.category_id===+c.id);if(qs.length)groups.category.push({type:'category',id:c.id,name:c.name+' Category',rows:qs});}
  for(const p of MCQ.db.papers.filter(x=>x.active!==false)){const qs=rows.filter(q=>MCQ.ids(q.paper_id).includes(+p.id));if(qs.length)groups.paper.push({type:'paper',id:p.id,name:p.name+' Paper',rows:qs});}
  const preferred=['important','category','paper'][period%3],fallback=['important','category','paper'].filter(x=>x!==preferred),typeOrder=[preferred,...fallback];let source=null;
  for(const type of typeOrder){const candidates=[...groups[type]].sort((a,b)=>stableTestScore(a.type+':'+a.id,period)-stableTestScore(b.type+':'+b.id,period));if(candidates.length){source=candidates[0];break;}}
  source=source||{type:'mixed',id:'all',name:'Mixed MCQs',rows};
  let selected=[...source.rows].sort((a,b)=>stableTestScore(a.id,period+':'+source.type+':'+source.id)-stableTestScore(b.id,period+':'+source.type+':'+source.id)).slice(0,10);
  if(selected.length<10){const have=new Set(selected.map(x=>x.id)),fill=rows.filter(q=>!have.has(q.id)).sort((a,b)=>stableTestScore(a.id,period+':fill')-stableTestScore(b.id,period+':fill'));selected=selected.concat(fill.slice(0,10-selected.length));}
  const next=(period+1)*days*86400000;return {rows:selected.slice(0,10),source,days,period,next};
 }
 function tests(){
  const plan=automaticTestPlan(),next=new Date(plan.next),sourceLabel=plan.source?.name||'Mixed MCQs';
  const main=UI.templateMarkup('mcq-tests-automatic-hero-template',{AUTO_TEST_DAYS:String(plan.days),AUTO_TEST_SOURCE:e(sourceLabel),AUTO_TEST_QUESTION_COUNT:String(plan.rows.length),AUTO_TEST_NEXT_DATE:e(next.toISOString().slice(0,10)),AUTO_TEST_START_LINK:link('test/auto','Start Automatic Test','btn primary')})||'';
  return PublicLayout.page({trail:[['Tests']],title:'Automatic Tests',desc:'A hands-off test system that continuously rotates 10-question sets from your approved MCQ library.',main,sidebar:PublicLayout.smart('tests'),active:'tests',sidebarLabel:'Related / Browse'});
 }
 function test(){
  const plan=automaticTestPlan(),rows=plan.rows,label='Automatic 10-MCQ Test · '+(plan.source?.name||'Mixed MCQs'),kind='auto',key='auto:'+plan.period+':'+rows.map(x=>x.id).join(','),result=App.testResult?.key===key?App.testResult:null,review=App.route.params.review==='1';
  if(result){const pct=result.total?Math.round(result.correct/result.total*100):0,secs=Math.max(0,Number(result.timeTaken||0)),time=(Math.floor(secs/60)?Math.floor(secs/60)+'m ':'')+(secs%60)+'s';return UI.layout(`<div class="container page">${crumbs([['Tests','tests'],[label]])}${heading(label,'Your test result is ready.')}<div class="test-result-grid">${[
   {value:result.total,title:'Total Questions',iconName:'book',tone:'primary'},{value:result.correct,title:'Correct Answers',iconName:'check',tone:'success'},{value:result.wrong,title:'Wrong Answers',iconName:'close',tone:'danger'},{value:result.unanswered,title:'Unanswered',iconName:'clock',tone:'warning'},{value:pct+'%',title:'Percentage',iconName:'chart',tone:'info'},{value:result.correct+'/'+result.total,title:'Score',iconName:'target',tone:'primary'},{value:time,title:'Time Taken',iconName:'clock',tone:'neutral'}
  ].map(UI.statCard).join('')}</div><div class="actions test-result-actions">${review?link('test/'+kind,'Hide review','btn'):link('test/'+kind,'Review Answers','btn primary',{review:1})}${btn('Try again','test-retry','',`data-kind="${e(kind)}"`)}</div>${review?`<section class="test-review">${rows.map((q,i)=>{const chosen=result.answers[q.id]||'',ok=chosen===q.correct_answer;return `<article class="card">${questionTags(q)}<h2>${e(q.question)}</h2><p><strong>Your answer:</strong> ${e(chosen||'Unanswered')} ${chosen?badge(ok?'Correct':'Incorrect',ok?'success':'danger'):''}</p><p><strong>Correct answer:</strong> ${e(q.correct_answer)}</p>${q.description?`<div class="explanation"><p>${e(q.description)}</p></div>`:''}</article>`}).join('')}</section>`:''}</div>`,'tests')}
  return UI.layout(`<div class="container page">${crumbs([['Tests','tests'],[label]])}${heading(label,rows.length?`Answer ${rows.length} questions, then submit to see your result.`:'No approved MCQs are available for this test yet.')} ${rows.length?`<form class="test-form" data-form="test-submit" data-test-key="${e(key)}" data-test-kind="${e(kind)}" data-started-at="${Date.now()}">${rows.map((q,i)=>`<article class="card test-question mcq-reference-card"><div class="mcq-top"><div class="mcq-question-label">${questionTags(q)}</div></div><div class="mcq-question-panel"><h2>${link('mcq/'+q.id,e(q.question),'mcq-question-link')}</h2></div><div class="test-options mcq-reference-options">${[1,2,3,4].map(n=>`<label><input type="radio" name="test_q_${q.id}" value="${e(q['option'+n])}"><span class="letter">${'ABCD'[n-1]}</span><span class="option-text">${e(q['option'+n])}</span><span class="option-indicator" aria-hidden="true"></span></label>`).join('')}</div></article>`).join('')}<button class="btn primary test-submit" type="submit">Submit test</button></form>`:empty('No MCQs available','Add approved MCQs to the library so the automatic system can build a set.',link('tests','Back to tests','btn'))}</div>`,'tests')
 }
 function jobsExams(){return browse('papers')}
  function pdfs(){
  const rows=(MCQ.db.pdfs||[]).filter(x=>x.active!==false),safeLink=u=>/^https?:\/\//i.test(String(u||''))||/^data:application\/pdf;base64,/i.test(String(u||'')),safeImage=u=>/^https?:\/\//i.test(String(u||''))||/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(u||'')),pageSize=12,page=App.page(rows.length,pageSize),shown=rows.slice((page-1)*pageSize,page*pageSize);
  const cards=shown.map(pdfResourceCard).join('');
  const main=`${UI.adSlot('pdf_ad')}${rows.length?`<div class="pdf-resource-grid">${cards}</div>${UI.pager(rows.length,page,pageSize,App.route.params,'pdfs')}`:empty('No PDFs available yet','Published PDF resources will appear here with a direct Download button.')}`;
  const copy=staticCopy('pdfs','Exam Preparation PDFs','Browse preparation PDFs, open each resource on its own page, and download the file directly.');
  return PublicLayout.page({trail:[['PDFs']],title:copy.title,desc:copy.desc,main,sidebar:PublicLayout.smart('pdfs'),active:'pdfs',sidebarLabel:'Related / Browse'});
 }
 function pdf(id){
  const x=(MCQ.db.pdfs||[]).find(row=>String(row.id)===String(id)||String(row.slug||MCQ.slug(row.title||row.name||''))===String(id));
  if(!x||x.active===false)return notFound();
  const safeLink=u=>/^https?:\/\//i.test(String(u||''))||/^data:application\/pdf;base64,/i.test(String(u||'')),safeImage=u=>/^https?:\/\//i.test(String(u||''))||/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(u||''));
  const fallbackTitle=x.title||x.name||'Exam Preparation PDF',fallbackDesc=x.description||'Download this exam preparation PDF and continue with related past papers and MCQs.',copy={title:x.seo_title||fallbackTitle+' PDF',desc:x.seo_description||fallbackDesc},title=copy.title,href=String(x.download_url||'').trim(),download=safeLink(href)?`<a class="btn primary" href="${e(href)}" data-auth-action="download-pdf" data-auth-download-name="${e(MCQ.slug(title))}.pdf" ${/^data:/i.test(href)?`download="${e(MCQ.slug(title))}.pdf"`:'target="_blank" rel="noopener"'}>Download PDF</a>`:'<span class="btn disabled" aria-disabled="true">Download unavailable</span>';
  const main=UI.templateMarkup('mcq-pdf-detail-template',{PDF_DETAIL_COVER:x.cover&&safeImage(x.cover)?'<img src="'+e(x.cover)+'" alt="'+e(title)+'">':'',PDF_DETAIL_TITLE:e(title),PDF_DETAIL_DESCRIPTION:e(copy.desc),PDF_DETAIL_DOWNLOAD:download})||'';
  return PublicLayout.page({trail:[['PDFs','pdfs'],[fallbackTitle]],title:copy.title,desc:copy.desc,main,sidebar:PublicLayout.smart('pdfs'),active:'pdfs',sidebarLabel:'Related / Browse'});
 }
 function latestJobs(){
  const today=new Date().toISOString().slice(0,10),all=[...(MCQ.db.latestJobs||[])],rows=all.filter(x=>x.published!==false&&String(x.last_date||'')>=today).sort((a,b)=>String(a.last_date||'').localeCompare(String(b.last_date||''))||Number(b.id)-Number(a.id));
  const main=`${rows.length?`<div class="latest-jobs-list">${rows.map(latestJobCard).join('')}</div>`:empty('No active job announcements right now','Expired jobs stay available to administrators but are hidden from this Latest Jobs list.')}`;
  const copy=staticCopy('latest-jobs','Latest Jobs','Current job opportunities with organization, job title, individual detail pages and last date to apply.');
  return PublicLayout.page({trail:[['Latest Jobs']],title:copy.title,desc:copy.desc,main,sidebar:PublicLayout.smart('jobs'),active:'latest-jobs',sidebarLabel:'Related / Browse'});
 }
 function latestJob(id){
  const x=(MCQ.db.latestJobs||[]).find(row=>String(row.id)===String(id)||String(row.slug||MCQ.slug(row.title||''))===String(id));
  if(!x||x.published===false)return notFound();
  const org=MCQ.get('papers',x.paper_id),fallbackTitle=((org?.name?org.name+' ':'')+(x.title||'Job opportunity')).trim(),fallbackDesc=x.description||'Latest job details, application deadline and related past-paper preparation links.',copy={title:x.seo_title||fallbackTitle,desc:x.seo_description||fallbackDesc},safe=u=>/^https?:\/\//i.test(String(u||'')),apply=safe(x.apply_url)?`<a class="btn primary" href="${e(x.apply_url)}" target="_blank" rel="noopener" data-auth-action="apply-job">Apply / View Official Details</a>`:'';
  const paperLink=(/^(https?:\/\/|\/(?!\/))/i.test(String(x.prep_url||'')))?`<a class="btn" href="${e(x.prep_url)}" target="_blank" rel="noopener">Past Papers</a>`:(org?link(pastPapersPath(x),'Past Papers','btn'):'');
  const main=UI.templateMarkup('mcq-latest-job-detail-template',{JOB_DETAIL_LOGO:org?UI.entityIcon(org,'briefcase'):icon('briefcase'),JOB_DETAIL_ORGANIZATION:e(org?.name||'Organization'),JOB_DETAIL_TITLE:e(copy.title),JOB_DETAIL_DESCRIPTION:e(copy.desc),JOB_DETAIL_LAST_DATE:e(UI.date(x.last_date)),JOB_DETAIL_ACTIONS:apply+paperLink})||'';
  return PublicLayout.page({trail:[['Latest Jobs','latest-jobs'],[x.title||'Job']],title:copy.title,desc:copy.desc,main,sidebar:PublicLayout.smart('jobs'),active:'latest-jobs',sidebarLabel:'Related / Browse'});
 }
 function sitemap(){
  if(MCQ.db.settings?.footer?.showSitemap===false)return notFound();const groups=[['Main Pages',[['Home','home'],['Past Papers','papers'],['Organizations / Boards','papers'],['MCQs','mcqs'],['Categories','categories'],['PDFs','pdfs'],['Latest Jobs','latest-jobs'],['Blog','posts']]]];const main=`<div class="sitemap-grid">${groups.map(([g,items])=>`<div class="card"><h2>${g}</h2>${items.map(([l,p])=>link(p,l,'discovery-link')).join('')}</div>`).join('')}</div>`;return PublicLayout.page({trail:[['Sitemap']],title:'Sitemap',desc:'Browse public study sections, organization pages, past papers and preparation resources.',main,sidebar:PublicLayout.smart('papers'),sidebarLabel:'Related / Browse'});
 }
 function notFound(){return UI.layout(`<div class="container page"><div class="error-page"><p class="eyebrow">404 · PAGE NOT FOUND</p><h1>We could not find that page.</h1><p>The link may be old, incomplete, or no longer available.</p><div class="actions">${link('home','Home','btn primary')}${link('search','Search','btn')}${link('categories','Categories','btn')}${link('papers','Past papers','btn')}</div></div></div>`)}
 return {home,countryLanding,quickCard,browse,listing,practice,mcq,relatedMcqs,questionCard,mini,posts,tests,test,automaticTestPlan,jobsExams,pdfs,pdf,pdfResourceCard,latestJobs,latestJob,latestJobCard,blogPostCard,dashboard,info,profileForm,sitemap,notFound};
})();


/* ===== END MODULE: public.js ===== */

;


/* SOURCE: frontend/js/modules/carousel.js */
/* ===== MCQCAMPUS MODULE: carousel.js ===== */
/* One cancellable countdown. Renders retain the deadline; interaction resets it. */
window.McqCarousel = {
  create({advance, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout}) {
    const delay = 10000;
    let timer = null, current = null, deadline = 0;
    function clear() {
      if (timer !== null) cancel(timer);
      timer = null;
    }
    function stop() {
      clear();
      current = null;
      deadline = 0;
    }
    function sync(key) {
      if (key == null) { stop(); return; }
      if (key !== current) {
        current = key;
        deadline = now() + delay;
      }
      clear();
      timer = schedule(() => {
        timer = null;
        current = null;
        deadline = 0;
        advance();
      }, Math.max(0, deadline - now()));
    }
    return {sync, stop, restart(key) { stop(); sync(key); }};
  }
};

/* ===== END MODULE: carousel.js ===== */

;


/* SOURCE: frontend/js/modules/seo.js */
/* ===== MCQCAMPUS MODULE: seo.js ===== */
window.SEO=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const slug=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'item';
 // Accept the existing Django sitemap spelling as well as the SPA spelling.
 // For example, [2026][Morning] and A & B are slugged differently by each.
 const hierarchySlug=s=>String(s??'').normalize('NFKD').replace(/[^\x00-\x7F]/g,'').toLowerCase().replace(/[^\w\s-]/g,'').trim().replace(/[-\s]+/g,'-').replace(/^[-_]+|[-_]+$/g,'').slice(0,96)||'item';
 const brand=value=>String(value??'').replace(/\bMCQs?\s*Campus\b/ig,'MCQCampus');
 const fitTitle=(value,limit=60)=>{const text=brand(value).replace(/\s+/g,' ').replace(/\s*(?:\||-|—|–)\s*MCQCampus\s*$/i,'').trim();if(text.length<=limit)return text;return text.slice(0,limit-3).replace(/[\s\-—–|,:]+$/,'')+'...'};
 const site=()=>brand(MCQ?.db?.settings?.siteName||'MCQCampus');
 const shortName=value=>{const text=String(value||'').trim(),bracket=[...text.matchAll(/\[([^\]]{2,16})\]/g)].map(m=>m[1].trim()).filter(Boolean);if(bracket.length)return bracket[bracket.length-1];const paren=[...text.matchAll(/\(([^)]{2,16})\)/g)].map(m=>m[1].trim()).filter(x=>/^[A-Z0-9&. -]+$/.test(x));if(paren.length)return paren[paren.length-1];const caps=text.match(/\b[A-Z][A-Z0-9&.-]{1,15}\b/g);return caps?.[caps.length-1]||text};
 const yearLabel=(job,value)=>{
  let text=String(value||'').trim();
  const jobText=String(job||'').trim();
  if(jobText&&text.toLowerCase().startsWith(jobText.toLowerCase())) text=text.slice(jobText.length).replace(/^\s*[-–—:]?\s*/,'');
  text=text.replace(/\bPast\s+Paper\b/ig,' ').replace(/[\[\]()]/g,' ').replace(/\s+/g,' ').trim();
  const dated=text.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}\b(?:\s+(?:Morning|Evening|Night|Shift\s*\d+))?/i);
  const year=text.match(/\b20\d{2}\b/);
  return (dated&&dated[0])||(year&&year[0])||text||String(value||'').trim();
 };
 const baseUrl=()=>{try{return new URL(document.querySelector('link[rel="canonical"]')?.href||document.querySelector('meta[property="og:url"]')?.content||location.href).origin}catch{return 'https://www.mcqcampus.com'}};
 const seoItems=()=>MCQ?.db?.seoIndex?.items||{};
 const catalogKey=x=>String(x?.id??x?.slug??slug(x?.title||x?.name||'item'));
 const indexFor=(kind,key)=>{const value=seoItems()[kind+':'+String(key)];return value?String(value).padStart(6,'0'):''};
 const resolveIndex=(token,kinds=[])=>{const n=Number.parseInt(String(token||''),10);if(!Number.isFinite(n))return null;for(const [key,value] of Object.entries(seoItems())){if(Number(value)!==n)continue;const at=key.indexOf(':'),kind=key.slice(0,at),entityKey=key.slice(at+1);if(!kinds.length||kinds.includes(kind))return {kind,key:entityKey,index:String(n).padStart(6,'0')}}return null};

 // The server resolves these discovery URLs from database IDs. Keep that exact
 // content after hydration; loading another discovery page uses its document.
 const serverDiscoveryPage=(()=>{try{return JSON.parse(document.getElementById('seo-discovery-page')?.textContent||'null')}catch{return null}})();
 const routePath=path=>'/'+String(path||'').split('?')[0].replace(/^\/+|\/+$/g,'');
 const discoveryPage=path=>serverDiscoveryPage?.path===routePath(path)?serverDiscoveryPage:null;
 const isDiscoveryPath=path=>routePath(path)==='/sitemap'||/^\/[a-z0-9_][a-z0-9_-]*-past-papers$/.test(routePath(path));
 const needsDocumentNavigation=path=>isDiscoveryPath(path)&&!discoveryPage(path);
 function renderDiscovery(path){
  const page=discoveryPage(path);if(!page)return '';
  const landing=page.landing||null;
  if(landing?.type==='paper'&&landing.id)return Public.browse('paper',landing.id);
  if(landing?.type==='job'&&landing.id)return Public.browse('job',landing.id);
  const groups=page.groups||[];
  const main='<div class="sitemap-grid">'+groups.map(([name,links])=>'<section class="card"><h2>'+esc(name)+'</h2>'+links.map(([label,href])=>UI.link(href,esc(label),'discovery-link')).join('')+'</section>').join('')+'</div>';
  const crumbs=(page.breadcrumbs||[]).slice(1).map(([label,href],i,all)=>i===all.length-1?[label]:[label,href]);
  return PublicLayout.page({trail:crumbs,title:page.heading,desc:page.intro,main,sidebar:PublicLayout.smart('papers'),active:'papers',sidebarLabel:'Related / Browse'});
 }
 function cleanPath(base,id){
  const get=(t,i)=>MCQ.get(t,i), s=x=>x?.slug||slug(x?.name||x?.title||x?.question||id);
  if(base==='home')return '/';
  if(base==='mcqs')return '/mcqs'; if(base==='important')return '/mcqs/important-mcqs';
  if(base==='categories')return '/categories';
  if(base==='papers')return '/past-papers';
  if(base==='pdfs')return '/past-papers/pdfs';
  if(base==='latest-jobs')return '/latest-jobs';
  if(base==='posts')return '/blog';
  if(base==='category'){const x=get('categories',id),idx=indexFor('category',id);return x&&idx?`/categories/${idx}/${s(x)}`:'/categories'}
  if(base==='paper'){const x=get('papers',id),idx=indexFor('paper',id);return x&&idx?`/past-papers/${idx}/${slug(shortName(x.name))}-past-papers`:x?`/paper/${x.id}`:'/past-papers'}
  if(base==='job')return '/past-papers'
  if(base==='year'){const x=get('years',id),p=x&&(get('papers',x.paper_id)||get('papers',get('jobs',x.job_id)?.paper_id)),idx=indexFor('year',id);return x&&p&&idx?`/past-papers/${idx}/${slug(shortName(p.name)+' '+x.name)}`:x&&p?`/paper/${p.id}/year/${x.id}`:'/past-papers'}
  if(base==='mcq'||base==='practice'){const x=get('mcqs',id),idx=indexFor('mcq',id);return x&&idx?`/mcqs/${idx}/${s(x)}`:'/mcqs'}
  if(base==='pdf'){const x=get('pdfs',id),idx=indexFor('pdf',catalogKey(x));return x&&idx?`/past-papers/pdfs/${idx}/${s(x)}`:'/past-papers/pdfs'}
  if(base==='latest-job'){const x=get('latestJobs',id),p=x&&get('papers',x.paper_id),idx=indexFor('latest-job',catalogKey(x));const label=(p?shortName(p.name)+' ':'')+(x?.title||'job');return x&&idx?`/latest-jobs/${idx}/${slug(label)}`:'/latest-jobs'}
  if(base==='post'){const x=get('posts',id),idx=indexFor('post',id);return x&&idx?`/blog/${idx}/${s(x)}`:'/blog'}
  if(base==='tests')return '/tests'; if(base==='test')return `/test/${slug(id)}`;
  if(base==='jobs-exams')return '/past-papers';
  if(base==='subcategory'){const x=get('subcategories',id);return x?`/subcategory/${s(x)}`:'/categories'}
  if(base==='topic'){const x=get('children',id);return x?`/topic/${s(x)}`:'/categories'}
  return `/${slug(base)}`;
 }
 function descriptor(base,id){
  const discovery=discoveryPage(location.pathname);
  if(discovery)return {...discovery,discovery:true};
  const get=(t,i)=>MCQ.get(t,i), suffix=''; let title=site(),description=MCQ.db.seo.description,robots='index,follow';
  if(base==='home'){title='MCQCampus — Organizations, Past Papers & Exam Preparation';description='Prepare for PPSC, FPSC, NTS, SPSC, BPSC and other competitive exams with organization-wise past papers, solved MCQs, answers and explanations.'}
  if(base==='categories'){title='MCQ Categories'+suffix;description='Browse MCQ categories and practise approved questions with answers and explanations.'}
  if(base==='category'){const x=get('categories',id);title=(x?.name||'Category')+' MCQs'+suffix;description=`Practice ${x?.name||'category'} MCQs with answers and explanations.`}
  if(base==='subcategory'){const x=get('subcategories',id);title=(x?.name||'Subcategory')+' MCQs with Answers'+suffix;description=`Practice ${x?.name||'subcategory'} MCQs with correct answers and explanations.`}
  if(base==='topic'){const x=get('children',id);title=(x?.name||'Topic')+' MCQs with Answers'+suffix;description=`Practice ${x?.name||'topic'} MCQs with correct answers and explanations.`}
  if(base==='papers'){title='Organizations & Boards Past Papers — PPSC, FPSC, NTS & More'+suffix;description='Browse organizations and testing boards, choose available past papers, then practice linked MCQs with correct answers and explanations.'}
  if(base==='paper'){const x=get('papers',id),short=x?shortName(x.name):'Organization / Board';title=short+' Past Papers & Solved MCQs'+suffix;description=`Browse past papers directly under ${x?.name||'this organization or board'}, then practise linked MCQs with correct answers, explanations and related preparation resources.`}
  if(base==='job'){const x=get('jobs',id),p=x&&get('papers',x.paper_id),short=p?shortName(p.name):'';title=(short||'Organizations / Boards')+' Past Papers & Solved MCQs'+suffix;description=`Browse ${p?.name||'this organization or board'} and open its Past Papers to practise linked MCQs with answers and explanations.`}
  if(base==='year'){const x=get('years',id),p=x&&(get('papers',x.paper_id)||get('papers',get('jobs',x.job_id)?.paper_id)),short=p?shortName(p.name):'';title=((short?short+' ':'')+(x?.name||'Past Paper')+' Solved MCQs')+suffix;description=`Practice ${(p?.name||'this organization or board')} ${x?.name||'Past Paper'} MCQs with correct answers and explanations.`}
  if(base==='important'){title='Important MCQs for Practice'+suffix;description='Practice MCQs marked important by the MCQCampus editorial workflow.'}
  if(base==='mcqs'){title='Practice MCQs with Answers & Explanations'+suffix;description='Practice approved MCQs across categories, organizations and past papers.'}
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);title=(q?.question||'MCQ').slice(0,70)+suffix;description=(q?.description||`Practice this MCQ and review the correct answer on ${site()}.`).slice(0,155)}
  if(base==='tests'){title='Automatic MCQ Tests'+suffix;description='Attempt an automatically generated 10-question test that rotates between important MCQs, categories and past papers.'}
  if(base==='test'){title='Automatic 10-MCQ Test'+suffix;description='Attempt the current automatic 10-question set and review answers, explanations, score and time taken.'}
  if(base==='jobs-exams'){title='Organizations / Boards — Past Papers & MCQs'+suffix;description='Browse organizations and boards, then open past papers and practise linked MCQs with answers and explanations.'}
  if(base==='latest-jobs'){title='Latest Jobs & Exam Opportunities'+suffix;description='Browse current job and exam opportunities with organization details, deadlines and preparation resources.'}
  if(base==='latest-job'){const x=get('latestJobs',id),p=x&&get('papers',x.paper_id),short=p?shortName(p.name):'';title=((short?short+' ':'')+(x?.title||'Latest Job')+' Latest Job')+suffix;description=(`${(short?short+' ':'')}${x?.title||'Job opportunity'} latest job details${x?.last_date?', last date '+x.last_date:''}. View related past papers and preparation resources.`).slice(0,155)}
  if(base==='pdfs'){title='Exam Preparation PDFs & Study Resources'+suffix;description='Browse preparation PDFs and downloadable study resources for MCQs, past papers and competitive exams.'}
  if(base==='pdf'){const x=get('pdfs',id);title=(x?.title||x?.name||'Exam Preparation')+' PDF Download'+suffix;description=(x?.description||`Download ${x?.title||x?.name||'this exam preparation'} PDF for MCQ and competitive exam preparation.`).slice(0,155)}
  if(base==='posts'){title='Exam Preparation Blog & Updates'+suffix;description='Read exam preparation articles, study guides, updates and useful learning resources.'}
  if(base==='post'){const x=get('posts',id);title=(x?.seo_title||x?.title||'Post')+suffix;description=(x?.seo_description||x?.excerpt||String(x?.body||'').slice(0,155))}
  if(['about','contact','privacy','terms','disclaimer','cookies','advertising'].includes(base)){const x=MCQ.db.content?.legalPages?.[base];title=(x?.seoTitle||x?.title||base.replace(/-/g,' '))+suffix;description=(x?.metaDescription||description).slice(0,155)}
  if(base==='faq'){title='Frequently Asked Questions'+suffix;description='Answers to common questions about MCQCampus, exam preparation content, corrections and official-information verification.'}
  if(base==='sitemap'){title='Sitemap'+suffix;description='Browse the main MCQCampus preparation, account, support and legal pages.'}
  if(['search','login','register','forgot','reset','verify','dashboard','profile','admin','super-admin'].includes(base))robots='noindex,nofollow';
  const pageSeo=MCQ?.db?.pageSeo||{};
  const staticKey={home:'home',mcqs:'mcqs',papers:'past-papers',pdfs:'pdfs',categories:'categories','latest-jobs':'latest-jobs',posts:'blog'}[base];
  const entityKind={category:'category',paper:'paper',job:'job',year:'year',mcq:'mcq'}[base];
  let override=staticKey?pageSeo['static:'+staticKey]:(entityKind?pageSeo[entityKind+':'+String(id)]:null);
  if(base==='pdf'){const x=get('pdfs',id);override={title:x?.seo_title||override?.title||'',description:x?.seo_description||override?.description||''}}
  if(base==='latest-job'){const x=get('latestJobs',id);override={title:x?.seo_title||override?.title||'',description:x?.seo_description||override?.description||''}}
  if(base==='post'){const x=get('posts',id);override={title:x?.seo_title||override?.title||'',description:x?.seo_description||override?.description||''}}
  const customTitle=String(override?.title||'').trim(),customDescription=String(override?.description||'').trim();
  if(customTitle)title=customTitle;
  if(customDescription)description=customDescription;
  return {title:fitTitle(title),description:brand(description),robots,canonical:baseUrl()+cleanPath(base,id)};
 }
 function setMeta(selector,attrs){let el=document.querySelector(selector);if(!el){el=document.createElement('meta');document.head.appendChild(el)}Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));}
 function apply(base,id){if(typeof document==='undefined'||!document.head)return;const d=descriptor(base,id);document.title=d.title;setMeta('meta[name="description"]',{name:'description',content:d.description});setMeta('meta[name="robots"]',{name:'robots',content:d.robots});setMeta('meta[property="og:title"]',{property:'og:title',content:d.title});setMeta('meta[property="og:description"]',{property:'og:description',content:d.description});setMeta('meta[property="og:type"]',{property:'og:type',content:['post'].includes(base)?'article':'website'});setMeta('meta[property="og:url"]',{property:'og:url',content:d.canonical});setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:d.title});setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:d.description});let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=d.canonical||cleanPath(base,id);
  document.getElementById('server-jsonld')?.remove();
  let node=document.getElementById('mcq-jsonld');if(node)node.remove();
  if(d.discovery){node=document.createElement('script');node.id='mcq-jsonld';node.type='application/ld+json';node.textContent=JSON.stringify(d.schema);document.head.appendChild(node);return;}
  const graph=[{'@type':'WebSite','name':site(),'alternateName':['mcqcampus.com'],'url':baseUrl()||'/'},{'@type':'WebPage','name':d.title,'description':d.description,'url':d.canonical||cleanPath(base,id),'speakable':{'@type':'SpeakableSpecification','cssSelector':['#main h1','#seo-summary']}}];const get=(t,i)=>MCQ.get(t,i),bc=[['Home','/']];if(base==='categories')bc.push(['Categories','/categories']);if(base==='category'){const x=get('categories',id);bc.push(['Categories','/categories'],[x?.name||'Category',cleanPath(base,id)])}if(base==='subcategory'){const x=get('subcategories',id),c=get('categories',x?.category_id);bc.push(['Categories','/categories']);if(c)bc.push([c.name,cleanPath('category',c.id)]);bc.push([x?.name||'Subcategory',cleanPath(base,id)])}if(base==='topic'){const x=get('children',id),sub=get('subcategories',x?.subcategory_id),c=get('categories',sub?.category_id);bc.push(['Categories','/categories']);if(c)bc.push([c.name,cleanPath('category',c.id)]);if(sub)bc.push([sub.name,`/subcategory/${slug(sub.name)}`]);bc.push([x?.name||'Topic',cleanPath(base,id)])}if(base==='papers')bc.push(['Past Papers','/past-papers']);if(base==='paper'){const p=get('papers',id);bc.push(['Past Papers','/past-papers'],[p?.name||'Paper',cleanPath(base,id)])}if(base==='job'){const j=get('jobs',id),p=j&&get('papers',j.paper_id);bc.push(['Past Papers','/past-papers']);if(p)bc.push([p.name,cleanPath('paper',p.id)]);bc.push([j?.name||'Job',cleanPath(base,id)])}if(base==='year'){const y=get('years',id),p=y&&(get('papers',y.paper_id)||get('papers',get('jobs',y.job_id)?.paper_id));bc.push(['Past Papers','/past-papers']);if(p)bc.push([p.name,cleanPath('paper',p.id)]);bc.push([y?.name||'Past Paper',cleanPath(base,id)])}if(base==='mcq'||base==='practice'){const q=get('mcqs',id),c=q&&get('categories',q.category_id);bc.push(['MCQs','/mcqs']);if(c)bc.push([c.name,cleanPath('category',c.id)]);bc.push([(q?.question||'MCQ').slice(0,80),cleanPath(base,id)])}if(base==='jobs-exams')bc.push(['Organizations / Boards','/past-papers']);if(base==='post'){const p=get('posts',id);bc.push(['Blog','/blog'],[p?.title||'Post',cleanPath(base,id)])}if(bc.length>1)graph.push({'@type':'BreadcrumbList','itemListElement':bc.map((x,i)=>({'@type':'ListItem','position':i+1,'name':x[0],'item':baseUrl()+x[1]}))});const itemRows=base==='category'?MCQ.publicMcqs().filter(q=>+q.category_id===+id).slice(0,20).map(q=>({name:q.question,url:baseUrl()+cleanPath('mcq',q.id)})):base==='subcategory'?MCQ.publicMcqs().filter(q=>MCQ.ids(q.subcategory_ids).includes(+id)).slice(0,20).map(q=>({name:q.question,url:baseUrl()+cleanPath('mcq',q.id)})):base==='topic'?MCQ.publicMcqs().filter(q=>MCQ.ids(q.child_subcategory_ids).includes(+id)).slice(0,20).map(q=>({name:q.question,url:baseUrl()+cleanPath('mcq',q.id)})):base==='paper'?MCQ.db.years.filter(y=>y.active!==false&&Number(y.paper_id||MCQ.get('jobs',y.job_id)?.paper_id||0)===Number(id)).slice(0,20).map(y=>({name:y.name,url:baseUrl()+cleanPath('year',y.id)})):base==='job'?[]:base==='year'?MCQ.publicMcqs().filter(q=>MCQ.ids(q.job_years_ids).includes(+id)).slice(0,20).map(q=>({name:q.question,url:baseUrl()+cleanPath('mcq',q.id)})):[];if(itemRows.length)graph.push({'@type':'ItemList','name':d.title,'itemListElement':itemRows.map((x,i)=>({'@type':'ListItem','position':i+1,'name':x.name,'url':x.url}))});if(base==='post'){const p=MCQ.get('posts',id);if(p)graph.push({'@type':'Article','headline':p.title,'description':p.excerpt||'','author':{'@type':'Organization','name':site(),'url':baseUrl()||'/'},'publisher':{'@type':'Organization','name':site(),'url':baseUrl()||'/'},'mainEntityOfPage':d.canonical||cleanPath(base,id),'datePublished':p.created_at||undefined,'dateModified':p.updated_at||p.created_at||undefined})}node=document.createElement('script');node.id='mcq-jsonld';node.type='application/ld+json';node.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});document.head.appendChild(node);
 }
 return {slug,hierarchySlug,shortName,indexFor,resolveIndex,cleanPath,descriptor,apply,discoveryPage,isDiscoveryPath,needsDocumentNavigation,renderDiscovery};
})();

/* ===== END MODULE: seo.js ===== */

;


/* SOURCE: frontend/js/modules/motion.js */
/* ===== MCQCAMPUS MODULE: motion.js ===== */
/* MCQCampus motion system: small, accessible view transitions and staggered reveals. */
window.MCQMotion=(()=>{
 const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const selector=[
  '.page-heading','.breadcrumbs','.hero > *','.home-top-stats','.section-head',
  '.card','.mcq-card','.entity-showcase-card','.stat-card','.question-row',
  '.table-wrap','.article','.cta','.empty','.notice','.auth-story','.auth-form',
  '.automatic-test-hero','.home-cat-group','.selection-stack'
 ].join(',');
 function enter(root=document){
  if(!root||reduce())return;
  const scope=root.querySelector('#main')||root.querySelector('main')||root;
  const nodes=[...scope.querySelectorAll(selector)]
   .filter((el,i,all)=>!el.closest('dialog')&&!el.classList.contains('hidden')&&!all.some((parent,p)=>p<i&&parent.contains(el)&&['CARD','ARTICLE'].includes(parent.tagName)));
  const entering=nodes.slice(0,28);
  entering.forEach((el,i)=>{
   el.classList.remove('mcq-motion-enter');
   el.style.setProperty('--motion-delay',Math.min(i*24,192)+'ms');
  });
  if(!entering.length)return;
  // Batch the layout flush once instead of forcing a reflow for every element.
  void scope.offsetWidth;
  entering.forEach(el=>el.classList.add('mcq-motion-enter'));
 }
 function pulse(el){
  if(!el||reduce())return;
  el.animate?.([
   {transform:'scale(.985)',opacity:.92},
   {transform:'scale(1)',opacity:1}
  ],{duration:180,easing:'cubic-bezier(.22,.8,.28,1)'});
 }
 document.addEventListener('change',event=>{
  const target=event.target;
  if(target.matches?.('select,input[type="checkbox"],input[type="radio"]'))pulse(target.closest('.field,.check-line')||target);
 },{passive:true});
 return {enter,pulse};
})();

/* ===== END MODULE: motion.js ===== */

;


/* SOURCE: frontend/js/modules/auth.js */
/* ===== MCQCAMPUS MODULE: auth.js ===== */
/* Same-origin Django authentication and API adapter.
   Country selection and auth screens are public; app sections require a signed-in session. */
window.Auth=(()=>{
 const authRoutes=new Set(['login','register','forgot','reset-code','reset-password','reset','verify']);
 const protectedRoutes=new Set(['dashboard','profile','admin','super-admin']);
 let ready=false,user=null,csrf='',csrfRefreshing=null,checking=null,expiryTimer=null,generation=0,routeRoleSync=null,pendingPublicAction=null;
 const loadedSections=new Set(),sectionLoadedAt=new Map(),loadingSections=new Map();
 const SECTION_TTL=Number.POSITIVE_INFINITY;
 const ADMIN_PAGE_SIZES=[10],ADMIN_DEFAULT_PAGE_SIZE=10;

 function initialRoute(){
  if(location.hash){
   const legacy=location.hash.replace(/^#\/?/,'');const [path,query='']=legacy.split('?'),params=Object.fromEntries(new URLSearchParams(query));history.replaceState(null,'',UI.href(path||'home',params));return;
  }
  let path=location.pathname.replace(/^\/+|\/+$/g,'').replace(/index\.html$/,'').replace(/\.html$/,'');
  const aliases={
   'auth/login':'login','auth/register':'register','auth/forgot-password':'forgot','auth/reset-password':'reset-code','auth/new-password':'reset-password','auth/verify-email':'verify',
   'user-dashboard':'dashboard','user-dashboard/profile':'profile','admin':'admin/overview','super-admin':'super-admin/overview','public':'home','':''
  };
  const mapped=aliases[path]??(path==='reset'?'reset-code':path.replace(/^public\//,''));
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
 function landing(){return user?.roles?.includes('super-admin')?'super-admin/overview':user?.roles?.includes('admin')?'admin/overview':'home';}
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
  if(window.App){App.answers={};App.choices={};App.quickAnswer=null;App.activeQuestionId=null;App.draft=null;App.draftKey=null;App.importRows=null;App.importSummary=null;App.importedIds=[];App.importPage=null;App.homeRandomIds=[];App.quickTimer?.stop();}
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
 async function ensureCsrfToken({force=false}={}){
  if(csrf&&!force)return csrf;
  if(!csrfRefreshing){
   csrfRefreshing=(async()=>{
    let response;
    try{
     response=await fetch('/api/startup',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    }catch{
     throw Error('Unable to initialize account security. Refresh the page and try again.');
    }
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')){
     throw Error('Unable to initialize account security. Refresh the page and try again.');
    }
    const data=await response.json();
    if(typeof data.csrfToken!=='string'||!data.csrfToken){
     throw Error('Unable to initialize account security. Refresh the page and try again.');
    }
    csrf=data.csrfToken;
    return csrf;
   })().finally(()=>{csrfRefreshing=null});
  }
  return csrfRefreshing;
 }
 async function request(path,body,{loading=false,timeout=15000}={}){
  if(body!==undefined)await ensureCsrfToken();
  if(loading)backendLoading(true);
  try{
   let response;
   const method=body===undefined?'GET':'POST';
   const publicCachedGet=method==='GET'&&!user&&new Set(['/public/content','/public/resources','/public/catalog','/public/legal']).has(path);
   const serializedBody=body===undefined?undefined:JSON.stringify(body);
   const send=()=>fetch('/api'+path,{
    method,
    credentials:'same-origin',
    cache:publicCachedGet?'default':'no-store',
    headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-CSRFToken':csrf})},
    ...(serializedBody===undefined?{}:{body:serializedBody}),
    signal:AbortSignal.timeout(timeout)
   });
   try{response=await send();}catch{throw Error('Unable to reach MCQCampus. Check your connection and try again.');}
   // A fresh startup token is only requested when Django rejects a write with
   // a non-JSON 403 (the CSRF middleware response). Normal POSTs reuse the
   // token already received from /startup, avoiding an extra request each time.
   if(body!==undefined&&response.status===403&&!response.headers.get('content-type')?.includes('application/json')){
    await ensureCsrfToken({force:true});
    try{response=await send();}catch{throw Error('Unable to reach MCQCampus. Check your connection and try again.');}
   }
   if(response.status===401&&!path.startsWith('/auth/')){clearPrivateState();ready=true;throw Error('Your session has ended. Please sign in again.');}
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error(authError);
   const data=await response.json();
   if(data.csrfToken)csrf=data.csrfToken;
   if(!response.ok){const error=Error(data.message||'The request could not be completed.');error.fields=data.fields;throw error;}
   return data;
  }finally{if(loading)backendLoading(false);}
 }
 async function ensureRouteData(path,context={}){
  if(!path)return false;
  const clean=String(path).split('?')[0].replace(/^\/+|\/+$/g,'')||'home';
  const parts=clean.split('/'),workspace=parts[0],section=parts[1]||'overview',recordId=parts[2]||'',wants=[];
  const routeParams=new URLSearchParams(location.search),resolvedBase=context?.base||workspace,resolvedId=context?.id??recordId,routeKey=location.pathname+location.search;
  if(!authRoutes.has(workspace))wants.push('core','resources');
  if(['home','posts','post','search','blog'].includes(workspace))wants.push('public-content');
  if(['home','pdfs','pdf','latest-jobs','latest-job'].includes(workspace)||(workspace==='past-papers'&&section==='pdfs'))wants.push('catalog');
  if(['about','contact','privacy','terms','disclaimer','cookies','advertising'].includes(workspace))wants.push('legal');
  if(['home','mcqs','important','category','subcategory','topic','year','mcq','practice','search'].includes(resolvedBase))wants.push('public-mcqs');
  if(['categories','papers','paper','job','jobs'].includes(resolvedBase))wants.push('entity-page');
  if(user&&(workspace==='dashboard'||workspace==='profile')){
   wants.push('learner');
   if(workspace==='profile'||section==='settings')wants.push('profile');
  }
  if(user&&['admin','super-admin'].includes(workspace)){
   if(section==='overview'||section==='admin-records')wants.push('overview');
   if(['users','admins','admin-records'].includes(section)||(section==='all-mcqs'&&user.roles?.includes('super-admin')))wants.push('users');
   if(['add','edit','all-mcqs','mcqs','paper-mcqs','categories','papers','years','import'].includes(section))wants.push('core');
   if(['all-mcqs','mcqs','edit','paper-mcqs'].includes(section))wants.push('workspace-mcqs');
   if(['categories','papers','years'].includes(section))wants.push('entity-page');
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
   q.set('page',String(Math.max(1,Number(routeParams.get('page'))||1)));
   q.set('page_size',String(section==='edit'?1:ADMIN_DEFAULT_PAGE_SIZE));
   for(const key of ['status','category','paper','job','year','author','from','to','search']){
    const value=routeParams.get(key);if(value)q.set(key,value);
   }
   if(section==='mcqs')q.set('owner','me');
   if(section==='edit'&&recordId)q.set('id',recordId);
   if(section==='paper-mcqs'&&recordId)q.set('paper',recordId);
   if(workspace==='super-admin'&&user.activeRole==='super-admin')q.set('admin_scope','1');
   return '/mcqs?'+q.toString();
  };
  const publicMcqEndpoint=()=>{
   const q=new URLSearchParams(),page=Math.max(1,Number(routeParams.get('page'))||1);
   q.set('public','1');q.set('page',String(page));q.set('page_size',String(['mcq','practice'].includes(resolvedBase)?1:10));
   if(!['mcqs','important'].includes(resolvedBase)){const passthrough=['category','paper','job','year','country','search'];for(const key of passthrough){const value=routeParams.get(key);if(value)q.set(key,value)}}
   if(resolvedBase==='home'||resolvedBase==='important')q.set('important','1');
   if(resolvedBase==='category'&&resolvedId)q.set('category',String(resolvedId));
   if(resolvedBase==='subcategory'&&resolvedId)q.set('subcategory',String(resolvedId));
   if(resolvedBase==='topic'&&resolvedId)q.set('child',String(resolvedId));
   if(resolvedBase==='year'&&resolvedId)q.set('year',String(resolvedId));
   if(['mcq','practice'].includes(resolvedBase)&&resolvedId)q.set('id',String(resolvedId));
   return '/mcqs?'+q.toString();
  };
  const entityEndpoint=()=>{
   const q=new URLSearchParams(),adminScope=user&&['admin','super-admin'].includes(workspace);
   let type=adminScope&&['categories','papers','years'].includes(section)?section:null;
   let parent='';
   if(!adminScope){
    if(resolvedBase==='categories')type='categories';
    else if(resolvedBase==='papers')type='papers';
    else if(resolvedBase==='paper'){type='years';parent=String(resolvedId||'')}
    else if(resolvedBase==='job'){type='years';parent=String(resolvedId||'')}
    else if(resolvedBase==='jobs')type=null;
   }
   if(!type)return '';
   q.set('type',type);q.set('page',String(Math.max(1,Number(routeParams.get('page'))||1)));
   if(!adminScope)q.set('scope','public');
   else if(workspace==='super-admin'&&user.activeRole==='super-admin')q.set('admin_scope','1');
   if(parent)q.set('parent',parent);
   else if(routeParams.get('parent'))q.set('parent',routeParams.get('parent'));
   if(adminScope&&routeParams.get('country'))q.set('country',routeParams.get('country'));
   if(routeParams.get('sort'))q.set('sort',routeParams.get('sort'));
   return '/entities?'+q.toString();
  };
  let changed=false;
  const load=async key=>{
   let endpoint='/admin/'+key;
   if(key==='core')endpoint=user?'/bootstrap':'/public/bootstrap';
   else if(key==='public-content')endpoint='/public/content';
   else if(key==='resources')endpoint='/public/resources';
   else if(key==='catalog')endpoint='/public/catalog';
   else if(key==='legal')endpoint='/public/legal';
   else if(key==='learner')endpoint='/learner/dashboard';
   else if(key==='profile')endpoint='/profile';
   else if(key==='workspace-mcqs')endpoint=workspaceEndpoint();
   else if(key==='public-mcqs')endpoint=publicMcqEndpoint();
   else if(key==='entity-page')endpoint=entityEndpoint();
   if(!endpoint)return false;
   const variable=new Set(['workspace-mcqs','public-mcqs','entity-page']);
   const cacheKey=variable.has(key)?key+'|'+endpoint:key;
   const fresh=loadedSections.has(cacheKey)&&Date.now()-(sectionLoadedAt.get(cacheKey)||0)<SECTION_TTL;
   const activePage=key==='entity-page'?MCQ.db.entityPage:MCQ.db.mcqPage;
   if(fresh&&(!variable.has(key)||(activePage?.request===endpoint&&activePage?.routeKey===routeKey)))return false;
   if (loadingSections.has(cacheKey)) {   await loadingSections.get(cacheKey);   return false; }
   const task=(async()=>{
    try{
     const own=generation,data=await request(endpoint);
     if(!['core','public-content','resources','catalog','legal'].includes(key)&&own!==generation)return;
     if(variable.has(key)&&routeKey!==location.pathname+location.search)return;
     if(data.seoIndex)MCQ.mergeCore({seoIndex:data.seoIndex});
     if(key==='core')MCQ.mergeCore(data);
     if(key==='public-content')MCQ.mergeCore(data);
     if(key==='resources'){MCQ.mergeCore(data);window.MCQCampusApplyOptionalIntegrations?.(data.settings||MCQ.db.settings||{});}
     if(key==='catalog')MCQ.mergeCore(data);
     if(key==='legal')MCQ.mergeCore(data);
     if(key==='learner'){
      if(Array.isArray(data.attempts))MCQ.db.attempts=data.attempts;
      if(Array.isArray(data.bookmarks))MCQ.db.bookmarks=data.bookmarks;
      if(Array.isArray(data.savedPapers))MCQ.db.savedPapers=data.savedPapers;
      const attemptedIds=[...new Set((data.attempts||[]).map(row=>Number(row.id)).filter(id=>Number.isInteger(id)&&id>0))].slice(0,100);
      if(attemptedIds.length){try{const historyData=await request('/mcqs?public=1&ids='+attemptedIds.join(',')+'&page_size='+attemptedIds.length);if(Array.isArray(historyData.items))historyData.items.forEach(row=>MCQ.upsert('mcqs',row));}catch(error){console.warn('Learner history question details unavailable.')}}
     }
     if(key==='profile'&&data.user)setIdentity({...user,...data.user});
     if(key==='workspace-mcqs'||key==='public-mcqs'){
      if(Array.isArray(data.items))MCQ.db.mcqs=data.items;
      MCQ.db.mcqPage={page:data.page,pageSize:data.pageSize,total:data.total,hasNext:data.hasNext,server:true,scope:key==='public-mcqs'?'public':'admin',request:endpoint,routeKey};
     }
     if(key==='entity-page'){
      if(Array.isArray(data.items))for(const row of data.items)MCQ.upsert(data.type,row);
      MCQ.db.entityPage={...data,server:true,request:endpoint,routeKey};
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
  // Load hierarchy/reference data first because it intentionally initializes
  // empty MCQ rows; then fetch the route's independent datasets together.
  if(unique.includes('core'))await load('core');
  await Promise.all(unique.filter(key=>key!=='core').map(load));
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
  window.MCQCampusApplyOptionalIntegrations?.(MCQ.db.settings||{});
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
 async function check({loading=true}={}){
  if(checking)return checking;
  const own=generation;
  checking=(async()=>{
   if(loading)backendLoading(true);
   try{
    const data=await request('/startup');
    if(own!==generation)return;
    csrf=data.csrfToken||'';
    window.MCQCampusBackendReady=true;
    hydrate(data.snapshot||{},data.user||null);
   }catch{
    window.MCQCampusBackendReady=false;
    if(own===generation){clearPrivateState();hydrate({},null);}
   }finally{if(loading)backendLoading(false);ready=true;checking=null;}
  })();
  return checking;
 }
 function guard(){
  if(!ready){document.getElementById('app').setAttribute('aria-busy','true');return false;}
  document.getElementById('app').removeAttribute('aria-busy');
  const current=route(),b=base();
  document.body.classList.toggle('auth-screen',authRoutes.has(b));
  const requestedCountry=String(new URLSearchParams(location.search).get('country')||'').trim().toLowerCase();
  const validCountry=(MCQ.db.countries||[]).some(item=>item&&item.active!==false&&String(item.name||'').trim().toLowerCase()===requestedCountry);
  const countryChooser=!user&&['login','register'].includes(b)&&!validCountry;
  document.body.classList.toggle('country-entry-screen',countryChooser);
  if(authRoutes.has(b)){
   if(user){history.replaceState(null,'',UI.href(landing()));return false;}
   return true;
  }
  if(!user && protectedRoutes.has(b)){
   const next=destination(current);
   history.replaceState(null,'',UI.href('login',next?{next}:{}));
   App.route={path:'login',params:next?{next}:{}};
   document.body.classList.add('auth-screen');
   document.getElementById('app').innerHTML=view('login');
   return false;
  }
  if(!user)return true;
  if(!allowed(current)){history.replaceState(null,'',UI.href(landing()));return false;}
  // Keep the URL and server-side workspace role in sync, including direct dashboard links.
  const desiredRole=b==='super-admin'?'super-admin':b==='admin'?'admin':null;
  if(desiredRole&&user.roles?.includes(desiredRole)&&user.activeRole!==desiredRole){
   if(!routeRoleSync){
    routeRoleSync=switchRole(desiredRole).then(()=>App.render()).catch(()=>{}).finally(()=>{routeRoleSync=null;});
   }
   return false;
  }
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
 const field=(name,label,type='text',auto='',extra='',mark=false,showHelp=true)=>{
  const required=mark?' <span class="required-mark" aria-hidden="true">*</span>':'';
  const input='<input id="'+UI.esc(name)+'" name="'+UI.esc(name)+'" type="'+UI.esc(type)+'" autocomplete="'+UI.esc(auto)+'" '+(type==='password'?'minlength="8" ':'')+extra+' required>';
  const values={FIELD_NAME:UI.esc(name),FIELD_LABEL:UI.esc(label),FIELD_REQUIRED:required,FIELD_INPUT:input};
  if(type!=='password')return UI.templateMarkup('mcq-auth-field-template',values)||('<div class="field"><label for="'+UI.esc(name)+'">'+label+required+'</label>'+input+'</div>');
  const help=showHelp&&['password','new_password'].includes(name)?'<small class="password-help">Use at least 8 characters. A longer password with a mix of letters, numbers and symbols is stronger.</small>':'';
  values.FIELD_LABEL_LOWER=UI.esc(String(label).toLowerCase());values.FIELD_TOGGLE_ICON=UI.icon('eye-off');values.FIELD_HELP=help;
  return UI.templateMarkup('mcq-auth-password-field-template',values)||('<div class="field"><label for="'+UI.esc(name)+'">'+label+required+'</label><div class="password-input-wrap">'+input+'<button class="password-toggle-btn" type="button" data-password-toggle="'+UI.esc(name)+'" aria-label="Show '+UI.esc(String(label).toLowerCase())+'" aria-pressed="false">'+UI.icon('eye-off')+'</button></div>'+help+'</div>');
 };
 function view(type){
  const params=new URLSearchParams(route().split('?')[1]||''),emailParam=params.get('email')||'';
  const activeCountries=(MCQ.db.countries||[{name:'Pakistan',active:true}]).filter(item=>item&&item.active!==false&&String(item.name||'').trim());
  const requestedCountry=String(params.get('country')||'').trim();
  const selectedCountry=(activeCountries.find(item=>String(item.name).toLowerCase()===requestedCountry.toLowerCase())||{}).name||'';
  if(['login','register'].includes(type)&&!selectedCountry){
   document.body.classList.add('country-entry-screen');
   const countryShell=document.querySelector('#static-page-shells [data-static-page="country-entry"]');
   if(countryShell){
    const fallback=countryShell.cloneNode(true),countryMain=fallback.querySelector('main');
    if(countryMain){countryMain.id='main';countryMain.tabIndex=-1;}
    return fallback.outerHTML;
   }
   return Public.countryLanding(type);
  }
  document.body.classList.remove('country-entry-screen');
  const defaultCountry=selectedCountry||(activeCountries.find(item=>String(item.name).toLowerCase()==='pakistan')||activeCountries[0]||{name:'Pakistan'}).name;
  const countryOptions=activeCountries.map(item=>'<option value="'+UI.esc(item.name)+'" '+(String(item.name).toLowerCase()===String(defaultCountry).toLowerCase()?'selected':'')+'>'+UI.esc(item.name)+'</option>').join('');
  const countryField='<div class="field"><label for="country">Country <span class="required-mark" aria-hidden="true">*</span></label><select id="country" name="country" required>'+countryOptions+'</select></div>';
  const titles={login:'Welcome back',register:selectedCountry?'Create your '+selectedCountry+' account':'Your next chapter',forgot:'Forgot your password?','reset-code':'Verify reset code','reset-password':'Choose a new password',reset:'Choose a new password',verify:'Email verification'};
  let form='';
  if(type==='login')form=UI.templateMarkup('mcq-auth-login-form-template',{
   AUTH_LOGIN_EMAIL:field('email','Email address','email','email'),
   AUTH_LOGIN_PASSWORD:field('password','Password','password','current-password','',false,false),
   AUTH_LOGIN_FORGOT:UI.link('forgot','Forgot password?','link'),
   AUTH_LOGIN_REGISTER:UI.link('register','Create an account','link')
  })||'';
  if(type==='register')form=UI.templateMarkup('mcq-auth-register-form-template',{
   AUTH_REGISTER_FIRST:field('first_name','First name','text','given-name','',true),
   AUTH_REGISTER_LAST:field('last_name','Last name','text','family-name','',true),
   AUTH_REGISTER_EMAIL:field('email','Email address','email','email','',true),
   AUTH_REGISTER_COUNTRY:countryField,
   AUTH_REGISTER_PASSWORD:field('password','Password','password','new-password','',true,false),
   AUTH_REGISTER_CONFIRM:field('confirm','Confirm password','password','new-password','',true,false),
   AUTH_REGISTER_TERMS:UI.link('terms','terms','link'),
   AUTH_REGISTER_PRIVACY:UI.link('privacy','privacy policy','link'),
   AUTH_REGISTER_LOGIN:UI.link('login','Log in','link')
  })||'';
  if(type==='forgot')form=UI.templateMarkup('mcq-auth-forgot-form-template',{AUTH_FORGOT_EMAIL:field('email','Email address','email','email')})||'';
  if(type==='reset-code')form=UI.templateMarkup('mcq-auth-reset-code-form-template',{
   RESET_CODE_EMAIL:UI.esc(emailParam),
   AUTH_RESET_CODE_FIELD:field('code','6-digit reset code','text','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}"',true),
   AUTH_RESET_CODE_FORGOT:UI.link('forgot','Use a different email','link')
  })||'';
  if(type==='reset-password')form=UI.templateMarkup('mcq-auth-reset-password-form-template',{
   RESET_PASSWORD_EMAIL:UI.esc(emailParam),
   AUTH_RESET_PASSWORD_FIELD:field('password','New password','password','new-password'),
   AUTH_RESET_PASSWORD_CONFIRM:field('confirm','Confirm new password','password','new-password')
  })||'';
  if(type==='verify'){form=UI.templateMarkup('mcq-auth-verify-form-template',{
   AUTH_VERIFY_EMAIL:field('email','Email address','email','email','value="'+UI.esc(emailParam)+'"'),
   AUTH_VERIFY_CODE:field('code','6-digit verification code','text','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}"'),
   AUTH_VERIFY_LOGIN:UI.link('login','Back to login','link')
  })||'';setTimeout(()=>syncVerificationTimer(emailParam),0)}
  return UI.layout(UI.templateMarkup('mcq-auth-layout-template',{AUTH_TITLE:UI.esc(titles[type]),AUTH_FORM:form})||('<div class="container"><div class="auth-layout"><div class="auth-story"><p class="eyebrow">MCQCampus</p><h2>Make room<br>for progress.</h2><p>Your questions, your pace,<br>your next step forward.</p></div><div class="auth-form"><h1>'+UI.esc(titles[type])+'</h1>'+form+'</div></div></div>'));
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
  if(action==='form:review'){
   if(Array.isArray(result?.mcqs))result.mcqs.forEach(row=>MCQ.upsert('mcqs',row));
   if(result?.allPending&&result?.status==='approved'){
    for(const q of MCQ.db.mcqs||[])if(q.status==='pending'||q.pending_update){q.status='approved';q.pending_update=null;q.rejection_reason='';}
   }
   return
  }
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
 function invalidatePagedLists(){
  for(const key of [...loadedSections])if(['workspace-mcqs|','public-mcqs|','entity-page|'].some(prefix=>String(key).startsWith(prefix))){loadedSections.delete(key);sectionLoadedAt.delete(key)}
  loadedSections.delete('core');sectionLoadedAt.delete('core');
  if(window.MCQ?.db){MCQ.db.entityPage=null;MCQ.db.mcqPage={...(MCQ.db.mcqPage||{}),server:false}}
 }
 async function command(action,payload){
  if(!user)throw Error('Sign in to save this activity.');
  const key=JSON.stringify([action,payload]);if(pendingCommands.has(key))return pendingCommands.get(key);
  const task=(async()=>{
   const longBulkReview=action==='form:review'&&String(payload?.context?.allPending||'').toLowerCase()==='true';
   const own=generation,data=await request('/commands',{action,payload},{loading:action==='action:import-confirm'||longBulkReview,timeout:action==='action:import-confirm'?60000:(longBulkReview?120000:15000)});
   if(own!==generation)throw Error('The account changed. Please try again.');
   if(data.user)setIdentity({...user,...data.user});
   if(data.seoIndex)MCQ.mergeCore({seoIndex:data.seoIndex});
   applyCommandResult(action,data.result,payload);
   if(['form:mcq','form:review','action:import-confirm','action:mcq-delete','action:mcq-delete-confirm','action:mcq-bulk-delete','action:trash-restore','action:restore-trash','action:trash-restore-many','action:trash-bulk-restore'].includes(action))invalidatePagedLists();
   if(['form:entity','action:entity-pin','action:entity-delete','action:entity-delete-confirm','action:entity-bulk-delete','action:bulk-hierarchy','action:bulk-categories'].includes(action))invalidatePagedLists();
   if(['action:mcq-delete','action:mcq-delete-confirm','action:mcq-bulk-delete','action:trash-restore','action:restore-trash','action:trash-restore-many','action:trash-bulk-restore','action:trash-permanent-delete','action:trash-bulk-delete'].includes(action)){loadedSections.delete('trash');sectionLoadedAt.delete('trash')}
   if(data.refresh==='bootstrap'){
    const snapshot=await request('/bootstrap');
    if(own!==generation)throw Error('The account changed. Please try again.');
    hydrate(snapshot,user);
   }else if(['form:config','form:settings','form:entity'].includes(action)){
    const snapshot=await request('/bootstrap');
    if(own!==generation)throw Error('The account changed. Please try again.');
    hydrate(snapshot,user);
    loadedSections.delete('resources');sectionLoadedAt.delete('resources');
   }
   return data.result;
  })();
  pendingCommands.set(key,task);try{return await task}finally{pendingCommands.delete(key)}
 }
 const originalAttempt=MCQ.attempt;
 MCQ.attempt=(...args)=>user?command('attempt',{args}):originalAttempt(...args);
 for(const name of ['toggleBookmark','savePaper','saveProfile','changePassword'])MCQ[name]=(...args)=>command(name,{args});
 MCQ.report=(id,reason)=>user?command('report',{args:[id,reason]}):request('/report',{id,reason});

 document.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-password-toggle]');if(!toggle)return;
  const input=toggle.closest('.password-input-wrap')?.querySelector('input');if(!input)return;
  const reveal=input.type==='password';input.type=reveal?'text':'password';
  toggle.setAttribute('aria-pressed',String(reveal));
  toggle.setAttribute('aria-label',(reveal?'Hide ':'Show ')+(input.labels?.[0]?.textContent||'password').replace('*','').trim().toLowerCase());
  toggle.innerHTML=UI.icon(reveal?'eye':'eye-off');
 });

 function resumePendingPublicAction(){
  const action=pendingPublicAction;pendingPublicAction=null;
  if(!action||!user)return;
  const url=String(action.url||'');
  if(/^data:application\/pdf;base64,/i.test(url)){
   const a=document.createElement('a');a.href=url;a.download=String(action.downloadName||'mcqcampus.pdf');document.body.appendChild(a);a.click();a.remove();return;
  }
  if(/^https?:\/\//i.test(url))window.location.assign(url);
 }
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[data-auth-action]');if(!anchor||user)return;
  const href=String(anchor.href||'').trim();if(!href)return;
  const kind=anchor.dataset.authAction;
  if(kind==='download-pdf'&&!(/^https?:\/\//i.test(href)||/^data:application\/pdf;base64,/i.test(href)))return;
  if(kind==='apply-job'&&!/^https?:\/\//i.test(href))return;
  event.preventDefault();event.stopImmediatePropagation();
  pendingPublicAction={kind,url:href,downloadName:anchor.dataset.authDownloadName||'mcqcampus.pdf'};
  const next=(location.pathname||'/').replace(/^\/+/, '')+location.search;
  App.go('login',next?{next}:{});
  UI.toast(kind==='download-pdf'?'Sign in to download this PDF.':'Sign in to continue to the official application page.');
 },true);

 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form^="auth-"]');if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form)),type=form.dataset.form.slice(5),button=form.querySelector('[type=submit]'),box=form.querySelector('[data-auth-error]');
  box.textContent='';
  const labels={login:'Signing in...',register:'Creating account...',forgot:'Sending...', 'reset-code':'Verifying...', 'reset-password':'Updating...',reset:'Updating...',verify:'Verifying...'};
  const restoreButton=setButtonLoading(button,labels[type]||'Working...');
  try{
   if((type==='reset-password'||type==='reset'||type==='register')&&values.password!==values.confirm)throw Error('Passwords do not match.');
   const params=new URLSearchParams(route().split('?')[1]||'');
   const apiType=(type==='reset-code'||type==='reset-password')?'reset':type;
   if(type==='reset-code')values.stage='verify';
   if(type==='reset-password')values.stage='update';
   const data=await request('/auth/'+apiType,values);
   if(type==='login'){
    csrf=data.csrfToken||csrf;setIdentity(data.user);ready=true;lastSessionValidation=Date.now();
    const next=destination(params.get('next')),target=next&&allowed(next)?next:'home';App.go(target);setTimeout(resumePendingPublicAction,300);
   }else if(type==='register'&&data.verificationRequired){
    const verifyEmail=data.email||values.email;
    armVerificationTimer(verifyEmail,data.resendAfter||60);
    App.go('verify',{email:verifyEmail});
   }else if(type==='forgot'){
    box.textContent=data.message||'If an active account matches that email, a reset code has been sent.';
    setTimeout(()=>App.go('reset-code',{email:values.email||''}),700);
   }else if(type==='reset-code'&&data.completed){
    box.textContent=data.message||'Code verified. Choose a new password.';
    setTimeout(()=>App.go('reset-password',{email:values.email||''}),450);
   }else if(type==='verify'&&data.completed){
    if(data.user){csrf=data.csrfToken||csrf;setIdentity(data.user);ready=true;lastSessionValidation=Date.now();App.go('home');setTimeout(resumePendingPublicAction,300);}
    else{box.textContent=data.message||'Email verified. You can now sign in.';setTimeout(()=>App.go('login'),700);}
   }else if((type==='reset-password'||type==='reset')&&data.completed){
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

 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form="move-past-paper-mcqs"]');if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!user?.roles?.includes('super-admin')){UI.toast('Only a Super Admin can move MCQs between Past Papers.');return;}
  if(!form.reportValidity())return;
  const fd=new FormData(form),button=form.querySelector('[type="submit"]'),mcq_ids=fd.getAll('mcq_ids').map(Number).filter(id=>Number.isInteger(id)&&id>0);
  if(!mcq_ids.length){UI.toast('Select at least one MCQ to move.');return;}
  const restore=setButtonLoading(button,'Moving MCQs...');
  try{
   const result=await request('/admin/mcqs/move-past-paper',{
    source_year_id:Number(fd.get('source_year_id')),
    destination_year_id:Number(fd.get('destination_year_id')),
    mcq_ids,
    delete_empty_source:fd.has('delete_empty_source')
   });
   invalidatePagedLists();
   const snapshot=await request('/bootstrap');
   hydrate(snapshot,user);
   UI.toast(result.message||('Moved '+Number(result.moved||0)+' MCQ(s).'));
   if(result.source_deleted)App.go('super-admin/overview');else App.render();
  }catch(error){UI.toast(error.message);}
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

 const writeActions=new Set(['entity-delete-confirm','entity-bulk-delete','hierarchy-bulk-delete','report-resolve','import-confirm','user-status','post-delete','pdf-delete','latest-job-toggle','latest-job-delete','latest-job-bulk-delete','ad-toggle','ad-delete']);
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||!writeActions.has(el.dataset.action))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(el.dataset.loading==='true')return;
  const actionLabels={'entity-delete-confirm':'Deleting...','entity-bulk-delete':'Deleting...','hierarchy-bulk-delete':'Deleting...','trash-restore':'Restoring...','report-resolve':'Updating...','restore-trash':'Restoring...','import-confirm':'Importing...','user-status':'Updating...','post-delete':'Deleting...','pdf-delete':'Deleting...','latest-job-toggle':'Updating...','latest-job-delete':'Deleting...','latest-job-bulk-delete':'Deleting...','ad-toggle':'Updating...','ad-delete':'Deleting...'};
  const restoreButton=setButtonLoading(el,actionLabels[el.dataset.action]||'Working...');
  try{
   let selectedImportRows=App.importRows;if(el.dataset.action==='import-confirm'){const selected=[...document.querySelectorAll('.import-row-check:checked')].map(x=>Number(x.value)).filter(Number.isInteger);if(!selected.length)throw Error('Select at least one MCQ to import.');selectedImportRows=selected.map(i=>App.importRows?.[i]).filter(Boolean);if(selectedImportRows.some(r=>!r?.q))throw Error('Selected import row is missing normalized MCQ data. Re-upload the file.');}const extra={...el.dataset,rows:el.dataset.action==='import-confirm'?selectedImportRows.map(r=>r.q):App.importRows};
   if(['entity-bulk-delete','hierarchy-bulk-delete'].includes(el.dataset.action)){const type=el.dataset.type;extra.ids=[...document.querySelectorAll(`.${el.dataset.action==='entity-bulk-delete'?'entity':'hierarchy'}-row-check[data-type="${type}"]:checked`)].map(x=>Number(x.value)).filter(Boolean);if(!extra.ids.length)throw Error('Select at least one record.');}
   if(el.dataset.action==='latest-job-bulk-delete'){MCQ.assert('latestJobDelete');extra.ids=[...document.querySelectorAll('.latest-job-row-check:checked')].map(x=>Number(x.value));if(!extra.ids.length)throw Error('Select at least one job.');if(!window.confirm('Delete '+extra.ids.length+' selected job announcements?'))return;}
   const result=await command('action:'+el.dataset.action,extra);if(el.dataset.action==='import-confirm'){
    App.importSummary=result?.summary||result;
    App.importedIds=(result?.importedIds||result?.mcqs?.map(x=>x.id)||[]).map(Number).filter(Number.isInteger);
    App.importPage={...(result?.importPage||{page:1,pageSize:50,total:App.importedIds.length,hasNext:App.importedIds.length>50}),ids:App.importedIds.slice(0,50)};
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
    App.go('home');
   }finally{
    backendLoading(false);
    majorTransition=null;
   }
  })();
  return majorTransition;
 }
 async function start(){const app=document.getElementById('app'),initialBase=base(),authFirst=authRoutes.has(initialBase);document.body.classList.toggle('auth-screen',authFirst);document.body.classList.toggle('country-entry-screen',authFirst&&['login','register'].includes(initialBase)&&!new URLSearchParams(location.search).has('country'));if(authFirst){ready=true;if(app)app.innerHTML=view(initialBase);}else window.App?.showStaticShell?.();try{await check({loading:false});window.MCQCampusApplyOptionalIntegrations?.(MCQ.db.settings||{});if(!authRoutes.has(base()))await ensureRouteData(route(),{});}finally{ready=true;App.render();}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)validateSession(false).then(()=>App.render());});
 window.addEventListener('pageshow',event=>{if(event.persisted&&user)validateSession(false).then(()=>App.render());});
 document.addEventListener('input',event=>{if(event.target.closest('form[data-form="mcq"]'))window.mcqDirty=true;});
 window.addEventListener('beforeunload',event=>{if(window.mcqDirty){event.preventDefault();event.returnValue='';}});
 return {guard,view,start,logout,switchRole,request,command,ensureRouteData,destination,allowed,ADMIN_PAGE_SIZES,ADMIN_DEFAULT_PAGE_SIZE,get user(){return user;}};
})();


/* ===== END MODULE: auth.js ===== */

;


/* SOURCE: frontend/js/admin/importer.js */
/* Strict UTF-8 TXT / RFC-style CSV / JSON importer. No numeric coercion of options. */
window.Importer=(()=>{
 const fields={question:'question',option1:'option1',option2:'option2',option3:'option3',option4:'option4',correctanswer:'correct_answer',description:'description',country:'country',category:'category',categoryname:'category',paper:'paper',organization:'paper',organizationboard:'paper',board:'paper',pastpaper:'pastpaper',pastpapername:'pastpaper',categoryid:'category_id',paperid:'paper_id',pastpaperid:'job_years_ids',pastpaperids:'job_years_ids',jobyearsids:'job_years_ids'};
 const key=k=>fields[k.toLowerCase().replace(/[^a-z0-9]/g,'')]||k;
 function csv(text){let rows=[],row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else if(!cell||quote)quote=!quote;else throw Error('Unexpected quote in CSV field.')}else if(c===','&&!quote){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quote)throw Error('Unclosed quoted CSV field.');if(cell||row.length){row.push(cell);rows.push(row)}const headers=rows.shift()?.map(h=>key(h.trim()));if(!headers||!headers.includes('question'))throw Error('CSV needs a Question header.');if(new Set(headers).size!==headers.length)throw Error('CSV contains duplicate column headers.');return rows.map((r,i)=>{const o=Object.fromEntries(headers.map((h,j)=>[h,r[j]??'']));if(r.length!==headers.length)o._parseError='Column count does not match headers.';return o})}
 function txt(text){const chunks=text.trim().split(/\n\s*\n(?=\S)/);return chunks.filter(x=>x.trim()).map(block=>{const lines=block.split('\n').map(x=>x.trim());let o={};let pos=0,last='';for(const line of lines){const m=line.match(/^(Question|Option\s*[1-4]|Correct Answer|Country|Category|Organization\s*\/\s*Board|Organization|Board|Past Paper|Paper|Description)\s*:\s*(.*)$/i);if(m){last=key(m[1]);o[last]=m[2]}else if(pos<5&&!last){o[pos===0?'question':'option'+pos]=line;pos++}else if(last==='description')o.description+='\n'+line;else o._parseError='Unexpected line: '+line}return o})}
 function parse(text,ext){text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');if(ext==='csv')return csv(text);if(ext==='txt')return txt(text);if(ext==='json'){const d=JSON.parse(text);const rows=Array.isArray(d)?d:d.mcqs||d.data;if(!Array.isArray(rows))throw Error('JSON must be an array or an object containing an mcqs/data array.');return rows.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r))return {_parseError:'Row must be an object.'};return Object.fromEntries(Object.entries(r).map(([k,v])=>[key(k),v]))})}throw Error('Choose a TXT, CSV or JSON file.')}
 function resolveName(type,value,parentIds){const names=Array.isArray(value)?value:String(value??'').split('|').filter(Boolean);const parent=MCQ.parents[type];return names.map(name=>{const matches=MCQ.db[type].filter(x=>(type!=='categories'||!x.legacy)&&MCQ.norm(x.name)===MCQ.norm(name)&&(!parent||parentIds.includes(x[parent[1]]))&&(type!=='categories'||!MCQ.db.activeCountry||(x.country||'Pakistan')==='Both'||MCQ.norm(x.country||'Pakistan')===MCQ.norm(MCQ.db.activeCountry)));if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Unknown')+' '+type+': '+name);return matches[0].id})}
 function normalize(raw){const q={question:String(raw.question??'').trim(),description:String(raw.description??''),correct_answer:String(raw.correct_answer??'').trim(),subcategory_ids:[],child_subcategory_ids:[]};for(let i=1;i<=4;i++)q['option'+i]=String(raw['option'+i]??'').trim();q.country=String(raw.country||MCQ.db.activeCountry||MCQ.db.session?.country||'Pakistan').trim();q.category_id=raw.category_id?+raw.category_id:resolveName('categories',raw.category,[])[0];q.paper_id=raw.paper_id?MCQ.ids(raw.paper_id):resolveName('papers',raw.paper,[]);q.job_ids=[];const pastPaperValue=raw.pastpaper??raw.job_years_ids??raw.job_year_ids;q.job_years_ids=Array.isArray(pastPaperValue)||typeof pastPaperValue==='number'?MCQ.ids(pastPaperValue):resolveName('years',pastPaperValue,q.paper_id);return q}
 function identityKey(value){return String(value??'').normalize('NFKC').replace(/\u00a0/g,' ').trim().toLowerCase().replace(/\s+/g,' ')}
 function prepareRows(rows){
  const groups=new Map,out=[];
  const add=(a,b)=>[...new Set([...MCQ.ids(a),...MCQ.ids(b)].map(Number).filter(Boolean))];
  for(const row of rows||[]){
   if(!row?.q||row.status==='invalid'){out.push(row);continue}
   const key=identityKey(row.q.question);
   if(!groups.has(key)){
    const copy={...row,q:{...row.q,paper_id:MCQ.ids(row.q.paper_id),job_ids:MCQ.ids(row.q.job_ids),job_years_ids:MCQ.ids(row.q.job_years_ids)},mergedRows:0,duplicateRows:0};
    groups.set(key,copy);out.push(copy);continue;
   }
   const base=groups.get(key);
   const before={p:MCQ.ids(base.q.paper_id),j:MCQ.ids(base.q.job_ids),y:MCQ.ids(base.q.job_years_ids)};
   base.q.paper_id=add(base.q.paper_id,row.q.paper_id);
   base.q.job_ids=add(base.q.job_ids,row.q.job_ids);
   base.q.job_years_ids=add(base.q.job_years_ids,row.q.job_years_ids);
   const changed=base.q.paper_id.length>before.p.length||base.q.job_ids.length>before.j.length||base.q.job_years_ids.length>before.y.length;
   if(changed)base.mergedRows=(base.mergedRows||0)+1;
   else base.duplicateRows=(base.duplicateRows||0)+1;
  }
  return out
 }
 function preview(raws){
  const normalized=raws.map((raw,i)=>{
   let row={line:i+1,raw,question:raw.question||'',errors:[],status:'valid'};
   try{
    row.q=normalize(raw);
    row.errors=MCQ.validate(row.q);
    if(raw._parseError)row.errors.unshift(raw._parseError);
    if(row.errors.length)row.status='invalid';
   }catch(e){row.status='invalid';row.errors=[e.message]}
   return row
  });
  return prepareRows(normalized).map(row=>{
   if(row.status==='invalid'||!row.q)return row;
   const existing=MCQ.db.mcqs.find(x=>identityKey(x.question)===identityKey(row.q.question));
   const ids=v=>[...new Set(MCQ.ids(v).map(Number).filter(Boolean))];
   const current=existing?{p:ids(existing.paper_id),j:ids(existing.job_ids),y:ids(existing.job_years_ids)}:{p:[],j:[],y:[]};
   const incoming={p:ids(row.q.paper_id),j:ids(row.q.job_ids),y:ids(row.q.job_years_ids)};
   const hasNew=incoming.p.some(x=>!current.p.includes(x))||incoming.j.some(x=>!current.j.includes(x))||incoming.y.some(x=>!current.y.includes(x));
   row.existing=existing&&MCQ.managedRows('mcqs').some(q=>q.id===existing.id)?existing.id:undefined;
   if(existing&&!hasNew){
    row.status='duplicate';
    row.errors=['Duplicate ignored: this question already has the same Organization / Board / Past Paper links.'];
   }else if(existing){
    row.status='update';
    row.errors=['Existing website MCQ: new unique Organization / Board / Past Paper links will be added to the stored MCQ.'+(row.mergedRows?' '+row.mergedRows+' repeated upload row(s) were consolidated first.':'')+(row.duplicateRows?' '+row.duplicateRows+' exact duplicate row(s) ignored.':'')];
   }else if(row.mergedRows){
    row.status='merge';
    row.errors=['Repeated question in this upload: unique Organization / Board and Past Paper links were combined into one MCQ.'+(row.duplicateRows?' '+row.duplicateRows+' exact duplicate row(s) ignored.':'')];
   }else{
    row.status='valid';
    if(row.duplicateRows)row.errors=[row.duplicateRows+' exact duplicate row(s) ignored.'];
   }
   return row
  })
 }
 return {parse,preview,prepareRows,normalize,csv};
})();


/* SOURCE: frontend/js/admin/enhancements.js */
/* Additional content-management interactions for the production frontend. */
window.MCQEnhancements=(()=>{
 const e=UI.esc;
 const nextId=rows=>Math.max(0,...(rows||[]).map(x=>Number(x.id)||0))+1;
 const stamp=()=>new Date().toISOString();
 const actor=()=>MCQ.db.session||{name:'Unknown',id:null};
 const checked=selector=>[...document.querySelectorAll(selector+':checked')].map(x=>Number(x.value)).filter(Boolean);
 function saveAndRender(message){MCQ.save();App.render();if(message)UI.toast(message)}
 function entityCount(type){const n=document.querySelectorAll(`.entity-row-check[data-type="${type}"]:checked`).length,box=document.querySelector(`[data-entity-selection-count="${type}"]`);if(box)box.textContent=n+' selected'}
 function hierarchyCount(type){const n=document.querySelectorAll(`.hierarchy-row-check[data-type="${type}"]:checked`).length;document.querySelectorAll(`[data-hierarchy-count="${type}"]`).forEach(x=>x.textContent=n)}
 function deleteEntityMany(type,ids){MCQ.assert(type);let removed=0;for(const id of ids){if(!MCQ.get(type,id))continue;MCQ.softDeleteEntity(type,id);removed++}return removed}
 function readImage(file,done){if(!/^image\/(png|jpeg|webp)$/i.test(file.type))throw Error('Image must be PNG, JPG or WebP.');if(file.size>900*1024)throw Error('Image must be 900 KB or smaller.');const r=new FileReader();r.onload=()=>done(r.result);r.readAsDataURL(file)}
 document.addEventListener('change',ev=>{
  try{
   if(ev.target.classList.contains('entity-row-check'))entityCount(ev.target.dataset.type);
   if(ev.target.classList.contains('hierarchy-row-check'))hierarchyCount(ev.target.dataset.type);
   if(ev.target.id==='pdf-cover-file'&&ev.target.files[0]){const f=ev.target.closest('form'),preview=document.getElementById('pdf-cover-preview');readImage(ev.target.files[0],data=>{f.querySelector('[name="cover_data"]').value=data;f.querySelector('[name="cover"]').value='';if(preview)preview.innerHTML=`<img src="${e(data)}" alt="">`})}
   if(ev.target.id==='pdf-file'&&ev.target.files[0]){const file=ev.target.files[0],f=ev.target.closest('form'),name=f.querySelector('[data-pdf-file-name]');if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('Choose a PDF file.');if(file.size>1.5*1024*1024)throw Error('PDF uploads through this form are limited to 1.5 MB. Use an external HTTPS download URL for larger files.');const r=new FileReader();r.onload=()=>{f.querySelector('[name="pdf_file_data"]').value=r.result;f.querySelector('[name="download_url"]').value='';if(name)name.textContent=file.name;};r.readAsDataURL(file)}
  }catch(err){UI.toast(err.message)}
 });
 document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=Number(el.dataset.id)||0;try{
  if(a==='entity-select-all'){const type=el.dataset.type;document.querySelectorAll(`.entity-row-check[data-type="${type}"]`).forEach(x=>x.checked=el.checked);entityCount(type)}
  if(a==='entity-bulk-delete'){const type=el.dataset.type,ids=checked(`.entity-row-check[data-type="${type}"]`);if(!ids.length)return UI.toast('Select at least one record.');if(!confirm(`Move ${ids.length} selected ${type} record(s) to Trash?`))return;saveAndRender(deleteEntityMany(type,ids)+' record(s) moved to Trash.')}
  if(a==='hierarchy-bulk-delete'){const type=el.dataset.type,ids=checked(`.hierarchy-row-check[data-type="${type}"]`);if(!ids.length)return UI.toast('Select at least one record.');if(!confirm(`Move ${ids.length} selected ${type} record(s) to Trash?`))return;saveAndRender(deleteEntityMany(type,ids)+' record(s) moved to Trash.')}
  if(a==='post-delete'){MCQ.assert('postDelete');if(confirm('Delete this blog post?')){MCQ.db.posts=MCQ.db.posts.filter(x=>+x.id!==id);saveAndRender('Blog post deleted.')}}
  if(a==='pdf-new'||a==='pdf-edit')Admin.pdfModal(id||undefined);
  if(a==='pdf-delete'){MCQ.assert('pdfDelete');if(confirm('Delete this PDF record?')){MCQ.db.pdfs=(MCQ.db.pdfs||[]).filter(x=>+x.id!==id);saveAndRender('PDF deleted.')}}
  if(a==='latest-job-new'||a==='latest-job-edit')Admin.latestJobModal(id||undefined);
  if(a==='latest-job-toggle'){MCQ.assert('latestJobs');const row=(MCQ.db.latestJobs||[]).find(x=>+x.id===id);if(row){row.published=row.published===false;row.updated_at=stamp();saveAndRender(row.published?'Job published.':'Job unpublished.')}}
  if(a==='latest-job-delete'){MCQ.assert('latestJobDelete');if(confirm('Delete this Latest Jobs announcement?')){MCQ.db.latestJobs=(MCQ.db.latestJobs||[]).filter(x=>+x.id!==id);saveAndRender('Latest Jobs announcement deleted.')}}
 }catch(err){UI.toast(err.message)}});
 document.addEventListener('submit',ev=>{const f=ev.target.closest('form[data-form]');if(!f)return;const type=f.dataset.form;if(!['pdf','latest-job'].includes(type))return;ev.preventDefault();const fd=new FormData(f),v=Object.fromEntries(fd),now=stamp(),who=actor();try{
  if(type==='pdf'){
   MCQ.assert('pdfs');const id=Number(f.dataset.id)||0,old=(MCQ.db.pdfs||[]).find(x=>+x.id===id),fileData=String(v.pdf_file_data||'').trim(),url=String(v.download_url||'').trim(),cover=String(v.cover_data||v.cover||old?.cover||'').trim();if(url&&!/^https?:\/\//i.test(url))throw Error('PDF Download URL must start with http:// or https://.');if(fileData&&!/^data:application\/pdf;base64,/i.test(fileData))throw Error('Uploaded PDF data is invalid.');if(cover&&!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(cover)&&!/^https?:\/\//i.test(cover))throw Error('Thumbnail must be an uploaded image or an http(s) URL.');const download=fileData||url||old?.download_url||'';const row={...old,id:old?.id||nextId(MCQ.db.pdfs),title:String(v.title||'').trim(),slug:MCQ.slug(String(v.title||'').trim()),description:String(v.description||'').trim(),seo_title:String(v.title||'').trim(),seo_description:String(v.description||'').trim().slice(0,155),download_url:download,cover:old?.cover||'',active:true,created_at:old?.created_at||now,created_by:old?.created_by||who.name,created_by_id:old?.created_by_id||who.id,updated_at:now,updated_by:who.name,updated_by_id:who.id};if(!row.title)throw Error('PDF Title is required.');if(!row.download_url)throw Error('Choose a PDF file or enter a Download URL.');MCQ.db.pdfs=MCQ.db.pdfs||[];if(old)MCQ.db.pdfs.splice(MCQ.db.pdfs.indexOf(old),1,row);else MCQ.db.pdfs.unshift(row);document.getElementById('modal')?.close();saveAndRender('PDF saved. It is now available from the direct-download listing.')
  }
  if(type==='latest-job'){
   MCQ.assert('latestJobs');const id=Number(f.dataset.id)||0,old=(MCQ.db.latestJobs||[]).find(x=>+x.id===id),paperId=Number(v.paper_id),org=MCQ.get('papers',paperId),title=String(v.title||'').trim(),lastDate=String(v.last_date||'').trim(),apply=String(v.apply_url||'').trim();if(!org)throw Error('Choose a valid Organization / Paper.');if(!title)throw Error('Job Title is required.');if(!lastDate)throw Error('Last Date is required.');if(apply&&!/^https?:\/\//i.test(apply))throw Error('Apply URL must start with http:// or https://.');const row={...old,id:old?.id||nextId(MCQ.db.latestJobs),paper_id:paperId,title,slug:MCQ.slug(org.name+' '+title),seo_title:title,seo_description:(org.name+' — '+title+' · Last date '+lastDate).slice(0,155),last_date:lastDate,apply_url:apply,published:v.published==='on',created_at:old?.created_at||now,created_by:old?.created_by||who.name,created_by_id:old?.created_by_id||who.id,updated_at:now,updated_by:who.name,updated_by_id:who.id};MCQ.db.latestJobs=MCQ.db.latestJobs||[];if(old)MCQ.db.latestJobs.splice(MCQ.db.latestJobs.indexOf(old),1,row);else MCQ.db.latestJobs.unshift(row);document.getElementById('modal')?.close();saveAndRender('Latest Job saved.')
  }
 }catch(err){UI.toast(err.message)}});
 return {};
})();


/* SOURCE: frontend/js/pages/about.js */
/* Page-specific JavaScript: frontend/js/pages/about.js
 * Add custom buttons, event handlers and behavior for the about page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["about"]||(registry["about"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="about";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"about",path:context.path||global.location.pathname,base:context.base||"about",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/admin.js */
/* Page-specific JavaScript: frontend/js/pages/admin.js
 * Add custom buttons, event handlers and behavior for the admin page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["admin"]||(registry["admin"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="admin";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"admin",path:context.path||global.location.pathname,base:context.base||"admin",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/blog.js */
/* Page-specific JavaScript: frontend/js/pages/blog.js
 * Add custom buttons, event handlers and behavior for the blog page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["blog"]||(registry["blog"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="blog";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"blog",path:context.path||global.location.pathname,base:context.base||"blog",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/categories.js */
/* Page-specific JavaScript: frontend/js/pages/categories.js
 * Add custom buttons, event handlers and behavior for the categories page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["categories"]||(registry["categories"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="categories";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"categories",path:context.path||global.location.pathname,base:context.base||"categories",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/contact.js */
/* Page-specific JavaScript: frontend/js/pages/contact.js
 * Add custom buttons, event handlers and behavior for the contact page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["contact"]||(registry["contact"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="contact";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"contact",path:context.path||global.location.pathname,base:context.base||"contact",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/dashboard.js */
/* Page-specific JavaScript: frontend/js/pages/dashboard.js
 * Add custom buttons, event handlers and behavior for the dashboard page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["dashboard"]||(registry["dashboard"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="dashboard";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"dashboard",path:context.path||global.location.pathname,base:context.base||"dashboard",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/home.js */
/* Page-specific JavaScript: frontend/js/pages/home.js
 * Add custom buttons, event handlers and behavior for the home page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["home"]||(registry["home"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="home";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"home",path:context.path||global.location.pathname,base:context.base||"home",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/latest-jobs.js */
/* Page-specific JavaScript: frontend/js/pages/latest-jobs.js
 * Add custom buttons, event handlers and behavior for the latest-jobs page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["latest-jobs"]||(registry["latest-jobs"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="latest-jobs";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"latest-jobs",path:context.path||global.location.pathname,base:context.base||"latest-jobs",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/login.js */
/* Page-specific JavaScript: frontend/js/pages/login.js
 * Add custom buttons, event handlers and behavior for the login page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["login"]||(registry["login"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="login";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"login",path:context.path||global.location.pathname,base:context.base||"login",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/mcqs.js */
/* Page-specific JavaScript: frontend/js/pages/mcqs.js
 * Add custom buttons, event handlers and behavior for the mcqs page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["mcqs"]||(registry["mcqs"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="mcqs";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"mcqs",path:context.path||global.location.pathname,base:context.base||"mcqs",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/past-papers.js */
/* Page-specific JavaScript: frontend/js/pages/past-papers.js
 * Add custom buttons, event handlers and behavior for the past-papers page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["past-papers"]||(registry["past-papers"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="past-papers";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"past-papers",path:context.path||global.location.pathname,base:context.base||"past-papers",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/pdfs.js */
/* Page-specific JavaScript: frontend/js/pages/pdfs.js
 * Add custom buttons, event handlers and behavior for the pdfs page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["pdfs"]||(registry["pdfs"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="pdfs";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"pdfs",path:context.path||global.location.pathname,base:context.base||"pdfs",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/register.js */
/* Page-specific JavaScript: frontend/js/pages/register.js
 * Add custom buttons, event handlers and behavior for the register page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["register"]||(registry["register"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="register";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"register",path:context.path||global.location.pathname,base:context.base||"register",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/super-admin.js */
/* Page-specific JavaScript: frontend/js/pages/super-admin.js
 * Add custom buttons, event handlers and behavior for the super-admin page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["super-admin"]||(registry["super-admin"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="super-admin";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"super-admin",path:context.path||global.location.pathname,base:context.base||"super-admin",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/pages/tests.js */
/* Page-specific JavaScript: frontend/js/pages/tests.js
 * Add custom buttons, event handlers and behavior for the tests page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["tests"]||(registry["tests"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="tests";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"tests",path:context.path||global.location.pathname,base:context.base||"tests",root}
  }));
 };
})(window);


/* SOURCE: frontend/js/app.js */
/* Route-specific JavaScript extensions are independent files under frontend/js/pages/. */
window.MCQCampusPageScriptsLoaded=window.MCQCampusPageScriptsLoaded||new Set();
window.MCQCampusPageScriptPromises=window.MCQCampusPageScriptPromises||new Map();
window.MCQCampusPageHooks=window.MCQCampusPageHooks||Object.create(null);
window.MCQCampusLoadPageScript=function(name){
 const safeName=String(name||"");
 if(!/^[a-z-]+$/.test(safeName))return Promise.resolve(false);
 if(window.MCQCampusPageScriptsLoaded.has(safeName))return Promise.resolve(true);
 const pending=window.MCQCampusPageScriptPromises.get(safeName);
 if(pending)return pending;
 const task=new Promise(resolve=>{
  const script=document.createElement("script");
  script.src="/assets/js/pages/"+safeName+".js?v=20261023-static-html-components-v4";
  script.dataset.mcqCampusPageScript=safeName;
  script.async=true;
  script.onload=()=>{window.MCQCampusPageScriptsLoaded.add(safeName);resolve(true)};
  script.onerror=()=>{script.remove();console.warn("Page-specific JavaScript is unavailable:",safeName);resolve(false)};
  document.head.appendChild(script);
 }).finally(()=>window.MCQCampusPageScriptPromises.delete(safeName));
 window.MCQCampusPageScriptPromises.set(safeName,task);
 return task;
};
window.MCQCampusSharedTemplatesPromise=null;
window.MCQCampusLoadSharedTemplates=function(){
 const required=['mcq-layout-template','mcq-header-template','mcq-footer-template','mcq-home-template','mcq-auth-layout-template','mcq-learner-dashboard-template','mcq-admin-layout-template'];
 const ready=()=>required.every(id=>document.getElementById(id));
 if(ready())return Promise.resolve(true);
 if(window.MCQCampusSharedTemplatesPromise)return window.MCQCampusSharedTemplatesPromise;
 const task=fetch('/index.html',{credentials:'same-origin',cache:'no-cache'})
  .then(response=>{if(!response.ok)throw Error('Could not load the central HTML templates from /index.html');return response.text()})
  .then(markup=>{
   const doc=new DOMParser().parseFromString(markup,'text/html');
   const nodes=Array.from(doc.querySelectorAll('template[id]'));
   if(!nodes.length||!nodes.some(node=>node.id==='mcq-layout-template'))throw Error('The central index.html has no usable page templates');
   nodes.forEach(node=>{const current=document.getElementById(node.id);if(current)current.replaceWith(node.cloneNode(true));else document.body.appendChild(node.cloneNode(true))});
   if(!ready())throw Error('The central index.html page templates are incomplete');
   return true;
  })
  .catch(error=>{window.MCQCampusSharedTemplatesPromise=null;throw error});
 window.MCQCampusSharedTemplatesPromise=task;
 return task;
};
/* ===== MCQCAMPUS MODULE: app.js ===== */
const resolveRouteId=(base,token,predicate=null)=>{if(!token)return token;const map={category:'categories',subcategory:'subcategories',topic:'children',paper:'papers',job:'jobs',year:'years',mcq:'mcqs',practice:'mcqs',post:'posts',pdf:'pdfs','latest-job':'latestJobs'},type=map[base];if(!type||!window.MCQ)return token;const rows=(MCQ.db[type]||[]).filter(x=>!predicate||predicate(x));if(/^\d+$/.test(String(token))){const row=rows.find(x=>Number(x.id)===Number(token));return row?String(row.id):token}const wanted=decodeURIComponent(token).toLowerCase(),row=rows.find(x=>[String(x.slug||MCQ.slug(x.name||x.title||x.question||'')).toLowerCase(),window.SEO?.hierarchySlug(x.name||x.title||x.question||'')].includes(wanted));return row?String(row.id):token};
window.App={route:{path:'home',params:{}},choices:{},answers:{},activeQuestionId:null,homeQuickIndex:0,quickAnswer:null,homeRandomIds:[],homeRandomSignature:'',draft:null,draftKey:null,importRows:null,importSummary:null,importedIds:[],importPage:null,testResult:null,testNonce:0,page(total,size=12){const requested=Number(this.route.params.page);const perPage=Math.max(1,Number(size)||12);return Math.max(1,Math.min(Number.isFinite(requested)?Math.floor(requested):1,Math.max(1,Math.ceil(total/perPage))))},go(path,params={}){history.pushState(null,'',UI.href(path,params));this.render();window.scrollTo(0,0)},ensureAdminBundle(){
 if(window.Admin&&window.Importer&&window.MCQEnhancements)return Promise.resolve();
 if(this.adminBundlePromise)return this.adminBundlePromise;
 if(typeof window.MCQCampusLoadBundledModule!=='function')return Promise.reject(new Error('Bundled admin loader is unavailable.'));
 this.adminBundlePromise=window.MCQCampusLoadBundledModule('importer.js')
  .then(()=>window.MCQCampusLoadBundledModule('enhancements.js'))
  .then(()=>window.MCQCampusLoadBundledModule('admin.js'))
  .catch(error=>{this.adminBundlePromise=null;throw error});
 return this.adminBundlePromise;
},
staticPageNode(shell,page){
 if(page==='country-entry'){
  const countryMain=shell.querySelector('main');
  if(countryMain){countryMain.id='main';countryMain.tabIndex=-1;}
  return shell;
 }
 shell.querySelectorAll('main').forEach(node=>{
  const wrapper=document.createElement('div');
  Array.from(node.attributes).forEach(attribute=>{
   if(attribute.name==='id'||attribute.name==='tabindex')return;
   wrapper.setAttribute(attribute.name,attribute.value);
  });
  while(node.firstChild)wrapper.appendChild(node.firstChild);
  node.replaceWith(wrapper);
 });
 const layoutTemplate=document.getElementById('mcq-layout-template');
 if(!layoutTemplate)return shell;
 const fragment=layoutTemplate.content.cloneNode(true);
 const slotMarkup={
  LAYOUT_HEADER:()=>window.UI?.header?.(page)||'',
  LAYOUT_HEADER_AD:()=>window.UI?.adSlot?.('header_ad')||'',
  LAYOUT_FOOTER_AD:()=>window.UI?.adSlot?.('footer_ad')||'',
  LAYOUT_FOOTER:()=>window.UI?.footer?.()||''
 };
 const walker=document.createTreeWalker(fragment,128);
 const comments=[];
 while(walker.nextNode())comments.push(walker.currentNode);
 for(const comment of comments){
  const match=String(comment.nodeValue||'').trim().match(/^SLOT:(LAYOUT_[A-Z_]+)$/);
  if(!match)continue;
  const slot=match[1];
  if(slot==='LAYOUT_BODY'){
   comment.replaceWith(shell);
   continue;
  }
  if(!Object.prototype.hasOwnProperty.call(slotMarkup,slot))continue;
  const holder=document.createElement('template');
  holder.innerHTML=String(slotMarkup[slot]());
  comment.replaceWith(holder.content.cloneNode(true));
 }
 return fragment;
},
staticMarkupFragment(markup){
 const holder=document.createElement('template');
 holder.innerHTML=String(markup??'');
 return holder.content;
},
staticTemplateFragment(id,slots={}){
 const template=document.getElementById(id);
 if(!template)return null;
 const fragment=template.content.cloneNode(true);
 const walker=document.createTreeWalker(fragment,NodeFilter.SHOW_COMMENT);
 const comments=[];
 while(walker.nextNode())comments.push(walker.currentNode);
 for(const comment of comments){
  const match=String(comment.nodeValue||'').trim().match(/^SLOT:([A-Z0-9_]+)$/);
  if(!match)continue;
  const key=match[1];
  if(!Object.prototype.hasOwnProperty.call(slots,key)){comment.remove();continue;}
  const value=slots[key];
  if(value&&typeof value==='object'&&typeof value.nodeType==='number')comment.replaceWith(value);
  else comment.replaceWith(document.createTextNode(String(value??'')));
 }
 return fragment;
},
mountDataDrivenPage(base,id){
 const supported=['home','mcqs','important','categories','papers','pdfs','latest-jobs','jobs-exams','posts','tests','test','login','register','forgot','reset-code','reset-password','verify','mcq','practice','category','subcategory','topic','paper','year','search','pdf','latest-job','post','about','contact','faq','privacy','terms','disclaimer','cookies','advertising','sitemap'];
 const detailRoutes=['mcq','practice','category','subcategory','topic','paper','year','test','pdf','latest-job','post'];
 if(!supported.includes(base)||(detailRoutes.includes(base)?!id:!!id))return false;
 const parent=document.getElementById('static-page-shells');
 const root=document.getElementById('app');
 if(!parent||!root)return false;
 const requestedCountry=String(new URLSearchParams(location.search).get('country')||'').trim();
 const showCountryEntry=()=>{
  const countrySource=parent.querySelector('[data-static-page="country-entry"]');
  if(!countrySource)return false;
  const countryShell=countrySource.cloneNode(true);
  const choices=countryShell.querySelector('.country-entry-grid');
  const template=document.getElementById('mcq-country-entry-card-template');
  const countries=(MCQ.db?.countries||[]).filter(item=>item&&item.active!==false&&String(item.name||'').trim());
  if(choices&&template){
   choices.replaceChildren();
   for(const item of countries){
    const name=String(item.name).trim(),card=template.content.cloneNode(true);
    const flag=card.querySelector('[data-country-flag]'),heading=card.querySelector('[data-country-name]'),description=card.querySelector('[data-country-description]'),login=card.querySelector('[data-country-login]'),register=card.querySelector('[data-country-register]');
    if(flag)flag.textContent=UI.countryFlag(name);
    if(heading)heading.textContent=name;
    if(description)description.textContent=name.toLowerCase()==='pakistan'?'PPSC, FPSC, SPSC, NTS and more':name.toLowerCase()==='india'?'Competitive exams and practice':name.toLowerCase()==='usa'?'Exam practice and learning resources':'Competitive exams and practice resources';
    const query='?'+new URLSearchParams({country:name}).toString();
    if(login)login.href='/login'+query;
    if(register)register.href='/register'+query;
    choices.append(card);
   }
   if(!countries.length)choices.textContent='No active countries are configured yet.';
  }
  root.replaceChildren(this.staticPageNode(countryShell,'country-entry'));
  root.removeAttribute('aria-busy');
  document.body.dataset.pageTemplate='country-entry';
  document.body.dataset.staticFallback='country-entry';
  return true;
 };
 if(['login','register'].includes(base)&&!requestedCountry)return showCountryEntry();
 const shellKey=['papers','paper'].includes(base)?'past-papers':['important','mcq','practice','year','search'].includes(base)?'mcqs':['category','subcategory','topic'].includes(base)?'categories':['posts','post'].includes(base)?'blog':['forgot','reset-code','reset-password','verify'].includes(base)?base:['test'].includes(base)?'tests':['latest-job','jobs-exams'].includes(base)?'latest-jobs':['pdf'].includes(base)?'pdfs':['faq','privacy','terms','disclaimer','cookies','advertising'].includes(base)?'about':base;
 const source=parent.querySelector('[data-static-page="'+shellKey+'"]');
 if(!source)return false;
 const shell=source.cloneNode(true);
 shell.dataset.staticFallback='true';
 const region=name=>shell.querySelector('[data-api-region="'+name+'"]');
 const setMarkup=(name,markup)=>{
  const dest=region(name);if(!dest)return false;
  dest.replaceChildren(this.staticMarkupFragment(markup));
  dest.hidden=false;
  return true;
 };
 const setText=(name,value)=>{
  const dest=region(name);if(!dest)return false;
  dest.textContent=String(value??'');dest.hidden=false;return true;
 };
 const setBreadcrumbs=items=>{
  const dest=region('breadcrumbs');if(!dest)return false;
  const nav=document.createElement('nav');nav.className='breadcrumbs';nav.setAttribute('aria-label','Breadcrumb');
  (items||[]).forEach((item,index)=>{
   if(index){const separator=document.createElement('span');separator.setAttribute('aria-hidden','true');separator.textContent='›';nav.append(separator);}
   const label=String(item?.[0]??'');
   if(item&&item[1]){const anchor=document.createElement('a');anchor.href=UI.href(item[1]);anchor.textContent=label;nav.append(anchor);}
   else{const current=document.createElement('span');current.setAttribute('aria-current','page');current.textContent=label;nav.append(current);}
  });
  dest.replaceChildren(nav);dest.hidden=false;return true;
 };
 const pageHeading=(title,description)=>{
  const heading=shell.querySelector('.page-heading h1'),summary=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=String(title||'');
  if(summary&&description!==undefined)summary.textContent=String(description||'');
 };
 const appendManagedText=(container,value)=>{
  if(!container)return;
  const lines=String(value||'').replace(/\\r/g,'').split('\\n');
  let paragraph=[],list=null;
  const flushParagraph=()=>{
   if(!paragraph.length)return;
   const node=document.createElement('p'),text=paragraph.join(' ').trim();
   text.split(/(\\*\\*[^*]+\\*\\*)/g).forEach(piece=>{
    if(piece.startsWith('**')&&piece.endsWith('**')&&piece.length>4){const strong=document.createElement('strong');strong.textContent=piece.slice(2,-2);node.append(strong);}
    else node.append(document.createTextNode(piece));
   });
   if(text)container.append(node);paragraph=[];
  };
  const flushList=()=>{if(list&&list.children.length)container.append(list);list=null;};
  for(const line of lines){
   const clean=line.trim();
   if(!clean){flushParagraph();flushList();continue;}
   const heading=clean.match(/^(#{1,3})\\s+(.+)$/);
   if(heading){flushParagraph();flushList();const node=document.createElement(heading[1].length===1?'h2':heading[1].length===2?'h3':'h4');node.textContent=heading[2];container.append(node);continue;}
   const bullet=clean.match(/^[-*]\\s+(.+)$/);
   if(bullet){flushParagraph();if(!list)list=document.createElement('ul');const item=document.createElement('li');item.textContent=bullet[1];list.append(item);continue;}
   flushList();paragraph.push(clean);
  }
  flushParagraph();flushList();
 };
 const makeInternalLink=(path,label,className)=>{
  const anchor=document.createElement('a');anchor.href=UI.href(path);anchor.textContent=String(label||'');anchor.className=className||'link';return anchor;
 };
 const copy=(key,title,description)=>{
  const row=(MCQ.db.pageSeo||{})['static:'+key]||{};
  return {title:String(row.title||title),description:String(row.description||description)};
 };
 const fixedCountry=()=>{
  const user=window.Auth?.user||MCQ.db.session||{};
  if(String(user.activeRole||'')==='super-admin'&&(user.roles||[]).includes('super-admin'))return String(MCQ.db.activeCountry||'').trim();
  return String(user.country||MCQ.db.settings?.country||'Pakistan').trim();
 };
 const data=MCQ.db||{};
 const entityCopy=(kind,key,title,description)=>{
  const row=(data.pageSeo||{})[kind+':'+String(key)]||{};
  return {title:String(row.title||title),description:String(row.description||description)};
 };
 const setCategoryContext=(eyebrow,title,items,regionName='category-context')=>{
  const dest=region(regionName),template=document.getElementById('mcq-category-context-template');
  if(!dest||!template||!items.length){if(dest)dest.hidden=true;return false;}
  const fragment=template.content.cloneNode(true);
  const eyebrowNode=fragment.querySelector('[data-context-eyebrow]'),titleNode=fragment.querySelector('[data-context-title]'),linksNode=fragment.querySelector('[data-context-links]');
  if(eyebrowNode)eyebrowNode.textContent=eyebrow;
  if(titleNode)titleNode.textContent=title;
  if(linksNode)linksNode.replaceChildren(this.staticMarkupFragment(items.join('')));
  dest.replaceChildren(fragment);dest.hidden=false;return true;
 };
 const publicMcqServerPage=()=>{
  const page=data.mcqPage||{};
  return page.server===true&&page.scope==='public'&&page.routeKey===location.pathname+location.search?page:null;
 };
 if(base==='search'){
  const params=App.route.params||{},query=String(params.q||'').trim(),wanted=String(params.type||'all'),normalized=MCQ.norm(query),results=[];
  const add=(type,label,path,title,summary,textValue,record)=>{
   if(query&&MCQ.norm(textValue||title).includes(normalized))results.push({type,label,path,title,summary,record});
  };
  if(query){
   MCQ.publicMcqs().forEach(item=>add('mcq','MCQ','mcq/'+item.id,item.question,MCQ.get('categories',item.category_id)?.name||'Practice question',item.question+' '+[1,2,3,4].map(n=>item['option'+n]).join(' ')+' '+(item.description||''),item));
   (data.categories||[]).filter(item=>item.active!==false&&!item.legacy).forEach(item=>add('category','Category','category/'+item.id,item.name,'Browse category',item.name,item));
   (data.papers||[]).filter(item=>item.active!==false).forEach(item=>add('paper','Past Paper / Exam','paper/'+item.id,item.name,item.country||'Past paper organization',item.name+' '+(item.country||''),item));
   (data.years||[]).filter(item=>item.active!==false).forEach(item=>{
    const paper=MCQ.get('papers',item.paper_id)||MCQ.get('papers',MCQ.get('jobs',item.job_id)?.paper_id);
    add('year','Past Paper',window.SEO?SEO.cleanPath('year',item.id):'year/'+item.id,((paper?.name||'')+' · '+item.name).trim(),paper?.name||'Past Paper',item.name+' '+(paper?.name||''),item);
   });
   (data.pdfs||[]).filter(item=>item.active!==false).forEach(item=>add('pdf','PDF',window.SEO?SEO.cleanPath('pdf',item.id):'pdfs',item.title||item.name||'PDF resource',item.description||'PDF resource',(item.title||item.name||'')+' '+(item.description||''),item));
   (data.posts||[]).filter(item=>item.published!==false).forEach(item=>add('post','Blog','post/'+item.id,item.title,item.excerpt||'MCQ Campus update',(item.title||'')+' '+(item.excerpt||'')+' '+(item.body||'')+' '+(item.category||''),item));
   (data.latestJobs||[]).filter(item=>item.published!==false).forEach(item=>{
    const organization=MCQ.get('papers',item.paper_id);
    add('latestjob','Latest Job',window.SEO?SEO.cleanPath('latest-job',item.id):'latest-jobs',item.title||'Job opportunity',(organization?.name||'')+' · Last date '+(item.last_date||''),(item.title||'')+' '+(organization?.name||'')+' '+(item.last_date||''),item);
   });
  }
  const types=[...new Set(results.map(item=>item.type))],filtered=wanted==='all'?results:results.filter(item=>item.type===wanted),pageSize=12,page=App.page(filtered.length,pageSize);
  const labels={mcq:'MCQs',category:'Categories',paper:'Organizations / Boards',year:'Past Papers',job:'Organizations / Boards',pdf:'PDFs',post:'Blog',latestjob:'Latest Jobs'};
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=query?'Search results for “'+query+'”':'Search MCQ Campus';
  if(description)description.textContent='Search public preparation content across MCQs, organizations, past papers, categories, PDFs, latest jobs and blog posts.';
  setMarkup('breadcrumbs',UI.crumbs([['Search']]));
  const searchInput=shell.querySelector('form[data-form="search"] input[name="q"]');
  if(searchInput)searchInput.value=query;
  const filterItems=[{label:'All',path:'search',params:{q:query},active:wanted==='all'},...types.map(type=>({label:labels[type]||type,path:'search',params:{q:query,type},active:wanted===type}))];
  setMarkup('search-filters',query&&types.length?PublicLayout.selectionBar(filterItems,'Search result types','search-type-selection'):'');
  const list=region('mcq-list');
  if(list){
   list.classList.add('search-results-list','public-main','public-main-full');
   let cards='';
   if(filtered.length){
    cards=filtered.slice((page-1)*pageSize,page*pageSize).map((item,index)=>{
     const serial=(page-1)*pageSize+index+1;
     if(item.type==='mcq')return Public.questionCard(item.record,serial,true);
     if(item.type==='paper'&&item.record)return UI.card('papers',item.record,index);
     if(item.type==='year'&&item.record)return UI.card('years',item.record,index);
     if(item.type==='category'&&item.record)return UI.card('categories',item.record,index);
     if(item.type==='pdf'&&item.record)return Public.pdfResourceCard(item.record);
     if(item.type==='post'&&item.record)return Public.blogPostCard(item.record);
     if(item.type==='latestjob'&&item.record)return Public.latestJobCard(item.record);
     return UI.link(item.path,'<span class="badge">'+UI.esc(item.label)+'</span><h2>'+UI.esc(item.title)+'</h2><p>'+UI.esc(item.summary||'')+'</p><div class="card-foot"><span>Open '+UI.esc(item.label.toLowerCase())+'</span>'+UI.icon('arrow')+'</div>','card search-result-card clickable');
    }).join('');
   }
   const content=!query?UI.empty('Search MCQ Campus','Use the search bar in the header to find MCQs, organizations, past papers, categories, PDFs, latest jobs and blog posts.'):filtered.length?'<p class="small muted result-count">'+filtered.length+' matching result'+(filtered.length===1?'':'s')+'</p>'+cards:UI.empty('No matching results','Try a shorter or different search phrase.',UI.link('search','Clear search','btn primary'));
   list.replaceChildren(this.staticMarkupFragment(content));list.hidden=false;
  }
  const summary=query?filtered.length.toLocaleString('en-GB')+' matching result'+(filtered.length===1?'':'s'):'Search across MCQCampus';
  setText('mcq-summary',summary);
  setMarkup('mcq-pagination',UI.pager(filtered.length,page,pageSize,params,'search'));
 }else if(base==='mcq'||base==='practice'){
  const question=MCQ.publicMcqs().find(item=>Number(item.id)===Number(id));
  if(!question)return false;
  if(base==='practice')MCQ.recent(id);
  const rows=MCQ.publicMcqs(),index=rows.findIndex(item=>Number(item.id)===Number(question.id));
  const category=MCQ.get('categories',question.category_id);
  const fallbackTitle=base==='practice'?'Practice MCQ':(category?.name||'MCQ')+' Question';
  const fallbackDescription=base==='practice'?(category?.name?category.name+' · ':'')+'Focus on the answer and explanation, then continue your practice.':question.description||'Practice this question, check the answer, and review its explanation.';
  const pageCopy=entityCopy('mcq',question.id,fallbackTitle,fallbackDescription);
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  setMarkup('breadcrumbs',UI.crumbs([['MCQs','mcqs'],[base==='practice'?'Practice Question '+id:question.question]]));
  const list=region('mcq-list');
  if(list){
   list.classList.add('public-main','public-main-full');
   list.replaceChildren(this.staticMarkupFragment(Public.questionCard(question,index+1,false)));
   list.hidden=false;
  }
  if(base==='practice'){
   const previous=index>0?UI.link('practice/'+rows[index-1].id,'← Previous','btn'):'';
   const next=index<rows.length-1?UI.link('practice/'+rows[index+1].id,'Next question '+UI.icon('arrow'),'btn primary'):UI.link('dashboard','View progress','btn primary');
   setMarkup('mcq-detail-actions','<div class="actions practice-nav">'+previous+'<span class="spacer"></span><span class="spacer"></span>'+next+'</div>');
  }else{
   const related=Public.relatedMcqs(question);
   const relatedList=region('mcq-related-list');
   if(relatedList){
    const content=related.length?related.map((item,i)=>Public.mini(item,i)).join(''):UI.empty('No close matches yet','Explore the broader category for more practice.',category?UI.link('category/'+category.id,'Browse category','btn'):UI.link('mcqs','Browse MCQs','btn'));
    relatedList.replaceChildren(this.staticMarkupFragment(content));
   }
   const relatedRegion=region('mcq-related');if(relatedRegion)relatedRegion.hidden=false;
  }
 }else if(base==='year'){
  const year=MCQ.get('years',id);
  const paper=year&&(MCQ.get('papers',year.paper_id)||MCQ.get('papers',MCQ.get('jobs',year.job_id)?.paper_id));
  if(!year||!paper)return false;
  const server=publicMcqServerPage(),rows=server?MCQ.publicMcqs():MCQ.publicMcqs().filter(item=>MCQ.ids(item.job_years_ids).includes(Number(id)));
  const pageSize=10,total=server?Number(server.total||0):rows.length,page=server?Math.max(1,Number(server.page)||1):App.page(total,pageSize),shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const fallbackTitle=paper.name+' '+year.name,fallbackDescription='Practice '+paper.name+' '+year.name+' MCQs with correct answers and explanations.';
  const pageCopy=entityCopy('year',year.id,fallbackTitle,fallbackDescription);
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  setMarkup('breadcrumbs',UI.crumbs([['Past Papers','papers'],[paper.name,'paper/'+paper.id],[year.name]]));
  setMarkup('year-actions',UI.btn(UI.icon('bookmark')+' '+((MCQ.db.savedPapers||[]).includes(Number(id))?'Remove saved paper':'Save paper'),'save-paper','','data-id="'+Number(id)+'"'));
  setText('mcq-summary',total.toLocaleString('en-GB')+' MCQs · 10 per page');
  const list=region('mcq-list');
  if(list){
   list.classList.add('public-main','public-main-full');
   const content=shown.length?shown.map((item,i)=>Public.questionCard(item,(page-1)*pageSize+i+1,false,Number(id))).join(''):UI.empty(server?'No MCQs found for this past paper.':'No MCQs are linked to this past paper yet.','Browse the other past papers or continue with important MCQs.',UI.link('important','Important MCQs','btn primary'));
   list.replaceChildren(this.staticMarkupFragment(content));list.hidden=false;
  }
  setMarkup('mcq-pagination',UI.pager(total,page,pageSize,App.route.params,'year/'+id));
 }else if(base==='topic'){
  const topic=MCQ.get('children',id);
  if(!topic)return false;
  const subcategory=MCQ.get('subcategories',topic.subcategory_id),category=subcategory&&MCQ.get('categories',subcategory.category_id);
  const server=publicMcqServerPage(),all=MCQ.publicMcqs(),rows=server?all:all.filter(item=>MCQ.ids(item.child_subcategory_ids).includes(Number(id)));
  const pageSize=10,total=server?Number(server.total||0):rows.length,page=server?Math.max(1,Number(server.page)||1):App.page(total,pageSize),shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=topic.name+' MCQs';
  if(description)description.textContent='Practice '+topic.name+' MCQs with correct answers and explanations.';
  setMarkup('breadcrumbs',UI.crumbs([['Categories','categories'],...(category?[[category.name,'category/'+category.id]]:[]),...(subcategory?[[subcategory.name,'subcategory/'+subcategory.id]]:[]),[topic.name]]));
  setText('mcq-summary',total.toLocaleString('en-GB')+' MCQs · 10 per page');
  const list=region('mcq-list');
  if(list){
   list.classList.add('public-main','public-main-full');
   list.replaceChildren(this.staticMarkupFragment(shown.length?shown.map((item,i)=>Public.questionCard(item,(page-1)*pageSize+i+1)).join(''):UI.empty(server?'No MCQs in this topic yet':'No MCQs are linked to this topic yet.','Choose another topic or browse the parent category.',subcategory?UI.link('subcategory/'+subcategory.id,'Browse '+subcategory.name,'btn primary'):UI.link('categories','Browse categories','btn primary'))));
   list.hidden=false;
  }
  setMarkup('mcq-pagination',UI.pager(total,page,pageSize,App.route.params,'topic/'+id));
 }else if(base==='category'||base==='subcategory'){
  const isCategory=base==='category',record=MCQ.get(isCategory?'categories':'subcategories',id);
  if(!record)return false;
  const category=isCategory?record:MCQ.get('categories',record.category_id);
  const server=publicMcqServerPage(),all=MCQ.publicMcqs();
  const rows=server?all:all.filter(item=>isCategory?Number(item.category_id)===Number(id):MCQ.ids(item.subcategory_ids).includes(Number(id)));
  const pageSize=10,total=server?Number(server.total||0):rows.length,page=server?Math.max(1,Number(server.page)||1):App.page(total,pageSize),shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const fallbackTitle=isCategory?record.name+' MCQs':record.name;
  const fallbackDescription=isCategory?'Practice '+record.name+' MCQs with correct answers and explanations, and explore related subcategories.':'Practice approved '+record.name+' MCQs with answers and explanations.';
  const pageCopy=isCategory?entityCopy('category',record.id,fallbackTitle,fallbackDescription):{title:fallbackTitle,description:fallbackDescription};
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  setMarkup('breadcrumbs',UI.crumbs([['Categories','categories'],...(isCategory?[[record.name]]:[...(category?[[category.name,'category/'+category.id]]:[]),[record.name]])]));
  if(isCategory){
   const subs=(data.subcategories||[]).filter(item=>item.active!==false&&Number(item.category_id)===Number(record.id)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
   setCategoryContext('EXPLORE TOPICS',record.name+' Subcategories',subs.map(item=>UI.link('subcategory/'+item.id,UI.esc(item.name),'chip')));
  }else{
   const children=(data.children||[]).filter(item=>item.active!==false&&Number(item.subcategory_id)===Number(record.id)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
   setCategoryContext('TOPICS','Explore '+record.name,children.map(item=>UI.link('topic/'+item.id,UI.esc(item.name),'chip')));
  }
  setText('mcq-summary',total.toLocaleString('en-GB')+' MCQs · 10 per page');
  const list=region('mcq-list');
  if(list){
   list.classList.add('public-main','public-main-full');
   list.replaceChildren(this.staticMarkupFragment(shown.length?shown.map((item,i)=>Public.questionCard(item,(page-1)*pageSize+i+1)).join(''):UI.empty(server?'No MCQs found for this selection.':'No MCQs are linked to this category yet.','Choose another category or browse all MCQs.',UI.link('mcqs','Browse all MCQs','btn primary'))));
   list.hidden=false;
  }
  setMarkup('mcq-pagination',UI.pager(total,page,pageSize,App.route.params,base+'/'+id));
 }else if(base==='paper'){
  const paper=MCQ.get('papers',id);
  if(!paper)return false;
  const all=(data.years||[]).filter(item=>item.active!==false&&(Number(item.paper_id)||Number(MCQ.get('jobs',item.job_id)?.paper_id)||0)===Number(paper.id));
  const rows=MCQ.sortPinned('years',all),pageSize=12,total=rows.length,page=App.page(total,pageSize),shown=rows.slice((page-1)*pageSize,page*pageSize);
  const titleText=String(paper.name||'').replace(/[\[\]()]+/g,' ').replace(/\s+/g,' ').trim();
  const fallbackDescription='Browse '+titleText+' past papers and select an exam year to practise linked MCQs with correct answers and explanations.';
  const pageCopy=entityCopy('paper',paper.id,titleText+' Past Papers',fallbackDescription);
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  setMarkup('breadcrumbs',UI.crumbs([['Past Papers','papers'],[titleText]]));
  const contextRegion=region('paper-context'),contextTemplate=document.getElementById('mcq-paper-context-template');
  if(contextRegion&&contextTemplate){
   const fragment=contextTemplate.content.cloneNode(true),contextTitle=fragment.querySelector('[data-paper-context-title]');
   if(contextTitle)contextTitle.textContent=titleText+' Past Papers';
   contextRegion.replaceChildren(fragment);contextRegion.hidden=false;
  }
  setText('past-paper-summary',total.toLocaleString('en-GB')+' past-paper records · 12 per page');
  const list=region('past-paper-list');
  if(list){
   list.classList.add('grid','paper-grid','public-main','public-main-full');
   list.replaceChildren(this.staticMarkupFragment(shown.length?shown.map((item,index)=>UI.card('years',item,(page-1)*pageSize+index)).join(''):UI.empty('No past papers available for this organization yet.','Choose another organization or return to the organization list.',UI.link('papers','Browse organizations / boards','btn primary'))));
   list.hidden=false;
  }
  setMarkup('past-paper-pagination',UI.pager(total,page,pageSize,App.route.params,'paper/'+id));
 }else if(base==='home'){
  const site=data.siteCounts||{},country=fixedCountry(),pageSize=10;
  const serverPage=data.mcqPage||{},server=serverPage.server===true&&serverPage.scope==='public'&&serverPage.routeKey===location.pathname+location.search?serverPage:null;
  const rows=server?MCQ.publicMcqs():[];
  const importantTotal=server?Number(server.total||0):Number(site.importantMcqs||0);
  const categories=MCQ.sortPinned('categories',(data.categories||[]).filter(c=>c.active!==false&&!c.legacy)).slice(0,7);
  const organizations=(data.papers||[]).filter(x=>x.active!==false&&(!country||(x.country||data.settings?.country||'Pakistan')===country));
  const organizationIds=new Set(organizations.map(x=>Number(x.id)));
  const pastPapers=(data.years||[]).filter(x=>x.active!==false&&organizationIds.has(Number(x.paper_id)||Number(MCQ.get('jobs',x.job_id)?.paper_id)||0));
  const activeCategories=(data.categories||[]).filter(c=>c.active!==false&&!c.legacy&&(!country||(c.country||'Both')==='Both'||(c.country||data.settings?.country||'Pakistan')===country));
  const stats=[
   {title:'MCQs',value:Number(site.approvedMcqs||0),iconName:'book',tone:'primary',subtitle:'Approved practice questions',path:'mcqs'},
   {title:'Organizations / Boards / Agencies',value:organizations.length,iconName:'landmark',tone:'neutral',subtitle:'Exam organizations, boards and agencies',path:'papers'},
   {title:'Past Papers',value:pastPapers.length,iconName:'paper',tone:'neutral',subtitle:'Past-paper records',path:'papers'},
   {title:'Categories',value:activeCategories.length,iconName:'grid',tone:'neutral',subtitle:'Preparation subjects',path:'categories'}
  ];
  const pageCopy=copy('home','Practice smarter. Prepare with purpose.','Start with important MCQs, then explore past papers, categories and exam-focused preparation.');
  const title=shell.querySelector('[data-static-home-title]');
  const description=shell.querySelector('[data-static-home-description]');
  if(title)title.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  const statsRegion=region('home-stats');
  if(statsRegion){
   statsRegion.replaceChildren();
   for(const item of stats)statsRegion.append(this.staticMarkupFragment(UI.statCard(item)));
   statsRegion.hidden=false;
  }
  setText('home-important-count',importantTotal.toLocaleString('en-GB')+' total important MCQs · only 10 load per page');
  setMarkup('home-mcqs',rows.length?rows.map((q,i)=>Public.questionCard(q,i+1,true)).join(''):UI.empty(server?'No important MCQs available yet':'Loading important MCQs…','Important MCQs are requested from the database 10 at a time.'));
  setMarkup('home-pagination',UI.pager(importantTotal,server?Math.max(1,Number(server.page)||1):1,pageSize,App.route.params,'home'));
  const categoryRegion=region('home-categories');
  if(categoryRegion){
   categoryRegion.replaceChildren();
   const template=document.getElementById('mcq-home-category-item-template');
   if(template){
    const counts=site.categoryMcqs||{};
    for(const category of categories){
     const item=template.content.cloneNode(true),anchor=item.querySelector('a'),iconSlot=item.querySelector('[data-home-category-icon]'),arrowSlot=item.querySelector('[data-home-category-arrow]'),name=item.querySelector('[data-home-category-name]'),count=item.querySelector('[data-home-category-count]');
     if(anchor)anchor.href=UI.href('category/'+category.id);
     if(iconSlot)iconSlot.append(this.staticMarkupFragment(UI.entityIcon(category,'grid')));
     if(arrowSlot)arrowSlot.append(this.staticMarkupFragment(UI.icon('arrow')));
     if(name)name.textContent=String(category.name||'');
     if(count)count.textContent=Number(counts[String(category.id)]||0).toLocaleString('en-GB')+' MCQs';
     categoryRegion.append(item);
    }
   }
   categoryRegion.hidden=false;
  }
  setMarkup('home-top-ad',UI.adSlot('home_top_ad'));
  setMarkup('home-middle-ad',UI.adSlot('home_middle_ad'));
 }else if(base==='mcqs'||base==='important'){
  const serverPage=data.mcqPage||{},server=serverPage.server===true&&serverPage.scope==='public'&&serverPage.routeKey===location.pathname+location.search?serverPage:null;
  const params=App.route.params||{},fixed=fixedCountry(),filters=fixed?{page:params.page,country:fixed}:params;
  let rows=MCQ.publicMcqs();
  const view=base==='important'?'important':String(filters.view||'all');
  if(!server){
   if(view==='important')rows=rows.filter(q=>MCQ.isImportant(q));
   if(view==='repeated')rows=rows.filter(q=>MCQ.ids(q.job_years_ids).length>=2);
   if(view==='latest')rows=[...rows].sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||''))||Number(b.id)-Number(a.id));
   if(filters.category)rows=rows.filter(q=>+q.category_id===+filters.category);
   if(filters.paper)rows=rows.filter(q=>MCQ.ids(q.paper_id).includes(+filters.paper));
   if(filters.job)rows=rows.filter(q=>MCQ.ids(q.job_ids).includes(+filters.job));
   if(filters.year)rows=rows.filter(q=>MCQ.ids(q.job_years_ids).includes(+filters.year));
   if(filters.country){
    rows=rows.filter(q=>{
     const paperIds=MCQ.ids(q.paper_id);
     const paperCountries=paperIds.map(key=>MCQ.get('papers',key)?.country).filter(Boolean);
     return String(q.country||paperCountries[0]||data.settings?.country||'Pakistan')===String(filters.country);
    });
   }
  }else rows=MCQ.publicMcqs();
  const total=server?Number(server.total||0):rows.length,pageSize=10,page=server?Math.max(1,Number(server.page||filters.page)||1):App.page(total,pageSize),shown=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const heading=shell.querySelector('.page-heading h1'),headingDesc=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=view==='important'?'Important MCQs':'Practice MCQs';
  if(headingDesc)headingDesc.textContent='Browse approved practice MCQs with correct answers and explanations.';
  const search=shell.querySelector('form[data-form="search"] input[name="q"]');
  if(search)search.value=String(params.q||'');
  setText('mcq-summary',total.toLocaleString('en-GB')+' total '+(view==='important'?'important MCQs':'MCQs')+' · only 10 load per page');
  const list=region('mcq-list');
  if(list){
   list.classList.add('public-main','public-main-full');
   const parts=[];
   parts.push(UI.adSlot('mcq_top_ad'));
   if(shown.length){
    shown.forEach((q,i)=>{
     parts.push(Public.questionCard(q,(page-1)*pageSize+i+1,false,base==='year'?Number(id)||null:null));
     if(i===4)parts.push(UI.adSlot('mcq_inline_ad'));
    });
   }else parts.push(UI.empty(server?'No MCQs found for this selection.':'No matching MCQs are available yet.','Choose another option or browse all MCQs.',UI.link('mcqs','Browse all MCQs','btn primary')));
   parts.push(UI.adSlot('mcq_bottom_ad'));
   list.replaceChildren(this.staticMarkupFragment(parts.join('')));
   list.hidden=false;
  }
  setMarkup('mcq-pagination',UI.pager(total,page,pageSize,params,App.route.path));
 }else if(base==='categories'||base==='papers'){
  const collection=base==='categories'?'categories':'papers',country=fixedCountry();
  const entityPage=data.entityPage||{},entityServer=entityPage.server===true&&entityPage.routeKey===location.pathname+location.search&&entityPage.type===collection?entityPage:null;
  let rows=(data[collection]||[]).filter(x=>x.active!==false&&(collection!=='categories'||!x.legacy));
  if(collection==='papers'&&country)rows=rows.filter(x=>(x.country||data.settings?.country||'Pakistan')===country);
  if(collection==='categories'&&country)rows=rows.filter(x=>(x.country||'Both')==='Both'||(x.country||data.settings?.country||'Pakistan')===country);
  rows=MCQ.sortPinned(collection,rows);
  const pageSize=12,total=entityServer?Number(entityPage.total||0):rows.length,page=entityServer?Math.max(1,Number(entityPage.page)||1):App.page(total,pageSize),shown=entityServer?(Array.isArray(entityPage.items)?entityPage.items:[]):rows.slice((page-1)*pageSize,page*pageSize);
  const pageCopy=collection==='categories'?copy('categories','All categories','Choose a category to open its MCQ collection.'):copy('past-papers','Organizations / Boards','Browse organizations and boards, then choose a Past Paper.');
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(heading)heading.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  const listName=collection==='categories'?'category-list':'organization-list',list=region(listName);
  if(list){
   list.classList.add('grid','public-main','public-main-full');
   if(collection==='papers')list.classList.add('paper-grid');
   const cards=shown.map((item,index)=>UI.card(collection,item,(page-1)*pageSize+index)).join('');
   list.replaceChildren(this.staticMarkupFragment(cards||UI.empty('No records available here','Try another section or return to the previous page.',UI.link(collection==='papers'?'papers':'categories',collection==='papers'?'Browse organizations / boards':'Browse categories','btn primary'))));
   list.hidden=false;
  }
  const summaryName=collection==='categories'?'category-context':'past-paper-summary';
  setText(summaryName,total.toLocaleString('en-GB')+' '+(collection==='categories'?'categories':'organizations / boards')+' · 12 per page');
  if(collection==='papers')setMarkup('past-paper-pagination',UI.pager(total,page,pageSize,App.route.params,'papers'));
 }else if(base==='test'){
  const plan=Public.automaticTestPlan(),rows=Array.isArray(plan.rows)?plan.rows:[],kind='auto',key='auto:'+plan.period+':'+rows.map(item=>item.id).join(','),result=App.testResult?.key===key?App.testResult:null;
  pageHeading('Automatic 10-MCQ Test',rows.length?'Answer the questions and submit to see your result.':'No approved MCQs are available for this test yet.');
  setBreadcrumbs([['Tests','tests'],['Automatic 10-MCQ Test']]);
  const dest=region('route-detail');if(!dest)return false;dest.classList.add('public-main','public-main-full');dest.replaceChildren();
  if(result){
   const percentage=result.total?Math.round(result.correct/result.total*100):0,stats=document.createElement('div');stats.className='test-result-grid';
   [['Total Questions',result.total],['Correct Answers',result.correct],['Wrong Answers',result.wrong],['Unanswered',result.unanswered],['Percentage',percentage+'%'],['Score',String(result.correct)+' / '+String(result.total)]].forEach(([label,value])=>{
    const card=document.createElement('article');card.className='card stat-card';const name=document.createElement('span');name.className='stat-card-label';name.textContent=label;const number=document.createElement('strong');number.className='stat-card-value';number.textContent=String(value);card.append(name,number);stats.append(card);
   });
   dest.append(stats);
   const actions=document.createElement('div');actions.className='actions test-result-actions';
   const reviewing=App.route.params.review==='1',reviewLink=makeInternalLink('test/auto',reviewing?'Hide review':'Review Answers',reviewing?'btn':'btn primary');
   reviewLink.href=UI.href('test/auto',reviewing?{}:{review:'1'});actions.append(reviewLink);
   const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.dataset.action='test-retry';retry.dataset.kind=kind;retry.textContent='Try again';actions.append(retry);dest.append(actions);
   if(reviewing){
    const review=document.createElement('section');review.className='test-review';
    rows.forEach((question,index)=>{
     const card=document.createElement('article');card.className='card';const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='MCQ '+(index+1);const title=document.createElement('h2');title.textContent=String(question.question||'');card.append(eyebrow,title);
     const chosen=String(result.answers?.[question.id]||''),your=document.createElement('p');your.textContent='Your answer: '+(chosen||'Unanswered');card.append(your);
     const correct=document.createElement('p');correct.textContent='Correct answer: '+String(question.correct_answer||'');card.append(correct);
     if(question.description){const explanation=document.createElement('div');explanation.className='explanation';const p=document.createElement('p');p.textContent=String(question.description);explanation.append(p);card.append(explanation);}
     review.append(card);
    });
    dest.append(review);
   }
  }else if(rows.length){
   const questionNodes=document.createDocumentFragment();
   rows.forEach((question,index)=>{
    const options=document.createDocumentFragment();
    [1,2,3,4].forEach(number=>{
     const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='test_q_'+question.id;input.value=String(question['option'+number]||'');label.append(input);
     const letter=document.createElement('span');letter.className='letter';letter.textContent='ABCD'[number-1];label.append(letter);
     const optionText=document.createElement('span');optionText.className='option-text';optionText.textContent=String(question['option'+number]||'');label.append(optionText);
     const indicator=document.createElement('span');indicator.className='option-indicator';indicator.setAttribute('aria-hidden','true');label.append(indicator);options.append(label);
    });
    const questionFragment=this.staticTemplateFragment('mcq-test-question-template',{TEST_QUESTION_NUMBER:String(index+1),TEST_QUESTION_TEXT:String(question.question||''),TEST_QUESTION_OPTIONS:options});
    if(questionFragment)questionNodes.append(questionFragment);
   });
   const formFragment=this.staticTemplateFragment('mcq-test-form-template',{TEST_QUESTIONS:questionNodes});
   const form=formFragment?.querySelector('form[data-form="test-submit"]');
   if(form){form.dataset.testKey=key;form.dataset.testKind=kind;form.dataset.startedAt=String(Date.now());dest.append(form);}
  }else{
   const empty=document.createElement('div');empty.className='empty';const heading=document.createElement('h3');heading.textContent='No MCQs available';const description=document.createElement('p');description.textContent='Approved MCQs will be used to build an automatic test.';empty.append(heading,description,makeInternalLink('tests','Back to tests','btn'));dest.append(empty);
  }
  dest.hidden=false;
 }else if(base==='tests'){
  const plan=Public.automaticTestPlan(),next=new Date(plan.next);
  const title=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  if(title)title.textContent='Automatic Tests';
  if(description)description.textContent='A hands-off test system that continuously rotates 10-question sets from your approved MCQ library.';
  const list=region('test-list');
  if(list){
   list.classList.add('public-main','public-main-full');
   const content=UI.templateMarkup('mcq-tests-automatic-hero-template',{
    AUTO_TEST_DAYS:String(plan.days),AUTO_TEST_SOURCE:UI.esc(plan.source?.name||'Mixed MCQs'),
    AUTO_TEST_QUESTION_COUNT:String(plan.rows.length),AUTO_TEST_NEXT_DATE:UI.esc(next.toISOString().slice(0,10)),
    AUTO_TEST_START_LINK:UI.link('test/auto','Start Automatic Test','btn primary')
   })||'';
   list.replaceChildren(this.staticMarkupFragment(content||UI.empty('No tests are available','Approved MCQs will be used to build automatic tests.')));
   list.hidden=false;
  }
 }else if(base==='pdf'){
  const resource=(data.pdfs||[]).find(row=>String(row.id)===String(id)||String(row.slug||MCQ.slug(row.title||row.name||''))===String(id));
  if(!resource||resource.active===false)return false;
  const safeLink=url=>/^https?:\\/\\//i.test(String(url||''))||/^data:application\\/pdf;base64,/i.test(String(url||'')),safeImage=url=>/^https?:\\/\\//i.test(String(url||''))||/^data:image\\/(png|jpeg|jpg|webp);base64,/i.test(String(url||''));
  const baseTitle=String(resource.title||resource.name||'Exam Preparation PDF'),title=String(resource.seo_title||baseTitle+' PDF'),description=String(resource.seo_description||resource.description||'Download this exam preparation PDF and continue with related past papers and MCQs.'),href=String(resource.download_url||'').trim(),filename=MCQ.slug(title)+'.pdf';
  pageHeading(title,description);setBreadcrumbs([['PDFs','pdfs'],[baseTitle]]);
  let cover=document.createDocumentFragment();if(resource.cover&&safeImage(resource.cover)){const image=document.createElement('img');image.src=String(resource.cover);image.alt=title;image.loading='lazy';image.decoding='async';cover.append(image);}
  let download;
  if(safeLink(href)){download=document.createElement('a');download.className='btn primary';download.href=href;download.dataset.authAction='download-pdf';download.dataset.authDownloadName=filename;download.textContent='Download PDF';if(/^data:/i.test(href))download.download=filename;else{download.target='_blank';download.rel='noopener';}}
  else{download=document.createElement('span');download.className='btn disabled';download.setAttribute('aria-disabled','true');download.textContent='Download unavailable';}
  const body=this.staticTemplateFragment('mcq-pdf-detail-template',{PDF_DETAIL_COVER:cover,PDF_DETAIL_TITLE:title,PDF_DETAIL_DESCRIPTION:description,PDF_DETAIL_DOWNLOAD:download});
  const destination=region('route-detail');if(destination&&body){destination.replaceChildren(body);destination.classList.add('public-main','public-main-full');destination.hidden=false;}
 }}else if(base==='pdfs'){
  const pdfPage=data.pdfPage||{},pageSize=12,rows=(data.pdfs||[]).filter(x=>x&&x.active!==false).sort((a,b)=>Number(b.id)-Number(a.id));
  const total=pdfPage.server===true&&pdfPage.routeKey===location.pathname+location.search?Number(pdfPage.total||0):rows.length;
  const page=pdfPage.server===true&&pdfPage.routeKey===location.pathname+location.search?Math.max(1,Number(pdfPage.page)||1):App.page(total,pageSize);
  const shown=pdfPage.server===true&&pdfPage.routeKey===location.pathname+location.search&&Array.isArray(pdfPage.items)?pdfPage.items:rows.slice((page-1)*pageSize,page*pageSize);
  const list=region('pdf-list');
  if(list){
   list.classList.add('pdf-resource-grid','public-main','public-main-full');
   const cards=shown.map(item=>Public.pdfResourceCard(item)).join('');
   list.replaceChildren(this.staticMarkupFragment(cards||UI.empty('No PDFs available yet','Published PDF resources will appear here with a direct Download button.')));
   list.hidden=false;
  }
  setText('pdf-summary',total.toLocaleString('en-GB')+' PDF resources · 12 per page');
  setMarkup('pdf-pagination',UI.pager(total,page,pageSize,App.route.params,'pdfs'));
 }else if(base==='latest-job'){
  const job=(data.latestJobs||[]).find(row=>String(row.id)===String(id)||String(row.slug||MCQ.slug(row.title||''))===String(id));
  if(!job||job.published===false)return false;
  const organization=MCQ.get('papers',job.paper_id),title=String(job.seo_title||((organization?.name?organization.name+' ':'')+(job.title||'Job opportunity')).trim()),description=String(job.seo_description||job.description||'Latest job details, application deadline and related past-paper preparation links.'),applyUrl=String(job.apply_url||'').trim(),prepUrl=String(job.prep_url||'').trim();
  pageHeading(title,description);setBreadcrumbs([['Latest Jobs','latest-jobs'],[job.title||'Job']]);
  const actions=document.createDocumentFragment();
  if(/^https?:\\/\\//i.test(applyUrl)){const apply=document.createElement('a');apply.className='btn primary';apply.href=applyUrl;apply.target='_blank';apply.rel='noopener';apply.dataset.authAction='apply-job';apply.textContent='Apply / View Official Details';actions.append(apply);}
  if(/^(https?:\\/\\/|\\/(?!\\/))/i.test(prepUrl)){const papers=document.createElement('a');papers.className='btn';papers.href=prepUrl;papers.textContent='Past Papers';if(/^https?:/i.test(prepUrl)){papers.target='_blank';papers.rel='noopener';}actions.append(papers);}
  else if(organization)actions.append(makeInternalLink('paper/'+organization.id,'Past Papers','btn'));
  const logo=organization?this.staticMarkupFragment(UI.entityIcon(organization,'briefcase')):this.staticMarkupFragment(UI.icon('briefcase'));
  const body=this.staticTemplateFragment('mcq-latest-job-detail-template',{JOB_DETAIL_LOGO:logo,JOB_DETAIL_ORGANIZATION:String(organization?.name||'Organization'),JOB_DETAIL_TITLE:title,JOB_DETAIL_DESCRIPTION:description,JOB_DETAIL_LAST_DATE:String(UI.date(job.last_date)||''),JOB_DETAIL_ACTIONS:actions});
  const destination=region('route-detail');if(destination&&body){destination.replaceChildren(body);destination.classList.add('public-main','public-main-full');destination.hidden=false;}
 }}else if(base==='latest-jobs'){
  const pageSize=10,today=new Date().toISOString().slice(0,10);
  const rows=(data.latestJobs||[]).filter(x=>x&&x.published!==false&&String(x.last_date||'')>=today).sort((a,b)=>String(a.last_date||'').localeCompare(String(b.last_date||''))||Number(b.id)-Number(a.id));
  const total=rows.length,page=App.page(total,pageSize),shown=rows.slice((page-1)*pageSize,page*pageSize);
  const heading=shell.querySelector('.page-heading h1'),description=shell.querySelector('.page-heading p');
  const pageCopy=copy('latest-jobs','Latest Jobs','Current job opportunities with organization, job title, individual detail pages and last date to apply.');
  if(heading)heading.textContent=pageCopy.title;
  if(description)description.textContent=pageCopy.description;
  const list=region('jobs-list');
  if(list){
   list.classList.add('latest-jobs-list','public-main','public-main-full');
   const cards=shown.map(item=>Public.latestJobCard(item)).join('');
   list.replaceChildren(this.staticMarkupFragment(cards||UI.empty('No active job announcements right now','Expired jobs stay available to administrators but are hidden from this Latest Jobs list.')));
   list.hidden=false;
  }
  setMarkup('jobs-pagination',UI.pager(total,page,pageSize,App.route.params,'latest-jobs'));
 }else if(base==='login'||base==='register'){
  const countries=(data.countries||[{name:'Pakistan',active:true},{name:'India',active:true}]).filter(item=>item&&item.active!==false&&String(item.name||'').trim());
  const selected=(countries.find(item=>String(item.name).toLowerCase()===requestedCountry.toLowerCase())||{}).name;
  if(!selected)return showCountryEntry();
  const form=shell.querySelector('form[data-form="auth-'+base+'"]');
  if(!form)return false;
  const heading=form.closest('.auth-form')?.querySelector('h1');
  if(heading)heading.textContent=base==='login'?'Sign in':'Create account';
  const mainHeading=shell.querySelector('.auth-story h2');
  if(mainHeading)mainHeading.textContent=base==='login'?'Welcome back':'Start learning';
  const story=shell.querySelector('.auth-story p:not(.eyebrow)');
  if(story)story.textContent=base==='login'?'Continue your learning journey.':'Create your MCQCampus account.';
  if(base==='register'){
   const countrySelect=form.querySelector('select[name="country"]');
   if(countrySelect){
    countrySelect.replaceChildren();
    const placeholder=document.createElement('option');
    placeholder.value='';placeholder.textContent='Choose country';countrySelect.append(placeholder);
    for(const item of countries){
     const option=document.createElement('option');option.value=String(item.name).trim();option.textContent=String(item.name).trim();countrySelect.append(option);
    }
    countrySelect.value=selected;
   }
  }
  form.querySelectorAll('[data-auth-error]').forEach(box=>{box.textContent='';});
 }else if(['forgot','reset-code','reset-password','verify'].includes(base)){
  // The outer page is a hard-coded index.html shell. Reuse the existing form
  // templates and Auth handlers so reset codes and verification timers keep working.
  const renderedAuth=Auth.view(base);
  const parsedAuth=new DOMParser().parseFromString(String(renderedAuth||''),'text/html');
  const sourceForm=parsedAuth.querySelector('.auth-form');
  const destination=region('auth-form');
  if(!sourceForm||!destination)return false;
  const sourceTitle=sourceForm.querySelector('h1');
  const pageTitle=sourceTitle?.textContent?.trim()||({forgot:'Forgot your password?','reset-code':'Verify reset code','reset-password':'Choose a new password',verify:'Email verification'}[base]);
  const pageHeading=shell.querySelector('.auth-form > h1');
  if(pageHeading)pageHeading.textContent=pageTitle;
  const storyHeading=shell.querySelector('.auth-story h2');
  const storyCopy=shell.querySelector('.auth-story p:not(.eyebrow)');
  const storyTitles={forgot:'Reset your password','reset-code':'Verify reset code','reset-password':'Choose a new password',verify:'Verify your email'};
  const storyCopies={forgot:'Enter your account email to receive a secure reset code.','reset-code':'Confirm your email with the 6-digit code.','reset-password':'Set a new password for your MCQCampus account.',verify:'Finish creating your account using the email code.'};
  if(storyHeading)storyHeading.textContent=storyTitles[base];
  if(storyCopy)storyCopy.textContent=storyCopies[base];
  destination.replaceChildren(...Array.from(sourceForm.childNodes).filter(node=>!(node.nodeType===1&&node.tagName==='H1')).map(node=>node.cloneNode(true)));
  destination.hidden=false;
 }else if(base==='post'){
  const post=(data.posts||[]).find(row=>String(row.id)===String(id)||String(row.slug||MCQ.slug(row.title||''))===String(id));
  if(!post||post.published===false)return false;
  const title=String(post.seo_title||post.title||'MCQCampus Update'),description=String(post.seo_description||post.excerpt||'MCQCampus article and preparation guide.');
  pageHeading(title,description);setBreadcrumbs([['Blog','posts'],[post.title||title]]);
  const body=this.staticTemplateFragment('mcq-blog-detail-template',{});
  if(!body)return false;
  const cover=body.querySelector('[data-post-cover]'),excerpt=body.querySelector('[data-post-excerpt]'),articleBody=body.querySelector('[data-post-body]'),linkSection=body.querySelector('[data-post-links]'),linkList=body.querySelector('[data-post-link-list]'),cta=body.querySelector('[data-post-practice-cta]');
  const imageUrl=String(post.featured_image||'').trim();
  if(cover&&imageUrl&&(/^https?:\\/\\//i.test(imageUrl)||/^\\/(?!\\/)/.test(imageUrl))){const image=document.createElement('img');image.src=imageUrl;image.alt='';image.loading='lazy';image.decoding='async';cover.append(image);cover.hidden=false;}
  if(excerpt&&String(post.excerpt||'').trim()){excerpt.textContent=String(post.excerpt).trim();excerpt.hidden=false;}
  if(articleBody){
   String(post.body||'').split(/\\n\\s*\\n/).map(value=>value.trim()).filter(Boolean).forEach(value=>{const paragraph=document.createElement('p');paragraph.textContent=value;articleBody.append(paragraph);});
   articleBody.append(this.staticMarkupFragment(UI.adSlot('article_ad')));
  }
  const seenLinks=new Set(),links=(post.links||[]).filter(item=>item&&item.label!=='__blog_url').filter(item=>/^(https?:\\/\\/|#\\/)/i.test(String(item.url||''))).filter(item=>{const key=String(item.url||'').trim().replace(/\\/+$/,'').toLowerCase();if(!key||seenLinks.has(key))return false;seenLinks.add(key);return true;});
  if(linkSection&&linkList&&links.length){links.forEach((item,index)=>{const anchor=document.createElement('a');anchor.className='btn post-link-row';anchor.href=String(item.url);if(/^https?:/i.test(String(item.url))){anchor.target='_blank';anchor.rel='noopener';}const number=document.createElement('span');number.className='post-link-index';number.textContent=String(index+1);const label=document.createElement('span');label.textContent=String(item.label||item.url);anchor.append(number,label);linkList.append(anchor);});linkSection.hidden=false;}
  if(cta){cta.append(makeInternalLink('mcqs','Practice MCQs','btn primary'));cta.append(makeInternalLink('important','Important MCQs','btn'));}
  const destination=region('route-detail');if(destination){destination.replaceChildren(body);destination.classList.add('public-main','public-main-full');destination.hidden=false;}
 }}else if(base==='posts'){
  const pageSize=10,params=App.route.params||{},category=String(params.category||'');
  const all=(data.posts||[]).filter(item=>item&&item.published!==false).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  const categories=[...new Set(all.map(item=>item.category).filter(Boolean))];
  const rows=category?all.filter(item=>item.category===category):all;
  const total=rows.length,page=App.page(total,pageSize),shown=rows.slice((page-1)*pageSize,page*pageSize);
  const list=region('blog-list');
  if(list){
   list.classList.add('content-showcase-grid','public-main','public-main-full');
   const cards=shown.map(item=>Public.blogPostCard(item)).join('');
   list.replaceChildren(this.staticMarkupFragment(cards||UI.empty('No updates have been published yet','Exam news, preparation guidance and announcements will appear here.')));
   list.hidden=false;
  }
  const filterBar=PublicLayout.selectionBar([{label:'All',path:'posts',params:{},active:!category},...categories.map(value=>({label:value,path:'posts',params:{category:value},active:category===value}))],'Update categories');
  setMarkup('blog-filters',filterBar);
  setMarkup('blog-pagination',UI.pager(total,page,pageSize,params,'posts'));
 }else if(['about','faq','privacy','terms','disclaimer','cookies','advertising'].includes(base)){
  const legalPages=data.content?.legalPages||{},page=legalPages[base]||{},footer=data.settings?.footer||{};
  if((base==='faq'&&footer.showFaq!==true)||(base==='cookies'&&footer.showCookiePolicy!==true)||(base==='advertising'&&footer.showAdvertisingPolicy!==true)||(page.published===false&&!['about','privacy','terms','disclaimer'].includes(base)))return false;
  const titles={about:'About MCQCampus',faq:'Frequently Asked Questions',privacy:'Privacy Policy',terms:'Terms & Conditions',disclaimer:'Disclaimer',cookies:'Cookie Policy',advertising:'Advertising Policy'};
  const title=String(page.title||titles[base]||'Information'),description=String(page.metaDescription||page.seoDescription||'MCQCampus information and policy page.');
  pageHeading(title,description);setBreadcrumbs([[title]]);
  const destination=region('about-content');if(!destination)return false;destination.replaceChildren();
  if(base==='faq'){
   const faq=this.staticTemplateFragment('mcq-faq-content-template');if(faq)destination.append(faq);
  }else{
   const article=this.staticTemplateFragment('mcq-legal-content-template',{}),body=article?.querySelector('[data-legal-body]'),updated=article?.querySelector('[data-policy-updated]');
   if(updated&&page.lastUpdated){updated.textContent='Last Updated: '+String(page.lastUpdated);updated.hidden=false;}
   appendManagedText(body,page.content||(base==='about'?data.content?.about:'')||'');
   if(article)destination.append(article);
  }
  if(!destination.childNodes.length){const paragraph=document.createElement('p');paragraph.textContent='Information will be published here.';destination.append(paragraph);}
  destination.hidden=false;
 }else if(base==='contact'){
  pageHeading('Contact MCQCampus','Contact MCQCampus for support, corrections, technical issues, PDF questions, or advertising inquiries.');
  setBreadcrumbs([['Contact']]);
  const destination=region('contact-form');if(!destination)return false;
  const form=destination.querySelector('form[data-form="contact"]');if(!form)return false;
  const contactSettings=data.settings?.contact||{},contactPage=(data.content?.legalPages||{}).contact||{};
  if(contactPage.content||data.content?.contact){const article=document.createElement('article');article.className='article legal-article';appendManagedText(article,contactPage.content||data.content.contact);if(article.childNodes.length)destination.insertBefore(article,form);}
  const details=document.createElement('div');details.className='contact-details card';
  if(contactSettings.supportEmail){const paragraph=document.createElement('p'),strong=document.createElement('strong'),anchor=document.createElement('a');strong.textContent='Support: ';anchor.className='link';anchor.href='mailto:'+String(contactSettings.supportEmail);anchor.textContent=String(contactSettings.supportEmail);paragraph.append(strong,anchor);details.append(paragraph);}
  if(contactSettings.advertisingContact){const paragraph=document.createElement('p'),strong=document.createElement('strong');strong.textContent='Advertising: ';paragraph.append(strong,document.createTextNode(String(contactSettings.advertisingContact)));details.append(paragraph);}
  if(details.childNodes.length)destination.insertBefore(details,form);
  const params=App.route.params||{},selected=String(params.subject||''),subject=form.querySelector('select[name="subject"]');
  if(subject&&Array.from(subject.options).some(option=>option.value===selected))subject.value=selected;
  const context=form.querySelector('[data-contact-context]');
  if(context){[['mcq_id',String(params.mcq||'').replace(/[^0-9]/g,'')],['page_url',String(params.url||'').slice(0,500)]].forEach(([name,value])=>{if(!value)return;const label=document.createElement('label');label.textContent=name==='mcq_id'?'MCQ ID':'Page URL';const input=document.createElement('input');input.name=name;input.value=value;input.readOnly=true;label.append(input);context.append(label);});}
  destination.hidden=false;
 }else if(base==='sitemap'){
  if(data.settings?.footer?.showSitemap===false)return false;
  setBreadcrumbs([['Sitemap']]);pageHeading('Sitemap','Browse public study sections, organizations, past papers and preparation resources.');
  const destination=region('sitemap-content');if(!destination)return false;
  const groups=[['Main Pages',[['Home','home'],['MCQs','mcqs'],['Important MCQs','important'],['Categories','categories'],['Organizations / Boards','papers'],['Past Papers','papers'],['Tests','tests'],['PDFs','pdfs'],['Jobs & Exams','latest-jobs'],['Blog & Updates','posts']]]];
  const grid=document.createElement('div');grid.className='sitemap-grid';
  groups.forEach(([name,entries])=>{const card=document.createElement('section');card.className='card';const heading=document.createElement('h2');heading.textContent=name;card.append(heading);entries.forEach(([label,path])=>card.append(makeInternalLink(path,label,'discovery-link')));grid.append(card);});
  destination.replaceChildren(grid);destination.hidden=false;
 } shell.querySelectorAll('[data-static-loading]').forEach(node=>node.remove());
 shell.querySelectorAll('[data-api-region]').forEach(area=>{
  const hasContent=Array.from(area.childNodes).some(node=>node.nodeType===1||String(node.textContent||'').trim());
  if(!hasContent)area.hidden=true;
 });
 root.replaceChildren(this.staticPageNode(shell,shellKey));
 root.removeAttribute('aria-busy');
 document.body.dataset.pageTemplate=shellKey==='past-papers'?'papers':shellKey;
 document.body.dataset.staticFallback=shellKey;
 return true;
},
showStaticShell(){
 const root=document.getElementById('app');
 if(!root)return false;
 const parts=location.pathname.replace(/^\/+|\/+$/g,'').replace(/\.html$/i,'').split('/').filter(Boolean);
 const first=parts[0]||'home';
 document.body.dataset.pageTemplate=first==='past-papers'?(parts[1]==='pdfs'?'pdfs':'papers'):first;
 const map={
  index:'home',home:'home',
  mcqs:'mcqs',mcq:'mcqs',practice:'mcqs',important:'mcqs',search:'mcqs',
  categories:'categories',category:'categories',subcategory:'categories',topic:'categories',
  'past-papers':parts[1]==='pdfs'?'pdfs':'past-papers',
  papers:'past-papers',paper:'past-papers',job:'past-papers',year:'past-papers',
  tests:'tests',test:'tests',pdfs:'pdfs',pdf:'pdfs',
  blog:'blog',blogs:'blog',posts:'blog',post:'blog',
  'latest-jobs':'latest-jobs','latest-job':'latest-jobs','jobs-exams':'latest-jobs',
  login:'login',register:'register',forgot:'forgot',reset:'reset-code','reset-code':'reset-code',
  'reset-password':'reset-password',verify:'verify',
  about:'about',faq:'about',privacy:'about',terms:'about',disclaimer:'about',
  cookies:'about',advertising:'about',contact:'contact'
 };
 let page=map[first];
 const requestedCountry=new URLSearchParams(location.search).get('country');
 if((first==='login'||first==='register')&&!String(requestedCountry||'').trim())page='country-entry';
 if(!page)return false;
 const parent=document.getElementById('static-page-shells');
 const source=parent?.querySelector('[data-static-page="'+page+'"]');
 if(!source)return false;
 this.route={path:location.pathname.replace(/^\/+|\/+$/g,'')||'home',params:Object.fromEntries(new URLSearchParams(location.search))};
 const shell=source.cloneNode(true);
 shell.dataset.staticFallback='true';
 root.replaceChildren(this.staticPageNode(shell,page));
 root.setAttribute('aria-busy','true');
 document.body.dataset.staticFallback=page;
 return true;
},

mountStaticPage(base,renderedHtml){
 const discovery=window.SEO?.discoveryPage?.(location.pathname);
 if(discovery?.landing?.type==='paper'&&discovery.landing.id)base='paper';
 else if(discovery?.landing?.type==='job'&&discovery.landing.id)base='job';
 const map={
  home:'home',mcqs:'mcqs',important:'mcqs',topic:'mcqs',search:'mcqs',mcq:'mcqs',practice:'mcqs',
  categories:'categories',category:'categories',subcategory:'categories',
  papers:'past-papers',paper:'past-papers',job:'past-papers',year:'past-papers',
  tests:'tests',test:'tests',pdfs:'pdfs',pdf:'pdfs',
  posts:'blog',post:'blog','latest-jobs':'latest-jobs','latest-job':'latest-jobs',
  about:'about',faq:'about',privacy:'about',terms:'about',disclaimer:'about',cookies:'about',advertising:'about',
  contact:'contact',dashboard:'dashboard',profile:'dashboard',sitemap:'sitemap',admin:'admin','super-admin':'super-admin'
 };
 const page=map[base];
 if(!page)return false;
 const parent=document.getElementById('static-page-shells');
 const sourceShell=parent?.querySelector('[data-static-page="'+page+'"]');
 if(!sourceShell)return false;
 let parsed;
 try{parsed=new DOMParser().parseFromString(String(renderedHtml||''),'text/html')}catch{return false}
 const sourceMain=parsed.querySelector('main#main')||parsed.querySelector('main');
 if(!sourceMain)return false;
 const content=sourceMain.querySelector('.public-main')||sourceMain;
 const shell=sourceShell.cloneNode(true);
 shell.dataset.staticFallback='true';
 const main=shell.querySelector('main');
 if(main){main.id='main';main.tabIndex=-1;if(page!=='home')main.classList.add('public-page')}
 const target=(name)=>shell.querySelector('[data-api-region="'+name+'"]');
 const nodes=(scope,selector)=>Array.from((scope||content).querySelectorAll(selector));
 const fill=(name,selector,scope=content,mode='outer')=>{
  const dest=target(name),found=nodes(scope,selector);
  if(!dest||!found.length)return false;
  if(['mcq-list','category-list','organization-list','past-paper-list','test-list','pdf-list','blog-list','jobs-list','about-content','route-detail'].includes(name))dest.classList.add('public-main','public-main-full');
  dest.replaceChildren();
  if(mode==='inner'){
   found.slice(0,1).forEach(src=>{
    Array.from(src.childNodes).forEach(node=>dest.appendChild(node.cloneNode(true)));
    String(src.className||'').split(/\s+/).filter(Boolean).forEach(cls=>dest.classList.add(cls));
   });
  }else found.forEach(src=>dest.appendChild(src.cloneNode(true)));
  dest.hidden=false;
  return true;
 };
 const fillAny=(name,selectors,scope=content)=>{
  for(const selector of selectors){if(fill(name,selector,scope))return true}
  return false;
 };
 const copyHeading=()=>{
  if(page==='home'){
   const sourceTitle=sourceMain.querySelector('.home-hero-copy h1');
   const sourceDesc=sourceMain.querySelector('.home-hero-copy .hero-copy');
   const title=shell.querySelector('[data-static-home-title]');
   const desc=shell.querySelector('[data-static-home-description]');
   if(sourceTitle&&title)title.textContent=sourceTitle.textContent.trim();
   if(sourceDesc&&desc)desc.textContent=sourceDesc.textContent.trim();
   return;
  }
  const sourceTitle=sourceMain.querySelector('.page-heading h1');
  const sourceDesc=sourceMain.querySelector('.page-heading p');
  const title=shell.querySelector('.page-heading h1');
  const desc=shell.querySelector('.page-heading p');
  if(sourceTitle&&title)title.textContent=sourceTitle.textContent.trim();
  if(sourceDesc&&desc)desc.textContent=sourceDesc.textContent.trim();
 };
 copyHeading();
 fill('breadcrumbs','.breadcrumbs',sourceMain);
 let populated=false;
 if(page==='home'){
  populated=fill('home-stats','.home-stats',sourceMain,'inner')||populated;
  populated=fill('home-important-count','.home-content-grid .section-head p.small.muted',sourceMain,'inner')||populated;
  populated=fill('home-mcqs','.home-mcq-list',sourceMain,'inner')||populated;
  populated=fillAny('home-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  populated=fill('home-categories','.home-cat-boxes',sourceMain,'inner')||populated;
 }else if(page==='mcqs'){
  if(base==='search'){
   populated=fillAny('mcq-summary',['.result-count'],sourceMain)||populated;
   populated=fillAny('mcq-list',['.search-results-list','.empty'],content)||populated;
   populated=fillAny('mcq-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  }else if(base==='mcq'||base==='practice'){
   populated=fill('mcq-list',':scope > *',content)||populated;
  }else{
   populated=fillAny('mcq-summary',['.mcq-count','.result-count'],sourceMain)||populated;
   populated=fillAny('mcq-list',['.mcq-reference-card, .empty'],content)||populated;
   populated=fillAny('mcq-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  }
 }else if(page==='categories'){
  if(base==='categories'){
   populated=fillAny('category-list',['.grid','.empty'],content)||populated;
  }else{
   populated=fillAny('category-context',['.seo-related-block','.chips'],sourceMain)||populated;
   populated=fillAny('mcq-summary',['.result-count','.mcq-count'],sourceMain)||populated;
   populated=fillAny('mcq-list',['.mcq-reference-card, .empty'],content)||populated;
   populated=fillAny('mcq-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  }
 }else if(page==='past-papers'){
  populated=fillAny('past-paper-summary',['.result-count','.mcq-count'],sourceMain)||populated;
  if(base==='papers')populated=fillAny('organization-list',['.grid.paper-grid','.grid','.empty'],content)||populated;
  else if(base==='paper')populated=fillAny('past-paper-list',['.grid.paper-grid','.grid','.empty'],content)||populated;
  else if(base==='year') {
   populated=fillAny('past-paper-list',['.mcq-reference-card, .empty'],content)||populated;
   populated=fillAny('past-paper-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  }else if(base==='job')populated=fillAny('route-detail',['.public-main','.empty'],sourceMain)||populated;
 }else if(page==='tests'){
  if(base==='tests')populated=fillAny('test-list',['.automatic-test-hero','.empty'],content)||populated;
  else populated=fillAny('route-detail',['.test-form','.test-result-grid','.test-result-actions','.empty'],content)||populated;
 }else if(page==='pdfs'){
  populated=fillAny('pdf-summary',['.result-count','.small.muted'],sourceMain)||populated;
  if(base==='pdfs') {
   populated=fillAny('pdf-list',['.pdf-resource-grid','.empty'],content)||populated;
   populated=fillAny('pdf-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  }else populated=fillAny('route-detail',['.pdf-direct-card','.pdf-card','.empty'],content)||populated;
 }else if(page==='blog'){
  if(base==='posts'||base==='blog'){
   populated=fillAny('blog-filters',['.selection-stack','.selection-bar','.chips'],sourceMain)||populated;
   populated=fillAny('blog-list',['.content-showcase-grid','.empty'],content)||populated;
   populated=fillAny('blog-pagination',['.pagination','.pagination-count'],sourceMain)||populated;
  }else populated=fillAny('route-detail',['.public-article','.article','.empty'],content)||populated;
 }else if(page==='latest-jobs'){
  if(base==='latest-jobs')populated=fillAny('jobs-list',['.latest-jobs-list','.empty'],content)||populated;
  else populated=fillAny('route-detail',['.latest-job-card','.empty'],content)||populated;
 }else if(page==='about'){
  populated=fillAny('about-content',['.public-article','.faq-list','.article','.empty'],content,'inner')||populated;
  if(!populated)populated=fill('about-content',':scope > *',content)||populated;
 }else if(page==='contact'){
  populated=fillAny('contact-form',['form[data-form="contact"]'],sourceMain)||populated;
  populated=fillAny('route-detail',['.contact-details','.empty'],content)||populated;
 }else if(page==='dashboard'){
  populated=fill('learner-dashboard','.learner-dashboard-shell',sourceMain,'inner')||populated;
  const dashboardRegion=target('learner-dashboard');dashboardRegion?.classList.remove('container','page');
 }else if(page==='sitemap'){
  populated=fillAny('sitemap-content',['.sitemap-grid','.empty'],content)||populated;
 }else if(page==='admin'||page==='super-admin'){
  shell.querySelector('.page-heading')?.remove();
  shell.querySelector('nav[aria-label="Admin sections"],nav[aria-label="Super Admin sections"]')?.remove();
  if(main)main.classList.remove('container','page','public-page');
  const regionName=page==='admin'?'admin-workspace':'super-admin-workspace';
  populated=fill(regionName,'.admin-shell',parsed.body,'inner')||populated;
  const workspace=target(regionName);
  workspace?.classList.remove('container','page','public-main','public-main-full');
 }
 if(!populated)return false;
 shell.querySelectorAll('[data-static-loading]').forEach(node=>node.remove());
 shell.querySelectorAll('[data-api-region]').forEach(region=>{if(!region.children.length)region.hidden=true});
 const root=document.getElementById('app');
 if(!root)return false;
 root.replaceChildren(this.staticPageNode(shell,page));
 document.body.dataset.staticFallback=page;
 return true;
},
render(){if(!Auth.guard())return;
 if(window.MCQCampusBackendReady===false&&document.querySelector('#app [data-static-fallback="true"]')){
  const root=document.getElementById('app');
  root?.removeAttribute('aria-busy');
  root?.querySelectorAll('[data-static-loading]').forEach(node=>{node.textContent='Live content is temporarily unavailable. Check your connection and try again.';});
  return;
 }const rawPath=location.pathname.replace(/^\/+|\/+$/g,'').replace(/\.html$/i,''),raw=(!rawPath||rawPath==='index')?'home':rawPath,query=location.search.replace(/^\?/,'');const path=raw,parts=path.split('/');let base=parts[0],rawId=parts[1],third=parts[2],id;
 const indexed=(token,kinds)=>window.SEO?.resolveIndex(token,kinds);
 if(base==='mcqs'&&parts[1]==='important-mcqs'){base='important'}
 else if(base==='mcqs'&&/^\d+$/.test(parts[1]||'')){const hit=indexed(parts[1],['mcq']);if(hit){base='mcq';id=hit.key}}
 else if(base==='categories'&&/^\d+$/.test(parts[1]||'')){const hit=indexed(parts[1],['category']);if(hit){base='category';id=hit.key}}
 else if(base==='past-papers'){
  if(parts[1]==='pdfs'){if(/^\d+$/.test(parts[2]||'')){const hit=indexed(parts[2],['pdf']);if(hit){base='pdf';id=hit.key}}else base='pdfs'}
  else if(/^\d+$/.test(parts[1]||'')){
   let hit=indexed(parts[1],['paper','job','year']);
   if(!hit&&parts[2]&&window.SEO){
    const wanted=String(parts[2]).toLowerCase(),slug=SEO.slug,short=SEO.shortName;
    const paper=MCQ.db.papers.find(x=>x.active!==false&&`${slug(short(x.name))}-past-papers`===wanted);
    if(paper)hit={kind:'paper',key:String(paper.id)};
    if(!hit){
     const job=MCQ.db.jobs.find(x=>{const p=MCQ.get('papers',x.paper_id);return x.active!==false&&p?.active!==false&&`${slug(short(p.name))}-${slug(x.name)}-past-papers`===wanted});
     if(job)hit={kind:'job',key:String(job.id)};
    }
    if(!hit){
     const year=MCQ.db.years.find(x=>{const p=MCQ.get('papers',x.paper_id)||MCQ.get('papers',MCQ.get('jobs',x.job_id)?.paper_id);return x.active!==false&&p?.active!==false&&slug(short(p.name)+' '+x.name)===wanted});
     if(year)hit={kind:'year',key:String(year.id)};
    }
   }
   if(hit){base=hit.kind;id=hit.key}
  } else base='papers';
 }
 else if(base==='latest-jobs'&&/^\d+$/.test(parts[1]||'')){const hit=indexed(parts[1],['latest-job']);if(hit){base='latest-job';id=hit.key}}
 else if(base==='blog'){if(/^\d+$/.test(parts[1]||'')){const hit=indexed(parts[1],['post']);if(hit){base='post';id=hit.key}}else base='posts'}
 if(parts[0]==='paper'&&parts[1]){const paperId=resolveRouteId('paper',parts[1]);if(parts[2]==='year'&&parts[3]){base='year';rawId=parts[3];id=resolveRouteId('year',parts[3],x=>(Number(x.paper_id)||Number(MCQ.get('jobs',x.job_id)?.paper_id)||0)===Number(paperId))}else if(parts[2]==='job'&&parts[3]){const jobId=resolveRouteId('job',parts[3],x=>Number(x.paper_id)===Number(paperId));if(parts[4]==='year'&&parts[5]){base='year';rawId=parts[5];id=resolveRouteId('year',parts[5],x=>Number(x.job_id)===Number(jobId))}else{base='job';rawId=parts[3];id=jobId}}else{base='paper';id=paperId}}if(id===undefined)id=resolveRouteId(base,rawId);if(this.activeQuestionId&&(base!=='practice'||Number(id)!==Number(this.activeQuestionId))){delete this.answers[this.activeQuestionId];delete this.choices[this.activeQuestionId];this.activeQuestionId=null}this.route={path,params:Object.fromEntries(new URLSearchParams(query))};document.body.dataset.pageTemplate=base;
 const pageTemplateMap={home:'index',mcqs:'mcqs',mcq:'mcqs',practice:'mcqs',important:'mcqs',search:'mcqs',categories:'categories',category:'categories',subcategory:'categories',topic:'categories',papers:'past-papers',paper:'past-papers',job:'past-papers',year:'past-papers',tests:'tests',test:'tests',login:'login',register:'register',forgot:'login',reset:'login','reset-code':'login','forgot-password':'login','reset-password':'login','password-reset':'login',verify:'login',pdfs:'pdfs',pdf:'pdfs',blog:'blog',posts:'blog',post:'blog',about:'about',faq:'about',privacy:'about',terms:'about',disclaimer:'about',cookies:'about',advertising:'about',contact:'contact',dashboard:'dashboard',profile:'dashboard',admin:'admin','super-admin':'super-admin','latest-jobs':'latest-jobs','latest-job':'latest-jobs','jobs-exams':'latest-jobs'};
 const templatePage=pageTemplateMap[base]||'index';
 if(!document.getElementById('mcq-layout-template')||document.body.dataset.mcqTemplatesPage!==templatePage){
  const pending=this.pageTemplatesPromise;
  if(pending&&pending.page===templatePage)return;
  const state={page:templatePage};this.pageTemplatesPromise=state;
  Promise.resolve(window.MCQCampusLoadSharedTemplates())
   .then(()=>window.MCQCampusLoadPageScript(templatePage==='index'?'home':templatePage))
   .then(()=>{if(this.route.path===path)document.body.dataset.mcqTemplatesPage=templatePage})
   .catch(error=>{console.warn('Using the central index.html templates for '+templatePage,error);if(this.route.path===path)document.body.dataset.mcqTemplatesPage=templatePage})
   .finally(()=>{if(this.pageTemplatesPromise===state)this.pageTemplatesPromise=null;if(this.route.path===path)this.render()});
  return;
 }
 if((base==='admin'||base==='super-admin')&&(!window.Admin||!window.Importer||!window.MCQEnhancements)){
  this.ensureAdminBundle().then(()=>{if(this.route.path===path)this.render()}).catch(error=>{
   const loader=document.getElementById('backend-loader');if(loader?.open)loader.close();
   const root=document.getElementById('app');
   if(root)root.innerHTML=UI.layout('<div class="container page"><div class="notice error" role="alert">Admin tools could not load. Please refresh the page.</div></div>');
   console.error('Admin assets failed to load',error);
  });
  return;
 }
 if(base!=='home'){this.quickTimer?.stop();this.quickAnswer=null;}if(window.SEO?.needsDocumentNavigation(path)){location.replace(UI.href(path,this.route.params));return}let html;try{if(window.SEO?.discoveryPage(path))html=SEO.renderDiscovery(path);else if(this.mountDataDrivenPage(base,id))html=null;else if(base==='home')html=Public.home();else if(['categories','category','subcategory','papers','paper','job'].includes(base))html=Public.browse(base,id);else if(['topic','year','mcqs','important','search'].includes(base))html=Public.listing(base,id);else if(base==='practice')html=Public.practice(id);else if(base==='jobs-exams')html=Public.jobsExams();else if(base==='pdfs')html=Public.pdfs();else if(base==='pdf')html=Public.pdf(id);else if(base==='latest-jobs')html=Public.latestJobs();else if(base==='latest-job')html=Public.latestJob(id);else if(base==='mcq')html=Public.mcq(id);else if(base==='posts'||base==='post')html=Public.posts(base==='post'?id:undefined);else if(base==='tests')html=Public.tests();else if(base==='test')html=Public.test(id);else if(['login','register','forgot','reset','reset-code','reset-password','verify'].includes(base))html=Auth.view(base);else if(base==='dashboard')html=Public.dashboard(id||'overview');else if(base==='profile')html=Public.dashboard('settings');else if(['about','contact','faq','privacy','terms','disclaimer','cookies','advertising'].includes(base))html=Public.info(base);else if(base==='sitemap')html=Public.sitemap();else if(base==='admin'||base==='super-admin')html=Admin.render(id||'overview',third);else html=Public.notFound();if(html!==null){const mountedStatic=this.mountStaticPage(base,html);if(!mountedStatic)document.getElementById('app').replaceChildren(this.staticMarkupFragment(html));}try{const pageKey=templatePage==='index'?'home':templatePage;window.MCQCampusPageHooks?.[pageKey]?.afterRender?.(document.getElementById('app'),{path,base,route:this.route});}catch(pageError){console.error('Page-specific JavaScript hook failed:',pageError)}UI.mountCustomAds?.(document.getElementById('app'));UI.ensureLinkNames?.(document.getElementById('app'));this.fitBracketBreaks?.();this.fitOverflowText?.();window.MCQMotion?.enter(document.getElementById('app'));const side=document.getElementById('admin-sidebar');if(side){side.scrollTop=Number(sessionStorage.getItem('mcq-admin-sidebar-scroll')||0);side.addEventListener('scroll',()=>sessionStorage.setItem('mcq-admin-sidebar-scroll',side.scrollTop),{passive:true});side.querySelector('.item.active')?.scrollIntoView({block:'nearest'});}const quick=base==='home'&&document.querySelector('.hero-quick')?MCQ.topMcqs():[];this.quickTimer?.sync(quick.length?String(quick[Math.max(0,Math.min(Number(this.homeQuickIndex||0),quick.length-1))].id):null);const faq=document.querySelector('[data-faq-rotator]');clearInterval(window.mcqFaqTimer);if(faq&&!matchMedia('(prefers-reduced-motion: reduce)').matches){faq.dataset.current='0';window.mcqFaqTimer=setInterval(()=>{if(document.hidden)return;const dots=[...faq.querySelectorAll('.faq-dot')];if(!dots.length)return;const next=(Number(faq.dataset.current||0)+1)%dots.length;dots[next].click()},5200)}const title=document.querySelector('h1')?.textContent||({home:'A little practice. A lot of progress.',dashboard:'My learning',practice:'Practice MCQs'}[base]||base);document.title=title+' | '+MCQ.db.seo.title;document.querySelector('meta[name="description"]').content=MCQ.db.seo.description;window.SEO?.apply(base,id);Auth.ensureRouteData?.(path,{base,id}).then(changed=>{if(changed&&App.route.path===path)App.render()});document.querySelectorAll('.brand span:last-child').forEach(el=>{const name=MCQ.db.settings.siteName;if(name!=='MCQ Campus')el.textContent=name});}catch(err){this.quickTimer?.stop();document.getElementById('app').innerHTML=UI.layout('<div class="container page">'+UI.empty('We could not load this view',err.message,UI.link('home','Return home','btn'))+'</div>');console.error(err)}}};

App.fitBracketBreaks=function(root=document){
 const scope=root===document?document.getElementById('app'):root;if(!scope)return;
 const selector='.public-page h1,.public-page h2,.public-page h3,.public-page h4,.entity-showcase-card h3,.content-showcase-card h3,.card h3,.article h1,.article h2,.article h3,.breadcrumbs span,.breadcrumbs a,.mcq-answer-years .mcq-year-chip>span:last-child';
 const candidates=[];
 scope.querySelectorAll(selector).forEach(el=>{
  if(el.closest('.admin-shell,.super-admin,form,table')||el.children.length&&![...el.children].every(x=>x.tagName==='BR'))return;
  const cached=el.dataset.bracketText,original=cached||el.textContent||'';if(!original.includes('['))return;
  // Reset a previously adjusted heading only when it contains our own inserted break.
  // Fresh headings already contain plain text, so avoid an unnecessary DOM write/layout.
  if((cached||el.children.length)&&(el.childNodes.length!==1||el.firstChild?.nodeType!==Node.TEXT_NODE||el.textContent!==original))el.textContent=original;
  el.dataset.bracketText=original;
  const node=el.firstChild,at=original.indexOf('[');if(!node||node.nodeType!==Node.TEXT_NODE||at<=0)return;
  candidates.push({el,node,original,at});
 });
 // Read geometry first, then write line breaks in a separate pass to prevent repeated
 // synchronous layout recalculation as the DOM is adjusted heading-by-heading.
 const breaks=[];
 for(const item of candidates){
  const {node,original,at}=item,range=document.createRange();
  range.setStart(node,0);range.setEnd(node,at);const before=range.getBoundingClientRect();
  range.setStart(node,at);range.setEnd(node,original.length);const suffix=range.getBoundingClientRect();
  if(Math.abs(before.bottom-suffix.bottom)>1)breaks.push(item);
 }
 for(const {el,original,at} of breaks)el.innerHTML=UI.esc(original.slice(0,at).trimEnd())+'<br>'+UI.esc(original.slice(at).trimStart());
};
App.fitOverflowText=function(root=document){
 const selectors=['.entity-card-badge','.content-pill','.badge','.chip','.selection-chip','.stat-card-label'];
 root.querySelectorAll(selectors.join(',')).forEach(el=>{
  // Most nodes are new after a render and have no inline adjustments to clear.
  if(el.style.fontSize)el.style.removeProperty('font-size');
  if(el.style.letterSpacing)el.style.removeProperty('letter-spacing');
  if(!el.clientWidth)return;
  const cs=getComputedStyle(el),singleLine=cs.whiteSpace==='nowrap'||el.classList.contains('entity-card-badge')||el.classList.contains('content-pill')||el.classList.contains('badge')||el.classList.contains('chip')||el.classList.contains('selection-chip');
  if(!singleLine)return;
  const over=()=>el.scrollWidth>el.clientWidth+1;
  if(!over())return;
  const size=parseFloat(cs.fontSize)||12,min=el.classList.contains('entity-card-badge')?5.5:7;
  let low=Math.min(min,size),high=size,best=null;
  el.style.setProperty('font-size',low+'px','important');
  if(!over())best=low;
  // Binary search preserves quarter-pixel fit precision in far fewer layout checks
  // than reducing the font size by 0.25px on every iteration.
  for(let i=0;i<7&&high-low>=.25;i++){
   const mid=Math.round(((low+high)/2)*4)/4;if(mid<=low||mid>=high)break;
   el.style.setProperty('font-size',mid+'px','important');
   if(!over()){best=mid;low=mid}else high=mid;
  }
  if(best!==null)el.style.setProperty('font-size',best+'px','important');
  else{el.style.setProperty('font-size',low+'px','important');if(over())el.style.setProperty('letter-spacing','-.045em','important')}
 });
};
App.refreshQuick=function(){
 if(this.route.path!=='home'){this.quickTimer.stop();this.quickAnswer=null;return;}
 const rows=MCQ.topMcqs();this.homeQuickIndex=Math.max(0,Math.min(this.homeQuickIndex,Math.max(0,rows.length-1)));
 const q=rows[this.homeQuickIndex];if(this.quickAnswer?.id!==q?.id)this.quickAnswer=null;
 const panel=document.querySelector('.hero-quick');if(panel){panel.outerHTML=Public.quickCard();window.MCQMotion?.enter(document.querySelector('.hero-quick')?.parentElement||document.getElementById('app'));}
 this.quickTimer.sync(q?String(q.id):null);
};
App.quickTimer=McqCarousel.create({advance(){
 const total=MCQ.topMcqs().length;
 if(App.route.path!=='home'||!total)return;
 App.quickAnswer=null;App.homeQuickIndex=(Number(App.homeQuickIndex||0)+1)%total;
 App.refreshQuick();
}});
(()=>{
 const {esc:e,icon,btn,link}=UI;
 function refreshQuestion(id){const q=MCQ.get('mcqs',id),old=document.querySelector(`[data-question="${+id}"]`);if(old){const number=Number(old.dataset.number||1),compact=old.classList.contains('mcq-card-compact');old.outerHTML=Public.questionCard(q,number,compact)}}
 function resetActiveQuestion(exceptId=null){const previous=Number(App.activeQuestionId||0);if(previous&&previous!==Number(exceptId||0)){delete App.answers[previous];delete App.choices[previous];refreshQuestion(previous)}App.activeQuestionId=exceptId?Number(exceptId):null}
 function error(msg,target){if(target)target.innerHTML=`<div class="notice error" role="alert">${e(msg)}</div>`;else UI.toast(msg)}
 function close(){document.getElementById('modal').close()}
 async function copyLink(id,share=false){const url=location.origin+UI.href('mcq/'+id);if(share&&navigator.share){try{await navigator.share({title:'MCQ Campus',text:MCQ.get('mcqs',id)?.question,url});return}catch(err){if(err.name==='AbortError')return}}try{await navigator.clipboard.writeText(url);UI.toast('Question link copied.')}catch{UI.modal('Copy question link',`<p class="small muted">Copy this address. Local file links work only on the same device.</p><input style="width:100%" value="${e(url)}" readonly aria-label="Question link">`);document.querySelector('#modal input').select()}}
 function review(ids,status){if(!ids.length){UI.toast('Select at least one question.');return}MCQ.assert('review');if(status==='approved'){UI.modal('Approve questions',`<p>Make ${ids.length} question${ids.length===1?'':'s'} visible on the public website?</p><form data-form="review" data-ids="${ids.join(',')}" data-status="approved"><button class="btn primary">Approve</button> ${btn('Cancel','close','')}</form>`)}else UI.modal(status==='pending'?'Send back for correction':'Reject questions',`<p>${ids.length} selected question${ids.length===1?'':'s'}.</p><form data-form="review" data-ids="${ids.join(',')}" data-status="${status}">${UI.textarea('reason',status==='pending'?'Correction needed':'Rejection reason','',true)}<button class="btn primary">Confirm</button></form>`)}
 function template(ext){const q=MCQ.clone(MCQ.db.mcqs[0]||{});q.question='What is 10% of 500?';q.option1='50';q.option2='5';q.option3='100';q.option4='500';q.correct_answer='50';q.description='500 × 0.10 = 50.';q.country=MCQ.db.activeCountry||MCQ.db.session?.country||'Pakistan';const label=(t,ids)=>MCQ.ids(ids).map(id=>MCQ.get(t,id)?.name).filter(Boolean).join('|');const category=MCQ.get('categories',q.category_id)?.name||MCQ.db.categories.find(x=>x.active!==false&&!x.legacy)?.name||'General Knowledge';const organizationRow=MCQ.get('papers',MCQ.ids(q.paper_id)[0])||MCQ.db.papers.find(x=>x.active!==false&&(x.country===q.country||x.country==='Both'));const organization=organizationRow?.name||'PPSC';const pastPaperRow=MCQ.db.years.find(x=>x.active!==false&&String(x.paper_id)===String(organizationRow?.id||''));const pastPaper=pastPaperRow?.name||'Past Paper 2025';const fields=['question','option1','option2','option3','option4','correct_answer','description','country','category','organization','past_paper'];const row={question:q.question,option1:q.option1,option2:q.option2,option3:q.option3,option4:q.option4,correct_answer:q.correct_answer,description:q.description,country:q.country,category,organization,past_paper:pastPaper};if(ext==='json')UI.download('mcq-import-template.json',JSON.stringify([row],null,2));else if(ext==='csv'){const quote=v=>'"'+String(Array.isArray(v)?JSON.stringify(v):v).replace(/"/g,'""')+'"';UI.download('mcq-import-template.csv',fields.map(quote).join(',')+'\n'+fields.map(k=>quote(row[k])).join(','),'text/csv')}else{const text=[q.question,'Option 1: '+q.option1,'Option 2: '+q.option2,'Option 3: '+q.option3,'Option 4: '+q.option4,'Correct Answer: '+q.correct_answer,'Country: '+q.country,'Category: '+category,'Organization / Board: '+organization,'Past Paper: '+pastPaper,'Description: '+q.description].join('\n');UI.download('mcq-import-template.txt',text,'text/plain')}}
 document.addEventListener('click',ev=>{const a=ev.target.closest('a[href^="/"]');if(!a)return;document.getElementById('main-nav')?.classList.remove('open');document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded','false');document.getElementById('public-smart-sidebar')?.classList.remove('open');document.querySelector('.public-sidebar-backdrop')?.classList.remove('open');document.querySelector('[data-action="public-sidebar-toggle"]')?.setAttribute('aria-expanded','false');if(ev.defaultPrevented||ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey||a.target==='_blank'||a.hasAttribute('download'))return;const url=new URL(a.href,location.origin);if(url.origin!==location.origin||window.SEO?.needsDocumentNavigation(url.pathname))return;ev.preventDefault();history.pushState(null,'',url.pathname+url.search);App.render();window.scrollTo(0,0);});
 document.addEventListener('click',async ev=>{if(ev.target.closest('.skip')){ev.preventDefault();document.getElementById('main')?.focus();document.getElementById('main')?.scrollIntoView();return}const el=ev.target.closest('[data-action]');if(!el)return;const a=el.dataset.action,id=+el.dataset.id;try{
 if(a==='close')close();
 if(a==='password-toggle'){const input=document.getElementById(el.dataset.target);if(input){const show=input.type==='password';input.type=show?'text':'password';el.setAttribute('aria-label',show?'Hide password':'Show password');el.innerHTML=UI.icon(show?'eye':'eye-off');}}

 if(a==='menu'){const n=document.getElementById('main-nav');el.setAttribute('aria-expanded',String(n.classList.toggle('open')))}
 if(a==='faq-slide'){const panel=el.closest('[data-faq-rotator]');const index=Number(el.dataset.index||0);if(panel){panel.querySelectorAll('.faq-slide').forEach((x,i)=>x.classList.toggle('active',i===index));panel.querySelectorAll('.faq-dot').forEach((x,i)=>x.classList.toggle('active',i===index));const c=panel.querySelector('.faq-count');if(c)c.textContent=String(index+1).padStart(2,'0')+' / 04';panel.dataset.current=index}}
 if(a==='home-quick-next'){App.quickTimer.stop();App.quickAnswer=null;const total=MCQ.topMcqs().length;App.homeQuickIndex=total?(Number(App.homeQuickIndex||0)+1)%total:0;App.refreshQuick()}
 if(a==='home-quick-jump'){App.quickTimer.stop();App.quickAnswer=null;App.homeQuickIndex=Number(el.dataset.index||0);App.refreshQuick()}
 if(a==='home-quick-choose'){const q=MCQ.topMcqs()[App.homeQuickIndex];if(!q||q.id!==id||App.quickAnswer?.id===id)return;const choice=q['option'+el.dataset.option];if(!choice)return;App.quickAnswer={id,choice};App.quickTimer.stop();App.refreshQuick();await MCQ.attempt(id,choice)}
 if(a==='sidebar'){const n=document.getElementById('admin-sidebar');el.setAttribute('aria-expanded',String(n.classList.toggle('open')))}
 if(a==='learner-sidebar-toggle'){const n=document.getElementById('learner-sidebar');if(n)n.classList.toggle('open')}
 if(a==='public-sidebar-toggle'){const n=document.getElementById('public-smart-sidebar'),b=document.querySelector('.public-sidebar-backdrop');if(n){const open=n.classList.toggle('open');b?.classList.toggle('open',open);el.setAttribute('aria-expanded',String(open));if(open)n.querySelector('select,input,button,a')?.focus()}}
 if(a==='public-sidebar-close'){const n=document.getElementById('public-smart-sidebar'),b=document.querySelector('.public-sidebar-backdrop'),t=document.querySelector('[data-action="public-sidebar-toggle"]');n?.classList.remove('open');b?.classList.remove('open');t?.setAttribute('aria-expanded','false');t?.focus()}
 if(a==='choose'){const q=MCQ.get('mcqs',id);if(!q)return;if(App.activeQuestionId&&App.activeQuestionId!==id)resetActiveQuestion(id);else App.activeQuestionId=id;if(App.answers[id])return;App.choices[id]=q['option'+el.dataset.option];App.answers[id]=true;refreshQuestion(id);await MCQ.attempt(id,App.choices[id])}
 if(a==='bookmark'){const saved=await MCQ.toggleBookmark(id);refreshQuestion(id);UI.toast(saved?'Question saved to your revision list.':'Bookmark removed.')}
 if(a==='copy'||a==='share')await copyLink(id,a==='share');
 if(a==='report')UI.modal('Report a question',`<p class="small">${e(MCQ.get('mcqs',id)?.question)}</p><form data-form="report" data-id="${id}">${UI.textarea('reason','What should we review?','',true)}<div class="actions"><button class="btn primary">Save report</button>${link('contact','Contact support','btn',{subject:'Report Incorrect MCQ',mcq:id,url:UI.href('mcq/'+id)})}</div></form>`);
	 if(a==='save-paper'){const saved=await MCQ.savePaper(id);App.render();UI.toast(saved?'Paper saved.':'Saved paper removed.')}
 if(a==='workspace-switch'){App.draftKey=null;App.draft=null;App.importRows=null;App.importSummary=null;App.importedIds=[];App.importPage=null;const r=await Auth.switchRole(el.dataset.role);App.go(r==='user'?'dashboard':r+'/overview');App.render()} if(a==='logout'){App.draftKey=null;App.draft=null;App.importRows=null;App.importSummary=null;App.importedIds=[];App.importPage=null;await Auth.logout()}
 if(a==='resend')UI.toast('Resend state preview. No email was sent.');
 if(a==='latest-jobs-select-all')document.querySelectorAll('.latest-job-row-check').forEach(c=>c.checked=el.checked);
 if(a==='select-all'){document.querySelectorAll('.row-check').forEach(c=>c.checked=el.checked);const allPending=document.querySelector('[data-action="select-all-pending"]');if(allPending&&!el.checked)allPending.checked=false;selectionCount()}
 if(a==='select-all-pending'){document.querySelectorAll('.row-check').forEach(c=>c.checked=el.checked);const pageSelect=document.querySelector('[data-action="select-all"]');if(pageSelect)pageSelect.checked=el.checked;const box=document.getElementById('selection-count');if(box)box.textContent=el.checked?Number(el.dataset.total||0).toLocaleString('en-GB')+' selected':'0 selected'}
 if(a==='sort')App.go(App.route.path,{...App.route.params,sort:el.dataset.sort,page:1});
 if(a==='review')review([id],el.dataset.status);
 if(a==='bulk-review'){const allPending=document.querySelector('[data-action="select-all-pending"]:checked');if(allPending){MCQ.assert('review');if(el.dataset.status!=='approved')throw Error('Select-all pending is available for approval only.');const total=Number(allPending.dataset.total||0);UI.modal('Approve all pending MCQs',`<div class="notice warning"><strong>${total.toLocaleString('en-GB')} pending MCQ${total===1?'':'s'} will be approved.</strong><p>This includes pending MCQs on every pagination page, not only the 10 currently visible.</p></div><form data-form="review" data-all-pending="true" data-status="approved"><button class="btn primary">Approve all pending</button> ${btn('Cancel','close','')}</form>`)}else review([...document.querySelectorAll('.row-check:checked')].map(x=>+x.value),el.dataset.status)}
 if(a==='bulk-mcq-delete'){const ids=id?[id]:[...document.querySelectorAll('.row-check:checked')].map(x=>+x.value);if(!ids.length)throw Error('Select at least one MCQ.');if(MCQ.role()!=='super-admin')throw Error('Only the Super Admin can delete MCQs.');UI.modal('Move selected MCQs to Trash?',`<div class="notice warning"><strong>${ids.length} MCQ${ids.length===1?'':'s'} will be removed from the website.</strong><p>They will stay recoverable in Trash & recovery.</p></div>${btn('Move to Trash','bulk-mcq-delete-confirm','danger',`data-ids="${ids.join(',')}"`)} ${btn('Cancel','close','')}`)}
 if(a==='bulk-mcq-delete-confirm'){const ids=String(el.dataset.ids||'').split(',').map(Number).filter(Boolean);if(!ids.length)throw Error('No MCQs selected.');const result=await Auth.request('/admin/mcqs/delete',{ids});MCQ.remove('mcqs',result.deletedIds||ids);close();App.render();UI.toast((result?.count||ids.length)+' MCQ(s) moved to Trash.')}
 if(a==='bulk-important'){const on=el.dataset.value==='true',target=el.dataset.target;let qs=[];if(target==='mcqs'){MCQ.assert('edit');const ids=[...document.querySelectorAll('.row-check:checked')].map(x=>+x.value);if(!ids.length)throw Error('Select at least one MCQ.');qs=MCQ.db.mcqs.filter(q=>ids.includes(+q.id));}else if(target==='papers'){MCQ.assert('papers');const ids=[...document.querySelectorAll('.entity-row-check[data-type="papers"]:checked')].map(x=>+x.value);if(!ids.length)throw Error('Select at least one Paper.');qs=MCQ.db.mcqs.filter(q=>MCQ.ids(q.paper_id).some(pid=>ids.includes(pid)));}if(!qs.length)throw Error('No linked MCQs found.');for(const q of qs)q.important=on;MCQ.log(on?'Bulk marked Important':'Bulk removed manual importance',qs.length+' MCQ(s)');MCQ.save();App.render();UI.toast(qs.length+' MCQ(s) updated. Automatic repeated-year importance remains active.');}
 if(a==='entity-delete'){const type=el.dataset.type;MCQ.assert(type);const impact=MCQ.deleteImpact(type,id);const childCount=Object.values(impact.sets).reduce((n,set)=>n+set.size,0)-1;UI.modal('Delete '+(impact.root?.name||'record')+'?',`<div class="notice warning"><strong>This is a recoverable delete.</strong><p>${impact.mcqs.length} MCQ${impact.mcqs.length===1?'':'s'} and ${childCount} linked child record${childCount===1?'':'s'} will be moved to Trash with this record.</p></div><p>You can restore the complete set later from <strong>Trash & recovery</strong>.</p>${btn('Move to Trash','entity-delete-confirm','danger',`data-type="${type}" data-id="${id}"`)} ${btn('Cancel','close','')}`)}
 if(a==='entity-delete-confirm'){MCQ.assert(el.dataset.type);const item=MCQ.softDeleteEntity(el.dataset.type,id);close();App.render();UI.toast(item.name+' moved to Trash with '+item.mcqs.length+' MCQ(s).')}
 if(a==='select-all-trash'){document.querySelectorAll('.trash-row-check').forEach(c=>c.checked=el.checked);const box=document.getElementById('trash-selection-count');if(box)box.textContent=document.querySelectorAll('.trash-row-check:checked').length+' selected'}
 if(a==='trash-restore'){MCQ.assert('restore');const result=await Auth.request('/admin/trash/restore',{ids:[id]});MCQ.remove('trash',result.ids||[id]);App.render();UI.toast('Deleted record recovered from Trash.')}
 if(a==='trash-bulk-restore'){const ids=[...document.querySelectorAll('.trash-row-check:checked')].map(x=>+x.value);if(!ids.length)throw Error('Select at least one Trash record.');const result=await Auth.request('/admin/trash/restore',{ids});MCQ.remove('trash',result.ids||ids);App.render();UI.toast((result?.restored||ids.length)+' Trash record(s) recovered.')}
 if(a==='trash-permanent-delete'||a==='trash-bulk-delete'){const ids=a==='trash-permanent-delete'?[id]:[...document.querySelectorAll('.trash-row-check:checked')].map(x=>+x.value);if(!ids.length)throw Error('Select at least one Trash record.');UI.modal('Permanently delete from Trash?',`<div class="notice warning"><strong>This cannot be recovered.</strong><p>${ids.length} Trash record${ids.length===1?'':'s'} will be permanently removed.</p></div>${btn('Delete permanently','trash-permanent-delete-confirm','danger',`data-ids="${ids.join(',')}"`)} ${btn('Cancel','close','')}`)}
 if(a==='trash-permanent-delete-confirm'){const ids=String(el.dataset.ids||'').split(',').map(Number).filter(Boolean);const result=await Auth.request('/admin/trash/delete',{ids});MCQ.remove('trash',result.deleted?.ids||ids);close();App.render();UI.toast((result?.count||ids.length)+' Trash record(s) permanently deleted.')}

 if(a==='view-mcq'){const q=MCQ.managedMcq(id),pu=q.pending_update,show=pu?.proposed||q;const names=(type,v)=>MCQ.ids(v).map(x=>MCQ.get(type,x)?.name).filter(Boolean).join(', ')||'—';const details=[['Question',show.question],['Option 1',show.option1],['Option 2',show.option2],['Option 3',show.option3],['Option 4',show.option4],['Correct Answer',show.correct_answer],['Description',show.description||'—'],['Category',MCQ.get('categories',show.category_id)?.name||'—'],['Organization / Board',names('papers',show.paper_id)],['Past Paper',names('years',show.job_years_ids)],['Importance',MCQ.isImportant(show)?(show.important?'Manual / automatic':'Automatic: repeated in 2+ Past Papers'):'Normal'],['Created by',q.created_by||'—'],['Created date',UI.date(q.created_at)],['Updated date',UI.date(q.updated_at)],['Updated by',pu?.submitted_by||q.updated_by||'—'],['Submission Type',pu?'UPDATE':(q.submission_type||'NEW').toUpperCase()],['Submitted By',pu?.submitted_by||q.submitted_by||q.created_by||'—'],['Submission Date/Time',UI.date(pu?.submitted_at||q.submitted_at||q.updated_at)]];const label={question:'Question',option1:'Option 1',option2:'Option 2',option3:'Option 3',option4:'Option 4',correct_answer:'Correct Answer',description:'Description',category_id:'Category',paper_id:'Organization / Board',job_ids:'Legacy Job IDs',job_years_ids:'Past Paper',important:'Manual Important'};const format=(k,v)=>{if(k==='category_id')return MCQ.get('categories',v)?.name||'—';if(k==='paper_id')return names('papers',v);if(k==='job_ids')return names('jobs',v);if(k==='job_years_ids')return names('years',v);return Array.isArray(v)?v.join(', '):String(v??'—')};const changed=pu?.changes?.length?`<section class="change-panel"><h3>Changes · Before → After</h3>${pu.changes.map(c=>`<div class="change-row"><strong>${e(label[c.field]||c.field)}</strong><div class="change-before"><span>Before</span>${e(format(c.field,c.before))}</div><div class="change-after"><span>After</span>${e(format(c.field,c.after))}</div></div>`).join('')}</section>`:'';UI.modal('Review MCQ #'+id,`${changed}<div class="review-record">${details.map(([k,v])=>`<div><span>${e(k)}</span><strong>${e(v)}</strong></div>`).join('')}</div>${q.rejection_reason?`<div class="notice warning">${e(q.rejection_reason)}</div>`:''}<div class="actions review-actions">${link(Admin.url('edit/'+id),'Edit question','btn')}${MCQ.allowed('approve')?btn('Approve','review','primary',`data-id="${id}" data-status="approved"`):''}${MCQ.role()==='super-admin'?btn('Delete','bulk-mcq-delete','danger',`data-id="${id}"`):''}</div>`)}
 if(a==='pick'||a==='remove-chip')Admin.pick(el.dataset.field,id,a==='remove-chip');
 if(a==='clear-draft'){UI.modal('Clear this form?',`<p>Unsaved changes in this form will be removed.</p>${btn('Clear form','clear-draft-confirm','danger')} ${btn('Keep editing','close','')}`)}
 if(a==='clear-draft-confirm'){App.draftKey=null;close();App.render()}
 if(a==='preview-draft'){Admin.syncDraft();const q=App.draft;UI.modal('Question preview',`<h3>${e(q.question||'Untitled question')}</h3><ol type="A">${[1,2,3,4].map(i=>`<li>${e(q['option'+i])}</li>`).join('')}</ol><p><strong>Correct answer:</strong> ${e(q.correct_answer||'Not selected')}</p><p>${e(q.description)}</p>`)}
 if(a==='entity-new'||a==='entity-edit')Admin.entityModal(el.dataset.type,id||undefined,el.dataset.parent?+el.dataset.parent:undefined);
 if(a==='entity-pin'){const type=el.dataset.type,mode=el.dataset.mode||'pin';if(MCQ.role()!=='super-admin')throw Error('Only the Super Admin can manage pins.');const result=await Auth.command('action:entity-pin',{type,id,mode});if(result?.pinnedEntities)MCQ.db.pinnedEntities=result.pinnedEntities;App.render();UI.toast(mode==='unpin'?'Unpinned.':'Pin order updated.')}
 if(a==='bulk-hierarchy')Admin.bulkHierarchyModal();
 if(a==='bulk-categories')Admin.bulkCategoriesModal();
 if(a==='use-entity'){close();App.go(Admin.url(el.dataset.type),{q:MCQ.get(el.dataset.type,id).name});UI.toast('Using existing record. No duplicate created.')}
 if(a==='user-new'||a==='user-edit')Admin.userModal(id||undefined);
 
 if(a==='post-new'||a==='post-edit')Admin.postModal(id||undefined);
 if(a==='ad-toggle'){MCQ.assert('ads');const ad=(MCQ.db.ads||[]).find(x=>+x.id===id);if(ad){ad.enabled=ad.enabled===false;MCQ.save();App.render()}}
	 if(a==='ad-delete'){MCQ.assert('ads');MCQ.db.ads=(MCQ.db.ads||[]).filter(x=>+x.id!==id);MCQ.save();App.render();UI.toast('Advertisement removed.')}
	 if(a==='report-resolve'){MCQ.assert('reports');const r=MCQ.get('reports',id);r.status='resolved';MCQ.log('Resolved report',String(id));MCQ.save();App.render();UI.toast('Report resolved.')}
 if(a==='import-template')template(el.dataset.ext);
 if(a==='import-page')await Admin.loadImportPage(Number(el.dataset.page||1));
 if(a==='import-report')UI.download('mcq-validation-report.json',JSON.stringify(App.importRows,null,2));
 if(['backup-export','mcqs-export','taxonomy-export'].includes(a)){MCQ.assert('backup');let d=a==='backup-export'?MCQ.exportData():a==='mcqs-export'?MCQ.db.mcqs:{categories:MCQ.db.categories};if(a==='backup-export')d.session=null;UI.download('mcq-campus-'+a.replace('-export','')+'.json',JSON.stringify(d,null,2))}
 }catch(err){error(err.message)}});
 function selectionCount(){const count=document.querySelectorAll('.row-check:checked').length;const box=document.getElementById('selection-count');if(box)box.textContent=count+' selected'}
 document.addEventListener('change',ev=>{
  const control=ev.target.closest('[data-auto-filter]');
  const form=control?.closest('form[data-form="filter"]');
  if(!form)return;
  const values=Object.fromEntries(new FormData(form)),p={};
  for(const [k,v] of Object.entries(values))if(v)p[k]=v;
  p.page='1';
  App.go(App.route.path,p);
 });
 document.addEventListener('submit',async ev=>{const f=ev.target.closest('form[data-form]');if(!f)return;ev.preventDefault();const type=f.dataset.form,values=Object.fromEntries(new FormData(f));try{
 if(type==='search')App.go('search',{q:values.q||''});
 if(type==='filter'){const p={};for(const[k,v]of Object.entries(values))if(v)p[k]=v;App.go(App.route.path,p)}
 if(type==='paper-job-select'){const ids=new FormData(f).getAll('job_id').map(Number).filter(Boolean);if(!ids.length)throw Error('Select at least one job/post.');App.go(Admin.url('paper-mcqs/'+f.dataset.paper),{jobs:ids.join(',')})}
 if(type==='test-submit'){const testRows=MCQ.publicMcqs().filter(q=>f.querySelector(`[name="test_q_${q.id}"]`));const answers={};let correct=0,wrong=0,unanswered=0;for(const q of testRows){const chosen=values['test_q_'+q.id]||'';answers[q.id]=chosen;if(!chosen)unanswered++;else if(chosen===q.correct_answer)correct++;else wrong++;}const started=Number(f.dataset.startedAt||Date.now()),timeTaken=Math.max(0,Math.round((Date.now()-started)/1000));App.testResult={key:f.dataset.testKey,total:testRows.length,correct,wrong,unanswered,answers,timeTaken,completedAt:new Date().toISOString()};if(MCQ.db.session){await MCQ.saveProfile({testsTaken:Number(MCQ.db.session.testsTaken||0)+1,lastTestSummary:{total:testRows.length,correct,wrong,unanswered,timeTaken,completedAt:App.testResult.completedAt}});}App.render();window.scrollTo(0,0)}
 if(type==='profile'){const data=new FormData(f);await MCQ.saveProfile({name:values.name.trim(),email:values.email.trim(),country:values.country,exam_goal:values.exam_goal||'PPSC',interests:data.getAll('interests'),daily_goal:Number(values.daily_goal||25)});UI.toast('Profile saved.');App.render()} if(type==='password-change'){if(values.new_password!==values.confirm_password)throw Error('New passwords do not match.');if(String(values.new_password||'').length<8)throw Error('New password must be at least 8 characters.');await MCQ.changePassword({current_password:values.current_password,new_password:values.new_password,confirm_password:values.confirm_password});f.reset();UI.toast('Password changed.')}
 if(type==='contact'){MCQ.db.contacts.unshift({...values,mcq_id:values.mcq_id?Number(values.mcq_id):null,page_url:String(values.page_url||''),id:Date.now(),at:new Date().toISOString(),by_id:MCQ.db.session?.id||null,by:MCQ.db.session?.name||values.name});MCQ.save();f.reset();UI.toast('Message sent.')}
 if(type==='report'){await MCQ.report(f.dataset.id,values.reason);close();UI.toast('Report submitted.')}
 if(type==='review'){await Auth.command('form:review',{values,fields:[...new FormData(f)],context:{ids:f.dataset.ids,status:f.dataset.status}});close();App.render();UI.toast('Review status updated.')}
 if(type==='mcq'){Admin.syncDraft();const paper=MCQ.ids(App.draft.paper_id).map(id=>MCQ.get('papers',id)).find(Boolean);if(paper?.country)App.draft.country=paper.country;else App.draft.country=App.draft.country||MCQ.db.settings.mcqEntryCountry||'Pakistan';const q=MCQ.saveMcq(App.draft);App.draftKey=null;App.go(Admin.url('mcqs'),{q:q.question});UI.toast('Question saved. Status: '+q.status)}
 if(type==='bulk-hierarchy'){MCQ.assert('papers');MCQ.assert('years');const lines=String(values.hierarchy||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)throw Error('Add at least one Organization / Board | Past Paper line.');let created=0,reused=0;const country=MCQ.db.settings.mcqEntryCountry||MCQ.db.settings.country||'Pakistan';const exact=(type,name,parentKey,parentId)=>MCQ.db[type].find(x=>MCQ.norm(x.name)===MCQ.norm(name)&&(!parentKey||Number(x[parentKey])===Number(parentId)));for(const [index,line] of lines.entries()){const parts=line.split(/\s*(?:\||>)\s*/).map(x=>x.trim()).filter(Boolean);if(parts.length!==2&&parts.length!==3)throw Error('Line '+(index+1)+' must contain: Organization / Board | Past Paper.');const [paperName,yearName]=parts.length===2?parts:[parts[0],parts[2]];let paper=exact('papers',paperName);if(!paper){const r=MCQ.saveEntity('papers',{name:paperName,country,icon:'paper',active:true});paper=r.record||r.existing;created++}else reused++;let year=exact('years',yearName,'paper_id',paper.id)||MCQ.db.years.find(x=>MCQ.norm(x.name)===MCQ.norm(yearName)&&Number(MCQ.get('jobs',x.job_id)?.paper_id)===Number(paper.id));if(!year){const r=MCQ.saveEntity('years',{name:yearName,paper_id:paper.id,icon:'paper',active:true});year=r.record||r.existing;created++}else reused++;}close();App.render();UI.toast(lines.length+' hierarchy line(s) processed · '+created+' records added · '+reused+' existing records reused.')}
 if(type==='entity'){const type=f.dataset.type,rel=MCQ.parents[type];const iconUrl=(values['entity-icon-url']||'').trim();if(iconUrl&&!/^https?:\/\//i.test(iconUrl))throw Error('Icon URL must start with http:// or https://.');const record={id:f.dataset.id?+f.dataset.id:undefined,name:values['entity-name'].trim(),...((type==='categories'||type==='papers')?{country:values['entity-country']||'Pakistan'}:{}),icon:(iconUrl||(values['entity-icon']||'').trim()||(values['entity-icon-data']||'').trim()),active:values['entity-active']==='on'};if(rel)record[rel[1]]=+values['entity-parent'];const result=MCQ.saveEntity(type,record);if(result.existing){Admin.entityState();return}close();App.render();UI.toast('Record saved.')}
 if(type==='user'){const data=new FormData(f),id=+f.dataset.id,old=MCQ.get('users',id),isOwner=MCQ.role()==='super-admin',targetRole=old?.role||values.role;MCQ.assert(targetRole==='user'&&values.role==='user'?'users':'admins');if(MCQ.db.users.some(x=>x.id!==id&&MCQ.norm(x.email)===MCQ.norm(values.email)))throw Error('An account with this email already exists.');if(old?.id===MCQ.db.session.id&&(values.role!=='super-admin'||values.status!=='active'))throw Error('Keep the active owner account enabled with Super admin access.');if(!['user','admin','super-admin'].includes(values.role))throw Error('Invalid role.');if(!isOwner&&old&&values.role!==old.role)throw Error('Only the Super Admin can change administrator roles.');if(!isOwner&&!old&&values.role!=='user')throw Error('Only the Super Admin can create administrator accounts.');if(!isOwner&&values.role==='super-admin')throw Error('Only the Super Admin can create or assign Super Admin access.');const roles=values.role==='user'?['user']:['user',values.role],selectedPermissions=isOwner?MCQ.permissionCatalog.filter(key=>data.has('perm_'+key)):(old?.permissions||[]),defaultPermissions=Object.entries(MCQ.db.rolePermissions?.admin?.permissions||{}).filter(([,enabled])=>enabled).map(([key])=>key),isDefaultPermissionSet=selectedPermissions.length===defaultPermissions.length&&selectedPermissions.every(key=>defaultPermissions.includes(key));const now=new Date().toISOString(),actor=MCQ.db.session;const row={...old,...values,created_at:old?old.created_at:now,created_by:old?old.created_by:actor.name,created_by_id:old?old.created_by_id:actor.id,updated_at:now,updated_by:actor.name,updated_by_id:actor.id,roles,activeRole:(old?.activeRole&&roles.includes(old.activeRole))?old.activeRole:values.role,permissions:values.role==='super-admin'?[...MCQ.permissionCatalog]:values.role==='admin'?selectedPermissions:[],permissionsCustomized:values.role==='admin'&&!isDefaultPermissionSet,avatar:old?.avatar||'',id:old?.id||Math.max(0,...MCQ.db.users.map(x=>x.id))+1};if(old)MCQ.db.users.splice(MCQ.db.users.indexOf(old),1,row);else MCQ.db.users.push(row);if(row.id===MCQ.db.session.id)MCQ.db.session=MCQ.clone(row);MCQ.log('Saved account',row.name);MCQ.save();close();App.render();UI.toast('Account saved. Use password reset to set or change credentials.')}
 if(type==='post'){MCQ.assert('posts');const old=MCQ.get('posts',f.dataset.id),now=new Date().toISOString(),actor=MCQ.db.session,title=String(values.title||'').trim(),body=String(values.body||'').trim(),excerpt=String(values.excerpt||'').trim();if(!title||!body)throw Error('Blog title and content are required.');const status=['draft','published'].includes(values.status)?values.status:'draft',autoDescription=(excerpt||body.replace(/\s+/g,' ').trim()).slice(0,155);const row={...old,title,slug:MCQ.slug(title),excerpt,body,featured_image:String(values.featured_image_data||values.featured_image||old?.featured_image||'').trim(),category:old?.category||'Exam preparation',seo_title:title,seo_description:autoDescription,status,links:old?.links||[],published:status==='published',created_at:old?old.created_at:now,created_by:old?old.created_by:actor.name,created_by_id:old?old.created_by_id:actor.id,updated_at:now,updated_by:actor.name,updated_by_id:actor.id,id:old?.id||Math.max(0,...MCQ.db.posts.map(x=>x.id))+1};if(old)MCQ.db.posts.splice(MCQ.db.posts.indexOf(old),1,row);else MCQ.db.posts.unshift(row);MCQ.log('Saved post',row.title);MCQ.save();close();App.render();UI.toast('Blog saved with automatic SEO URL and metadata.')}
 if(type==='ad-config'){MCQ.assert('ads');const slots={};for(const [k,v] of Object.entries(values))if(k.startsWith('slot_')&&String(v).trim())slots[k.slice(5)]=String(v).trim();MCQ.db.adSettings={...(MCQ.db.adSettings||{}),enabled:values.enabled==='on',adsenseClient:String(values.adsenseClient||'').trim(),analyticsId:String(values.analyticsId||'').trim(),slots};MCQ.save();App.render();UI.toast('Ad and analytics configuration saved.')}
 if(type==='custom-ad'){MCQ.assert('ads');await Auth.command('form:ad',{values,fields:[...new FormData(f)]});f.reset();App.render();UI.toast('Custom ad code saved.')}  if(type==='direct-ad'){MCQ.assert('ads');const safeUrl=v=>!v||/^https?:\/\//i.test(v);if(!safeUrl(values.image_url)||!safeUrl(values.destination_url))throw Error('Banner and destination URLs must use http:// or https://.');MCQ.db.ads=MCQ.db.ads||[];MCQ.db.ads.unshift({id:Date.now(),provider:'direct',brand:String(values.brand||'').trim(),image_url:String(values.image_url||'').trim(),destination_url:String(values.destination_url||'').trim(),text:String(values.text||'').trim(),placement:values.placement,start_date:values.start_date||'',end_date:values.end_date||'',enabled:true});MCQ.save();f.reset();App.render();UI.toast('Direct advertisement added.')}
 if(type==='footer-settings'){MCQ.assert('footer');const safeUrl=v=>!v||/^https?:\/\//i.test(v)||/^assets\//i.test(v),email=String(values.supportEmail||'').trim();if(!safeUrl(values.footerLogoUrl))throw Error('Footer logo URL must use http://, https://, or an assets/ path.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid support email address.');MCQ.db.settings.footer={...(MCQ.db.settings.footer||{}),description:String(values.description||'').trim(),copyrightText:String(values.copyrightText||'').trim(),footerLogoUrl:String(values.footerLogoUrl||'').trim(),showCountryText:values.showCountryText==='on',countryText:String(values.countryText||'').trim(),showAbout:values.showAbout==='on',showContact:values.showContact==='on',showPrivacy:values.showPrivacy==='on',showTerms:values.showTerms==='on',showDisclaimer:values.showDisclaimer==='on',showCookiePolicy:values.showCookiePolicy==='on',showAdvertisingPolicy:values.showAdvertisingPolicy==='on',showFaq:values.showFaq==='on',showSitemap:values.showSitemap==='on'};MCQ.db.settings.contact={...(MCQ.db.settings.contact||{}),supportEmail:email,advertisingContact:String(values.advertisingContact||'').trim()};MCQ.log('Updated footer settings','Footer visibility and contact details');MCQ.save();App.render();UI.toast('Footer settings saved.')}
 if(type==='social-links'){MCQ.assert('social');const next={},allowedIcons=['facebook','youtube','instagram','linkedin','share','globe'];for(const key of ['facebook','youtube','instagram','linkedin']){const url=String(values[key+'_url']||'').trim(),chosen=String(values[key+'_icon']||key),iconData=String(values[key+'_icon_data']||'').trim();if(url&&!/^https?:\/\//i.test(url))throw Error(key[0].toUpperCase()+key.slice(1)+' URL must start with http:// or https://.');if(iconData&&!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(iconData))throw Error('Custom social icon must be a PNG, JPG or WebP image.');next[key]={url,enabled:values[key+'_enabled']==='on',icon:allowedIcons.includes(chosen)?chosen:key,iconData}}MCQ.db.settings.socialLinks=next;MCQ.log('Updated social links','Footer social links and icons');MCQ.save();App.render();UI.toast('Social links saved.')}
 if(type==='legal-page'){MCQ.assert('legal');const key=f.dataset.page,page=MCQ.db.content?.legalPages?.[key];if(!page)throw Error('Legal page not found.');const title=String(values.title||'').trim(),content=String(values.content||'').trim();if(!title||!content)throw Error('Page title and content are required.');Object.assign(page,{title,content,lastUpdated:values.lastUpdated||new Date().toISOString().slice(0,10),published:values.published==='on',slug:MCQ.slug(title),seoTitle:title,metaDescription:content.replace(/\s+/g,' ').trim().slice(0,155)});MCQ.log('Updated legal page',title);MCQ.save();App.render();UI.toast('Page settings saved.')}
 if(type==='config'){const view=f.dataset.view;if(view==='roles'){if(MCQ.role()!=='super-admin')throw Error('Only the Super Admin can change role defaults.');const permissions=Object.fromEntries(MCQ.permissionCatalog.map(k=>[k,values['perm_'+k]==='on']));MCQ.db.rolePermissions.admin={review:values.review==='on',import:values.import==='on',defaultsVersion:3,permissions}}else{MCQ.assert('settings');Object.assign(MCQ.db[view==='content'?'content':view==='seo'?'seo':'settings'],values);}MCQ.log('Updated '+view,'Site configuration');MCQ.save();App.render();UI.toast('Changes saved.')}
 }catch(err){if(type==='mcq'&&err.existing&&!err.existing.restricted){document.getElementById('mcq-errors').innerHTML=`<div class="notice warning">Already exists: ${e(err.existing.question)}<p>${link(Admin.url('edit/'+err.existing.id),'Open existing question','btn sm')}</p></div>`}else error(err.message,type==='mcq'?document.getElementById('mcq-errors'):type==='entity'?document.getElementById('entity-state'):null)}});
 let questionMatchTimer=0,questionMatchSeq=0;
 function checkQuestionDuplicate(input){
  const box=document.getElementById('question-duplicate');if(!box)return;
  clearTimeout(questionMatchTimer);
  const question=String(input.value||'').trim();
  if(!question||App.draft?.id){box.innerHTML='';return}
  const local=MCQ.managedRows('mcqs').find(x=>x.id!==App.draft.id&&MCQ.norm(x.question)===MCQ.norm(question));
  if(local){
   const canEdit=MCQ.canEditMcq(local);
   box.innerHTML=`<div class="notice warning"><strong>This MCQ already exists.</strong><div class="small muted">${e(local.question)}</div>${canEdit?`<div class="actions" style="margin-top:8px">${link(Admin.url('edit/'+local.id),'Update existing MCQ','btn sm primary')}</div>`:'<div class="small muted">Use the existing MCQ instead of creating a duplicate.</div>'}</div>`;
  }else box.innerHTML='';
  const seq=++questionMatchSeq;
  questionMatchTimer=setTimeout(async()=>{
   try{
    const data=await Auth.request('/mcqs/match?question='+encodeURIComponent(question));
    if(seq!==questionMatchSeq||String(input.value||'').trim()!==question)return;
    const dup=data?.match;
    if(!dup){box.innerHTML='';return}
    MCQ.upsert('mcqs',dup);
    const canEdit=MCQ.canEditMcq(dup);
    box.innerHTML=`<div class="notice warning"><strong>This MCQ already exists in the database.</strong><div class="small muted">${e(dup.question)}</div><div class="small muted">Do not create another copy. Open the existing MCQ and add any new Organization / Board or Past Paper links.</div>${canEdit?`<div class="actions" style="margin-top:8px">${link(Admin.url('edit/'+dup.id),'Update existing MCQ','btn sm primary')}</div>`:''}</div>`;
   }catch{}
  },350);
 }
 document.addEventListener('input',ev=>{const el=ev.target;if(el.dataset.pickerInput)Admin.showPicker(el);if(el.closest('#mcq-form')){Admin.syncDraft();if(/^option[1-4]$/.test(el.name)){const sel=document.getElementById('answer-select');const current=App.draft.correct_answer;sel.innerHTML='<option value="">Choose the correct option</option>'+[1,2,3,4].filter(i=>App.draft['option'+i]).map(i=>`<option value="${e(App.draft['option'+i])}" ${current===App.draft['option'+i]?'selected':''}>${'ABCD'[i-1]} · ${e(App.draft['option'+i])}</option>`).join('')}if(el.name==='question')checkQuestionDuplicate(el)}if(el.closest('form[data-form="entity"]')){if(el.dataset.parentSearch){const rel=MCQ.parents[el.dataset.parentSearch];const s=document.getElementById('entity-parent');const val=s.value;s.innerHTML='<option value="">Choose parent</option>'+MCQ.list(rel[0],el.value).map(x=>`<option value="${x.id}" ${+val===x.id?'selected':''}>${e(x.name)}</option>`).join('')}if(el.name==='entity-icon'){const f=el.closest('form');f.querySelector('[name="entity-icon-data"]').value='';const url=f.querySelector('[name="entity-icon-url"]');if(url)url.value='';const v=el.value.trim().slice(0,4);el.value=v;document.getElementById('entity-icon-preview').innerHTML=v?`<span class="entity-emoji">${e(v)}</span>`:icon('grid')}if(el.name==='entity-icon-url'){const f=el.closest('form'),v=el.value.trim();f.querySelector('[name="entity-icon-data"]').value='';const chars=f.querySelector('[name="entity-icon"]');if(chars)chars.value='';document.getElementById('entity-icon-preview').innerHTML=/^https?:\/\//i.test(v)?`<img class="entity-icon-img" src="${e(v)}" alt="">`:icon('grid')}Admin.entityState()}});
 document.addEventListener('focusin',ev=>{if(ev.target.dataset.pickerInput)Admin.showPicker(ev.target)});
 document.addEventListener('change',ev=>{if(ev.target.id==='import-file')Admin.loadFile(ev.target.files[0]);if(ev.target.classList.contains('row-check'))selectionCount();if(ev.target.classList.contains('trash-row-check')){const box=document.getElementById('trash-selection-count');if(box)box.textContent=document.querySelectorAll('.trash-row-check:checked').length+' selected'}if(ev.target.name==='entity-parent')Admin.entityState();if(ev.target.id==='entity-icon-file'&&ev.target.files[0]){const file=ev.target.files[0];if(!/^image\/(png|jpeg|webp)$/i.test(file.type))return error('Image must be PNG, JPG or WebP.',document.getElementById('entity-state'));if(file.size>600*1024)return error('Image must be 600 KB or smaller.',document.getElementById('entity-state'));const r=new FileReader();r.onload=()=>{const f=ev.target.closest('form');f.querySelector('[name="entity-icon-data"]').value=r.result;f.querySelector('[name="entity-icon"]').value='';const url=f.querySelector('[name="entity-icon-url"]');if(url)url.value='';document.getElementById('entity-icon-preview').innerHTML=`<img class="entity-icon-img" src="${e(r.result)}" alt="">`;};r.readAsDataURL(file)}if(ev.target.id==='post-image-file'&&ev.target.files[0]){const file=ev.target.files[0],preview=document.getElementById('post-image-preview');if(!/^image\/(png|jpeg|webp)$/i.test(file.type))return error('Image must be PNG, JPG or WebP.');if(file.size>900*1024)return error('Image must be 900 KB or smaller.');const r=new FileReader();r.onload=()=>{const f=ev.target.closest('form');f.querySelector('[name="featured_image_data"]').value=r.result;f.querySelector('[name="featured_image"]').value='';if(preview)preview.innerHTML=`<img src="${e(r.result)}" alt="">`;};r.readAsDataURL(file)}if(ev.target.dataset.socialIconFile&&ev.target.files[0]){const file=ev.target.files[0],key=ev.target.dataset.socialIconFile,row=ev.target.closest('[data-social-row]'),hidden=row?.querySelector(`[name="${key}_icon_data"]`),preview=document.getElementById('social-preview-'+key);if(!/^image\/(png|jpeg|webp)$/i.test(file.type))return error('Social icon must be PNG, JPG or WebP.');if(file.size>300*1024)return error('Social icon must be 300 KB or smaller.');const r=new FileReader();r.onload=()=>{if(hidden)hidden.value=r.result;if(preview)preview.innerHTML=`<img class="social-custom-preview" src="${e(r.result)}" alt="">`;};r.readAsDataURL(file)}if(ev.target.dataset.socialIconSelect){const key=ev.target.dataset.socialIconSelect,row=ev.target.closest('[data-social-row]'),hidden=row?.querySelector(`[name="${key}_icon_data"]`),preview=document.getElementById('social-preview-'+key);if(hidden)hidden.value='';if(preview)preview.innerHTML=UI.icon(ev.target.value||key)}if(ev.target.id==='profile-image'&&ev.target.files[0]){const file=ev.target.files[0];if(!/^image\/(png|jpeg|webp)$/i.test(file.type))return error('Profile image must be PNG, JPG or WebP.');if(file.size>600*1024)return error('Profile image must be 600 KB or smaller.');const r=new FileReader();r.onload=async()=>{await MCQ.saveProfile({avatar:r.result});App.render();UI.toast('Profile image updated.');};r.readAsDataURL(file)}});
 document.addEventListener('click',ev=>{if(!ev.target.closest('.picker'))document.querySelectorAll('.picker-results').forEach(x=>{x.classList.add('hidden');x.previousElementSibling?.setAttribute('aria-expanded','false')})});
 document.addEventListener('keydown',ev=>{const input=ev.target.closest('[data-picker-input]');if(input&&ev.key==='Enter'){ev.preventDefault();const query=input.value.trim();if(!query)return;Admin.showPicker(input);const buttons=[...document.querySelectorAll('#results-'+input.dataset.pickerInput+' button[data-action="pick"]')],choice=buttons.find(b=>MCQ.norm(b.textContent)===MCQ.norm(query))||buttons[0];if(choice){Admin.pick(choice.dataset.field,+choice.dataset.id);UI.toast(choice.textContent.trim()+' selected.')}else UI.toast('No matching record found.');return}if(input&&ev.key==='ArrowDown'){ev.preventDefault();Admin.showPicker(input);document.querySelector('#results-'+input.dataset.pickerInput+' button')?.focus()}if(ev.target.closest('.picker-results')){const buttons=[...ev.target.parentElement.querySelectorAll('button')],i=buttons.indexOf(ev.target);if(['ArrowDown','ArrowUp'].includes(ev.key)){ev.preventDefault();buttons[(i+(ev.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()}}if(ev.key==='Escape'){document.querySelectorAll('.picker-results').forEach(x=>x.classList.add('hidden'));document.querySelectorAll('.picker input').forEach(x=>x.setAttribute('aria-expanded','false'));document.getElementById('admin-sidebar')?.classList.remove('open');document.getElementById('main-nav')?.classList.remove('open');document.getElementById('public-smart-sidebar')?.classList.remove('open');document.querySelector('.public-sidebar-backdrop')?.classList.remove('open')}});
 document.addEventListener('dragover',ev=>{const zone=ev.target.closest('#dropzone');if(zone){ev.preventDefault();zone.classList.add('dragover')}});
 document.addEventListener('dragleave',ev=>ev.target.closest('#dropzone')?.classList.remove('dragover'));
 document.addEventListener('drop',ev=>{const zone=ev.target.closest('#dropzone');if(zone){ev.preventDefault();zone.classList.remove('dragover');Admin.loadFile(ev.dataTransfer.files[0]);}});
 window.addEventListener('pagehide',()=>{App.quickTimer.stop();App.quickAnswer=null;});
 window.addEventListener('pageshow',event=>{if(event.persisted)App.render()});
 window.addEventListener('popstate',()=>{document.getElementById('modal')?.open&&close();App.render();window.scrollTo(0,0)});
 document.addEventListener('submit',event=>{
  const form=event.target.closest('form[data-form="mcq-filter"]');
  if(!form)return;
  event.preventDefault();
  const query=String(form.elements.q?.value||'').trim();
  if(query)App.go('search',{q:query});
  else App.go('mcqs',{});
 });

 document.documentElement.dataset.theme='light';try{localStorage.removeItem('mcq-campus-theme')}catch{}const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.content='#f6f8f7';
 Auth.start();
 // Optional agent navigation mirrors the visible search form; unsupported browsers skip it.
 if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'search_mcq_campus',title:'Search MCQ Campus',description:'Navigate to MCQ search results for a query. Does not answer questions or change records.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.query!=='string'||!input.query.trim())throw Error('A non-empty query is required.');App.go('search',{q:input.query});App.render();return {query:input.query,matches:MCQ.publicMcqs().filter(q=>MCQ.norm(q.question).includes(MCQ.norm(input.query))).length}}})).catch(()=>{})}catch{}}
})();



let mcqBracketResizeTimer;window.addEventListener('resize',()=>{clearTimeout(mcqBracketResizeTimer);mcqBracketResizeTimer=setTimeout(()=>App.fitBracketBreaks?.(),120)},{passive:true});


/* ===== END MODULE: app.js ===== */


/* SOURCE: frontend/js/admin/admin.js */
window.Admin=(()=>{
 const {esc:e,icon,link,btn,heading,empty,badge,field,textarea,select}=UI;
 const names={categories:'Categories',papers:'Organizations / Boards',jobs:'Legacy Jobs (hidden)',years:'Past Papers',countries:'Countries'};
 const root=()=>{const routeRoot=String(location.pathname||'').split('/').filter(Boolean)[0]||'';return routeRoot==='super-admin'?'super-admin':routeRoot==='admin'?'admin':MCQ.role()==='super-admin'?'super-admin':'admin';};
 const url=p=>root()+'/'+p;
 const ADMIN_MCQ_PAGE_SIZE=10,IMPORT_PAGE_SIZE=50;
 const adminPageSize=()=>ADMIN_MCQ_PAGE_SIZE;
 function progressivePageNumbers(total,page,size){
  const pages=Math.max(1,Math.ceil(Number(total||0)/Math.max(1,size))),current=Math.max(1,Math.min(Number(page)||1,pages));
  const start=Math.floor((current-1)/5)*5+1,end=Math.min(pages,start+4);
  return {pages,current,numbers:Array.from({length:end-start+1},(_,i)=>start+i)};
 }
 function mcqPager(total,page,size,params,path){
  const state=progressivePageNumbers(total,page,size);if(state.pages<=1)return `<div class="small muted pagination-count">${Number(total||0).toLocaleString('en-GB')} total MCQs</div>`;
  const clean={...(params||{})};delete clean.limit;
  const numbers=state.numbers.map(p=>link(path,String(p),`btn sm ${p===state.current?'current':''}`,{...clean,page:p})).join('');
  return `<nav class="pagination" aria-label="MCQ pagination">${state.current>1?link(path,'‹ Previous','btn sm',{...clean,page:state.current-1}):'<span></span>'}<div class="page-numbers">${numbers}</div>${state.current<state.pages?link(path,'Next ›','btn sm primary',{...clean,page:state.current+1}):'<span></span>'}<span class="small muted pagination-count">${Number(total||0).toLocaleString('en-GB')} total MCQs · Page ${state.current}</span></nav>`;
 }
 function importResultPager(total,page){
  const state=progressivePageNumbers(total,page,IMPORT_PAGE_SIZE);if(!total)return '';
  if(state.pages<=1)return `<div class="small muted pagination-count">${Number(total).toLocaleString('en-GB')} total imported MCQs</div>`;
  const numbers=state.numbers.map(p=>btn(String(p),'import-page',`sm ${p===state.current?'current':''}`,`data-page="${p}"`)).join('');
  return `<nav class="pagination" aria-label="Imported MCQ pagination">${state.current>1?btn('‹ Previous','import-page','sm',`data-page="${state.current-1}"`):'<span></span>'}<div class="page-numbers">${numbers}</div>${state.current<state.pages?btn('Next ›','import-page','sm primary',`data-page="${state.current+1}"`):'<span></span>'}<span class="small muted pagination-count">${Number(total).toLocaleString('en-GB')} total imported MCQs · Page ${state.current}</span></nav>`;
 }
 const navLink=(p,title,i)=>link(url(p),icon(i)+e(title),'item '+(App.route.path===url(p)?'active':''));
 function shell(body,title){
  const superAdmin=MCQ.role()==='super-admin';
  const library=superAdmin
   ? `${navLink('all-mcqs','All MCQs','book')}${navLink('mcqs','My Collection','user')}${navLink('admin-records','Admin Records','shield')}${navLink('add','Add MCQ','plus')}${MCQ.allowed('import')?navLink('import','Bulk import','upload'):''}`
   : `${MCQ.allowed('globalMcqs')?navLink('all-mcqs','All MCQs','book'):''}${navLink('mcqs','My Collection','user')}${MCQ.allowed('add')?navLink('add','Add MCQ','plus'):''}${MCQ.allowed('import')?navLink('import','Bulk import','upload'):''}`;
  const contentLinks=[MCQ.allowed('categories')?navLink('categories','Categories','grid'):'',MCQ.allowed('papers')||MCQ.allowed('years')?navLink('papers','Organizations / Boards','paper'):'',MCQ.allowed('posts')?navLink('posts','Blog','edit'):'',MCQ.allowed('pdfs')?navLink('pdfs-manager','PDFs','download'):'',MCQ.allowed('latestJobs')?navLink('latest-jobs-manager','Latest Jobs','briefcase'):''].filter(Boolean).join('');
  const systemLinks=(MCQ.allowed('system')?navLink('settings','Settings','settings'):'')+(superAdmin?navLink('countries','Countries','globe'):'');
  const management=(contentLinks?`<div class="nav-label">Content</div>${contentLinks}`:'')+(systemLinks?`<div class="nav-label">System</div>${systemLinks}`:'');
  const countryOptions=(MCQ.db.countries||[]).filter(c=>c.active!==false).map(c=>`<option value="${e(c.name)}" ${String(c.name).toLowerCase()===String(MCQ.db.activeCountry||'Pakistan').toLowerCase()?'selected':''}>${e(c.name)}</option>`).join('');
  const countrySwitcher=superAdmin?`<label class="admin-country-switcher"><span>Active country</span><select data-active-country-select aria-label="Active Super Admin country">${countryOptions}</select></label>`:'';
  return UI.templateMarkup('mcq-admin-layout-template',{
   ADMIN_BRAND:UI.brand(),
   ADMIN_ROLE_LABEL:superAdmin?'Super admin':'Content admin',
   ADMIN_OVERVIEW_LINK:navLink('overview','Overview','grid'),
   ADMIN_LIBRARY:library,
   ADMIN_MANAGEMENT:management,
   ADMIN_MENU_BUTTON:btn(icon('menu'),'sidebar','ghost menu-toggle','aria-label="Toggle admin sidebar" aria-expanded="false" aria-controls="admin-sidebar"'),
   ADMIN_TITLE:e(title),
   ADMIN_COUNTRY_SWITCHER:countrySwitcher,
   ADMIN_USER_MENU:UI.userMenu(),
   ADMIN_BODY:body
  })||''
 }
 const metrics=()=>{const d=MCQ.db;const today=new Date().toISOString().slice(0,10),month=today.slice(0,7);return [[d.mcqs.length,'Total MCQs'],[d.mcqs.filter(x=>x.status==='pending').length,'Pending review'],[d.mcqs.filter(x=>x.status==='approved').length,'Approved MCQs'],[d.mcqs.filter(x=>x.status==='rejected').length,'Rejected MCQs'],[d.papers.length,'Organizations / Boards'],[d.years.length,'Past Papers'],[MCQ.list('categories').length,'Categories'],[d.users.filter(x=>x.role==='user').length,'Learners'],[d.users.filter(x=>x.role!=='user').length,'Administrators'],[d.mcqs.filter(x=>x.created_at?.startsWith(today)).length,'Added today'],[d.mcqs.filter(x=>x.created_at?.startsWith(month)).length,'Added this month']]};
 function bars(type,field){const xs=MCQ.db[type].filter(x=>type!=='categories'||!x.legacy).map(x=>({...x,count:MCQ.db.mcqs.filter(q=>MCQ.ids(q[field]).includes(x.id)).length})).sort((a,b)=>b.count-a.count).slice(0,5);return xs.map(x=>`<div class="bar-row"><div class="row"><span>${e(x.name)}</span><span>${x.count}</span></div><div class="progress-track"><span style="width:${x.count/Math.max(1,xs[0].count)*100}%"></span></div></div>`).join('')}
 function personalOverview(){
  const rows=MCQ.managedRows('mcqs'),summary=MCQ.db.adminOverview||{},counts=summary.mcqs||{};
  const pending=counts.pending??rows.filter(q=>q.status==='pending'||q.pending_update).length;
  const approved=counts.approved??rows.filter(q=>q.status==='approved'&&!q.pending_update).length;
  const rejected=counts.rejected??rows.filter(q=>q.status==='rejected'&&!q.pending_update).length;
  const total=counts.total??rows.length;
  const cards=[[total,'My MCQs'],[pending,'My pending'],[approved,'My approved'],[rejected,'My rejected']];
  const recent=(Array.isArray(summary.recent)&&summary.recent.length?summary.recent:rows).filter(q=>q.status!=='approved'||q.pending_update).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,5);
  return heading('My contribution','Your Question Library contains only the MCQs created by your account.',MCQ.allowed('add')?link(url('add'),icon('plus')+' Add MCQ','btn primary'):'')+`<div class="metric-grid">${cards.map(([n,l],i)=>UI.statCard({title:l,value:n,iconName:['book','clock','check','flag'][i],tone:['primary','info','success','danger'][i],path:url('mcqs'),params:i?{status:['','pending','approved','rejected'][i]}:{}})).join('')}</div><section><div class="section-head"><h2>My recent questions</h2>${link(url('mcqs'),'Open Question Library','link')}</div>${recent.length?table(recent,false):empty('No questions added yet','Questions created by your account will appear here.')}</section>`;
 }
 function overview(){
  if(MCQ.role()==='admin')return personalOverview();
  const d=MCQ.db,me=d.session||{},summary=d.adminOverview||{},mine=d.mcqs.filter(q=>Number(q.created_by_id)===Number(me.id));
  const statusCount=(rows,status)=>status==='pending'?rows.filter(q=>q.status==='pending'||q.pending_update).length:rows.filter(q=>q.status===status&&!q.pending_update).length;
  const pending=summary.mcqs?.pending??statusCount(d.mcqs,'pending'),approved=summary.mcqs?.approved??statusCount(d.mcqs,'approved'),rejected=summary.mcqs?.rejected??statusCount(d.mcqs,'rejected'),total=summary.mcqs?.total??d.mcqs.length;
  const openReports=summary.openReports??(d.reports||[]).filter(r=>!['resolved','closed'].includes(String(r.status||'').toLowerCase())).length;
  const staff=(d.users&&d.users.length?d.users.filter(u=>['admin','super-admin'].includes(u.role)):(summary.staffPreview||[])),learners=summary.learners??d.users.filter(u=>u.role==='user').length,trash=summary.trash??(d.trash||[]).length,staffTotal=summary.staff??staff.length;
  const recent=(Array.isArray(summary.recent)&&summary.recent.length?summary.recent:d.mcqs).slice(0,5);
  const top=[
   {title:'Website MCQs',value:total,iconName:'book',tone:'primary',path:url('all-mcqs'),subtitle:'Complete collection'},
   {title:'Pending',value:pending,iconName:'clock',tone:'info',path:url('all-mcqs'),params:{status:'pending'},subtitle:'Needs a decision'},
   {title:'Approved',value:approved,iconName:'check',tone:'success',path:url('all-mcqs'),params:{status:'approved'},subtitle:'Live-ready MCQs'},
   {title:'Open Reports',value:openReports,iconName:'flag',tone:openReports?'warning':'neutral',path:url('reports'),subtitle:'Content issues'}
  ];
  const mineTotal=summary.mine?.total??mine.length,minePending=summary.mine?.pending??statusCount(mine,'pending'),mineApproved=summary.mine?.approved??statusCount(mine,'approved');
  const controlRows=[
   [icon('book'),'Question Library',`${total} total · ${pending} waiting`,url('all-mcqs')],
   [icon('shield'),'Admin Records',`${staffTotal} administrator account${staffTotal===1?'':'s'}`,url('admin-records')],
   [icon('paper'),'Organizations & Past Papers',`${d.papers.length} organizations · ${d.years.length} past-paper records`,url('papers')],
   [icon('file-text'),'Public Content',`${Number(summary.contentCounts?.latestJobs||0)} latest jobs · ${Number(summary.contentCounts?.blogPosts||0)} blog posts · ${Number(summary.contentCounts?.pdfs||0)} PDFs · ${Number(summary.contentCounts?.guides||0)} guides`,url('posts')],
   [icon('settings'),'System Settings',`${learners} learners`,url('settings')]
  ];
  return heading('Super Admin Overview','Review website content, track ownership, and open the main control areas from one compact command centre.',`<div class="actions overview-head-actions">${link(url('add'),icon('plus')+' Add MCQ','btn primary')}${link(url('all-mcqs'),icon('clock')+' Pending','btn',{status:'pending'})}${link(url('settings'),icon('settings')+' Settings','btn')}</div>`)+
   `<div class="metric-grid admin-primary-metrics overview-top-metrics">${top.map(x=>UI.statCard({...x,className:'overview-stat'})).join('')}</div>`+
   `<div class="overview-command-grid">`+
    `<section class="card overview-command-card"><div class="overview-card-head"><div><p class="eyebrow">MY COLLECTION</p><h2>${e(me.name||'Super Admin')}</h2></div>${link(url('mcqs'),'Open '+icon('arrow'),'link')}</div><div class="overview-mini-stats"><div><strong>${mineTotal}</strong><span>Added</span></div><div><strong>${minePending}</strong><span>Pending</span></div><div><strong>${mineApproved}</strong><span>Approved</span></div></div><p class="small muted">Only MCQs created by your Super Admin account are counted here.</p></section>`+
    `<section class="card overview-command-card"><div class="overview-card-head"><div><p class="eyebrow">ADMIN OWNERSHIP</p><h2>Admin Records</h2></div>${link(url('admin-records'),'All records '+icon('arrow'),'link')}</div><div class="admin-record-mini">${staff.slice(0,4).map(u=>{const rows=d.mcqs.filter(q=>Number(q.created_by_id)===Number(u.id)),count=(summary.staffCounts||{})[u.id]??rows.length;return `<a href="${e(UI.href(url('all-mcqs'),{author:u.id}))}" class="admin-record-mini-row"><span><strong>${e(u.name)}</strong><small>${e(u.role==='super-admin'?'Super Admin':'Admin')}</small></span><b>${count}</b></a>`}).join('')||'<p class="muted small">No administrator accounts.</p>'}</div></section>`+
   `</div>`+
   `<section class="overview-authority-section"><div class="section-head"><div><p class="eyebrow">CONTROL AREAS</p><h2>Super Admin authority map</h2><p class="small muted">Each area opens the existing management workflow instead of duplicating it on the overview.</p></div></div><div class="overview-authority-grid">${controlRows.map(([ic,title,desc,path])=>link(path,`<span class="overview-authority-icon">${ic}</span><span><strong>${e(title)}</strong><small>${e(desc)}</small></span>${icon('arrow')}`,'overview-authority-item')).join('')}</div></section>`+
   `<section class="overview-recent-section"><div class="section-head"><div><p class="eyebrow">LATEST SUBMISSIONS</p><h2>Recent website MCQs</h2></div>${link(url('all-mcqs'),'View all','link')}</div>${recent.length?table(recent,false):empty('No MCQs yet')}</section>`;
 }
  function submissionBadge(q){if(q.pending_update)return badge('UPDATE','warning');if(q.submission_type==='duplicate')return badge('DUPLICATE','danger');return badge(q.status==='pending'?'NEW':(q.submission_type||q.status),q.status==='pending'?'success':q.status)}
 function table(rows,bulk=true){
  const namesFor=(type,ids)=>MCQ.ids(ids).map(id=>MCQ.get(type,id)?.name).filter(Boolean).join(' · ')||'—';
  return `<div class="table-wrap mobile-cards"><table class="admin-mcq-full-table"><thead><tr>${bulk?'<th><input type="checkbox" data-action="select-all" aria-label="Select all visible rows"></th>':''}<th class="mcq-col-question">Question</th><th class="mcq-col-option">Option A</th><th class="mcq-col-option">Option B</th><th class="mcq-col-option">Option C</th><th class="mcq-col-option">Option D</th><th class="mcq-col-answer">Correct answer</th><th class="mcq-col-description">Description</th><th class="mcq-col-meta">Category</th><th class="mcq-col-meta">Organization / Board</th><th class="mcq-col-small">Past Paper</th><th class="mcq-col-small">Country</th><th class="mcq-col-small">Submission</th><th class="mcq-col-meta">Submitted by</th><th class="mcq-col-small">Status</th><th class="mcq-col-date">Created / updated (PKT)</th><th class="mcq-col-actions">Actions</th></tr></thead><tbody>${rows.map(q=>{const pu=q.pending_update,shown=pu?.proposed||q;return `<tr>${bulk?`<td data-label="Select"><input type="checkbox" class="row-check" value="${q.id}" aria-label="Select question ${q.id}"></td>`:''}<td class="mcq-col-question" data-label="Question"><strong>${e(shown.question||q.question)}</strong><div class="small muted">#${q.id}</div></td><td class="mcq-col-option" data-label="Option A">${e(shown.option1||q.option1||'—')}</td><td class="mcq-col-option" data-label="Option B">${e(shown.option2||q.option2||'—')}</td><td class="mcq-col-option" data-label="Option C">${e(shown.option3||q.option3||'—')}</td><td class="mcq-col-option" data-label="Option D">${e(shown.option4||q.option4||'—')}</td><td class="mcq-col-answer" data-label="Correct answer"><strong>${e(shown.correct_answer||q.correct_answer||'—')}</strong></td><td class="mcq-col-description" data-label="Description">${e(shown.description||q.description||'—')}</td><td class="mcq-col-meta" data-label="Category">${e(MCQ.get('categories',shown.category_id||q.category_id)?.name||'—')}</td><td class="mcq-col-meta" data-label="Organization / Board">${e(namesFor('papers',shown.paper_id||q.paper_id))}</td><td class="mcq-col-small" data-label="Past Paper">${e(namesFor('years',shown.job_years_ids||q.job_years_ids))}</td><td class="mcq-col-small" data-label="Country">${e(shown.country||q.country||'—')}</td><td class="mcq-col-small" data-label="Submission">${submissionBadge(q)}</td><td class="mcq-col-meta" data-label="Submitted by">${e(pu?.submitted_by||q.submitted_by||q.created_by||'—')}</td><td class="mcq-col-small" data-label="Status">${badge(pu?'pending':q.status)}</td><td class="mcq-col-date" data-label="Created / updated">Created: ${UI.date(q.created_at)}<br>Updated: ${UI.date(q.updated_at)}<br><span class="small muted">By ${e(q.created_by||'Unknown')}</span></td><td class="mcq-col-actions" data-label="Actions"><div class="table-actions">${btn('Read / review','view-mcq','sm',`data-id="${q.id}"`)}${MCQ.canEditMcq(q)?link(url('edit/'+q.id),'Edit','btn sm'):''}${MCQ.allowed('approve')&&(q.status!=='approved'||pu)?btn('Approve','review','sm',`data-id="${q.id}" data-status="approved"`):''}</div></td></tr>`}).join('')}</tbody></table></div>`}
 function mcqs(view){
  const global=view==='all-mcqs',p=App.route.params,actor=MCQ.db.session||{},serverPage=MCQ.db.mcqPage?.server===true,superAdmin=MCQ.role()==='super-admin',pageSize=adminPageSize();
  let rows=[...MCQ.db.mcqs];
  const status=String(p.status||'');
  if(!serverPage){
   if(!global)rows=rows.filter(q=>Number(q.created_by_id)===Number(actor.id)&&(q.status!=='approved'||q.pending_update));
   if(status==='pending')rows=rows.filter(q=>q.status==='pending'||q.pending_update);
   else if(['approved','rejected'].includes(status))rows=rows.filter(q=>q.status===status&&!q.pending_update);
   if(p.search){const term=String(p.search).trim().toLowerCase();rows=rows.filter(q=>[q.question,q.description,q.correct_answer,q.created_by,q.submitted_by].some(v=>String(v||'').toLowerCase().includes(term)))}
  }
  rows=[...rows].sort((a,b)=>b.id-a.id);
  const total=serverPage?Number(MCQ.db.mcqPage.total||0):rows.length;
  const page=serverPage?Math.max(1,Number(MCQ.db.mcqPage.page||p.page)||1):App.page(total,pageSize);
  const pageRows=serverPage?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const path=global?'all-mcqs':'mcqs',title=global?'All MCQs':'My Question Library',desc=global?'Complete MCQ collection across every administrator.':'Only MCQs created by your current account are shown here.';
  const searchBar=`<form class="toolbar admin-library-toolbar admin-google-search" data-form="filter"><div class="searchbox"><span>${icon('search')}</span><input type="search" name="search" value="${e(p.search||'')}" placeholder="Search any MCQ, answer, description or admin…" autocomplete="off"><button class="btn primary sm" type="submit">Search</button></div>${status?`<input type="hidden" name="status" value="${e(status)}">`:''}${p.search?link(url(path),'Clear','btn sm'):''}<span class="small muted">10 MCQs load per page</span></form>`;
  const regularTabs=!superAdmin?`<div class="tabs">${[['All',''],['Pending','pending'],['Approved','approved'],['Rejected','rejected']].map(([label,val])=>link(url(path),label,(status||'')===val?'active':'',val?{status:val}:{})).join('')}</div>`:'';
  const pager=mcqPager(total,page,pageSize,p,url(path));
  const allPendingSelect=superAdmin&&global&&status==='pending'&&total
   ?`<label class="check-line"><input type="checkbox" data-action="select-all-pending" data-total="${total}" aria-label="Select all pending MCQs across every page"> Select all ${Number(total).toLocaleString('en-GB')} pending</label>`
   :'';
  return heading(title,`${Number(total).toLocaleString('en-GB')} total records · ${desc}`,MCQ.allowed('add')?link(url('add'),icon('plus')+' Add MCQ','btn primary'):'')+
   regularTabs+searchBar+
   `${MCQ.allowed('review')?`<div class="toolbar"><label class="check-line"><input type="checkbox" data-action="select-all" aria-label="Select all visible MCQs"> Select this page</label>${allPendingSelect}<span class="small muted" id="selection-count">0 selected</span>${MCQ.allowed('approve')?btn('Approve selected','bulk-review','sm','data-status="approved"'):''}${MCQ.role()==='super-admin'?btn('Delete selected','bulk-mcq-delete','sm danger'):''}</div>`:''}`+
   `${pageRows.length?table(pageRows)+pager:empty('No matching questions',global?'No website MCQs match this search.':'Your own collection has no matching MCQs yet.')}`;
 }
 const pickerDefs={category_id:['categories','Category',false],paper_id:['papers','Organization / Board',true],job_years_ids:['years','Past Paper',true]};
 function picker(name){const [type,label,multi]=pickerDefs[name],vals=MCQ.ids(App.draft[name]);return `<div class="field mcq-search-picker-field"><label for="pick-${name}">${label} *</label><div class="picker mcq-search-picker" data-picker="${name}"><input id="pick-${name}" type="search" data-picker-input="${name}" autocomplete="off" aria-autocomplete="list" aria-controls="results-${name}" aria-expanded="false" placeholder="Search ${label.toLowerCase()}…"><div class="picker-results hidden" id="results-${name}" role="listbox"></div></div><div class="chips" data-chip-area="${name}">${vals.map(id=>`<span class="chip" data-chip="${name}" data-id="${id}">${e(MCQ.get(type,id)?.name||id)}<button type="button" data-action="remove-chip" data-field="${name}" data-id="${id}" aria-label="Remove ${e(MCQ.get(type,id)?.name)}">×</button></span>`).join('')}</div><small>${multi?'Search an existing record and press Enter. You can select more than one; selected records cannot be added twice.':'Search an existing category and press Enter. If it is not available, nothing is added.'}</small></div>`}
 function form(id){
  const existing=id?MCQ.managedMcq(+id,'edit'):null;if(id&&!existing)return empty('Question not found');
  const draftKey=String(id||'new');
  if(App.draftKey!==draftKey){App.draft=existing?MCQ.clone(existing):{question:'',option1:'',option2:'',option3:'',option4:'',correct_answer:'',description:'',source:'',country:MCQ.db.activeCountry||MCQ.db.settings.mcqEntryCountry||'Pakistan',category_id:'',paper_id:[],job_ids:[],job_years_ids:[]};App.draft.subcategory_ids=[];App.draft.child_subcategory_ids=[];App.draftKey=draftKey;}
  const q=App.draft,z=MCQ.contentQuality(q),back=link(url('mcqs'),'Back to my library','btn'),mcqSeo=(MCQ.db.pageSeo||{})['mcq:'+String(existing?.id||'')]||{};
  return heading(existing?'Edit question':'Add MCQ','All MCQ entry fields are required. Importance remains preserved for existing MCQs; new importance is evaluated from linked past papers.',back)+
   `<form data-form="mcq" id="mcq-form" class="card mcq-editor-single"><div class="mcq-editor-head"><div><p class="eyebrow">QUESTION DETAILS</p><h2>${existing?'Update MCQ #'+existing.id:'New MCQ'}</h2></div><span class="badge">${existing?e(existing.status):'Pending'}</span></div>`+
   `${textarea('question','Question',q.question,true)}<div id="question-duplicate"></div>`+
   `<div class="form-grid mcq-options-grid">${[1,2,3,4].map(i=>field('option'+i,'Option '+i,q['option'+i],'text',true)).join('')}</div>`+
   `<div class="form-grid mcq-core-grid"><div class="field"><label for="answer-select">Correct answer *</label><select id="answer-select" name="correct_answer" required><option value="">Choose the correct option</option>${[1,2,3,4].filter(i=>q['option'+i]).map(i=>`<option value="${e(q['option'+i])}" ${q.correct_answer===q['option'+i]?'selected':''}>${'ABCD'[i-1]} · ${e(q['option'+i])}</option>`).join('')}</select></div>${picker('category_id')}</div>`+
   `<section class="mcq-required-links"><div class="mcq-required-head"><div><p class="eyebrow">REQUIRED CLASSIFICATION</p><h3>Organization / Board & Past Paper</h3></div><span class="badge">All required</span></div><p class="small muted">Select the Organization / Board and its Past Paper. Existing question content, options, answers and explanations remain attached to the MCQ.</p><div id="paper-pickers" class="mcq-links-stack">${['paper_id','job_years_ids'].map(picker).join('')}</div></section>`+
   `<div class="mcq-description-large">${textarea('description','Explanation / description',q.description,true)}</div>`+
   `${MCQ.role()==='super-admin'?'<section class="admin-seo-fields"><h3>Public MCQ page title & description</h3><p class="small muted">These values control the MCQ detail page heading and Google title/description. Leave blank for the automatic question-based values.</p>'+field('page_seo_title','Page / Google Title',q.page_seo_title??mcqSeo.title??'','text',false,'maxlength="180"')+textarea('page_seo_description','Page / Google Description',q.page_seo_description??mcqSeo.description??'',false)+'</section>':''}`+
   `<div class="mcq-editor-footer"><div class="quality-compact"><strong>${z.score}/${z.total}</strong><span>content checks complete</span></div><div class="actions">${btn('Preview','preview-draft','sm')}${btn('Clear','clear-draft','sm')}<button type="submit" class="btn primary">${existing?'Save changes':'Save MCQ'}</button></div></div><div id="mcq-errors" role="alert"></div>${existing?`<p class="small muted mcq-owner-line">Owner: ${e(existing.created_by||'Unknown')} · Created ${UI.date(existing.created_at)} · Updated ${UI.date(existing.updated_at)}</p>`:''}</form>`;
 }
  function syncDraft(){const f=document.getElementById('mcq-form');if(!f)return;const data=new FormData(f);for(const k of ['question','option1','option2','option3','option4','correct_answer','description','page_seo_title','page_seo_description'])if(data.has(k))App.draft[k]=String(data.get(k)||'');App.draft.subcategory_ids=[];App.draft.child_subcategory_ids=[]}
 function refreshPickers(){const subject=document.getElementById('subject-pickers');if(subject)subject.innerHTML=picker('category_id');const papers=document.getElementById('paper-pickers');if(papers)papers.innerHTML=['paper_id','job_years_ids'].map(picker).join('');const category=document.querySelector('[data-picker="category_id"]')?.closest('.field');if(category&&category.parentElement?.classList.contains('mcq-core-grid'))category.outerHTML=picker('category_id')}
 function pickerOptions(field,q=''){const [type]=pickerDefs[field];let rows=MCQ.db[type],d=App.draft,ids=MCQ.ids;if(type==='categories')rows=rows.filter(x=>!x.legacy&&((x.country||'Pakistan')==='Both'||(x.country||'Pakistan')===(d.country||MCQ.db.settings.mcqEntryCountry||'Pakistan')));if(type==='papers')rows=rows.filter(x=>(x.country||MCQ.db.settings.country||'Pakistan')===(d.country||MCQ.db.settings.mcqEntryCountry||'Pakistan'));if(field==='job_years_ids')rows=rows.filter(x=>{const paperId=Number(x.paper_id)||Number(MCQ.get('jobs',x.job_id)?.paper_id)||0;return ids(d.paper_id).includes(paperId)});return rows.filter(x=>x.active!==false&&MCQ.norm(x.name).includes(MCQ.norm(q))&&!ids(d[field]).includes(x.id)).sort((a,b)=>(MCQ.norm(b.name)===MCQ.norm(q))-(MCQ.norm(a.name)===MCQ.norm(q))||a.name.localeCompare(b.name))}
 function showPicker(input){const f=input.dataset.pickerInput,res=document.getElementById('results-'+f),rows=pickerOptions(f,input.value);res.innerHTML=rows.length?rows.map(x=>`<button type="button" role="option" aria-selected="false" data-action="pick" data-field="${f}" data-id="${x.id}">${e(x.name)}</button>`).join(''):'<p class="small muted" style="padding:10px">No matches. Select the parent first, or create the record from management.</p>';res.classList.remove('hidden');input.setAttribute('aria-expanded','true')}
 function pick(f,id,remove=false){syncDraft();const multi=pickerDefs[f][2];if(remove)App.draft[f]=multi?MCQ.ids(App.draft[f]).filter(x=>x!==+id):'';else App.draft[f]=multi?[...new Set([...MCQ.ids(App.draft[f]),+id])]:+id;const d=App.draft;if(f==='paper_id'){const first=MCQ.ids(d.paper_id)[0],paper=first?MCQ.get('papers',first):null;if(paper?.country)d.country=paper.country;d.job_years_ids=MCQ.ids(d.job_years_ids).filter(id=>{const y=MCQ.get('years',id),parent=Number(y?.paper_id)||Number(MCQ.get('jobs',y?.job_id)?.paper_id)||0;return MCQ.ids(d.paper_id).includes(parent)});}refreshPickers()}
 function entities(type){
  const p=App.route.params,rel=MCQ.parents[type],superAdmin=MCQ.role()==='super-admin',server=MCQ.db.entityPage?.server===true&&MCQ.db.entityPage?.routeKey===location.pathname+location.search&&MCQ.db.entityPage?.type===type,pageSize=10;
  let rows=server?[...(MCQ.db.entityPage.items||[])]:MCQ.list(type,'');
  if(!server){
   if(p.parent&&rel)rows=rows.filter(x=>x[rel[1]]===+p.parent);
   rows=superAdmin&&['categories','papers','years'].includes(type)?MCQ.sortPinned(type,rows):[...rows].sort((a,b)=>p.sort==='new'?b.id-a.id:a.name.localeCompare(b.name));
  }
  const total=server?Number(MCQ.db.entityPage.total||0):rows.length,page=server?Math.max(1,Number(MCQ.db.entityPage.page)||1):App.page(total,pageSize),pageRows=server?rows:rows.slice((page-1)*pageSize,page*pageSize);
  const canDelete=MCQ.allowed(type),canBulkHierarchy=type==='papers'&&MCQ.allowed('papers')&&MCQ.allowed('years');
  const entityActions=`<div class="actions">${btn(icon('plus')+' Add '+(names[type]||type).toLowerCase(),'entity-new','primary',`data-type="${type}"`)}${type==='categories'?btn(icon('upload')+' Bulk import categories','bulk-categories',''):''}${canBulkHierarchy?btn(icon('upload')+' Bulk add hierarchy','bulk-hierarchy',''):''}</div>`;
  return heading(names[type]||type,`${total.toLocaleString('en-GB')} total records · 10 load per page · ${type==='categories'?'One category level is used across MCQ Campus.':'Manage the paper hierarchy without loading the full list.'}`,entityActions)+
   `<form class="toolbar" data-form="filter">${rel?`<select name="parent" aria-label="Parent" data-auto-filter><option value="">All ${e((names[rel[0]]||rel[0]).toLowerCase())}</option>${MCQ.db[rel[0]].map(x=>`<option value="${x.id}" ${+p.parent===x.id?'selected':''}>${e(x.name)}</option>`).join('')}</select>`:''}<span class="small muted">10 records per page</span>${!superAdmin?`<select name="sort" data-auto-filter><option value="">Name A–Z</option><option value="new" ${p.sort==='new'?'selected':''}>Newest first</option></select>`:''}</form>`+
   `${pageRows.length?`<div class="toolbar entity-bulk-toolbar"><label class="check-line"><input type="checkbox" data-action="entity-select-all" data-type="${type}"> Select page</label><span class="small muted" data-entity-selection-count="${type}">0 selected</span><span class="spacer"></span>${canDelete?btn(icon('trash')+' Delete selected','entity-bulk-delete','sm danger',`data-type="${type}"`):''}</div><div class="table-wrap mobile-cards"><table><thead><tr><th class="select-col">Select</th><th>Name</th><th>Icon</th><th>Status</th>${rel?'<th>Parent</th>':''}<th>MCQs</th>${superAdmin&&['categories','papers','years'].includes(type)?'<th>Pin</th>':''}<th>Actions</th></tr></thead><tbody>${pageRows.map(x=>{const fallback=type==='categories'?MCQ.db.mcqs.filter(q=>+q.category_id===+x.id).length:type==='papers'?MCQ.db.mcqs.filter(q=>MCQ.ids(q.paper_id).includes(x.id)).length:type==='jobs'?MCQ.db.mcqs.filter(q=>MCQ.ids(q.job_ids).includes(x.id)).length:MCQ.db.mcqs.filter(q=>MCQ.ids(q.job_years_ids).includes(x.id)).length,count=Number.isFinite(Number(x.mcq_count))?Number(x.mcq_count):fallback;return `<tr><td data-label="Select"><input class="entity-row-check" type="checkbox" value="${x.id}" data-type="${type}" aria-label="Select ${e(x.name)}"></td><td data-label="Name"><strong>${(()=>{if(type==='papers'&&MCQ.allowed('papers'))return link(url('paper-mcqs/'+x.id),e(x.name),'admin-entity-name-link');if(type==='jobs'&&MCQ.allowed('jobs'))return link(url('paper-mcqs/'+x.paper_id),e(x.name),'admin-entity-name-link',{job:x.id});if(type==='years'&&MCQ.allowed('years')){const parentId=Number(x.paper_id)||Number(MCQ.get('jobs',x.job_id)?.paper_id)||0;return parentId?link(url('paper-mcqs/'+parentId),e(x.name),'admin-entity-name-link',{year:x.id}):e(x.name)}return e(x.name)})()}</strong></td><td data-label="Icon"><span class="admin-icon-cell">${UI.entityIcon(x,'grid')}</span></td><td data-label="Status">${badge(x.active===false?'disabled':'active',x.active===false?'rejected':'approved')}</td>${rel?`<td data-label="Parent">${e(MCQ.get(rel[0],x[rel[1]])?.name||'—')}</td>`:''}<td data-label="MCQs"><strong>${count.toLocaleString('en-GB')}</strong></td>${superAdmin&&['categories','papers','jobs','years'].includes(type)?`<td data-label="Pin">${(()=>{const pos=MCQ.pinIndex(type,x.id);return pos<999?`<div class="table-actions"><span class="badge approved">#${pos+1}</span>${btn('↑','entity-pin','sm',`data-type="${type}" data-id="${x.id}" data-mode="up" aria-label="Move pin up"`)}${btn('↓','entity-pin','sm',`data-type="${type}" data-id="${x.id}" data-mode="down" aria-label="Move pin down"`)}${btn('Unpin','entity-pin','sm',`data-type="${type}" data-id="${x.id}" data-mode="unpin"`)}</div>`:btn('Pin','entity-pin','sm',`data-type="${type}" data-id="${x.id}" data-mode="pin"`)})()}</td>`:''}<td><div class="table-actions">${btn('Edit','entity-edit','sm',`data-type="${type}" data-id="${x.id}"`)}${canDelete?btn(icon('trash')+' Delete','entity-delete','sm danger',`data-type="${type}" data-id="${x.id}"`):''}</div></td></tr>`}).join('')}</tbody></table></div>${UI.pager(total,page,pageSize,p,App.route.path)}`:empty('No matching records','Add a record or adjust the available filters.')}`;
 }
 function bulkCategoriesModal(){
  MCQ.assert('categories');
  UI.modal('Bulk import Categories',`<form data-form="bulk-categories" class="compact-content-form"><p class="small muted">Choose a UTF-8 text file. One category goes on each line.</p><div class="field"><label for="category-bulk-file">Category file *</label><input id="category-bulk-file" type="file" accept=".txt,.csv,text/plain" required><input type="hidden" name="categories"><small data-category-file-name>No file selected.</small></div><div class="notice"><strong>File format</strong><br>Category Name<br>[📚] Category Name<br>{https://example.com/icon.png} Category Name<br><span class="small">Use [icon] before the title for text/emoji icons, or {image-link} before the title for an icon URL.</span></div><div class="actions"><button class="btn primary" type="submit">Import Categories</button>${btn('Cancel','close','')}</div></form>`);
 }
 function bulkHierarchyModal(){
  MCQ.assert('papers');MCQ.assert('years');
  UI.modal('Bulk add Organization / Past Paper hierarchy',`<form data-form="bulk-hierarchy" class="compact-content-form"><p class="small muted">Choose a UTF-8 text file. Each line contains an Organization / Board followed by a Past Paper.</p><div class="field"><label for="hierarchy-file">Hierarchy file *</label><input id="hierarchy-file" type="file" accept=".txt,.csv,text/plain" required><input type="hidden" name="hierarchy"><small data-hierarchy-file-name>No file selected.</small></div><div class="notice"><strong>Required format</strong><br>{organization-icon-link} Organization / Board | {past-paper-icon-link} Past Paper<br>[P] PPSC | [2026] Past Paper 2026<br><span class="small">Icons/links are optional. Use | between Organization / Board and Past Paper. Existing matching records are reused. Old three-column files are also accepted; the middle Job name is ignored.</span></div><div class="actions"><button class="btn primary" type="submit">Import hierarchy</button>${btn('Cancel','close','')}</div></form>`);
 }
 function entitySeo(type,id){
  const kind={categories:'category',papers:'paper',jobs:'job',years:'year'}[type];if(!kind)return {};
  return (MCQ.db.pageSeo||{})[kind+':'+String(id||'')]||{};
 }
 function entityModal(type,id,prefillParent){MCQ.assert(type);const entityCountryChoices=[{id:'Both',name:'Both countries'},...(MCQ.db.countries||[]).filter(c=>c.active!==false&&(!MCQ.db.activeCountry||c.name===MCQ.db.activeCountry)).map(c=>({id:c.name,name:c.name}))],x=MCQ.get(type,id)||{},parent=MCQ.parents[type],iconValue=String(x.icon||''),isDataIcon=/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(iconValue),isUrlIcon=/^https?:\/\//i.test(iconValue),seo=entitySeo(type,id),seoFields=MCQ.role()==='super-admin'&&['categories','papers','jobs','years'].includes(type)?`<section class="admin-seo-fields"><h3>Public page title & description</h3><p class="small muted">These values are used as the page heading/intro and the Google title/meta description. Leave blank to use the automatic title and description.</p>${field('entity-seo-title','Page / Google Title',seo.title||'','text',false,'maxlength="180" placeholder="Optional custom public title"')}${textarea('entity-seo-description','Page / Google Description',seo.description||'',false)}</section>`:'';UI.modal(id?'Edit '+names[type].toLowerCase():'Add '+names[type].toLowerCase(),`<form data-form="entity" data-type="${type}" data-id="${id||''}">${field('entity-name','Name',x.name||'','text',true)}<div class="field"><label>Icon</label><div class="icon-editor"><div class="icon-preview" id="entity-icon-preview">${UI.entityIcon(x,'grid')}</div><div class="grow">${field('entity-icon-url','Image URL',isUrlIcon?iconValue:'','url',false,'placeholder="https://example.com/logo.png" autocomplete="url"')}${field('entity-icon','Characters / emoji',isDataIcon||isUrlIcon?'':iconValue,'text',false,'maxlength="4" placeholder="1–4 characters, e.g. CS or 📚"')}<label class="btn sm" for="entity-icon-file">Upload image</label><input class="visually-hidden" id="entity-icon-file" type="file" accept="image/png,image/jpeg,image/webp"><input type="hidden" name="entity-icon-data" value="${isDataIcon?e(iconValue):''}"><p class="small muted">Paste a direct HTTPS image/logo link, use 1–4 characters/emoji, or upload PNG/JPG/WebP. The latest choice is used as the icon and appears immediately in the preview.</p></div></div></div><label class="check-line"><input type="checkbox" name="entity-active" ${x.active!==false?'checked':''}> Enabled / visible</label>${['categories','papers'].includes(type)?select('entity-country','Country',type==='categories'?entityCountryChoices:entityCountryChoices.filter(c=>c.id!=='Both'),x.country||(type==='categories'?(MCQ.db.activeCountry||'Both'):(MCQ.db.activeCountry||'Pakistan')),true):''}${parent?select('entity-parent','Parent '+names[parent[0]].toLowerCase(),MCQ.db[parent[0]],x[parent[1]]||prefillParent||'',true):''}${seoFields}<div id="entity-state" role="status"></div><div class="actions"><button class="btn primary">Save record</button>${id&&MCQ.allowed(type)?btn(icon('trash')+' Delete','entity-delete','danger',`data-type="${type}" data-id="${id}"`):''}${btn('Cancel','close','')}</div></form>`)}
 function entityState(){const f=document.querySelector('form[data-form="entity"]');if(!f)return;const type=f.dataset.type,id=f.dataset.id,name=f.querySelector('[name="entity-name"]').value,parent=f.querySelector('[name="entity-parent"]')?.value;const dup=MCQ.duplicate(type,name,parent,id);const el=document.getElementById('entity-state');if(dup)el.innerHTML=`<div class="notice warning"><strong>Already exists: ${e(dup.name)}</strong><div class="actions" style="margin-top:10px">${btn('Use existing','use-entity','sm',`data-type="${type}" data-id="${dup.id}"`)}${btn('Edit existing','entity-edit','sm',`data-type="${type}" data-id="${dup.id}"`)}${link(({categories:'category',papers:'paper',jobs:'job',years:'year'})[type]+'/'+dup.id,'View','btn sm')}</div></div>`;else{const possible=MCQ.list(type,name).filter(x=>name&&x.id!==+id).slice(0,3);el.innerHTML=name?`<div class="notice ${possible.length?'warning':'success'}">${possible.length?'Possible match: '+possible.map(x=>e(x.name)).join(' · '):'New record. No exact match.'}</div>`:''}}
 function importPage(){return heading('Bulk Import MCQs','Upload, validate, import and approve MCQs in one place.')+`<div class="notice">One workflow: upload → validate → consolidate duplicates → import. Same-question rows become one MCQ with every unique Organization / Board and Past Paper mapping. Imported MCQs are stored in Pending review. Approve them from All MCQs / Overview when ready.</div><div class="steps">${['Upload','Parse','Preview','Validate','Duplicate check','Import'].map((s,i)=>`<span class="step ${App.importRows&&i<5?'done':''}">${i+1}. ${s}</span>`).join('')}</div><div class="card"><div class="section-head"><h3>Choose your file</h3><div class="actions">${['txt','csv','json'].map(ext=>btn(ext.toUpperCase()+' template','import-template','sm',`data-ext="${ext}"`)).join('')}</div></div><div class="dropzone" id="dropzone"><span class="tile-icon">${icon('upload')}</span><h3>Drop a file here, or browse</h3><p class="small muted">UTF-8 TXT, CSV or JSON · up to 5 MB</p><input type="file" id="import-file" accept=".txt,.csv,.json" aria-label="Upload MCQ file"></div><div id="import-results">${App.importRows?importPreview():'<p class="small muted">Use columns: Question, Option 1–4, Correct Answer, Description, Country, Category, Organization, Past Paper. Organization and Past Paper must match existing records for the selected country.</p>'}</div></div>`}
 function importPreview(){
  const rows=App.importRows||[],actionable=rows.filter(x=>['valid','merge','update'].includes(x.status));
  const s={new:rows.filter(x=>x.status==='valid').length,merge:rows.filter(x=>x.status==='merge').length,update:rows.filter(x=>x.status==='update').length,duplicate:rows.filter(x=>x.status==='duplicate').length};
  const importIds=App.importedIds||[],importTotal=importIds.length,importPage=Math.max(1,Number(App.importPage?.page||1)),start=(importPage-1)*IMPORT_PAGE_SIZE;
  const pageIds=(Array.isArray(App.importPage?.ids)&&App.importPage.ids.length?App.importPage.ids:importIds.slice(start,start+IMPORT_PAGE_SIZE));
  const imported=pageIds.map(id=>MCQ.get('mcqs',id)).filter(Boolean),pending=imported.filter(q=>q.status!=='approved'||q.pending_update);
  const namesFor=(type,ids)=>MCQ.ids(ids).map(id=>MCQ.get(type,id)?.name||id).filter(Boolean).join(' · ')||'—';
  const previewStatus=r=>r.status==='update'?badge('UPDATE','info'):r.status==='merge'?badge('MERGE','warning'):r.status==='duplicate'?badge('DUPLICATE','pending'):r.status==='invalid'||r.status==='failed'?badge(r.status.toUpperCase(),'rejected'):badge((r.status||'valid').toUpperCase(),'approved');
  const rowDetails=(r,index)=>{const q=r.q||{},canImport=['valid','merge','update'].includes(r.status);return `<tr class="import-preview-row import-status-${e(r.status||'valid')}"><td class="select-col" data-label="Select">${canImport?`<input class="import-row-check" type="checkbox" value="${index}" checked aria-label="Select import row ${index+1}">`:''}</td><td class="mcq-col-small" data-label="Row">${r.line??'—'}</td><td class="mcq-col-question" data-label="Question"><strong>${e(q.question||r.question||'—')}</strong>${r.existing?`<div class="small muted">Existing MCQ #${r.existing}</div>`:''}</td><td class="mcq-col-option" data-label="Option A">${e(q.option1||'—')}</td><td class="mcq-col-option" data-label="Option B">${e(q.option2||'—')}</td><td class="mcq-col-option" data-label="Option C">${e(q.option3||'—')}</td><td class="mcq-col-option" data-label="Option D">${e(q.option4||'—')}</td><td class="mcq-col-answer" data-label="Correct answer"><strong>${e(q.correct_answer||'—')}</strong></td><td class="mcq-col-description" data-label="Description">${e(q.description||'—')}</td><td class="mcq-col-meta" data-label="Category">${e(MCQ.get('categories',q.category_id)?.name||q.category_id||'—')}</td><td class="mcq-col-meta" data-label="Organization / Board">${e(namesFor('papers',q.paper_id))}</td><td class="mcq-col-meta" data-label="Past Paper">${e(namesFor('years',q.job_years_ids))}</td><td class="mcq-col-small" data-label="Result">${previewStatus(r)}${r.mergedRows?`<div class="small import-merge-count">+${r.mergedRows} merged row${r.mergedRows===1?'':'s'}</div>`:''}${r.duplicateRows?`<div class="small muted">${r.duplicateRows} exact duplicate ignored</div>`:''}</td><td class="mcq-col-description" data-label="Merge / Validation">${(r.errors||[]).map(e).join(' ')||'Ready'}${r.existing?link(url('edit/'+r.existing),'Open existing','btn sm'):''}</td></tr>`};
  const importedFull=imported.length?table(imported,false):empty('No MCQs on this result page','Open another result page to load its 50-record batch.');
  return `<div class="status-grid import-status-cards">${Object.entries(s).map(([l,n])=>`<div class="card"><span class="small muted">${l[0].toUpperCase()+l.slice(1)}</span><strong>${n}</strong></div>`).join('')}</div><div class="toolbar import-preview-toolbar"><label class="check-line"><input type="checkbox" data-action="import-select-all" checked> Select all</label><span class="small muted" id="import-selection-count">${actionable.length} selected</span>${btn('Import selected','import-confirm','primary',actionable.length?'':'disabled')}${btn('Download validation report','import-report','')}<span class="small muted">Each visible row is one final MCQ candidate. Repeated questions are consolidated here, so all unique Organization / Board and Past Paper links must appear in the same row before import.</span></div><div class="table-wrap mobile-cards import-preview-wrap"><table class="admin-mcq-full-table import-preview-table"><thead><tr><th class="select-col">Select</th><th class="mcq-col-small">Row</th><th class="mcq-col-question">Question</th><th class="mcq-col-option">Option A</th><th class="mcq-col-option">Option B</th><th class="mcq-col-option">Option C</th><th class="mcq-col-option">Option D</th><th class="mcq-col-answer">Correct answer</th><th class="mcq-col-description">Description</th><th class="mcq-col-meta">Category</th><th class="mcq-col-meta">Organization / Board</th><th class="mcq-col-meta">Past Paper</th><th class="mcq-col-small">Result</th><th class="mcq-col-description">Merge / Validation</th></tr></thead><tbody>${rows.map(rowDetails).join('')}</tbody></table></div>${importTotal?`<section class="import-approval-panel"><div class="section-head"><div><p class="eyebrow">LAST IMPORT RESULT</p><h3>Final stored MCQ data</h3><p class="small muted">${importTotal.toLocaleString('en-GB')} total MCQ result(s). Only ${IMPORT_PAGE_SIZE} records are loaded at a time; the full total remains available without downloading every row.</p></div></div>${pending.length?`<div class="toolbar"><label class="check-line"><input type="checkbox" data-action="select-all" aria-label="Select all imported pending MCQs on this page"> Select this page</label><span class="small muted" id="selection-count">0 selected</span>${MCQ.allowed('approve')?btn('Approve selected','bulk-review','primary','data-status="approved"'):''}</div>`:''}${importedFull}${importResultPager(importTotal,importPage)}</section>`:''}`;
 }
 async function loadImportPage(page){
  const ids=App.importedIds||[];if(!ids.length)return;
  const pages=Math.max(1,Math.ceil(ids.length/IMPORT_PAGE_SIZE)),current=Math.max(1,Math.min(Number(page)||1,pages)),chunk=ids.slice((current-1)*IMPORT_PAGE_SIZE,current*IMPORT_PAGE_SIZE);
  if(!chunk.length)return;
  const data=await Auth.request('/mcqs?ids='+encodeURIComponent(chunk.join(','))+'&page=1&page_size='+IMPORT_PAGE_SIZE+'&admin_scope=1');
  for(const row of (data.items||[]))MCQ.upsert('mcqs',row);
  App.importPage={page:current,pageSize:IMPORT_PAGE_SIZE,total:ids.length,hasNext:current<pages,ids:chunk};
  App.render();
  document.querySelector('.import-approval-panel')?.scrollIntoView({block:'start'});
 }
 async function loadFile(file){if(!file)return;if(file.size>5*1024*1024){UI.toast('Choose a file smaller than 5 MB.');return}const box=document.getElementById('import-results');box.innerHTML='<div class="skeleton" role="status" aria-label="Parsing file"></div>';try{const raw=Importer.parse(await file.text(),file.name.split('.').pop().toLowerCase());if(raw.length>10000)throw Error('Use at most 10,000 rows per import.');App.importSummary=null;App.importRows=Importer.preview(raw);box.innerHTML=importPreview()}catch(err){App.importRows=null;box.innerHTML=`<div class="notice error" role="alert">${e(err.message)}</div>`}}
 function users(view){const rows=MCQ.db.users.filter(x=>view==='admins'?x.role!=='user':x.role==='user');return heading(view==='admins'?'Administrators':'Learners','Manage database accounts, roles and account status.',btn(icon('plus')+' Add account','user-new','primary'))+`<div class="table-wrap mobile-cards"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created / updated (PKT)</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>`<tr><td data-label="Name">${e(x.name)}</td><td data-label="Email">${e(x.email)}</td><td data-label="Role">${e(x.role)}</td><td data-label="Status">${badge(x.status==='active'?'approved':'rejected')}</td><td data-label="Created / updated">${UI.date(x.created_at)} · ${e(x.created_by||'Unknown')}<br>${UI.date(x.updated_at)} · ${e(x.updated_by||'Unknown')}</td><td>${btn('Edit','user-edit','sm',`data-id="${x.id}"`)}</td></tr>`).join('')}</tbody></table></div>`}
 function userModal(id){
  const x=MCQ.get('users',id)||{},defaultRole=App.route.path.endsWith('/users')?'user':'admin',targetRole=x.role||defaultRole;MCQ.assert(targetRole==='user'?'users':'admins');const isOwner=MCQ.role()==='super-admin',roleOptions=(isOwner?['user','admin','super-admin']:[targetRole]).map(role=>({id:role,name:role})),elevated=(x.permissions||[]).includes('super_admin_permission');
  const permissionEditor=isOwner&&targetRole==='admin'?`<fieldset class="admin-permission-fieldset"><legend>Permission type</legend><div class="notice"><strong>Admin Permission</strong><br>Add MCQs, edit own pending MCQs, and view own submission totals. No delete access.</div><label class="check-line"><input name="super_admin_permission" type="checkbox" ${elevated?'checked':''}> <span><strong>Super Admin Permission</strong><small>One click grants the full Super Admin workspace and management rights to this Admin.</small></span></label></fieldset>`:'';
  UI.modal(id?'Edit account':'Add account',`<form data-form="user" data-id="${id||''}">${field('name','Name',x.name||'','text',true)}${field('email','Email',x.email||'','email',true)}${select('role','Role',roleOptions,x.role||defaultRole,true)}${select('status','Status',['active','disabled'].map(x=>({id:x,name:x})),x.status||'active',true)}${permissionEditor}<p class="small muted">Regular Admin permission is automatic. Only the Super Admin Permission switch expands an Admin to full access.</p><button class="btn primary">Save account & permission</button></form>`)
 }
 function reports(){const d=MCQ.db;return heading('Reports & messages','Review question feedback and locally drafted contact messages.')+`<h2>Question reports</h2>${d.reports.length?`<div class="question-list">${d.reports.map(r=>`<div class="card"><div class="actions"><h3>${e(MCQ.get('mcqs',r.mcq_id)?.question)}</h3><span class="spacer"></span>${badge(r.status)}</div><p>${e(r.reason)}</p><div class="card-foot"><span>${UI.date(r.at)} · ${e(r.by||'Unknown')}</span><div class="actions">${link(url('edit/'+r.mcq_id),'Edit MCQ','btn sm')}${r.status!=='resolved'?btn('Resolve','report-resolve','sm',`data-id="${r.id}"`):''}</div></div></div>`).join('')}</div>`:empty('No question reports','Reports submitted from practice pages will appear here.')}<h2 style="margin-top:28px">Contact drafts</h2>${d.contacts.length?`<div class="question-list">${d.contacts.map(c=>`<div class="card"><h3>${e(c.subject)}</h3><p>${e(c.message)}</p><div class="card-foot"><span>${e(c.name)} · ${e(c.email)} · ${UI.date(c.at)}</span><span>Not sent</span></div></div>`).join('')}</div>`:empty('No contact drafts')}`}
 function postManager(){const rows=[...(MCQ.db.posts||[])].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));const bulk=`<section class="card bulk-resource-card"><div class="section-head"><div><p class="eyebrow">BULK IMPORT</p><h2>Bulk Blog Import</h2><p class="small muted">Import many published blog items from one text file. The URL may point to MCQ Campus or any external website.</p></div></div><form data-form="bulk-posts" class="compact-content-form"><div class="field"><label for="bulk-posts-file">Text file</label><input id="bulk-posts-file" class="bulk-resource-file" data-target="bulk-posts-text" type="file" accept=".txt,text/plain"><small data-bulk-file-name>Choose a .txt file. Blocks can be separated by blank lines.</small></div><textarea id="bulk-posts-text" name="bulk_text" class="visually-hidden"></textarea><pre class="bulk-format-example">Title: How to Prepare for PPSC\\nContent: Full blog content can be any length and may span multiple lines.\\nURL: https://example.com/article</pre><button class="btn primary" type="submit">${icon('upload')} Import all</button></form></section>`;return heading('Blog','Publish useful preparation articles and links that can lead readers into MCQ practice.',btn(icon('plus')+' Add blog post','post-new','primary'))+bulk+(rows.length?`<div class="post-grid">${rows.map(post=>`<div class="card post-card"><div class="actions"><span class="eyebrow">${post.published!==false?'PUBLISHED':'DRAFT'}</span><span class="spacer"></span>${badge(post.published!==false?'published':'draft',post.published!==false?'success':'warning')}</div><h3>${e(post.title)}</h3><p>${e(post.excerpt||String(post.body||'').slice(0,150))}</p><p class="small muted">${(post.links||[]).filter(x=>x.label!=='__blog_url').length} useful link(s) · Updated ${UI.date(post.updated_at||post.created_at)}</p><div class="card-foot">${post.published!==false?link('post/'+post.id,'View','link'):''}${btn('Edit','post-edit','sm',`data-id="${post.id}"`)}${MCQ.allowed('postDelete')?btn('Delete','post-delete','sm danger',`data-id="${post.id}"`):''}</div></div>`).join('')}</div>`:empty('No blog posts yet','Add the first blog post with useful links.'))}
 function postModal(id){MCQ.assert('posts');const p=MCQ.get('posts',id)||{},img=String(p.featured_image||'');UI.modal(id?'Edit blog post':'Add blog post',`<form data-form="post" data-id="${id||''}" class="compact-content-form">${field('title','Blog Title',p.title||'','text',true)}${textarea('body','Blog Content',p.body||'',true)}${MCQ.role()==='super-admin'?`<section class="admin-seo-fields"><h3>Public page title & description</h3>${field('seo_title','Page / Google Title',p.seo_title||p.title||'','text',false,'maxlength="80"')}${textarea('seo_description','Page / Google Description',p.seo_description||p.excerpt||'',false)}</section>`:''}<div class="field compact-upload-field"><span>Blog Image (optional)</span><div class="content-image-editor"><div class="content-image-preview" id="post-image-preview">${img?`<img src="${e(img)}" alt="">`:icon('edit')}</div><div class="grow">${field('featured_image','Image URL',/^data:image\//i.test(img)?'':img,'url',false,'placeholder="https://…"')}<label class="btn sm" for="post-image-file">Upload image</label><input class="visually-hidden" id="post-image-file" type="file" accept="image/png,image/jpeg,image/webp"><input type="hidden" name="featured_image_data" value="${/^data:image\//i.test(img)?e(img):''}"></div></div></div><p class="small muted">The public page, Google title and description use the SEO fields above when provided.</p><div class="actions"><button class="btn primary">Save Blog</button>${btn('Cancel','close','')}</div></form>`) }
 function adminRecords(){
  MCQ.assert('admins');
  const staff=MCQ.db.users.filter(u=>['admin','super-admin'].includes(u.role)),all=MCQ.db.mcqs,summary=MCQ.db.adminOverview||{},counts=summary.mcqs||{},staffStats=summary.staffStats||{},unassigned=summary.unassigned||{};
  const stat=(rows,status)=>status==='pending'?rows.filter(q=>q.status==='pending'||q.pending_update).length:rows.filter(q=>q.status===status&&!q.pending_update).length;
  const fallback={total:all.length,pending:stat(all,'pending'),approved:stat(all,'approved'),rejected:stat(all,'rejected')};
  const overall=[{title:'All Website MCQs',value:counts.total??fallback.total,iconName:'book',tone:'primary',path:url('all-mcqs')},{title:'Pending Review',value:counts.pending??fallback.pending,iconName:'clock',tone:'info',path:url('all-mcqs'),params:{status:'pending'}},{title:'Approved',value:counts.approved??fallback.approved,iconName:'check',tone:'success',path:url('all-mcqs'),params:{status:'approved'}},{title:'Rejected',value:counts.rejected??fallback.rejected,iconName:'flag',tone:'danger',path:url('all-mcqs'),params:{status:'rejected'}}];
  const legacyTotal=Number(unassigned.total??all.filter(q=>!q.created_by_id).length);
  return heading('Admin Records','Counts come from the complete database; MCQ rows are loaded separately in small pages.')+`<div class="metric-grid">${overall.map(UI.statCard).join('')}</div><section class="section"><div class="section-head"><div><p class="eyebrow">ADMIN COLLECTIONS</p><h2>Individual records</h2></div></div><div class="admin-record-grid">${staff.map(u=>{const local=all.filter(q=>Number(q.created_by_id)===Number(u.id)),s=staffStats[String(u.id)]||{total:local.length,pending:stat(local,'pending'),approved:stat(local,'approved'),rejected:stat(local,'rejected')};return `<article class="card admin-record-card"><div class="admin-record-head"><span class="stat-card-icon tone-${u.role==='super-admin'?'primary':'info'}">${icon(u.role==='super-admin'?'shield':'user')}</span><div><h3>${e(u.name)}</h3><p>${e(u.email||'')} · ${u.role==='super-admin'?'Super Admin':'Admin'}</p></div></div><div class="admin-record-counts"><div><strong>${Number(s.total||0).toLocaleString('en-GB')}</strong><span>Total</span></div><div><strong>${Number(s.pending||0).toLocaleString('en-GB')}</strong><span>Pending</span></div><div><strong>${Number(s.approved||0).toLocaleString('en-GB')}</strong><span>Approved</span></div><div><strong>${Number(s.rejected||0).toLocaleString('en-GB')}</strong><span>Rejected</span></div></div><div class="admin-record-permission-line"><span>${u.role==='super-admin'||(u.permissions||[]).includes('super_admin_permission')?'Super Admin Permission':'Admin Permission'}</span></div><div class="actions">${link(url('all-mcqs'),'Open '+e(u.name)+' collection '+icon('arrow'),'btn',{author:u.id})}${u.role==='admin'?btn('Edit permissions','user-edit','btn sm',`data-id="${u.id}"`):''}</div></article>`}).join('')}${legacyTotal?`<article class="card admin-record-card"><div class="admin-record-head"><span class="stat-card-icon tone-neutral">${icon('archive')}</span><div><h3>Legacy / unassigned</h3><p>Records without an owner ID</p></div></div><div class="admin-record-counts"><div><strong>${legacyTotal.toLocaleString('en-GB')}</strong><span>Total</span></div><div><strong>${Number(unassigned.pending||0).toLocaleString('en-GB')}</strong><span>Pending</span></div><div><strong>${Number(unassigned.approved||0).toLocaleString('en-GB')}</strong><span>Approved</span></div><div><strong>${Number(unassigned.rejected||0).toLocaleString('en-GB')}</strong><span>Rejected</span></div></div>${link(url('all-mcqs'),'Open legacy collection','btn',{author:'unknown'})}</article>`:''}</div></section>`;
 }
 function paperCollection(id){
  MCQ.assert('papers');
  const paper=MCQ.get('papers',id);
  if(!paper)return empty('Organization / Board not found');
  const p=App.route.params||{};
  const paperForYear=y=>Number(y.paper_id)||Number(MCQ.get('jobs',y.job_id)?.paper_id)||0;
  const years=MCQ.sortPinned('years',MCQ.db.years.filter(y=>y.active!==false&&paperForYear(y)===Number(paper.id)));
  const selectedYearIds=[...new Set(String(p.years||p.year||'').split(',').map(Number).filter(Boolean))];
  const backActions=`<div class="actions">${link(url('papers'),'Back to Organizations / Boards','btn')}${MCQ.allowed('years')?btn(icon('plus')+' Add Past Paper','entity-new','sm primary',`data-type="years" data-parent="${paper.id}"`):''}</div>`;
  if(!selectedYearIds.length){
   const rows=years.map(y=>{
    const count=MCQ.db.mcqs.filter(q=>MCQ.ids(q.job_years_ids).includes(Number(y.id))).length;
    return `<tr><td><span class="admin-icon-cell">${UI.entityIcon(y,'paper')}</span></td><td><strong>${link(url('paper-mcqs/'+paper.id),e(y.name),'admin-entity-name-link',{year:y.id})}</strong></td><td>${count.toLocaleString('en-GB')}</td><td>${badge(y.active===false?'disabled':'active',y.active===false?'rejected':'approved')}</td><td><div class="table-actions">${MCQ.allowed('years')?btn('Edit','entity-edit','sm',`data-type="years" data-id="${y.id}"`):''}</div></td></tr>`;
   }).join('');
   const tableHtml=years.length?`<div class="table-wrap mobile-cards"><table><thead><tr><th>Icon</th><th>Past Paper</th><th>MCQs</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`:empty('No Past Papers yet','Add a past-paper record under this Organization / Board.');
   return heading(paper.name,'Manage past papers directly under this Organization / Board. Existing MCQs remain linked by their Past Paper IDs.',backActions)+`<div class="paper-hierarchy-trail"><strong>Organizations / Boards</strong><span>${icon('arrow')}</span><b>${e(paper.name)}</b><span>${icon('arrow')}</span><strong>Past Papers</strong></div>${tableHtml}`;
  }
  const selected=years.filter(y=>selectedYearIds.includes(Number(y.id)));
  if(!selected.length)return heading('Past Paper not found','This past paper may have been moved or disabled.',backActions);
  const groups=selected.map(y=>{
   const mcqs=MCQ.db.mcqs.filter(q=>MCQ.ids(q.job_years_ids).includes(Number(y.id)));
   const queryPage=Number(MCQ.db.mcqPage?.page||p.page||1),queryTotal=Number(MCQ.db.mcqPage?.total||mcqs.length);
   const mcqPageNav=mcqPager(queryTotal,queryPage,10,{year:y.id},url('paper-mcqs/'+paper.id));
   const destinationYears=MCQ.sortPinned('years',MCQ.db.years.filter(dest=>{
    if(dest.active===false||Number(dest.id)===Number(y.id))return false;
    const parentId=paperForYear(dest),parent=MCQ.get('papers',parentId);
    return parent&&String(parent.country||'Pakistan').toLowerCase()===String(paper.country||'Pakistan').toLowerCase();
   }));
   const moveForm=MCQ.role()==='super-admin'&&mcqs.length?`<form data-form="move-past-paper-mcqs" class="card move-past-paper-form">
    <input type="hidden" name="source_year_id" value="${y.id}">
    <div class="section-head"><div><p class="eyebrow">SUPER ADMIN TOOL</p><h3>Move MCQs to another Past Paper</h3><p class="small muted">Select one or more MCQs, choose the destination and confirm. Question text, options, answers, explanations and IDs are preserved.</p></div></div>
    <label class="field"><span>Destination Past Paper</span><select name="destination_year_id" required><option value="">Choose destination…</option>${destinationYears.map(dest=>{const destPaper=MCQ.get('papers',paperForYear(dest));return `<option value="${dest.id}">${e(destPaper?.name||'Organization / Board')} · ${e(dest.name)}</option>`}).join('')}</select></label>
    <div class="move-mcq-selection">${mcqs.map(q=>`<label class="move-mcq-row"><input type="checkbox" name="mcq_ids" value="${q.id}"><span><strong>MCQ #${q.id}</strong> ${e(q.question.slice(0,220))}<span class="small muted"> · Answer: ${e(q.correct_answer)}</span></span></label>`).join('')}</div>
    <label class="check-line"><input type="checkbox" name="delete_empty_source" value="true"><span>Delete source Past Paper only if it is empty after the move</span></label>
    <button class="btn primary" type="submit">Move selected MCQs</button>
   </form>`:'';
   return `<section class="section admin-year-mcqs"><div class="section-head"><div><p class="eyebrow">${e(paper.name)}</p><h2>${e(y.name)}</h2><p class="small muted">${mcqs.length.toLocaleString('en-GB')} MCQs · selecting a question does not duplicate it.</p></div><div class="actions">${link(url('paper-mcqs/'+paper.id),'All Past Papers','btn')}${MCQ.allowed('years')?btn('Edit Past Paper','entity-edit','sm',`data-type="years" data-id="${y.id}"`):''}</div></div>${mcqs.length?table(mcqs,false):empty('No MCQs linked to this Past Paper','This record currently has no MCQs.')}${mcqPageNav}${moveForm}</section>`;
  }).join('');
  return heading(paper.name+' · Past Papers','Review a past paper and move selected MCQs to another past paper from the same country.',backActions)+`<div class="paper-hierarchy-trail"><strong>${e(paper.name)}</strong><span>${icon('arrow')}</span><strong>Past Papers</strong></div>${groups}`;
 }
 function pdfManager(){
  MCQ.assert('pdfs');const rows=[...(MCQ.db.pdfs||[])].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  const bulk=`<section class="card bulk-resource-card"><div class="section-head"><div><p class="eyebrow">BULK IMPORT</p><h2>Bulk PDF Import</h2><p class="small muted">Import Title, Description and Download URL for many PDFs at once.</p></div></div><form data-form="bulk-pdfs" class="compact-content-form"><div class="field"><label for="bulk-pdfs-file">Text file</label><input id="bulk-pdfs-file" class="bulk-resource-file" data-target="bulk-pdfs-text" type="file" accept=".txt,text/plain"><small data-bulk-file-name>Choose a .txt file. Blocks can be separated by blank lines.</small></div><textarea id="bulk-pdfs-text" name="bulk_text" class="visually-hidden"></textarea><pre class="bulk-format-example">Title: PPSC General Knowledge PDF\\nDescription: Complete preparation notes and practice material. Description may use multiple lines.\\nURL: https://example.com/file.pdf</pre><button class="btn primary" type="submit">${icon('upload')} Import all</button></form></section>`;
  return heading('PDF Resources','The public page downloads directly from this list. Admin only maintains the information users actually see.',btn(icon('plus')+' Add PDF','pdf-new','primary'))+bulk+(rows.length?`<div class="table-wrap mobile-cards"><table><thead><tr><th>Title</th><th>Description</th><th>Download URL</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>`<tr><td data-label="Title"><strong>${e(x.title||x.name)}</strong></td><td data-label="Description">${e(x.description||'—')}</td><td data-label="Download URL"><span class="small muted">${e(x.download_url||'—')}</span></td><td data-label="Status">${badge(x.active===false?'disabled':'active',x.active===false?'danger':'success')}</td><td><div class="table-actions">${link('pdfs','Public PDFs','btn sm')}${btn('Edit','pdf-edit','sm',`data-id="${x.id}"`)}${MCQ.allowed('pdfDelete')?btn('Delete','pdf-delete','sm danger',`data-id="${x.id}"`):''}</div></td></tr>`).join('')}</tbody></table></div>`:empty('No PDF resources yet','Add a PDF with a title and file/download URL.'));
 }
 function pdfModal(id){
  MCQ.assert('pdfs');const x=(MCQ.db.pdfs||[]).find(r=>+r.id===+id)||{},stored=/^data:application\/pdf;base64,/i.test(String(x.download_url||''));
  UI.modal(id?'Edit PDF':'Add PDF',`<form data-form="pdf" data-id="${id||''}" class="pdf-editor-form compact-content-form">${field('title','PDF Title',x.title||x.name||'','text',true)}${textarea('description','Short Description',x.description||'',false)}${MCQ.role()==='super-admin'?`<section class="admin-seo-fields"><h3>Public page title & description</h3>${field('seo_title','Page / Google Title',x.seo_title||x.title||'','text',false,'maxlength="180"')}${textarea('seo_description','Page / Google Description',x.seo_description||x.description||'',false)}</section>`:''}${field('download_url','PDF Download URL',stored?'':(x.download_url||''),'url',false,'placeholder="https://…"')}<div class="field compact-upload-field"><span>PDF File</span><label class="btn sm" for="pdf-file">Choose PDF file</label><input class="visually-hidden" id="pdf-file" type="file" accept="application/pdf,.pdf"><input type="hidden" name="pdf_file_data" value="${stored?e(x.download_url):''}"><small data-pdf-file-name>${stored?'Stored PDF file':'Choose a file or enter a URL above.'}</small></div><input type="hidden" name="active" value="on"><p class="small muted">Only visible PDF-card fields are requested. The SEO slug and clean URL metadata are generated automatically from the PDF title.</p><div class="actions pdf-editor-actions"><button class="btn primary" type="submit">Save PDF</button>${btn('Cancel','close','')}</div></form>`);
 }
 function latestJobsManager(){
  MCQ.assert('latestJobs');const today=new Date().toISOString().slice(0,10),rows=[...(MCQ.db.latestJobs||[])].sort((a,b)=>String(b.last_date||'').localeCompare(String(a.last_date||''))||Number(b.id)-Number(a.id));
  const bulk=`<section class="card bulk-resource-card"><div class="section-head"><div><p class="eyebrow">BULK IMPORT</p><h2>Bulk Latest Jobs Import</h2><p class="small muted">Import many job announcements. If the Paper/Organization does not exist, it is created automatically.</p></div></div><form data-form="bulk-latest-jobs" class="compact-content-form"><div class="field"><label for="bulk-latest-jobs-file">Text file</label><input id="bulk-latest-jobs-file" class="bulk-resource-file" data-target="bulk-latest-jobs-text" type="file" accept=".txt,text/plain"><small data-bulk-file-name>Choose a .txt file. Blocks can be separated by blank lines.</small></div><textarea id="bulk-latest-jobs-text" name="bulk_text" class="visually-hidden"></textarea><pre class="bulk-format-example">Paper: BPSC\\nJob: Assistant\\nLast Date: 2026-10-25\\nApply URL: https://example.com/apply\\nPreparation URL: https://www.mcqcampus.com/bpsc-past-papers</pre><button class="btn primary" type="submit">${icon('upload')} Import all</button></form></section>`;
  return heading('Latest Jobs','Job announcements can be added one-by-one or imported in bulk. Missing Paper / Organization records are created automatically.',btn(icon('plus')+' Add Job','latest-job-new','primary'))+bulk+(rows.length?`<div class="toolbar"><label class="check-line"><input type="checkbox" data-action="latest-jobs-select-all"> Select all jobs</label>${MCQ.allowed('latestJobDelete')?btn('Delete selected','latest-job-bulk-delete','sm danger'):''}</div><div class="table-wrap mobile-cards"><table><thead><tr><th>Select</th><th>Organization</th><th>Job Title</th><th>Last Date</th><th>Past Papers</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>{const org=MCQ.get('papers',x.paper_id),expired=String(x.last_date||'')<today,status=x.published===false?'unpublished':expired?'expired':'active';return `<tr><td data-label="Select"><input type="checkbox" class="latest-job-row-check" value="${x.id}" aria-label="Select ${e(x.title)}"></td><td data-label="Organization"><span class="admin-icon-cell">${org?UI.entityIcon(org,'briefcase'):icon('briefcase')}</span> <strong>${e(org?.name||'—')}</strong></td><td data-label="Job Title">${e(x.title||'')}</td><td data-label="Last Date">${e(UI.date(x.last_date))}</td><td data-label="Past Papers"><span class="small muted">${e(x.prep_url||'Automatic paper link')}</span></td><td data-label="Status">${badge(status,status==='active'?'success':status==='expired'?'warning':'neutral')}</td><td><div class="table-actions">${btn('Edit','latest-job-edit','sm',`data-id="${x.id}"`)}${btn(x.published===false?'Publish':'Unpublish','latest-job-toggle','sm',`data-id="${x.id}"`)}${MCQ.allowed('latestJobDelete')?btn('Delete','latest-job-delete','sm danger',`data-id="${x.id}"`):''}</div></td></tr>`}).join('')}</tbody></table></div>`:empty('No Latest Jobs announcements yet','Add a current job opportunity.'));
 }
 function latestJobModal(id){
  MCQ.assert('latestJobs');const x=(MCQ.db.latestJobs||[]).find(r=>+r.id===+id)||{},orgs=MCQ.db.papers.filter(r=>r.active!==false).sort((a,b)=>a.name.localeCompare(b.name));UI.modal(id?'Edit Latest Job':'Add Latest Job',`<form data-form="latest-job" data-id="${id||''}">${select('paper_id','Organization / Paper',orgs,x.paper_id||'',true)}${field('title','Job Title',x.title||'','text',true)}${textarea('description','Job page description',x.description||'',false)}${MCQ.role()==='super-admin'?`<section class="admin-seo-fields"><h3>Public page title & description</h3>${field('seo_title','Page / Google Title',x.seo_title||x.title||'','text',false,'maxlength="180"')}${textarea('seo_description','Page / Google Description',x.seo_description||x.description||'',false)}</section>`:''}${field('last_date','Last Date to Apply',x.last_date||'','date',true)}${field('apply_url','Apply URL',x.apply_url||'','url',false,'placeholder="Optional https://…"')}${field('prep_url','Past Papers URL',x.prep_url||'','url',false,'placeholder="Optional MCQ Campus paper/job link"')}<label class="check-line"><input type="checkbox" name="published" ${x.published!==false?'checked':''}> Published</label><p class="small muted">The visible page title/description and Google metadata stay aligned with the fields above.</p><div class="actions"><button class="btn primary" type="submit">Save Job</button>${btn('Cancel','close','')}</div></form>`)}
  function countryManager(){
  const countries=Array.isArray(MCQ.db.countries)?MCQ.db.countries:[];
  const cards=countries.map(country=>{
   const name=String(country.name||'');
   const active=country.active!==false;
   return `<article class="country-manager-card"><div class="row"><strong>${e(name)}</strong><span class="badge">${active?'Active':'Disabled'}</span></div><div class="country-mcq-total"><strong>${Number(country.mcqCount||0).toLocaleString('en-US')}</strong><span>approved MCQs</span></div><div class="row"><span class="small muted">Learner signup ${active?'enabled':'disabled'}</span><button type="button" class="btn sm ${active?'ghost':'primary'}" data-country-toggle data-country-name="${e(name)}" data-country-active="${active?'true':'false'}">${active?'Disable':'Enable'} country</button></div></article>`;
  }).join('');
  return `<section class="page country-management"><div class="section-head"><div><p class="eyebrow">SUPER ADMIN</p><h1>Country management</h1><p class="muted">Add a country to make it available during signup. Approved MCQ totals are calculated from the database and refresh when the page reloads.</p></div></div><div class="card" style="padding:20px;margin-bottom:22px"><h2>Add a country</h2><form data-form="country-create" class="form-grid"><div class="field"><label for="country-new-name">Country name</label><input id="country-new-name" name="name" maxlength="80" autocomplete="country-name" required></div><div class="actions"><button type="submit" class="btn primary">Add country</button></div><p class="auth-error" role="alert" data-country-error></p></form></div><div class="section-head"><div><h2>Available country libraries</h2><p class="small muted">Disabling a country prevents new signups from selecting it. Existing accounts and their data are not deleted.</p></div></div><div class="country-manager-grid">${cards||empty('No country libraries yet','Add a country to make it available to learners.')}</div></section>`;
 }

 function settingsHub(){
  MCQ.assert('system');const learners=MCQ.db.users.filter(u=>u.role==='user'),staff=MCQ.db.users.filter(u=>['admin','super-admin'].includes(u.role)),trash=(MCQ.db.trash||[]).length;
  const groups=[
   ['Content','Create and manage learner-facing material.',[['posts','Blog','edit',(MCQ.db.posts||[]).length+' posts','posts'],['pdfs-manager','PDF Resources','download',(MCQ.db.pdfs||[]).length+' PDF resources','pdfs'],['latest-jobs-manager','Latest Jobs','briefcase',(MCQ.db.latestJobs||[]).length+' announcements','latestJobs']]],
   ['People','Accounts, staff access and permission control.',[['users','Users','user',learners.length+' learner accounts','users'],['admins','Admins','shield',staff.length+' administrator accounts','admins'],['roles','Roles & Permissions','shield','Global defaults and access model','roles']]],
   ['Site Config','Branding, public pages, social links and monetization.',[['site-settings','Website Settings','settings','Website name, description and default country','settings'],...(MCQ.role()==='super-admin'?[['countries','Countries','globe','Manage signup countries and live MCQ totals','system']]:[]),['page-seo','Page Titles & Descriptions','search','Edit public hub titles and Google descriptions','system'],['footer','Footer Settings','grid','Footer links and visibility','footer'],['legal-pages','Legal Pages','paper','About, Privacy, Terms and policies','legal'],['social-links','Social Links','share','URLs, icons and visibility','social'],['ads','Ads & Analytics','chart','Advertising slots and analytics IDs','ads']]],
   ['Data / Safety','Recovery, reporting, backups and collection health.',[['trash','Trash & Recovery','archive',trash+' recovery items','restore'],['backup','Backup / Export','download','Export data safely','backup'],['reports','Reports','flag',(MCQ.db.reports||[]).length+' content reports','reports'],['analytics','Collection Analytics','chart','Website content statistics','analytics']]]
  ];
  const allowed=([path,title,ic,desc,cap])=>path==='countries'?MCQ.role()==='super-admin':cap==='roles'?MCQ.role()==='super-admin':MCQ.allowed(cap),renderCard=([path,title,ic,desc])=>link(url(path),`<span class="settings-hub-icon">${icon(ic)}</span><span><strong>${e(title)}</strong><small>${e(desc)}</small></span>${icon('arrow')}`,'card settings-hub-card clickable');
  const summary=[];if(MCQ.allowed('users'))summary.push(UI.statCard({title:'Learners',value:learners.length,iconName:'user',tone:'info',path:url('users')}));if(MCQ.allowed('admins'))summary.push(UI.statCard({title:'Administrators',value:staff.length,iconName:'shield',tone:'primary',path:url('admins')}));if(MCQ.allowed('restore'))summary.push(UI.statCard({title:'Trash Items',value:trash,iconName:'archive',tone:'danger',path:url('trash')}));if(MCQ.allowed('reports'))summary.push(UI.statCard({title:'Reports',value:(MCQ.db.reports||[]).length,iconName:'flag',tone:'warning',path:url('reports')}));
  const hub=groups.map(([title,desc,items])=>{const visible=items.filter(allowed);if(!visible.length)return '';return `<section class="settings-hub-group"><div class="section-head"><div><p class="eyebrow">${e(title.toUpperCase())}</p><h2>${e(title)}</h2><p class="small muted">${e(desc)}</p></div></div><div class="settings-hub-grid">${visible.map(renderCard).join('')}</div></section>`}).join('');
  return heading('Settings','Control areas are grouped by purpose so administrators can find the right workflow quickly.')+(summary.length?`<div class="metric-grid settings-summary">${summary.join('')}</div>`:'')+`${MCQ.allowed('admins')?`<section class="section"><div class="section-head"><div><p class="eyebrow">ADMINISTRATORS</p><h2>Current admin accounts</h2></div>${MCQ.role()==='super-admin'?link(url('admin-records'),'View MCQ records','link'):''}</div><div class="settings-admin-names">${staff.map(u=>`<span class="chip">${icon(u.role==='super-admin'?'shield':'user')} ${e(u.name)}</span>`).join('')}</div></section>`:''}${hub}`;
 }
  function config(view){const d=MCQ.db;if(view==='roles')return heading('Roles & permissions','MCQ Campus now uses only two administrator permission levels.')+`<div class="grid"><div class="card"><span class="tile-icon">${icon('user')}</span><h3>Admin Permission</h3><p>Add MCQs, edit own pending submissions, and see own totals for pending / approved / rejected records. Admins cannot delete MCQs.</p></div><div class="card"><span class="tile-icon">${icon('shield')}</span><h3>Super Admin Permission</h3><p>Grant this to a specific Admin from the Administrators page to give that account the complete Super Admin workspace and rights.</p></div></div>`;let fields='';if(view==='settings')fields=`${field('siteName','Website name',d.settings.siteName,'text',true)}${textarea('description','Site description',d.settings.description,true)}${field('country','Default country',d.settings.country,'text',true)}<div class="notice">MCQs are created as Pending for regular Admin accounts.</div>`;if(view==='content')fields=`${textarea('about','About page introduction',d.content.about,true)}${textarea('contact','Contact page introduction',d.content.contact,true)}`;return heading({settings:'Site settings',content:'Site content'}[view]||'Settings','Changes are saved to the production database settings.')+`<div class="card" style="max-width:850px"><form data-form="config" data-view="${view}">${fields}<button class="btn primary">Save changes</button></form></div>`}
 
 function pageSeoSettings(){
  if(MCQ.role()!=='super-admin')return empty('Super Admin access required');
  const pages=[
   ['home','Home','MCQ Campus — Past Papers, Job Papers & MCQ Preparation','Practice MCQs, past papers and exam preparation resources.'],
   ['mcqs','MCQs','Practice MCQs with Answers & Explanations','Practice approved MCQs across categories, jobs and past papers.'],
   ['past-papers','Past Papers','Past Papers','Browse organizations, jobs and exam years with linked MCQs.'],
   ['pdfs','PDFs','Exam Preparation PDFs','Browse preparation PDFs and downloadable study resources.'],
   ['categories','Categories','MCQ Categories','Browse MCQ categories and practice questions with answers.'],
   ['latest-jobs','Latest Jobs','Latest Jobs & Exam Opportunities','Browse current job opportunities and preparation resources.'],
   ['blog','Blog','Exam Preparation Blog & Updates','Read exam preparation articles, guides and useful updates.']
  ];
  const rows=pages.map(([key,label,autoTitle,autoDesc])=>{const seo=(MCQ.db.pageSeo||{})['static:'+key]||{};return `<section class="card admin-static-seo-card"><div class="section-head"><div><p class="eyebrow">${e(label.toUpperCase())}</p><h2>${e(label)}</h2></div></div><form data-form="page-seo" data-kind="static" data-key="${e(key)}">${field('seo_title','Page / Google Title',seo.title||'','text',false,`maxlength="180" placeholder="${e(autoTitle)}"`)}${textarea('seo_description','Page / Google Description',seo.description||'',false)}<p class="small muted">Automatic fallback: <strong>${e(autoTitle)}</strong> — ${e(autoDesc)}</p><button class="btn primary" type="submit">Save ${e(label)} SEO</button></form></section>`}).join('');
  return heading('Page Titles & Descriptions','These fields control both the visible page heading/intro and the title/description Google can read. Detail pages are edited from their Organization / Board, Past Paper, Category, PDF, Latest Job or Blog edit forms.')+`<div class="grid">${rows}</div>`;
 }
 function check(name,label,checked,help=''){return `<label class="check-line settings-check"><input type="checkbox" name="${name}" ${checked?'checked':''}> <span>${e(label)}${help?`<small>${e(help)}</small>`:''}</span></label>`}
 function footerSettings(){
  MCQ.assert('footer');const d=MCQ.db.settings||{},f=d.footer||{},c=d.contact||{};
  return heading('Footer settings','Keep the public footer compact and manage routine footer changes without editing source code.')+`<form data-form="footer-settings"><div class="split admin-settings-split"><section class="card"><h3>MCQ Campus footer</h3>${textarea('description','Footer short description',f.description||'',true)}${field('copyrightText','Copyright text (year is added automatically)',f.copyrightText||'MCQ Campus. All rights reserved.','text',true)}${field('footerLogoUrl','Optional footer logo URL',f.footerLogoUrl||'','text',false,'placeholder="Leave blank to use the existing MCQ Campus logo"')}<h4>Country text</h4>${check('showCountryText','Show Pakistan | India text',f.showCountryText!==false)}${field('countryText','Country text',f.countryText||'Pakistan | India')}<h4>Contact details</h4>${field('supportEmail','Support email',c.supportEmail||'','email',false,'placeholder="Only shown when configured"')}${field('advertisingContact','Advertising contact information',c.advertisingContact||'','text',false,'placeholder="Optional email, team name, or contact note"')}</section><section class="card"><h3>Footer link visibility</h3><p class="small muted">Core pages normally remain visible. Optional policy and sitemap links can be switched on or off.</p>${check('showAbout','About Us',f.showAbout!==false)}${check('showContact','Contact Us',f.showContact!==false)}${check('showPrivacy','Privacy Policy',f.showPrivacy!==false)}${check('showTerms','Terms & Conditions',f.showTerms!==false)}${check('showDisclaimer','Disclaimer',f.showDisclaimer!==false)}<hr>${check('showCookiePolicy','Cookie Policy',f.showCookiePolicy===true,'Optional')}${check('showAdvertisingPolicy','Advertising Policy',f.showAdvertisingPolicy===true,'Optional')}${check('showFaq','FAQ',f.showFaq===true,'Optional')}${check('showSitemap','Sitemap in bottom bar',f.showSitemap!==false,'Optional small link')}<div class="notice">Unpublished legal pages are not shown publicly even if a footer visibility toggle is enabled.</div></section></div><button class="btn primary" type="submit">Save footer settings</button></form>`
 }
 function socialSettings(){
  MCQ.assert('social');const rows=[['facebook','Facebook'],['youtube','YouTube'],['instagram','Instagram'],['linkedin','LinkedIn']],social=MCQ.db.settings.socialLinks||{},email=social.email||{},iconChoices=['facebook','youtube','instagram','linkedin','share','globe'];
  return heading('Social links','Manage the footer email and social links. Disabled or empty items stay hidden publicly.')+`<div class="card social-settings-card"><form data-form="social-links"><section class="footer-email-admin"><div class="social-admin-icon">${icon('mail')}</div><div class="grow"><strong>Footer email</strong>${field('footer_email','Email address',email.address||'','email',false,'placeholder="contact@example.com"')}<small class="muted">When enabled, this appears above the social icons in the public footer.</small></div>${check('footer_email_enabled','Enabled',email.enabled===true)}</section><div class="social-admin-grid">${rows.map(([key,label])=>{const x=social[key]||{},chosen=x.icon||key,custom=/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(x.iconData||'')),preview=custom?`<img class="social-custom-preview" src="${e(x.iconData)}" alt="">`:icon(chosen);return `<section class="social-admin-row" data-social-row="${key}"><div class="social-admin-icon" id="social-preview-${key}">${preview}</div><div class="grow"><strong>${label}</strong>${field(key+'_url','URL',x.url||'','url',false,'placeholder="https://…"')}<div class="social-icon-controls"><div class="field"><label for="${key}_icon">Built-in icon</label><select id="${key}_icon" name="${key}_icon" data-social-icon-select="${key}">${iconChoices.map(i=>`<option value="${i}" ${chosen===i?'selected':''}>${i}</option>`).join('')}</select></div><div class="field social-upload-field"><span>Custom icon file</span><label class="btn sm" for="social-icon-file-${key}">Upload icon</label><input class="visually-hidden" id="social-icon-file-${key}" data-social-icon-file="${key}" type="file" accept="image/png,image/jpeg,image/webp"><input type="hidden" name="${key}_icon_data" value="${custom?e(x.iconData):''}"><small>PNG, JPG or WebP · max 300 KB. Choosing a built-in icon removes the uploaded icon.</small></div></div></div>${check(key+'_enabled','Enabled',x.enabled!==false)}</section>`}).join('')}</div><div class="notice">Small custom icons are stored with the site configuration. Use managed media storage for larger assets.</div><button class="btn primary">Save social links</button></form></div>`
 }

 function legalPages(){
  MCQ.assert('legal');const pages=MCQ.db.content?.legalPages||{},defs=[['about','About Us'],['contact','Contact Us'],['privacy','Privacy Policy'],['terms','Terms & Conditions'],['disclaimer','Disclaimer'],['cookies','Cookie Policy'],['advertising','Advertising Policy']],key=defs.some(([k])=>k===App.route.params.page)?App.route.params.page:'about',page=pages[key];if(!page)return empty('Page configuration missing','Reload the preview defaults or connect the production settings source.');
  return heading('Legal & information pages','Edit public informational pages from one safe settings area. SEO title and description are generated automatically from the page title and content.')+`<nav class="tabs legal-tabs">${defs.map(([k,l])=>link(url('legal-pages'),l,k===key?'active':'',{page:k})).join('')}</nav><form class="card legal-editor" data-form="legal-page" data-page="${e(key)}">${field('title','Page Title',page.title||'', 'text',true)}<div class="field"><label for="content">Page Content *</label><textarea id="content" name="content" required>${e(page.content||'')}</textarea><small>Use ## for section headings and - for bullet items. Content is escaped before display.</small></div><div class="form-grid">${field('lastUpdated','Last Updated Date',page.lastUpdated||'','date')}<div class="field"><span>Publication</span>${check('published','Published',page.published!==false)}</div></div><div class="actions"><button class="btn primary">Save page</button>${page.published!==false?link(key,'Open public page','btn'):''}</div></form>`
 }
 function trash(){MCQ.assert('restore');const rows=MCQ.db.trash||[],counts=MCQ.trashCounts(),p=App.route.params,allowedPageSizes=[10,20,50,100,500,1000,2000,3000],pageSize=allowedPageSizes.includes(+p.limit)?+p.limit:20,page=App.page(rows.length,pageSize);const pageRows=rows.slice((page-1)*pageSize,page*pageSize),cards=[[counts.mcqs,'Deleted MCQs'],[counts.papers,'Deleted organizations / boards'],[counts.years,'Deleted past papers'],[counts.categories,'Deleted categories']];return heading('Trash & recovery','Recover selected records or permanently delete them from Trash.')+`<form class="toolbar" data-form="filter"><label class="admin-page-size"><span>Show entries</span><select name="limit">${allowedPageSizes.map(n=>`<option value="${n}" ${pageSize===n?'selected':''}>${n.toLocaleString()}</option>`).join('')}</select></label><button class="btn sm" type="submit">Apply</button></form><div class="metric-grid">${cards.map(([n,label],i)=>UI.statCard({title:label,value:n,iconName:['book','paper','briefcase','history','grid'][i]||'archive',tone:i===0?'danger':'neutral'})).join('')}</div>`+(rows.length?`<div class="toolbar"><label class="check-line"><input type="checkbox" data-action="select-all-trash" aria-label="Select all Trash records"> Select all shown</label><span class="small muted" id="trash-selection-count">0 selected</span>${btn('Recover selected','trash-bulk-restore','sm primary')}${btn('Delete permanently','trash-bulk-delete','sm danger')}</div><div class="table-wrap mobile-cards"><table><thead><tr><th>Select</th><th>Deleted record</th><th>Type</th><th>Affected MCQs</th><th>Deleted by</th><th>Deleted</th><th>Action</th></tr></thead><tbody>${pageRows.map(x=>`<tr><td><input type="checkbox" class="trash-row-check" value="${x.id}" aria-label="Select Trash record ${x.id}"></td><td data-label="Deleted record"><strong>${e(x.name)}</strong></td><td data-label="Type">${e(names[x.type]||x.type)}</td><td data-label="Affected MCQs">${(x.mcqs||[]).length}</td><td data-label="Deleted by">${e(x.deleted_by||'—')}</td><td data-label="Deleted">${UI.date(x.deleted_at)}</td><td><div class="table-actions">${btn('Recover','trash-restore','sm primary',`data-id="${x.id}"`)}${btn('Permanent delete','trash-permanent-delete','sm danger',`data-id="${x.id}"`)}</div></td></tr>`).join('')}</tbody></table></div>${UI.pager(rows.length,page,pageSize,p)}`:empty('Trash is empty','Deleted MCQs and recoverable records will appear here.'))}

 function backup(){return heading('Backup & export','Download a current export of database-backed site data.')+`<div class="grid"><div class="card"><span class="tile-icon">${icon('download')}</span><h3>Complete site backup</h3><p>All content, categories, users, reports and progress as JSON.</p><div class="card-foot">${btn('Download backup','backup-export','primary')}</div></div><div class="card"><span class="tile-icon">${icon('book')}</span><h3>MCQ collection</h3><p>Questions with normalized ID arrays for backend integration.</p><div class="card-foot">${btn('Export MCQs','mcqs-export','')}</div></div><div class="card"><span class="tile-icon">${icon('grid')}</span><h3>Category list</h3><p>Single-level categories as JSON for backend integration.</p><div class="card-foot">${btn('Export taxonomy','taxonomy-export','')}</div></div></div>`}
 function adManager(){
  MCQ.assert('ads');const cfg=MCQ.db.adSettings||{},placements=['header_ad','home_top_ad','home_middle_ad','home_bottom_ad','public_page_top','sidebar_top','sidebar_middle','sidebar_bottom','mcq_top_ad','mcq_inline_ad','mcq_bottom_ad','article_inline','article_bottom','paper_sidebar','jobs_sidebar','pdf_sidebar','sidebar_ad','paper_ad','jobs_ad','article_ad','pdf_ad','footer_ad'];const ads=MCQ.db.ads||[];
  return heading('Ads & Analytics','Configure safe placement metadata without pasting unrestricted script into page templates.')+`<div class="split"><section class="card"><h3>Global configuration</h3><form data-form="ad-config"><label class="check-line"><input type="checkbox" name="enabled" ${cfg.enabled!==false?'checked':''}> Enable configured advertisement placements</label>${field('adsenseClient','AdSense publisher/client ID',cfg.adsenseClient||'','text',false,'placeholder="ca-pub-…"')}${field('analyticsId','Google Analytics measurement ID',cfg.analyticsId||'','text',false,'placeholder="G-…"')}<p class="small muted">Publisher and measurement IDs are saved in site configuration; provider scripts load centrally from the Django template.</p><h4>AdSense slot IDs</h4><div class="ad-slot-admin-grid">${placements.map(x=>field('slot_'+x,x.replaceAll('_',' '),cfg.slots?.[x]||'','text')).join('')}</div><button class="btn primary">Save configuration</button></form></section><section class="card"><h3>Add direct brand ad</h3><form data-form="direct-ad">${field('brand','Brand name','','text',true)}${field('image_url','Banner image URL','','url')}${field('destination_url','Destination URL','','url')}${textarea('text','Short ad text','')}${select('placement','Placement',placements.map(x=>({id:x,name:x.replaceAll('_',' ')})),'',true)}${field('start_date','Start date','','date')}${field('end_date','End date','','date')}<button class="btn primary">Add direct ad</button></form><div class="notice">Direct ads are rendered as clearly labelled Sponsored content. Empty slots collapse completely.</div><hr><h3>Custom Ad Network Code</h3><form data-form="custom-ad"><input type="hidden" name="name" value="Custom Ad Network"><input type="hidden" name="provider" value="custom_code"><input type="hidden" name="priority" value="0"><input type="hidden" name="active" value="on">${select('placement','Ad placement',placements.map(x=>({id:x,name:x.replaceAll('_',' ')})),'',true)}${textarea('body','Paste ad network HTML / JavaScript code','',true)}<button class="btn primary">Save ad code</button></form><p class="small muted">Paste the complete code supplied by Adsterra, MGID, AdVista or another supported ad network.</p></section></div><section class="section"><div class="section-head"><h2>Configured direct ads</h2></div>${ads.length?`<div class="table-wrap mobile-cards"><table><thead><tr><th>Brand</th><th>Placement</th><th>Dates</th><th>Status</th><th>Action</th></tr></thead><tbody>${ads.map(x=>`<tr><td data-label="Brand"><strong>${e(x.brand||'Advertisement')}</strong></td><td data-label="Placement">${e(x.placement||'—')}</td><td data-label="Dates">${e(x.start_date||'Any')} → ${e(x.end_date||'Any')}</td><td data-label="Status">${badge(x.enabled===false?'disabled':'enabled',x.enabled===false?'danger':'success')}</td><td>${btn(x.enabled===false?'Enable':'Disable','ad-toggle','sm',`data-id="${x.id}"`)} ${btn('Remove','ad-delete','sm danger',`data-id="${x.id}"`)}</td></tr>`).join('')}</tbody></table></div>`:empty('No direct ads configured','Add a safe banner record above; no fake advertisements are inserted.')}</section>`;
 }
 function analytics(){return heading('Collection analytics','Live counts from the data in this browser.')+`<div class="metric-grid">${metrics().slice(0,4).map(([n,l],i)=>UI.statCard({title:l,value:n,iconName:['book','clock','check','flag'][i],tone:['primary','info','success','danger'][i]})).join('')}</div><div class="split"><div class="card"><h3>Questions by category</h3>${bars('categories','category_id')}</div><div class="card"><h3>Questions by organization</h3>${bars('papers','paper_id')}</div><div class="card"><h3>Learning activity</h3><p class="callout-number">${MCQ.db.attempts.length}</p><p>Answers checked on this browser</p><p class="small muted">${MCQ.db.bookmarks.length} bookmarks · ${MCQ.db.savedPapers.length} saved papers</p></div><div class="card"><h3>Review status</h3>${['pending','approved','rejected'].map(s=>`<div class="bar-row"><div class="row"><span>${s}</span><span>${MCQ.db.mcqs.filter(q=>q.status===s).length}</span></div><div class="progress-track"><span style="width:${MCQ.db.mcqs.filter(q=>q.status===s).length/MCQ.db.mcqs.length*100}%"></span></div></div>`).join('')}</div></div>`}
 function render(view,id){
  if(!['admin','super-admin'].includes(MCQ.role()))return UI.layout(`<div class="container page">${empty('Sign in required','Use an Admin or Super Admin account to open this workspace.',link('login','Log in','btn primary'))}</div>`);
  const viewCaps={
   add:'add',edit:'edit','all-mcqs':'globalMcqs','admin-records':'admins','paper-mcqs':'papers',categories:'categories',papers:'papers',jobs:'jobs',years:'years',countries:'system',import:'import',settings:'system','site-settings':'settings',users:'users',admins:'admins',reports:'reports',posts:'posts','pdfs-manager':'pdfs','latest-jobs-manager':'latestJobs','page-seo':'system',footer:'footer','legal-pages':'legal','social-links':'social',trash:'restore',backup:'backup',analytics:'analytics',ads:'ads'
  };
  const cap=viewCaps[view];
  if(App.route.path.startsWith('super-admin')&&MCQ.role()!=='super-admin'||['roles','page-seo','countries'].includes(view)&&MCQ.role()!=='super-admin'||cap&&!MCQ.allowed(cap))return shell(empty('This account does not have access to this area','Ask the Super Admin to grant the required permission for this workspace.',link(url('overview'),'Back to overview','btn')),'Access limited');
  let body,title=view;
  if(view==='overview')body=overview();
  else if(['mcqs','all-mcqs'].includes(view))body=mcqs(view);
  else if(view==='admin-records')body=adminRecords();
  else if(view==='paper-mcqs')body=paperCollection(id);
  else if(view==='add'||view==='edit')body=form(id);
  else if(view==='countries')body=countryManager();
  else if(view==='jobs')body=empty('Jobs hierarchy removed','Manage Organizations / Boards and their Past Papers instead.',link(url('papers'),'Open Organizations / Boards','btn primary'));
  else if(names[view]&&view!=='jobs')body=entities(view);
  else if(view==='import')body=importPage();
  else if(view==='settings')body=settingsHub();
  else if(view==='site-settings')body=config('settings');
  else if(view==='page-seo')body=pageSeoSettings();
  else if(view==='users'||view==='admins')body=users(view);
  else if(view==='reports')body=reports();
  else if(view==='posts')body=postManager();
  else if(view==='pdfs-manager')body=pdfManager();
    else if(view==='latest-jobs-manager')body=latestJobsManager();
  else if(view==='roles')body=config('roles');
  else if(view==='footer')body=footerSettings();
  else if(view==='legal-pages')body=legalPages();
  else if(view==='social-links')body=socialSettings();
  else if(view==='trash')body=trash();
  else if(view==='backup')body=backup();
  else if(view==='analytics')body=analytics();
  else if(view==='ads')body=adManager();
  else body=empty('Page not found','This item is no longer part of the simplified Super Admin navigation.');
  return shell(body,names[view]||({'all-mcqs':'All MCQs','admin-records':'Admin Records','paper-mcqs':'Organizations / Past Papers',settings:'Settings','site-settings':'Website Settings','page-seo':'Page Titles & Descriptions','pdfs-manager':'PDF Resources','latest-jobs-manager':'Latest Jobs'}[view])||view.replace(/^./,x=>x.toUpperCase()))
 }


 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form="move-past-paper-mcqs"]');if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(MCQ.role()!=='super-admin'){UI.toast('Only Super Admin can move MCQs.');return;}
  const selected=[...form.querySelectorAll('input[name="mcq_ids"]:checked')].map(input=>Number(input.value)).filter(Number.isSafeInteger);
  const source=Number(form.elements.source_year_id.value),destination=Number(form.elements.destination_year_id.value);
  if(!selected.length){UI.toast('Select at least one MCQ to move.');return;}
  if(!destination){UI.toast('Choose a destination past paper.');return;}
  if(!window.confirm('Move '+selected.length+' selected MCQ(s) to the chosen past paper?'))return;
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  try{
   const result=await Auth.request('/admin/mcqs/move-past-paper',{source_year_id:source,destination_year_id:destination,mcq_ids:selected});
   UI.toast(result.message||('Moved '+result.moved+' MCQ(s).'));
   await Auth.loadSection?.('core');
   window.location.reload();
  }catch(error){UI.toast(error.message||'Could not move the selected MCQs.');}
  finally{submit.disabled=false;}
 },true);

 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form="country-create"]');if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();
  const error=form.querySelector('[data-country-error]'),button=form.querySelector('[type="submit"]');
  if(error)error.textContent='';
  button.disabled=true;
  try{
   const result=await Auth.request('/admin/countries',{action:'add',name:form.elements.name.value});
   MCQ.mergeCore({countries:result.countries||[]});
   UI.toast('Country added and available for signup.');
   App.render();
  }catch(err){if(error)error.textContent=err.message||'Country could not be added.';}
  finally{button.disabled=false;}
 },true);

 document.addEventListener('change',async event=>{
  const select=event.target.closest('[data-active-country-select]');if(!select)return;
  const previous=String(MCQ.db.activeCountry||'Pakistan');
  if(select.value===previous)return;
  select.disabled=true;
  try{
   await Auth.request('/admin/active-country',{country:select.value});
   window.location.reload();
  }catch(err){
   select.value=previous;
   select.disabled=false;
   UI.toast(err.message||'Could not switch the active country.');
  }
 },true);

 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-country-toggle]');if(!button)return;
  event.preventDefault();
  const name=button.getAttribute('data-country-name')||'';
  const active=button.getAttribute('data-country-active')!=='true';
  button.disabled=true;
  try{
   const result=await Auth.request('/admin/countries',{action:'toggle',name,active});
   MCQ.mergeCore({countries:result.countries||[]});
   UI.toast(active?'Country enabled for signup.':'Country disabled for new signups.');
   App.render();
  }catch(err){UI.toast(err.message||'Country status could not be changed.');}
  finally{button.disabled=false;}
 },true);

 function updateImportSelection(){
  const checks=[...document.querySelectorAll('.import-row-check')],count=checks.filter(x=>x.checked).length;
  const label=document.getElementById('import-selection-count');if(label)label.textContent=count+' selected';
  const all=document.querySelector('[data-action="import-select-all"]');if(all){all.checked=checks.length>0&&count===checks.length;all.indeterminate=count>0&&count<checks.length}
 }
 document.addEventListener('change',ev=>{
  const input=ev.target;
  if(input.matches('[data-action="import-select-all"]')){document.querySelectorAll('.import-row-check').forEach(x=>x.checked=input.checked);updateImportSelection();return}
  if(input.matches('.import-row-check')){updateImportSelection();return}
 });
 document.addEventListener('change',ev=>{
  const input=ev.target;
  if(!input.matches('.bulk-resource-file')||!input.files?.[0])return;
  const file=input.files[0],target=document.getElementById(input.dataset.target||''),label=input.closest('form')?.querySelector('[data-bulk-file-name]');
  if(file.size>5*1024*1024){UI.toast('Choose a text file smaller than 5 MB.');input.value='';return}
  const reader=new FileReader();
  reader.onload=()=>{if(target)target.value=String(reader.result||'');if(label)label.textContent=file.name+' ready to import';};
  reader.onerror=()=>UI.toast('Could not read that file.');
  reader.readAsText(file);
 });
 document.addEventListener('change',ev=>{
  const input=ev.target;
  if(!['category-bulk-file','hierarchy-file'].includes(input.id)||!input.files?.[0])return;
  const file=input.files[0],form=input.closest('form'),hidden=form?.querySelector(input.id==='category-bulk-file'?'[name="categories"]':'[name="hierarchy"]'),label=form?.querySelector(input.id==='category-bulk-file'?'[data-category-file-name]':'[data-hierarchy-file-name]');
  if(file.size>2*1024*1024){UI.toast('Choose a text file smaller than 2 MB.');input.value='';return}
  const reader=new FileReader();
  reader.onload=()=>{if(hidden)hidden.value=String(reader.result||'');if(label)label.textContent=file.name;};
  reader.onerror=()=>UI.toast('Could not read that file.');
  reader.readAsText(file);
 });
 return {render,url,pickerDefs,picker,showPicker,pick,syncDraft,refreshPickers,entityModal,entityState,userModal,postModal,pdfModal,latestJobModal,bulkHierarchyModal,bulkCategoriesModal,loadFile,importPreview,loadImportPage};
})();



/* All first-party modules are bundled above; prevent legacy per-page/module requests. */
window.MCQCampusPageScriptsLoaded=window.MCQCampusPageScriptsLoaded||new Set();
for(const name of ["about","admin","blog","categories","contact","dashboard","home","latest-jobs","login","mcqs","past-papers","pdfs","register","super-admin","tests"])window.MCQCampusPageScriptsLoaded.add(name);
window.MCQCampusLoadPageScript=async function(name){return !!window.MCQCampusPageHooks?.[String(name||"")]};
