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
