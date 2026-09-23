/* MCQ Campus motion system: small, accessible view transitions and staggered reveals. */
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
  nodes.slice(0,28).forEach((el,i)=>{
   el.classList.remove('mcq-motion-enter');
   el.style.setProperty('--motion-delay',Math.min(i*24,192)+'ms');
   // Force a fresh animation when a view is re-rendered in place.
   void el.offsetWidth;
   el.classList.add('mcq-motion-enter');
  });
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
