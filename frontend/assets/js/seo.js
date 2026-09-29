window.SEO=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const slug=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'item';
 // Accept the existing Django sitemap spelling as well as the SPA spelling.
 // For example, [2026][Morning] and A & B are slugged differently by each.
 const hierarchySlug=s=>String(s??'').normalize('NFKD').replace(/[^\x00-\x7F]/g,'').toLowerCase().replace(/[^\w\s-]/g,'').trim().replace(/[-\s]+/g,'-').replace(/^[-_]+|[-_]+$/g,'').slice(0,96)||'item';
 const fitTitle=(value,limit=60)=>{const text=String(value||'').replace(/\s+/g,' ').trim();if(text.length<=limit)return text;const suffix=' | '+site();if(text.endsWith(suffix)){const head=text.slice(0,-suffix.length).replace(/[\s\-—|,:]+$/,'');const room=Math.max(12,limit-suffix.length-3);return head.slice(0,room).replace(/[\s\-—|,:]+$/,'')+'...'+suffix}return text.slice(0,limit-3).replace(/[\s\-—|,:]+$/,'')+'...'};
 const site=()=>MCQ?.db?.settings?.siteName||'MCQ Campus';
 const shortName=value=>{const text=String(value||'').trim(),bracket=[...text.matchAll(/\[([^\]]{2,16})\]/g)].map(m=>m[1].trim()).filter(Boolean);if(bracket.length)return bracket[bracket.length-1];const paren=[...text.matchAll(/\(([^)]{2,16})\)/g)].map(m=>m[1].trim()).filter(x=>/^[A-Z0-9&. -]+$/.test(x));if(paren.length)return paren[paren.length-1];const caps=text.match(/\b[A-Z][A-Z0-9&.-]{1,15}\b/g);return caps?.[caps.length-1]||text};
 const baseUrl=()=>{try{return new URL(document.querySelector('link[rel="canonical"]')?.href||document.querySelector('meta[property="og:url"]')?.content||location.href).origin}catch{return 'https://www.mcqcampus.com'}};
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
  if(base==='home')return '/'; if(base==='categories')return '/categories';
  if(base==='category')return `/category/${s(get('categories',id))}`;
  if(base==='subcategory'){const x=get('subcategories',id);return x?`/subcategory/${s(x)}`:'/categories'}
  if(base==='topic'){const x=get('children',id);return x?`/topic/${s(x)}`:'/categories'}
  if(base==='mcqs')return '/mcqs'; if(base==='papers')return '/papers'; if(base==='paper'){const p=get('papers',id);return p?`/${slug(p.name)}-past-papers`:'/papers'}
  if(base==='job'){const j=get('jobs',id),p=j&&get('papers',j.paper_id);return p&&j?`/${slug(shortName(p.name))}-${slug(j.name)}-past-papers`:`/job/${s(j)}`}
  if(base==='year'){const y=get('years',id),j=y&&get('jobs',y.job_id),p=j&&get('papers',j.paper_id);return p&&j?`/paper/${s(p)}/job/${s(j)}/year/${s(y)}`:`/year/${s(y)}`}
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);return `/mcq/${s(q)}`}
  if(base==='tests')return '/tests'; if(base==='test')return `/test/${slug(id)}`;
  if(base==='jobs-exams')return '/jobs-exams'; if(base==='pdfs')return '/pdfs'; if(base==='latest-jobs')return '/latest-jobs';
  if(base==='posts')return '/posts'; if(base==='post')return `/post/${s(get('posts',id))}`;
  return `/${slug(base)}`;
 }
 function descriptor(base,id){
  const discovery=discoveryPage(location.pathname);
  if(discovery)return {...discovery,discovery:true};
  const get=(t,i)=>MCQ.get(t,i), suffix=' | '+site(); let title=site(),description=MCQ.db.seo.description,robots='index,follow';
  if(base==='home'){title='MCQ Campus — Practice MCQs, Past Papers & Exam Preparation';description='Practice MCQs with answers and explanations, browse past papers, jobs, categories and exam preparation resources for Pakistan and India.'}
  if(base==='categories'){title='MCQ Categories'+suffix;description='Browse MCQ categories and practise approved questions with answers and explanations.'}
  if(base==='category'){const x=get('categories',id);title=(x?.name||'Category')+' MCQs'+suffix;description=`Practice ${x?.name||'category'} MCQs with answers and explanations.`}
  if(base==='subcategory'){const x=get('subcategories',id);title=(x?.name||'Subcategory')+' MCQs with Answers'+suffix;description=`Practice ${x?.name||'subcategory'} MCQs with correct answers and explanations.`}
  if(base==='topic'){const x=get('children',id);title=(x?.name||'Topic')+' MCQs with Answers'+suffix;description=`Practice ${x?.name||'topic'} MCQs with correct answers and explanations.`}
  if(base==='papers'){title='Past Papers & MCQs with Answers'+suffix;description='Browse organizations, jobs and dated past papers, then practice related MCQs.'}
  if(base==='paper'){const x=get('papers',id);title=(x?.name||'Past Paper')+' Past Papers, Jobs & MCQs'+suffix;description=`Browse ${x?.name||'organization'} jobs and past papers, then practice linked MCQs with correct answers and explanations.`}
  if(base==='job'){const x=get('jobs',id),p=x&&get('papers',x.paper_id);title=((p?.name? p.name+' ':'')+(x?.name||'Job')+' Past Papers & MCQs')+suffix;description=`Explore ${(p?.name? p.name+' ':'')}${x?.name||'job'} past papers by year and practice related MCQs with answers and explanations.`}
  if(base==='year'){const x=get('years',id),j=x&&get('jobs',x.job_id),p=j&&get('papers',j.paper_id);title=((p?.name? p.name+' ':'')+(j?.name? j.name+' ':'')+(x?.name||'Past Paper')+' Past Paper MCQs')+suffix;description=`Practice ${(p?.name? p.name+' ':'')}${j?.name||'job'} ${x?.name||'past paper'} MCQs with correct answers and explanations.`}
  if(base==='important'){title='Important MCQs for Practice'+suffix;description='Practice MCQs marked important by the MCQ Campus editorial workflow.'}
  if(base==='mcqs'){title='Practice MCQs with Answers & Explanations'+suffix;description='Practice approved MCQs across categories, jobs and past papers.'}
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);title=(q?.question||'MCQ').slice(0,70)+suffix;description=(q?.description||`Practice this MCQ and review the correct answer on ${site()}.`).slice(0,155)}
  if(base==='tests'){title='Automatic MCQ Tests'+suffix;description='Attempt an automatically generated 10-question test that rotates between important MCQs, categories and past papers.'}
  if(base==='test'){title='Automatic 10-MCQ Test'+suffix;description='Attempt the current automatic 10-question set and review answers, explanations, score and time taken.'}
  if(base==='jobs-exams'){title='Jobs & Exams Preparation — Past Papers & MCQs'+suffix;description='Browse job and competitive exam preparation pages with agency-wise past papers, years and linked MCQs.'}
  if(base==='latest-jobs'){title='Latest Jobs & Exam Opportunities'+suffix;description='Browse current job and exam opportunities with organization details, deadlines and preparation resources.'}
  if(base==='pdfs'){title='Exam Preparation PDFs & Study Resources'+suffix;description='Browse preparation PDFs and downloadable study resources for MCQs, past papers and competitive exams.'}
  if(base==='posts'){title='Exam Preparation Blog & Updates'+suffix;description='Read exam preparation articles, study guides, updates and useful learning resources.'}
  if(base==='post'){const x=get('posts',id);title=(x?.seo_title||x?.title||'Post')+suffix;description=(x?.seo_description||x?.excerpt||String(x?.body||'').slice(0,155))}
  if(['about','contact','privacy','terms','disclaimer','cookies','advertising'].includes(base)){const x=MCQ.db.content?.legalPages?.[base];title=(x?.seoTitle||x?.title||base.replace(/-/g,' '))+suffix;description=(x?.metaDescription||description).slice(0,155)}
  if(base==='faq'){title='Frequently Asked Questions'+suffix;description='Answers to common questions about MCQ Campus, exam preparation content, corrections and official-information verification.'}
  if(base==='sitemap'){title='Sitemap'+suffix;description='Browse the main MCQ Campus preparation, account, support and legal pages.'}
  if(['search','login','register','forgot','reset','verify','dashboard','profile','admin','super-admin'].includes(base))robots='noindex,nofollow';
  return {title:fitTitle(title),description,robots,canonical:baseUrl()+cleanPath(base,id)};
 }
 function setMeta(selector,attrs){let el=document.querySelector(selector);if(!el){el=document.createElement('meta');document.head.appendChild(el)}Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));}
 function apply(base,id){if(typeof document==='undefined'||!document.head)return;const d=descriptor(base,id);document.title=d.title;setMeta('meta[name="description"]',{name:'description',content:d.description});setMeta('meta[name="robots"]',{name:'robots',content:d.robots});setMeta('meta[property="og:title"]',{property:'og:title',content:d.title});setMeta('meta[property="og:description"]',{property:'og:description',content:d.description});setMeta('meta[property="og:type"]',{property:'og:type',content:['post'].includes(base)?'article':'website'});setMeta('meta[property="og:url"]',{property:'og:url',content:d.canonical});setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:d.title});setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:d.description});let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=d.canonical||cleanPath(base,id);
  document.getElementById('server-jsonld')?.remove();
  let node=document.getElementById('mcq-jsonld');if(node)node.remove();
  if(d.discovery){node=document.createElement('script');node.id='mcq-jsonld';node.type='application/ld+json';node.textContent=JSON.stringify(d.schema);document.head.appendChild(node);return;}
  const graph=[{'@type':'WebSite','name':site(),'url':baseUrl()||'/'},{'@type':'WebPage','name':d.title,'description':d.description,'url':d.canonical||cleanPath(base,id),'speakable':{'@type':'SpeakableSpecification','cssSelector':['#main h1','#seo-summary']}}];const get=(t,i)=>MCQ.get(t,i),bc=[['Home','/']];if(base==='categories')bc.push(['Categories','/categories']);if(base==='category'){const x=get('categories',id);bc.push(['Categories','/categories'],[x?.name||'Category',cleanPath(base,id)])}if(base==='subcategory'){const x=get('subcategories',id),c=get('categories',x?.category_id);bc.push(['Categories','/categories']);if(c)bc.push([c.name,`/category/${slug(c.name)}`]);bc.push([x?.name||'Subcategory',cleanPath(base,id)])}if(base==='topic'){const x=get('children',id),sub=get('subcategories',x?.subcategory_id),c=get('categories',sub?.category_id);bc.push(['Categories','/categories']);if(c)bc.push([c.name,`/category/${slug(c.name)}`]);if(sub)bc.push([sub.name,`/subcategory/${slug(sub.name)}`]);bc.push([x?.name||'Topic',cleanPath(base,id)])}if(base==='papers')bc.push(['Past Papers','/papers']);if(base==='paper'){const p=get('papers',id);bc.push(['Past Papers','/papers'],[p?.name||'Paper',cleanPath(base,id)])}if(base==='job'){const j=get('jobs',id),p=j&&get('papers',j.paper_id);bc.push(['Past Papers','/papers']);if(p)bc.push([p.name,`/paper/${slug(p.name)}`]);bc.push([j?.name||'Job',cleanPath(base,id)])}if(base==='year'){const y=get('years',id),j=y&&get('jobs',y.job_id),p=j&&get('papers',j.paper_id);bc.push(['Past Papers','/papers']);if(p)bc.push([p.name,`/paper/${slug(p.name)}`]);if(j)bc.push([j.name,`/paper/${slug(p?.name)}/job/${slug(j.name)}`]);bc.push([y?.name||'Year',cleanPath(base,id)])}if(base==='mcq'||base==='practice'){const q=get('mcqs',id),c=q&&get('categories',q.category_id);bc.push(['MCQs','/mcqs']);if(c)bc.push([c.name,`/category/${slug(c.name)}`]);bc.push([(q?.question||'MCQ').slice(0,80),cleanPath(base,id)])}if(base==='jobs-exams')bc.push(['Jobs & Exams','/jobs-exams']);if(base==='post'){const p=get('posts',id);bc.push(['Blog','/posts'],[p?.title||'Post',cleanPath(base,id)])}if(bc.length>1)graph.push({'@type':'BreadcrumbList','itemListElement':bc.map((x,i)=>({'@type':'ListItem','position':i+1,'name':x[0],'item':baseUrl()+x[1]}))});const itemRows=base==='category'?MCQ.publicMcqs().filter(q=>+q.category_id===+id).slice(0,20).map(q=>({name:q.question,url:baseUrl()+'/mcq/'+slug(q.question)})):base==='subcategory'?MCQ.publicMcqs().filter(q=>MCQ.ids(q.subcategory_ids).includes(+id)).slice(0,20).map(q=>({name:q.question,url:baseUrl()+'/mcq/'+slug(q.question)})):base==='topic'?MCQ.publicMcqs().filter(q=>MCQ.ids(q.child_subcategory_ids).includes(+id)).slice(0,20).map(q=>({name:q.question,url:baseUrl()+'/mcq/'+slug(q.question)})):base==='paper'?MCQ.db.jobs.filter(j=>j.active!==false&&+j.paper_id===+id).slice(0,20).map(j=>({name:j.name,url:baseUrl()+cleanPath('job',j.id)})):base==='job'?MCQ.db.years.filter(y=>y.active!==false&&+y.job_id===+id).slice(0,20).map(y=>({name:y.name,url:baseUrl()+cleanPath('year',y.id)})):base==='year'?MCQ.publicMcqs().filter(q=>MCQ.ids(q.job_years_ids).includes(+id)).slice(0,20).map(q=>({name:q.question,url:baseUrl()+'/mcq/'+slug(q.question)})):[];if(itemRows.length)graph.push({'@type':'ItemList','name':d.title,'itemListElement':itemRows.map((x,i)=>({'@type':'ListItem','position':i+1,'name':x.name,'url':x.url}))});if(base==='post'){const p=MCQ.get('posts',id);if(p)graph.push({'@type':'Article','headline':p.title,'description':p.excerpt||'','author':{'@type':'Organization','name':site(),'url':baseUrl()||'/'},'publisher':{'@type':'Organization','name':site(),'url':baseUrl()||'/'},'mainEntityOfPage':d.canonical||cleanPath(base,id),'datePublished':p.created_at||undefined,'dateModified':p.updated_at||p.created_at||undefined})}node=document.createElement('script');node.id='mcq-jsonld';node.type='application/ld+json';node.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});document.head.appendChild(node);
 }
 return {slug,hierarchySlug,cleanPath,descriptor,apply,discoveryPage,isDiscoveryPath,needsDocumentNavigation,renderDiscovery};
})();
