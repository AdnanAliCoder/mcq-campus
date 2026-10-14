/* Strict UTF-8 TXT / RFC-style CSV / JSON importer. No numeric coercion of options. */
window.Importer=(()=>{
 const fields={question:'question',option1:'option1',option2:'option2',option3:'option3',option4:'option4',correctanswer:'correct_answer',description:'description',category:'category',paper:'paper',organizationboard:'paper',pastpaper:'pastpaper',job:'job',jobyear:'jobyear',categoryid:'category_id',paperid:'paper_id',jobids:'job_ids',jobyearsids:'job_years_ids'};
 const key=k=>fields[k.toLowerCase().replace(/[^a-z0-9]/g,'')]||k;
 function csv(text){let rows=[],row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else if(!cell||quote)quote=!quote;else throw Error('Unexpected quote in CSV field.')}else if(c===','&&!quote){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quote)throw Error('Unclosed quoted CSV field.');if(cell||row.length){row.push(cell);rows.push(row)}const headers=rows.shift()?.map(h=>key(h.trim()));if(!headers||!headers.includes('question'))throw Error('CSV needs a Question header.');if(new Set(headers).size!==headers.length)throw Error('CSV contains duplicate column headers.');return rows.map((r,i)=>{const o=Object.fromEntries(headers.map((h,j)=>[h,r[j]??'']));if(r.length!==headers.length)o._parseError='Column count does not match headers.';return o})}
 function txt(text){const chunks=text.trim().split(/\n\s*\n(?=\S)/);return chunks.filter(x=>x.trim()).map(block=>{const lines=block.split('\n').map(x=>x.trim());let o={};let pos=0,last='';for(const line of lines){const m=line.match(/^(Question|Option\s*[1-4]|Correct Answer|Category|Organization\s*\/\s*Board|Past Paper|Paper|Job|Job Year|Description)\s*:\s*(.*)$/i);if(m){last=key(m[1]);o[last]=m[2]}else if(pos<5&&!last){o[pos===0?'question':'option'+pos]=line;pos++}else if(last==='description')o.description+='\n'+line;else o._parseError='Unexpected line: '+line}return o})}
 function parse(text,ext){text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');if(ext==='csv')return csv(text);if(ext==='txt')return txt(text);if(ext==='json'){const d=JSON.parse(text);const rows=Array.isArray(d)?d:d.mcqs||d.data;if(!Array.isArray(rows))throw Error('JSON must be an array or an object containing an mcqs/data array.');return rows.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r))return {_parseError:'Row must be an object.'};return Object.fromEntries(Object.entries(r).map(([k,v])=>[key(k),v]))})}throw Error('Choose a TXT, CSV or JSON file.')}
 function resolveName(type,value,parentIds){const names=Array.isArray(value)?value:String(value??'').split('|').filter(Boolean);const parent=MCQ.parents[type];return names.map(name=>{const matches=MCQ.db[type].filter(x=>(type!=='categories'||!x.legacy)&&MCQ.norm(x.name)===MCQ.norm(name)&&(!parent||parentIds.includes(x[parent[1]]))&&(type!=='categories'||!MCQ.db.activeCountry||(x.country||'Pakistan')==='Both'||MCQ.norm(x.country||'Pakistan')===MCQ.norm(MCQ.db.activeCountry)));if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Unknown')+' '+type+': '+name);return matches[0].id})}
 function normalize(raw){const q={question:String(raw.question??'').trim(),description:String(raw.description??''),correct_answer:String(raw.correct_answer??'').trim(),subcategory_ids:[],child_subcategory_ids:[]};for(let i=1;i<=4;i++)q['option'+i]=String(raw['option'+i]??'').trim();q.category_id=raw.category_id?+raw.category_id:resolveName('categories',raw.category,[])[0];q.paper_id=raw.paper_id?MCQ.ids(raw.paper_id):resolveName('papers',raw.paper,[]);q.job_ids=raw.job_ids?MCQ.ids(raw.job_ids):[];const pastPaperValue=raw.pastpaper??raw.jobyear;q.job_years_ids=raw.job_years_ids?MCQ.ids(raw.job_years_ids):resolveName('years',pastPaperValue,q.paper_id);return q}
 function identityKey(value){return String(value??'').normalize('NFKC').replace(/\u00a0/g,' ').trim().toLowerCase().replace(/\s+/g,' ')}
 function prepareRows(rows){
  const groups=new Map,out=[];
  const add=(a,b)=>[...new Set([...MCQ.ids(a),...MCQ.ids(b)].map(Number).filter(Boolean))];
  for(const row of rows||[]){
   if(!row?.q||row.status==='invalid'){out.push(row);continue}
   const key=identityKey(row.q.question);
   if(!groups.has(key)){
    const copy={...row,q:{...row.q,paper_id:MCQ.ids(row.q.paper_id),job_ids:MCQ.ids(row.q.job_ids),job_years_ids:MCQ.ids(row.q.job_years_ids)},mergedRows:0,duplicateRows:0};
    groups.set(key,copy);out.push(copy);continue;
   }
   const base=groups.get(key);
   const before={p:MCQ.ids(base.q.paper_id),j:MCQ.ids(base.q.job_ids),y:MCQ.ids(base.q.job_years_ids)};
   base.q.paper_id=add(base.q.paper_id,row.q.paper_id);
   base.q.job_ids=add(base.q.job_ids,row.q.job_ids);
   base.q.job_years_ids=add(base.q.job_years_ids,row.q.job_years_ids);
   const changed=base.q.paper_id.length>before.p.length||base.q.job_ids.length>before.j.length||base.q.job_years_ids.length>before.y.length;
   if(changed)base.mergedRows=(base.mergedRows||0)+1;
   else base.duplicateRows=(base.duplicateRows||0)+1;
  }
  return out
 }
 function preview(raws){
  const normalized=raws.map((raw,i)=>{
   let row={line:i+1,raw,question:raw.question||'',errors:[],status:'valid'};
   try{
    row.q=normalize(raw);
    row.errors=MCQ.validate(row.q);
    if(raw._parseError)row.errors.unshift(raw._parseError);
    if(row.errors.length)row.status='invalid';
   }catch(e){row.status='invalid';row.errors=[e.message]}
   return row
  });
  return prepareRows(normalized).map(row=>{
   if(row.status==='invalid'||!row.q)return row;
   const existing=MCQ.db.mcqs.find(x=>identityKey(x.question)===identityKey(row.q.question));
   const ids=v=>[...new Set(MCQ.ids(v).map(Number).filter(Boolean))];
   const current=existing?{p:ids(existing.paper_id),j:ids(existing.job_ids),y:ids(existing.job_years_ids)}:{p:[],j:[],y:[]};
   const incoming={p:ids(row.q.paper_id),j:ids(row.q.job_ids),y:ids(row.q.job_years_ids)};
   const hasNew=incoming.p.some(x=>!current.p.includes(x))||incoming.j.some(x=>!current.j.includes(x))||incoming.y.some(x=>!current.y.includes(x));
   row.existing=existing&&MCQ.managedRows('mcqs').some(q=>q.id===existing.id)?existing.id:undefined;
   if(existing&&!hasNew){
    row.status='duplicate';
    row.errors=['Duplicate ignored: this question already has the same Organization / Board / Past Paper links.'];
   }else if(existing){
    row.status='update';
    row.errors=['Existing website MCQ: new unique Organization / Board / Past Paper links will be added to the stored MCQ.'+(row.mergedRows?' '+row.mergedRows+' repeated upload row(s) were consolidated first.':'')+(row.duplicateRows?' '+row.duplicateRows+' exact duplicate row(s) ignored.':'')];
   }else if(row.mergedRows){
    row.status='merge';
    row.errors=['Repeated question in this upload: unique Organization / Board and Past Paper links were combined into one MCQ.'+(row.duplicateRows?' '+row.duplicateRows+' exact duplicate row(s) ignored.':'')];
   }else{
    row.status='valid';
    if(row.duplicateRows)row.errors=[row.duplicateRows+' exact duplicate row(s) ignored.'];
   }
   return row
  })
 }
 return {parse,preview,prepareRows,normalize,csv};
})();
