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
  const out=[],p=App.route?.params||{},cats=MCQ.db.categories.filter(x=>x.active!==false&&!x.legacy),papers=MCQ.db.papers.filter(x=>x.active!==false),jobs=MCQ.db.jobs.filter(x=>x.active!==false),years=MCQ.db.years.filter(x=>x.active!==false);
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
   if(type==='paper'&&parent)hierarchy=MCQ.db.jobs.filter(x=>x.active!==false&&x.paper_id===parent.id).slice(0,8).map(x=>['paper/'+parent.id+'/job/'+x.id,x.name]);
   else if(type==='job'&&parent){const paper=MCQ.get('papers',parent.paper_id);hierarchy=years.filter(x=>x.job_id===parent.id).slice(0,8).map(x=>[paper?'paper/'+paper.id+'/job/'+parent.id+'/year/'+x.id:'year/'+x.id,x.name]);}
   else hierarchy=paperLinks(7);
   if(type==='paper'||type==='job')out.push(module(type==='paper'?'Jobs / Posts':'Years / Papers',linkList(hierarchy)));
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
   if(yrs.length)out.push(module('Related Past Papers',linkList(yrs.slice(0,7).map(x=>{const job=MCQ.get('jobs',x.job_id),paper=job&&MCQ.get('papers',job.paper_id);return [paper&&job?'paper/'+paper.id+'/job/'+job.id+'/year/'+x.id:'year/'+x.id,x.name]}))));
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
  const has=clean(sidebar);const sidebarId='public-smart-sidebar';
  return UI.layout(`<div class="container page public-page ${e(className)}">${crumbs(trail)}${heading(title,desc,actions)}${pre}${has?`<div class="public-sidebar-mobile-bar">${btn(icon('menu')+' '+e(sidebarLabel),'public-sidebar-toggle','',`aria-expanded="false" aria-controls="${sidebarId}"`)}</div><div class="public-layout"><main class="public-main">${main}</main><aside class="public-sidebar" id="${sidebarId}" aria-label="Contextual sidebar"><div class="public-sidebar-head"><strong>${e(sidebarLabel)}</strong>${btn(icon('close'),'public-sidebar-close','ghost','aria-label="Close sidebar"')}</div><div class="public-sidebar-inner">${sidebar}</div></aside></div><button class="public-sidebar-backdrop" type="button" data-action="public-sidebar-close" aria-label="Close sidebar"></button>`:`<main class="public-main public-main-full">${main}</main>`}</div>`,active);
 }
 return {page,smart,module,linkList,selectionBar,selectionStack};
})();

