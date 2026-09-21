window.SEO=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const slug=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'item';
 const site=()=>MCQ?.db?.settings?.siteName||'MCQ Campus';
 const baseUrl=()=>{try{return location.origin&&location.origin!=='null'?location.origin:''}catch{return ''}};
 function cleanPath(base,id){
  const get=(t,i)=>MCQ.get(t,i), s=x=>slug(x?.name||x?.title||x?.question||id);
  if(base==='home')return '/'; if(base==='categories')return '/categories/';
  if(base==='category')return `/categories/${s(get('categories',id))}/`;
  if(base==='subcategory'){const x=get('subcategories',id),c=get('categories',x?.category_id);return `/categories/${s(c)}/${s(x)}/`}
  if(base==='topic'){const x=get('children',id),sub=get('subcategories',x?.subcategory_id),c=get('categories',sub?.category_id);return `/categories/${s(c)}/${s(sub)}/${s(x)}/`}
  if(base==='papers')return '/papers/'; if(base==='paper')return `/papers/${s(get('papers',id))}/`;
  if(base==='job')return `/jobs/${s(get('jobs',id))}/`; if(base==='year')return `/past-papers/${s(get('years',id))}/`;
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);return `/mcqs/${s(q)}/`}
  if(base==='posts')return '/posts/'; if(base==='post')return `/posts/${s(get('posts',id))}/`;
  if(base==='guides')return '/guides/'; if(base==='guide')return `/guides/${s(get('guides',id))}/`;
  return `/${slug(base)}/`;
 }
 function descriptor(base,id){
  const get=(t,i)=>MCQ.get(t,i), suffix=' | '+site(); let title=site(),description=MCQ.db.seo.description,robots='index,follow';
  if(base==='home'){title='MCQ Campus — Practice MCQs, Past Papers & Exam Preparation';description='Practice MCQs, explore past papers, jobs, categories, guides and important questions for competitive exam preparation.'}
  if(base==='categories'){title='MCQ Categories & Topics'+suffix;description='Browse MCQ categories, subcategories and focused topics for structured practice.'}
  if(base==='category'){const x=get('categories',id);title=(x?.name||'Category')+' MCQs & Topics'+suffix;description=`Practice ${x?.name||'category'} MCQs and explore related subcategories and topics.`}
  if(base==='subcategory'){const x=get('subcategories',id);title=(x?.name||'Subject')+' MCQs'+suffix;description=`Explore ${x?.name||'subject'} topics and practice related MCQs with answers and explanations.`}
  if(base==='topic'){const x=get('children',id);title=(x?.name||'Topic')+' MCQs with Answers'+suffix;description=`Practice ${x?.name||'topic'} MCQs with answers and explanations.`}
  if(base==='papers'){title='Past Papers & MCQs with Answers'+suffix;description='Browse organizations, jobs and dated past papers, then practice related MCQs.'}
  if(base==='paper'){const x=get('papers',id);title=(x?.name||'Past Paper')+' Past Papers & MCQs with Answers'+suffix;description=`Practice ${x?.name||'organization'} past paper MCQs with answers, explanations and job-wise questions.`}
  if(base==='job'){const x=get('jobs',id);title=(x?.name||'Job')+' Past Papers & MCQs'+suffix;description=`Explore ${x?.name||'job'} past papers and related MCQ practice.`}
  if(base==='year'){const x=get('years',id);title=(x?.name||'Past Paper')+' MCQs'+suffix;description=`Practice MCQs associated with ${x?.name||'this past paper'}, with answers and explanations.`}
  if(base==='important'){title='Important MCQs for Practice'+suffix;description='Practice MCQs marked important by the MCQ Campus editorial workflow.'}
  if(base==='mcqs'){title='Practice MCQs with Answers & Explanations'+suffix;description='Practice approved MCQs across categories, jobs and past papers.'}
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);title=(q?.question||'MCQ').slice(0,70)+suffix;description=(q?.description||`Practice this MCQ and review the correct answer on ${site()}.`).slice(0,155)}
  if(base==='posts'){title='Posts & Learning Resources'+suffix;description='Read useful exam-preparation posts and follow internal links to relevant MCQs and past papers.'}
  if(base==='post'){const x=get('posts',id);title=(x?.seo_title||x?.title||'Post')+suffix;description=(x?.seo_description||x?.excerpt||String(x?.body||'').slice(0,155))}
  if(base==='guides'){title='Study Guides & Exam Preparation'+suffix;description='Read practical study guides and connect them with MCQ and past-paper practice.'}
  if(base==='guide'){const x=get('guides',id);title=(x?.name||'Study guide')+suffix;description=(x?.summary||'Study guide from MCQ Campus').slice(0,155)}
  if(['search','login','register','forgot','reset','verify','dashboard','profile','admin','super-admin'].includes(base))robots='noindex,nofollow';
  return {title,description,robots,canonical:baseUrl()+cleanPath(base,id)};
 }
 function setMeta(selector,attrs){let el=document.querySelector(selector);if(!el){el=document.createElement('meta');document.head.appendChild(el)}Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));}
 function apply(base,id){if(typeof document==='undefined'||!document.head)return;const d=descriptor(base,id);document.title=d.title;setMeta('meta[name="description"]',{name:'description',content:d.description});setMeta('meta[name="robots"]',{name:'robots',content:d.robots});setMeta('meta[property="og:title"]',{property:'og:title',content:d.title});setMeta('meta[property="og:description"]',{property:'og:description',content:d.description});setMeta('meta[property="og:type"]',{property:'og:type',content:['post','guide'].includes(base)?'article':'website'});setMeta('meta[property="og:url"]',{property:'og:url',content:d.canonical});setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:d.title});setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:d.description});let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=d.canonical||cleanPath(base,id);
  let node=document.getElementById('mcq-jsonld');if(node)node.remove();const graph=[{'@type':'WebSite','name':site(),'url':baseUrl()||'/'},{'@type':'WebPage','name':d.title,'description':d.description,'url':d.canonical||cleanPath(base,id)}];if(base==='post'){const p=MCQ.get('posts',id);if(p)graph.push({'@type':'Article','headline':p.title,'description':p.excerpt||'', 'datePublished':p.created_at||undefined,'dateModified':p.updated_at||undefined})}if(base==='guide'){const g=MCQ.get('guides',id);if(g)graph.push({'@type':'Article','headline':g.name,'description':g.summary||''})}node=document.createElement('script');node.id='mcq-jsonld';node.type='application/ld+json';node.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});document.head.appendChild(node);
 }
 return {slug,cleanPath,descriptor,apply};
})();
