/* Strict UTF-8 TXT / RFC-style CSV / JSON importer. No numeric coercion of options. */
window.Importer=(()=>{
 const fields={question:'question',option1:'option1',option2:'option2',option3:'option3',option4:'option4',correctanswer:'correct_answer',description:'description',category:'category',paper:'paper',job:'job',jobyear:'jobyear',categoryid:'category_id',paperid:'paper_id',jobids:'job_ids',jobyearsids:'job_years_ids'};
 const key=k=>fields[k.toLowerCase().replace(/[^a-z0-9]/g,'')]||k;
 function csv(text){let rows=[],row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else if(!cell||quote)quote=!quote;else throw Error('Unexpected quote in CSV field.')}else if(c===','&&!quote){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quote)throw Error('Unclosed quoted CSV field.');if(cell||row.length){row.push(cell);rows.push(row)}const headers=rows.shift()?.map(h=>key(h.trim()));if(!headers||!headers.includes('question'))throw Error('CSV needs a Question header.');if(new Set(headers).size!==headers.length)throw Error('CSV contains duplicate column headers.');return rows.map((r,i)=>{const o=Object.fromEntries(headers.map((h,j)=>[h,r[j]??'']));if(r.length!==headers.length)o._parseError='Column count does not match headers.';return o})}
 function txt(text){const chunks=text.trim().split(/\n\s*\n(?=\S)/);return chunks.filter(x=>x.trim()).map(block=>{const lines=block.split('\n').map(x=>x.trim());let o={};let pos=0,last='';for(const line of lines){const m=line.match(/^(Question|Option\s*[1-4]|Correct Answer|Category|Paper|Job|Job Year|Description)\s*:\s*(.*)$/i);if(m){last=key(m[1]);o[last]=m[2]}else if(pos<5&&!last){o[pos===0?'question':'option'+pos]=line;pos++}else if(last==='description')o.description+='\n'+line;else o._parseError='Unexpected line: '+line}return o})}
 function parse(text,ext){text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');if(ext==='csv')return csv(text);if(ext==='txt')return txt(text);if(ext==='json'){const d=JSON.parse(text);const rows=Array.isArray(d)?d:d.mcqs||d.data;if(!Array.isArray(rows))throw Error('JSON must be an array or an object containing an mcqs/data array.');return rows.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r))return {_parseError:'Row must be an object.'};return Object.fromEntries(Object.entries(r).map(([k,v])=>[key(k),v]))})}throw Error('Choose a TXT, CSV or JSON file.')}
 function resolveName(type,value,parentIds){const names=Array.isArray(value)?value:String(value??'').split('|').filter(Boolean);const parent=MCQ.parents[type];return names.map(name=>{const matches=MCQ.db[type].filter(x=>(type!=='categories'||!x.legacy)&&MCQ.norm(x.name)===MCQ.norm(name)&&(!parent||parentIds.includes(x[parent[1]])));if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Unknown')+' '+type+': '+name);return matches[0].id})}
 function normalize(raw){const q={question:String(raw.question??'').trim(),description:String(raw.description??''),correct_answer:String(raw.correct_answer??'').trim(),subcategory_ids:[],child_subcategory_ids:[]};for(let i=1;i<=4;i++)q['option'+i]=String(raw['option'+i]??'').trim();q.category_id=raw.category_id?+raw.category_id:resolveName('categories',raw.category,[])[0];q.paper_id=raw.paper_id?MCQ.ids(raw.paper_id):resolveName('papers',raw.paper,[]);q.job_ids=raw.job_ids?MCQ.ids(raw.job_ids):resolveName('jobs',raw.job,q.paper_id);q.job_years_ids=raw.job_years_ids?MCQ.ids(raw.job_years_ids):resolveName('years',raw.jobyear,q.job_ids);return q}
 function preview(raws){
  const seen=new Map;
  const ids=v=>[...new Set(MCQ.ids(v).map(Number).filter(Boolean))].sort((a,b)=>a-b);
  const hierarchy=q=>({papers:ids(q.paper_id),jobs:ids(q.job_ids),years:ids(q.job_years_ids)});
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  const hasNew=(base,next)=>next.papers.some(x=>!base.papers.includes(x))||next.jobs.some(x=>!base.jobs.includes(x))||next.years.some(x=>!base.years.includes(x));
  const mergeHierarchy=(a,b)=>({papers:ids([...a.papers,...b.papers]),jobs:ids([...a.jobs,...b.jobs]),years:ids([...a.years,...b.years])});
  return raws.map((raw,i)=>{
   let row={line:i+1,raw,question:raw.question||'',errors:[],status:'valid'};
   try{
    row.q=normalize(raw);row.errors=MCQ.validate(row.q);if(raw._parseError)row.errors.unshift(raw._parseError);
    const n=MCQ.norm(row.q.question),incoming=hierarchy(row.q),existing=MCQ.db.mcqs.find(x=>MCQ.norm(x.question)===n);
    if(!row.errors.length){
     if(existing){
      const current=hierarchy(existing);
      if(hasNew(current,incoming)){
       row.status='merge';row.existing=MCQ.managedRows('mcqs').some(q=>q.id===existing.id)?existing.id:undefined;
       row.errors.push('Existing MCQ found: new Paper / Job / Job Year links will be added to the same MCQ.');
      }else{
       row.status='duplicate';row.existing=MCQ.managedRows('mcqs').some(q=>q.id===existing.id)?existing.id:undefined;
       row.errors.push('Duplicate ignored: Question, Paper, Job and Job Year are already linked.');
      }
     }else if(seen.has(n)){
      const current=seen.get(n);
      if(hasNew(current,incoming)){
       row.status='merge';row.errors.push('Repeated in this upload: new hierarchy links will be merged into one MCQ.');
       seen.set(n,mergeHierarchy(current,incoming));
      }else{
       row.status='duplicate';row.errors.push('Duplicate ignored: same Question, Paper, Job and Job Year already appear in this upload.');
      }
     }else seen.set(n,incoming);
    }else row.status='invalid';
    if(!seen.has(n)&&row.status!=='invalid')seen.set(n,incoming);
   }catch(e){row.status='invalid';row.errors=[e.message]}
   return row
  })
 }
 function commit(rows){MCQ.assert('import');const summary={total:rows.length,valid:rows.filter(r=>r.status==='valid').length,imported:0,duplicates:rows.filter(r=>r.status==='duplicate').length,invalid:rows.filter(r=>r.status==='invalid').length,failed:0};for(const row of rows){if(row.status!=='valid')continue;try{MCQ.saveMcq(row.q);row.status='imported';summary.imported++}catch(e){row.errors=[e.message];row.status=e.existing?'duplicate':'failed';if(e.existing)summary.duplicates++;else summary.failed++}}return summary}
 return {parse,preview,commit,normalize,csv};
})();
