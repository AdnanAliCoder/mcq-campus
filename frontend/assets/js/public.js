window.Public=(()=>{
 const {esc:e,icon,link,btn,card,heading,crumbs,empty,badge,field,textarea,select}=UI;
 const yearPath=x=>{const p=x&&(MCQ.get('papers',x.paper_id)||MCQ.get('papers',MCQ.get('jobs',x.job_id)?.paper_id));return p?'paper/'+p.id+'/year/'+x.id:'year/'+x.id};
 const jobPath=x=>{const p=x&&MCQ.get('papers',x.paper_id);return p?'paper/'+p.id+'/job/'+x.id:'job/'+x.id};
 const pageCopy=(kind,key,title,desc)=>{const row=(MCQ.db.pageSeo||{})[kind+':'+String(key)]||{};return {title:String(row.title||title||''),desc:String(row.description||desc||'')}};
 const staticCopy=(key,title,desc)=>pageCopy('static',key,title,desc);
 const fixedPublicCountry=()=>{
  const user=window.Auth?.user||MCQ.db.session||{};
  if(String(user.activeRole||'')==='super-admin'&&(user.roles||[]).includes('super-admin'))return String(MCQ.db.activeCountry||'').trim();
  return String(user.country||'').trim();
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
 const latestJobCard=x=>{const safe=u=>/^https?:\/\//i.test(String(u||'')),org=MCQ.get('papers',x.paper_id),logo=org?UI.entityIcon(org,'briefcase'):icon('briefcase'),slug=x.slug||MCQ.slug(x.title||'job'),path=window.SEO?SEO.cleanPath('latest-job',x.id):'latest-job/'+slug,apply=safe(x.apply_url)?`<a class="btn sm" href="${e(x.apply_url)}" target="_blank" rel="noopener">Apply</a>`:'',prep=(/^(https?:\/\/|\/(?!\/))/i.test(String(x.prep_url||'')))?`<a class="btn sm" href="${e(x.prep_url)}" target="_blank" rel="noopener">Past Papers</a>`:(org?link(pastPapersPath(x),'Past Papers','btn sm'):'');return `<article class="card latest-job-card"><div class="latest-job-logo">${logo}</div><div class="latest-job-copy"><p class="eyebrow">${e(org?.name||'Organization')}</p><h2>${link(path,e(x.title||'Job opportunity'))}</h2>${x.description?`<p>${e(x.description)}</p>`:''}<p><strong>Last Date:</strong> ${e(UI.date(x.last_date))}</p><p class="small muted">${link(path,'View job details')}</p></div>${apply||prep?`<div class="latest-job-action"><div class="actions">${apply}${prep}</div></div>`:''}</article>`};
 const pdfResourceCard=x=>{const safeLink=u=>/^https?:\/\//i.test(String(u||''))||/^data:application\/pdf;base64,/i.test(String(u||'')),safeImage=u=>/^https?:\/\//i.test(String(u||''))||/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(u||'')),href=String(x.download_url||'').trim(),title=x.title||x.name||'PDF resource',slug=x.slug||MCQ.slug(title),path=window.SEO?SEO.cleanPath('pdf',x.id):'pdf/'+slug,download=safeLink(href)?`<a class="btn primary" href="${e(href)}" ${/^data:/i.test(href)?`download="${e(MCQ.slug(title||'mcq-campus'))}.pdf"`:'target="_blank" rel="noopener"'}>Download PDF</a>`:'<span class="btn disabled" aria-disabled="true">Download unavailable</span>';return `<article class="card pdf-card pdf-direct-card">${x.cover&&safeImage(x.cover)?`<img src="${e(x.cover)}" alt="${e(title)}">`:''}<div class="pdf-direct-copy"><h2>${link(path,e(title))}</h2>${x.description?`<p>${e(x.description)}</p>`:''}<p class="small muted">${link(path,'Open PDF details')}</p></div><div class="pdf-direct-action">${download}</div></article>`};
 const blogPostCard=post=>{const safeUrl=u=>/^(https?:\/\/|#\/)/i.test(String(u||'')),source=(post.links||[]).find(x=>x.label==='__blog_url'&&safeUrl(x.url)),body=`<div class="content-showcase-copy"><p class="content-kicker">Latest Update</p><span class="content-pill content-pill-blue">${e(post.category||'UPDATE')}</span><h3>${e(post.title)}</h3>${post.excerpt?`<p>${e(post.excerpt)}</p>`:''}<div class="content-date">${icon('calendar')}<span>${UI.date(post.updated_at||post.created_at)}</span></div><span class="content-cta">Read update ${icon('arrow')}</span></div><div class="content-showcase-media">${post.featured_image?`<img src="${e(post.featured_image)}" alt="">`:`<span class="content-fallback content-fallback-blue">${icon('edit')}</span>`}</div>`;return source?`<a href="${e(source.url)}" class="card clickable content-showcase-card" target="_blank" rel="noopener">${body}</a>`:link('post/'+post.id,body,'card clickable content-showcase-card')};
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

 function questionCard(q,number=1,compact=false,contextYearId=null){const answer=App.answers[q.id],chosen=App.choices[q.id];const rows=MCQ.publicMcqs(),globalIndex=rows.findIndex(x=>x.id===q.id),next=globalIndex>=0&&globalIndex<rows.length-1?rows[globalIndex+1]:rows[0];return `<article class="card mcq-card mcq-reference-card ${compact?'mcq-card-compact':''}" data-question="${q.id}"><div class="mcq-top"><div class="mcq-question-label">${questionTags(q)}</div><div class="mcq-top-actions">${btn(icon('bookmark'),'bookmark','ghost',`data-id="${q.id}" aria-label="${MCQ.db.bookmarks.includes(q.id)?'Remove bookmark':'Bookmark question'}" aria-pressed="${MCQ.db.bookmarks.includes(q.id)}"`)}${compact&&next?link('practice/'+next.id,icon('arrow'),'btn ghost quick-next'):''}</div></div><div class="mcq-question-panel"><h2>${link('mcq/'+q.id,e(q.question),'mcq-question-link')}</h2></div><div class="options mcq-reference-options" role="group" aria-label="Answer options">${[1,2,3,4].map((n,i)=>{const text=q['option'+n];const state=answer?(text===q.correct_answer?'correct':text===chosen?'wrong':''):text===chosen?'selected':'';return btn(`<span class="letter">${'ABCD'[i]}</span><span class="option-text">${e(text)}</span><span class="option-indicator" aria-hidden="true"></span>`,'choose',`option ${state}`,`data-id="${q.id}" data-option="${n}" aria-pressed="${text===chosen}" ${answer?'disabled':''}`)}).join('')}</div>${answer?`<div class="explanation mcq-verified-answer" role="status"><div class="verified-answer-head"><span class="verified-check" aria-hidden="true">✓</span><strong>Correct Answer: <b>${e(q.correct_answer)}</b></strong></div><p>${e(q.description||'No explanation has been added yet.')}</p>${relationships(q,contextYearId)}</div>`:''}<div class="actions mcq-reference-actions">${!answer?'<span class="small muted">Select an option to check your answer instantly.</span>':''}<span class="spacer"></span>${btn(icon('share'),'share','ghost',`data-id="${q.id}" aria-label="Share question"`)}${btn(icon('copy'),'copy','ghost',`data-id="${q.id}" aria-label="Copy question link"`)}${btn(icon('flag'),'report','ghost',`data-id="${q.id}" aria-label="Report question"`)}</div></article>`}
 function mini(q,index){return questionCard(q,index+1,true)}
 function quickCard(){const quick=MCQ.topMcqs(),qi=Math.max(0,Math.min(Number(App.homeQuickIndex||0),Math.max(0,quick.length-1))),q=quick[qi];return q?`<div class="hero-quick mcq-reference-quick"><div class="quick-head"><div>${questionTags(q,{featured:true})}</div>${btn('›','home-quick-next','quick-next-control',`aria-label="Next quick MCQ"`)}</div><div class="quick-question-panel"><h3>${e(q.question)}</h3></div><div class="quick-options">${[1,2,3,4].map((n,i)=>{const text=q['option'+n],chosen=App.quickAnswer?.id===q.id?App.quickAnswer.choice:null,answered=App.quickAnswer?.id===q.id,state=answered?(text===q.correct_answer?'correct':text===chosen?'wrong':''):text===chosen?'selected':'';return btn(`<span class="letter">${'ABCD'[i]}</span><span class="option-text">${e(text)}</span><span class="option-indicator" aria-hidden="true"></span>`,'home-quick-choose',`quick-option ${state}`,`data-id="${q.id}" data-option="${n}" ${answered?'disabled':''}`)}).join('')}</div>${App.quickAnswer?.id===q.id?`<div class="quick-answer mcq-verified-answer"><div class="verified-answer-head"><span class="verified-check" aria-hidden="true">✓</span><strong>Correct Answer: <b>${e(q.correct_answer)}</b></strong></div><p>${e(q.description||'No explanation has been added yet.')}</p>${relationships(q)}</div>`:''}<div class="quick-dots">${quick.map((_,i)=>`<button type="button" class="quick-dot ${i===qi?'active':''}" data-action="home-quick-jump" data-index="${i}" aria-label="Quick MCQ ${i+1}"></button>`).join('')}</div></div>`:'';}
 function countryLanding(){
  const source=Array.isArray(MCQ.db.countries)?MCQ.db.countries:[];
  const countries=source
   .filter(item=>item&&item.active!==false&&String(item.name||'').trim())
   .map(item=>({...item,name:String(item.name||'').trim()}));
  if(!countries.length)countries.push({name:'Pakistan',active:true,mcqCount:0});
  const totalApproved=Number.isFinite(Number(MCQ.db.totalApprovedMcqs))
   ?Number(MCQ.db.totalApprovedMcqs)
   :source.reduce((sum,item)=>sum+Math.max(0,Number(item?.mcqCount)||0),0);
  const globalTotal=Math.max(0,totalApproved).toLocaleString('en-US');
  const countryCards=countries.map(item=>{
   const name=item.name;
   const mcqTotal=Math.max(0,Number(item.mcqCount)||0).toLocaleString('en-US');
   const target=UI.href('register',{country:name});
   const current=name.toLowerCase()==='pakistan'?' country-entry-pakistan':'';
   return '<a class="country-entry-card'+current+'" href="'+e(target)+'" aria-label="Continue with '+e(name)+'">'+
    '<span class="country-entry-flag" aria-hidden="true">'+UI.countryFlag(name)+'</span>'+
    '<h2>'+e(name)+'</h2>'+
    '<p><strong>'+mcqTotal+'</strong><span> approved MCQs</span></p>'+
    '<span class="country-entry-card-arrow" aria-hidden="true">'+icon('arrow')+'</span>'+
   '</a>';
  }).join('');
  const countryLabel=countries.length+' '+(countries.length===1?'country':'countries')+' available';
  return '<main id="main" class="country-entry-page" tabindex="-1">'+
   '<div class="country-entry-shell">'+
    '<header class="country-entry-brand" aria-label="MCQCampus">'+
     '<img class="country-entry-logo" src="/assets/images/favicon-192.png" alt="MCQCampus logo" width="48" height="48">'+
     '<span>MCQ<span>Campus</span></span>'+
    '</header>'+
    '<section class="country-entry-hero" aria-labelledby="country-entry-title">'+
     '<p class="country-entry-eyebrow"><span class="country-entry-eyebrow-dot"></span> YOUR GLOBAL EXAM PREPARATION HUB</p>'+
     '<h1 id="country-entry-title">Prepare smarter.<br><span>Achieve more.</span></h1>'+
     '<p class="country-entry-intro">Explore MCQCampus, your destination for multiple-choice questions from different countries, competitive examinations, recruitment tests, and educational assessments.</p>'+
     '<div class="country-entry-global-stat"><span class="country-entry-stat-icon" aria-hidden="true">'+icon('book')+'</span><span><strong>'+globalTotal+'</strong><small>approved MCQs across all countries</small></span><span class="country-entry-live-dot" aria-hidden="true"></span></div>'+
    '</section>'+
    '<section class="country-entry-country-section" aria-labelledby="country-entry-country-title">'+
     '<div class="country-entry-section-heading"><div><p class="country-entry-eyebrow">START LEARNING</p><h2 id="country-entry-country-title">Choose your country</h2><p>Explore the question bank available for your exam preparation.</p></div><span class="country-entry-country-count">'+countryLabel+'</span></div>'+
     '<div class="country-entry-grid">'+countryCards+'</div>'+
    '</section>'+
    '<footer class="country-entry-footer"><span>Learn with confidence. Prepare for your next opportunity.</span><span>Already have an account? '+link('login','Sign in','country-entry-signin')+'</span></footer>'+
   '</div>'+
  '</main>';
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
  return UI.layout(`<div class="container"><section class="hero home-hero-compact"><div class="home-hero-copy"><p class="eyebrow">COMPETITIVE EXAM PREPARATION</p><h1>${e(homeSeo.title)}</h1><p class="hero-copy">${e(homeSeo.desc)}</p>${heroActions}</div><div class="home-stats home-top-stats">${homeStats.map(x=>UI.statCard(x)).join('')}</div></section>${UI.adSlot('home_top_ad')}<section class="section home-content-grid home-content-priority"><div><div class="section-head"><div><p class="eyebrow">PRACTICE</p><h2>Important MCQs</h2><p class="small muted">${importantTotal.toLocaleString('en-GB')} total important MCQs · only 10 load per page</p></div>${link('mcqs','Browse all MCQs','link')}</div><div class="home-mcq-list">${rows.length?rows.map((q,i)=>questionCard(q,(page-1)*pageSize+i+1,true)).join(''):empty(server?'No important MCQs available yet':'Loading important MCQs…','Important MCQs are requested from the database 10 at a time.')}</div>${UI.pager(importantTotal,page,pageSize,App.route.params,'home')}</div><aside class="home-category-nav card"><div class="section-head"><div><p class="eyebrow">EXPLORE</p><h2>Categories</h2></div></div><div class="home-cat-boxes">${cats.map(c=>`<div class="home-cat-group"><div class="home-cat-title">${link('category/'+c.id,`<span class="home-cat-icon">${UI.entityIcon(c,'grid')}</span><span>${e(c.name)}</span>${icon('arrow')}`)}</div><div class="home-sub-list"><span class="home-sub-link">${Number(categoryCounts[String(c.id)]||0).toLocaleString('en-GB')} MCQs</span></div></div>`).join('')}</div>${link('categories','View all categories '+icon('arrow'),'btn home-cat-more')}</aside></section>${UI.adSlot('home_middle_ad')}</div>`,'home')
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
  const entityServer=activeEntityPage(),useServer=!!(entityServer&&entityServer.type===collection),pageSize=['papers','categories'].includes(collection)?12:10,total=useServer?Number(entityServer.total||0):rows.length;
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
  return UI.layout(`<div class="container page learner-dashboard-shell"><div class="learner-mobile-head"><button class="btn ghost" type="button" data-action="learner-sidebar-toggle">${icon('menu')} Learning menu</button></div><div class="learner-shell">${side}<main class="learner-content"><div class="profile-band compact-profile-band">${avatar}<div><p class="eyebrow">YOUR LEARNING SPACE</p><h2>Welcome back, ${e(s?.name||'learner')}</h2><span class="small muted">Practice, review mistakes, explore past papers, and track progress.</span></div></div>${body}</main></div></div>`) }
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
  const form=questions.length?`<form data-form="test-submit" data-test-key="${e(key)}" data-started-at="${started}" class="test-form">${questions.map((q,i)=>`<article class="card test-question"><p class="eyebrow">MCQ ${i+1}</p><h3>${e(q.question)}</h3><div class="test-options">${[1,2,3,4].map(n=>`<label><input type="radio" name="test_q_${q.id}" value="${e(q['option'+n])}"><span>${'ABCD'[n-1]}. ${e(q['option'+n])}</span></label>`).join('')}</div></article>`).join('')}<button class="btn primary" type="submit">Submit Test</button></form>`:empty('No MCQs available','This test does not have approved MCQs yet.',link('tests','Back to tests','btn'));
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
  const main=`<section class="card automatic-test-hero"><p class="eyebrow">FULLY AUTOMATIC</p><h2>Smart 10-MCQ Test</h2><p>The system selects a source automatically from Important MCQs, Categories, or Papers and rotates the set every ${plan.days} days. No Admin test setup is required.</p><div class="auto-test-meta"><span class="badge">Current source: ${e(sourceLabel)}</span><span class="small muted">${plan.rows.length} questions · next rotation ${e(next.toISOString().slice(0,10))}</span></div><div class="card-foot">${link('test/auto','Start Automatic Test','btn primary')}<span>Automatic selection & rotation</span></div></section>`;
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
  const fallbackTitle=x.title||x.name||'Exam Preparation PDF',fallbackDesc=x.description||'Download this exam preparation PDF and continue with related past papers and MCQs.',copy={title:x.seo_title||fallbackTitle+' PDF',desc:x.seo_description||fallbackDesc},title=copy.title,href=String(x.download_url||'').trim(),download=safeLink(href)?`<a class="btn primary" href="${e(href)}" ${/^data:/i.test(href)?`download="${e(MCQ.slug(title))}.pdf"`:'target="_blank" rel="noopener"'}>Download PDF</a>`:'<span class="btn disabled" aria-disabled="true">Download unavailable</span>';
  const main=`<article class="card pdf-card pdf-direct-card">${x.cover&&safeImage(x.cover)?`<img src="${e(x.cover)}" alt="${e(title)}">`:''}<div class="pdf-direct-copy"><p class="eyebrow">EXAM PREPARATION PDF</p><h2>${e(title)}</h2><p>${e(copy.desc)}</p></div><div class="pdf-direct-action">${download}</div></article>`;
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
  const org=MCQ.get('papers',x.paper_id),fallbackTitle=((org?.name?org.name+' ':'')+(x.title||'Job opportunity')).trim(),fallbackDesc=x.description||'Latest job details, application deadline and related past-paper preparation links.',copy={title:x.seo_title||fallbackTitle,desc:x.seo_description||fallbackDesc},safe=u=>/^https?:\/\//i.test(String(u||'')),apply=safe(x.apply_url)?`<a class="btn primary" href="${e(x.apply_url)}" target="_blank" rel="noopener">Apply / View Official Details</a>`:'';
  const paperLink=(/^(https?:\/\/|\/(?!\/))/i.test(String(x.prep_url||'')))?`<a class="btn" href="${e(x.prep_url)}" target="_blank" rel="noopener">Past Papers</a>`:(org?link(pastPapersPath(x),'Past Papers','btn'):'');
  const main=`<article class="card latest-job-card"><div class="latest-job-logo">${org?UI.entityIcon(org,'briefcase'):icon('briefcase')}</div><div class="latest-job-copy"><p class="eyebrow">${e(org?.name||'Organization')}</p><h2>${e(copy.title)}</h2><p>${e(copy.desc)}</p><p><strong>Last Date:</strong> ${e(UI.date(x.last_date))}</p><div class="actions">${apply}${paperLink}</div></div></article>`;
  return PublicLayout.page({trail:[['Latest Jobs','latest-jobs'],[x.title||'Job']],title:copy.title,desc:copy.desc,main,sidebar:PublicLayout.smart('jobs'),active:'latest-jobs',sidebarLabel:'Related / Browse'});
 }
 function sitemap(){
  const pages=MCQ.db.content?.legalPages||{},f=MCQ.db.settings?.footer||{},coreHelpPages=new Set(['about','contact','privacy','terms','disclaimer']);if(f.showSitemap===false)return notFound();const pub=k=>coreHelpPages.has(k)||pages[k]?.published!==false;const support=[pub('about')&&['About Us','about'],pub('contact')&&['Contact Us','contact'],f.showFaq&&['FAQ','faq']].filter(Boolean),legal=[pub('privacy')&&['Privacy Policy','privacy'],pub('terms')&&['Terms & Conditions','terms'],pub('disclaimer')&&['Disclaimer','disclaimer'],pub('cookies')&&f.showCookiePolicy&&['Cookie Policy','cookies'],pub('advertising')&&f.showAdvertisingPolicy&&['Advertising Policy','advertising']].filter(Boolean),groups=[['Main Pages',[['Home','home'],['MCQs','mcqs'],['Past Papers','papers'],['Categories','categories'],['PDFs','pdfs'],['Tests','tests'],['Latest Jobs','latest-jobs'],['Blog','posts']]],['Account',[['Dashboard','dashboard'],['Settings','dashboard/settings']]],['Company / Support',support],['Legal',legal]].filter(([,items])=>items.length);const main=`<div class="sitemap-grid">${groups.map(([g,items])=>`<div class="card"><h2>${g}</h2>${items.map(([l,p])=>link(p,l,'discovery-link')).join('')}</div>`).join('')}</div>`;return PublicLayout.page({trail:[['Sitemap']],title:'Sitemap',desc:'Browse the main public sections of MCQ Campus.',main,sidebar:PublicLayout.smart('legal'),sidebarLabel:'Help & Legal'});
 }
 function notFound(){return UI.layout(`<div class="container page"><div class="error-page"><p class="eyebrow">404 · PAGE NOT FOUND</p><h1>We could not find that page.</h1><p>The link may be old, incomplete, or no longer available.</p><div class="actions">${link('home','Home','btn primary')}${link('search','Search','btn')}${link('categories','Categories','btn')}${link('papers','Past papers','btn')}</div></div></div>`)}
 return {home,countryLanding,quickCard,browse,listing,practice,mcq,relatedMcqs,questionCard,mini,posts,tests,test,jobsExams,pdfs,pdf,latestJobs,latestJob,dashboard,info,profileForm,sitemap,notFound};
})();

