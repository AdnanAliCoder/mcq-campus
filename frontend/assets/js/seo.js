window.SEO=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const slug=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'item';
 const site=()=>MCQ?.db?.settings?.siteName||'MCQ Campus';
 const CANONICAL_ORIGIN='https://www.mcqcampus.com';
 const baseUrl=()=>CANONICAL_ORIGIN;
 function cleanPath(base,id){
  const get=(t,i)=>MCQ.get(t,i), s=x=>x?.slug||slug(x?.name||x?.title||x?.question||id);
  if(base==='home')return '/'; if(base==='categories')return '/categories/';
  if(base==='category')return `/categories/${s(get('categories',id))}/`;
  if(base==='subcategory'){const x=get('subcategories',id),c=get('categories',x?.category_id);return c?`/categories/${s(c)}/`:'/categories/'}
  if(base==='topic'){const x=get('children',id),sub=get('subcategories',x?.subcategory_id),c=get('categories',sub?.category_id);return c?`/categories/${s(c)}/`:'/categories/'}
  if(base==='mcqs')return '/mcqs/'; if(base==='papers')return '/past-papers/'; if(base==='paper')return `/past-papers/${s(get('papers',id))}/`;
  if(base==='job')return `/jobs/${s(get('jobs',id))}/`; if(base==='year')return `/past-papers/${s(get('years',id))}/`;
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);return `/mcqs/${s(q)}/`}
  if(base==='tests')return '/tests/'; if(base==='test')return `/tests/${slug(id)}/`;
  if(base==='jobs-exams')return '/jobs-exams/'; if(base==='pdfs')return '/pdfs/'; if(base==='latest-jobs')return '/latest-jobs/';
  if(base==='posts')return '/blog/'; if(base==='post')return `/blog/${s(get('posts',id))}/`;
  return `/${slug(base)}/`;
 }
 function descriptor(base,id){
  const get=(t,i)=>MCQ.get(t,i), suffix=' | '+site(); let title=site(),description=MCQ.db.seo.description,robots='index,follow';
  if(base==='home'){title='MCQ Campus — Practice MCQs, Past Papers & Exam Preparation';description='Practice MCQs, explore past papers, jobs, categories, PDFs, tests and important questions for competitive exam preparation.'}
  if(base==='categories'){title='MCQ Categories'+suffix;description='Browse MCQ categories and practise approved questions with answers and explanations.'}
  if(base==='category'){const x=get('categories',id);title=(x?.name||'Category')+' MCQs'+suffix;description=`Practice ${x?.name||'category'} MCQs with answers and explanations.`}
  if(base==='subcategory'){const x=get('subcategories',id),c=get('categories',x?.category_id);title=(c?.name||'Category')+' MCQs'+suffix;description=`Practice ${c?.name||'category'} MCQs with answers and explanations.`}
  if(base==='topic'){const x=get('children',id),sub=get('subcategories',x?.subcategory_id),c=get('categories',sub?.category_id);title=(c?.name||'Category')+' MCQs'+suffix;description=`Practice ${c?.name||'category'} MCQs with answers and explanations.`}
  if(base==='papers'){title='Past Papers & MCQs with Answers'+suffix;description='Browse organizations, jobs and dated past papers, then practice related MCQs.'}
  if(base==='paper'){const x=get('papers',id);title=(x?.name||'Past Paper')+' Past Papers & MCQs with Answers'+suffix;description=`Practice ${x?.name||'organization'} past paper MCQs with answers, explanations and job-wise questions.`}
  if(base==='job'){const x=get('jobs',id);title=(x?.name||'Job')+' Past Papers & MCQs'+suffix;description=`Explore ${x?.name||'job'} past papers and related MCQ practice.`}
  if(base==='year'){const x=get('years',id);title=(x?.name||'Past Paper')+' MCQs'+suffix;description=`Practice MCQs associated with ${x?.name||'this past paper'}, with answers and explanations.`}
  if(base==='important'){title='Important MCQs for Practice'+suffix;description='Practice MCQs marked important by the MCQ Campus editorial workflow.'}
  if(base==='mcqs'){title='Practice MCQs with Answers & Explanations'+suffix;description='Practice approved MCQs across categories, jobs and past papers.'}
  if(base==='mcq'||base==='practice'){const q=get('mcqs',id);title=(q?.question||'MCQ').slice(0,70)+suffix;description=(q?.description||`Practice this MCQ and review the correct answer on ${site()}.`).slice(0,155)}
  if(base==='tests'){title='Automatic MCQ Tests'+suffix;description='Attempt an automatically generated 10-question test that rotates between important MCQs, categories and past papers.'}
  if(base==='test'){title='Automatic 10-MCQ Test'+suffix;description='Attempt the current automatic 10-question set and review answers, explanations, score and time taken.'}
  if(base==='jobs-exams'){title='Jobs & Competitive Exams — Pakistan & India'+suffix;description='Browse structured job and exam preparation records with related MCQs and past papers.'}
  if(base==='latest-jobs'){title='Latest Jobs'+suffix;description='Browse current job announcements with organization, title, deadline and application link when available.'}
  if(base==='pdfs'){title='Exam Preparation PDFs'+suffix;description='Browse preparation PDFs and download available files directly from the PDF listing page.'}
  if(base==='posts'){title='Blog — Exam Preparation Articles'+suffix;description='Read preparation articles, exam information and useful learning resources.'}
  if(base==='post'){const x=get('posts',id);title=(x?.seo_title||x?.title||'Post')+suffix;description=(x?.seo_description||x?.excerpt||String(x?.body||'').slice(0,155))}
  if(['about','contact','privacy','terms','disclaimer','cookies','advertising'].includes(base)){const x=MCQ.db.content?.legalPages?.[base];title=(x?.seoTitle||x?.title||base.replace(/-/g,' '))+suffix;description=(x?.metaDescription||description).slice(0,155)}
  if(base==='faq'){title='Frequently Asked Questions'+suffix;description='Answers to common questions about MCQ Campus, exam preparation content, corrections and official-information verification.'}
  if(base==='sitemap'){title='Sitemap'+suffix;description='Browse the main MCQ Campus preparation, account, support and legal pages.'}
  if(['search','login','register','forgot','reset','verify','dashboard','profile','admin','super-admin'].includes(base))robots='noindex,nofollow';
  return {title,description,robots,canonical:baseUrl()+cleanPath(base,id)};
 }
 function setMeta(selector,attrs){let el=document.querySelector(selector);if(!el){el=document.createElement('meta');document.head.appendChild(el)}Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));}
 function apply(base,id){if(typeof document==='undefined'||!document.head)return;const d=descriptor(base,id);document.title=d.title;setMeta('meta[name="description"]',{name:'description',content:d.description});setMeta('meta[name="robots"]',{name:'robots',content:d.robots});setMeta('meta[property="og:title"]',{property:'og:title',content:d.title});setMeta('meta[property="og:description"]',{property:'og:description',content:d.description});setMeta('meta[property="og:type"]',{property:'og:type',content:['post'].includes(base)?'article':'website'});setMeta('meta[property="og:url"]',{property:'og:url',content:d.canonical});setMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});setMeta('meta[name="twitter:title"]',{name:'twitter:title',content:d.title});setMeta('meta[name="twitter:description"]',{name:'twitter:description',content:d.description});let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=d.canonical||cleanPath(base,id);
  let node=document.getElementById('mcq-jsonld');if(node)node.remove();const graph=[{'@type':'WebSite','name':site(),'url':baseUrl()||'/'},{'@type':'WebPage','name':d.title,'description':d.description,'url':d.canonical||cleanPath(base,id)}];if(base==='post'){const p=MCQ.get('posts',id);if(p)graph.push({'@type':'Article','headline':p.title,'description':p.excerpt||'', 'datePublished':p.created_at||undefined,'dateModified':p.updated_at||undefined})}node=document.createElement('script');node.id='mcq-jsonld';node.type='application/ld+json';node.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});document.head.appendChild(node);
 }
 return {slug,cleanPath,descriptor,apply};
})();
