/* MCQCampus pricing and manual Raast payment page. */
window.MCQPricing=(()=>{
 const esc=UI.esc;
 let pricingData=null,selectedPlan=null;
 const money=value=>'Rs. '+Number(value||0).toLocaleString('en-PK');
 const priceLabel=plan=>plan.key==='free'?'Free':money(plan.amount);
 function render(){
  const main='<div class="mcq-pricing-page" id="mcq-pricing-page">'+
   '<section class="mcq-pricing-hero"><p class="eyebrow">SUBSCRIPTION PLANS</p><h2>Choose the plan that fits your preparation</h2>'+
   '<p>Unlock all 17,000+ MCQs, Important MCQs, past papers and premium PDF resources. Pay through Raast and submit your proof for verification.</p></section>'+
   '<div class="mcq-pricing-status" data-pricing-status aria-live="polite">Loading your subscription options…</div>'+
   '<section class="mcq-pricing-grid" data-pricing-grid aria-label="Subscription plans"><div class="mcq-pricing-loading">Loading plans…</div></section>'+
   '<section class="mcq-pricing-faq"><h2>Common questions</h2>'+
   '<details class="mcq-faq-item" open><summary>Payment kaise karein?</summary><p>Subscribe button dabayein. Raast QR scan karein ya Raast ID par exact amount transfer karein. Phir transaction reference aur screenshot/PDF receipt submit karein.</p></details>'+
   '<details class="mcq-faq-item"><summary>Premium access kab activate hoga?</summary><p>Super Admin payment verify karne ke baad aapka selected plan activate karega. Status aapke account mein update ho jayega.</p></details>'+
   '<details class="mcq-faq-item"><summary>Payment proof kahan jata hai?</summary><p>Proof private tor par MCQCampus ke admin review queue mein save hota hai. Sirf Super Admin uploaded receipt dekh sakta hai.</p></details>'+
   '<details class="mcq-faq-item"><summary>Free plan bhi available hai?</summary><p>Haan. Free plan ke selected MCQs, past papers aur resources available rehte hain. Free access limits Super Admin manage karta hai.</p></details></section>'+
   '<dialog class="mcq-payment-dialog" data-pricing-dialog aria-labelledby="mcq-payment-title"><div class="mcq-payment-box">'+
   '<button class="mcq-payment-close" type="button" data-pricing-close aria-label="Close">&times;</button>'+
   '<div data-pricing-form-state><header class="mcq-payment-head"><p class="eyebrow">RAAST PAYMENT</p><h2 id="mcq-payment-title" data-pricing-plan-name>Premium plan</h2><p class="mcq-payment-amount" data-pricing-plan-amount>Rs. 299</p></header>'+
   '<div class="mcq-raast-block"><div class="mcq-raast-qr"><img data-pricing-qr alt="MCQCampus Raast payment QR code" hidden><span data-pricing-qr-fallback>Raast QR is not configured yet.</span></div>'+
   '<div class="mcq-raast-info"><p class="mcq-raast-label">Raast ID</p><div class="mcq-raast-id"><span data-pricing-raast-id>Not configured</span><button type="button" class="mcq-copy-btn" data-pricing-copy>Copy</button></div>'+
   '<p class="small muted">QR scan karein ya Raast ID par exact plan amount transfer karein. Us ke baad neeche transaction proof submit karein.</p></div></div>'+
   '<form class="mcq-payment-form" data-pricing-payment-form enctype="multipart/form-data" novalidate>'+
   '<label>Full name<input name="name" type="text" maxlength="150" autocomplete="name" required></label>'+
   '<label>Email<input name="email" type="email" maxlength="254" autocomplete="email" required></label>'+
   '<label>Transaction ID / Reference<input name="transaction_id" type="text" maxlength="120" placeholder="Raast transaction reference" required></label>'+
   '<label>Amount paid<input data-pricing-amount-input name="amount" type="text" readonly></label>'+
   '<label class="mcq-upload-field">Payment screenshot / PDF receipt<input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required><span data-pricing-file-label>Choose PNG, JPG, WebP or PDF (max 5 MB)</span></label>'+
   '<p class="mcq-pricing-error" data-pricing-error role="alert"></p><p class="mcq-pricing-note"><strong>Note:</strong> Proof submit hone ke baad request verification queue mein jayegi. Premium access approval ke baad hi activate hoga.</p>'+
   '<div class="mcq-payment-actions"><button class="btn" type="button" data-pricing-close>Cancel</button><button class="btn primary" type="submit" data-pricing-submit>Submit payment proof</button></div></form></div>'+
   '<div class="mcq-payment-success" data-pricing-success hidden><div class="mcq-payment-success-icon">✓</div><h2>Payment proof submitted</h2>'+
   '<p>Your payment reference has been saved and is waiting for verification.</p><p class="mcq-payment-reference">Reference: <strong data-pricing-reference>—</strong></p>'+
   '<p class="small muted">Premium access activate hone par aapke account mein status update ho jayega.</p><button class="btn primary" type="button" data-pricing-close>Done</button></div>'+
   '</div></dialog></div>';
  return PublicLayout.page({
   trail:[['Pricing']],
   title:'Choose the plan that fits your preparation',
   desc:'Unlock the complete MCQCampus library with a manual Raast payment and verified activation.',
   main:main,
   sidebar:PublicLayout.smart('mcqs'),
   active:'pricing',
   sidebarLabel:'Related / Browse'
  });
 }
 function planCard(plan){
  const featured=plan.key==='quarterly';
  const features=(plan.features||[]).map(text=>'<li>'+esc(text)+'</li>').join('');
  const button=plan.key==='free'
   ?'<button class="mcq-plan-button" type="button" data-pricing-free>Start Free</button>'
   :'<button class="mcq-plan-button" type="button" data-pricing-choose="'+esc(plan.key)+'" '+(plan.active?'':'disabled')+'>Subscribe</button>';
  return '<article class="mcq-plan-card '+(featured?'is-featured':'')+'">'+(featured?'<span class="mcq-plan-badge">MOST POPULAR</span>':'')+
   '<div class="mcq-plan-head"><p class="mcq-plan-name">'+esc(plan.name)+'</p><p class="mcq-plan-price"><strong>'+esc(priceLabel(plan))+'</strong><span>'+esc(plan.period||'')+'</span></p>'+
   '<p class="mcq-plan-tagline">'+esc(plan.tagline||'')+'</p></div><ul class="mcq-plan-features">'+features+'</ul>'+button+'</article>';
 }
 function updatePlans(root,data){
  const grid=root.querySelector('[data-pricing-grid]'),status=root.querySelector('[data-pricing-status]');
  if(!grid)return;
  const plans=data.plans||{},order=['free','monthly','quarterly','yearly'];
  grid.innerHTML=order.filter(key=>plans[key]&&(key==='free'||plans[key].active!==false)).map(key=>planCard(plans[key])).join('');
  if(data.subscription?.active){
   const end=data.subscription.ends_at?new Date(data.subscription.ends_at).toLocaleDateString():'—';
   status.innerHTML='<strong>Premium active</strong><span>Your '+esc(data.subscription.plan||'Premium')+' access is active until '+esc(end)+'.</span>';
  }else{status.textContent='Choose a plan to unlock all premium levels, past papers and PDF resources.';}
 }
 function showError(root,message){const box=root.querySelector('[data-pricing-error]');if(box)box.textContent=message||'';}
 function openPayment(root,key){
  const plan=pricingData?.plans?.[key];if(!plan||plan.active===false)return;
  if(!Auth.user){UI.toast('Please sign in before submitting payment proof.');App.go('login',{next:'pricing'});return;}
  selectedPlan=plan;
  const dialog=root.querySelector('[data-pricing-dialog]');
  root.querySelector('[data-pricing-plan-name]').textContent=plan.name;
  root.querySelector('[data-pricing-plan-amount]').textContent=money(plan.amount)+' '+(plan.period||'');
  root.querySelector('[data-pricing-amount-input]').value=money(plan.amount);
  root.querySelector('[data-pricing-raast-id]').textContent=pricingData.raast_id||'Not configured yet';
  root.querySelector('[data-pricing-copy]').disabled=!pricingData.raast_id;
  const img=root.querySelector('[data-pricing-qr]'),fallback=root.querySelector('[data-pricing-qr-fallback]');
  if(pricingData.qr_url){img.src=pricingData.qr_url;img.hidden=false;fallback.hidden=true;img.onerror=()=>{img.hidden=true;fallback.hidden=false;fallback.textContent='Raast QR image could not be loaded.';};}
  else{img.hidden=true;fallback.hidden=false;fallback.textContent='Raast QR is not configured yet.';}
  const form=root.querySelector('[data-pricing-payment-form]');form.reset();
  form.elements.name.value=Auth.user?.name||'';
  form.elements.email.value=Auth.user?.email||'';
  root.querySelector('[data-pricing-amount-input]').value=money(plan.amount);
  root.querySelector('[data-pricing-file-label]').textContent='Choose PNG, JPG, WebP or PDF (max 5 MB)';
  root.querySelector('[data-pricing-form-state]').hidden=false;
  root.querySelector('[data-pricing-success]').hidden=true;
  showError(root,'');
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 }
 function closeDialog(dialog){if(dialog?.close)dialog.close();else dialog?.removeAttribute('open');}
 function copyText(value){
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(value);
  const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
  try{document.execCommand('copy');}finally{input.remove();}
  return Promise.resolve();
 }
 async function load(root){
  const grid=root.querySelector('[data-pricing-grid]');if(!grid||root.dataset.pricingLoaded==='true')return;
  root.dataset.pricingLoaded='true';
  try{const response=await Auth.request('/subscription/plans');if(!root.isConnected)return;pricingData=response;updatePlans(root,response);}
  catch(error){root.dataset.pricingLoaded='false';grid.innerHTML='<div class="mcq-pricing-error">Subscription plans could not be loaded. Please refresh and try again.</div>';const status=root.querySelector('[data-pricing-status]');if(status)status.textContent=error.message||'Unable to load payment settings.';}
 }
 function afterRender(root){
  const page=root.querySelector('#mcq-pricing-page');if(!page)return;
  load(page);if(page.dataset.pricingBound==='true')return;page.dataset.pricingBound='true';
  page.addEventListener('click',async event=>{
   const choose=event.target.closest('[data-pricing-choose]');if(choose){openPayment(page,choose.dataset.pricingChoose);return;}
   if(event.target.closest('[data-pricing-free]')){App.go('register');return;}
   if(event.target.closest('[data-pricing-close]')){closeDialog(page.querySelector('[data-pricing-dialog]'));return;}
   if(event.target.closest('[data-pricing-copy]')){
    const button=page.querySelector('[data-pricing-copy]');if(!pricingData?.raast_id)return;
    try{await copyText(pricingData.raast_id);button.textContent='Copied';setTimeout(()=>{if(button.isConnected)button.textContent='Copy';},1400);}
    catch{UI.toast('Could not copy the Raast ID.');}
   }
  });
  page.addEventListener('change',event=>{
   const input=event.target.closest('[name="screenshot"]');if(!input)return;
   const chosen=input.files?.[0];if(!chosen)return;
   const ok=['image/png','image/jpeg','image/webp','application/pdf'].includes(chosen.type);
   if(!ok||chosen.size>5*1024*1024){showError(page,'Choose a valid PNG, JPG, WebP or PDF file smaller than 5 MB.');input.value='';page.querySelector('[data-pricing-file-label]').textContent='Choose PNG, JPG, WebP or PDF (max 5 MB)';return;}
   showError(page,'');page.querySelector('[data-pricing-file-label]').textContent=chosen.name+' · '+Math.max(1,Math.round(chosen.size/1024))+' KB';
  });
  page.addEventListener('submit',async event=>{
   const form=event.target.closest('[data-pricing-payment-form]');if(!form)return;
   event.preventDefault();showError(page,'');if(!selectedPlan){showError(page,'Choose a plan first.');return;}
   const file=form.elements.screenshot.files?.[0];if(!file){showError(page,'Please upload your payment screenshot or PDF receipt.');return;}
   if(file.size>5*1024*1024){showError(page,'The proof file must be 5 MB or smaller.');return;}
   const submit=form.querySelector('[data-pricing-submit]'),original=submit.textContent;submit.disabled=true;submit.textContent='Submitting…';
   try{
    const payload=new FormData(form);payload.set('plan',selectedPlan.key);payload.set('amount',String(selectedPlan.amount));
    const result=await Auth.upload('/subscription/payment-proof',payload,{timeout:45000});
    if(!result.success||!result.reference_id)throw Error('The server did not confirm that the proof was saved.');
    page.querySelector('[data-pricing-reference]').textContent=result.reference_id;
    page.querySelector('[data-pricing-form-state]').hidden=true;page.querySelector('[data-pricing-success]').hidden=false;
   }catch(error){showError(page,error.message||'Your proof could not be submitted. Please try again.');}
   finally{submit.disabled=false;submit.textContent=original;}
  });
  page.querySelector('[data-pricing-dialog]')?.addEventListener('click',event=>{if(event.target===page.querySelector('[data-pricing-dialog]'))closeDialog(event.target);});
 }
 window.MCQCampusPageHooks=window.MCQCampusPageHooks||Object.create(null);
 window.MCQCampusPageHooks.pricing={afterRender:afterRender};
 return {render,afterRender};
})();
