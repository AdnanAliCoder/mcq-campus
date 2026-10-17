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
