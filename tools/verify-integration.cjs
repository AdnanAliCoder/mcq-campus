const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const frontend=path.join(root,'frontend');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name)}

for(const name of fs.readdirSync(path.join(frontend,'assets/js')).filter(x=>x.endsWith('.js'))){
 const result=cp.spawnSync(process.execPath,['--check',path.join(frontend,'assets/js',name)],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr||result.stdout);
}
test('All frontend JavaScript parses',()=>{});

const html=fs.readFileSync(path.join(root,'templates/index.html'),'utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
test('Final frontend and backend adapter load in the required order',()=>{
 const required=['assets/js/service.js','assets/js/ui.js','assets/js/public-layout.js','assets/js/public.js','assets/js/admin.js','assets/js/motion.js','assets/js/enhancements.js','assets/js/auth.js','assets/js/app.js'];
 for(const file of required){assert(scripts.includes(file),file+' missing');assert(fs.existsSync(path.join(frontend,file)),file+' not found')}
 assert(scripts.indexOf('assets/js/public-layout.js')<scripts.indexOf('assets/js/public.js'));
 assert(scripts.indexOf('assets/js/auth.js')<scripts.indexOf('assets/js/app.js'));
 assert(!html.includes('demo-data.js'));
 assert(!html.includes('demo-adapter.js'));
});

test('Loading system is asset-free, CSS-based and non-blocking by default',()=>{
 assert(html.includes('id="backend-loader"'));
 assert(html.includes('app-loader-spinner'));
 assert(html.includes('global-spinner'));
 assert(!html.includes('.webm'));
 const mediaFiles=fs.readdirSync(path.join(frontend,'assets/images'));
 assert(!mediaFiles.some(name=>/\.(webm|mp4|gif)$/i.test(name)),'loader media assets should not be packaged');
 const css=fs.readFileSync(path.join(frontend,'assets/css/styles.css'),'utf8');
 assert(css.includes('.app-loader-spinner'));
 assert(css.includes('.button-loader-spinner'));
 assert(css.includes('@keyframes mcq-loader-spin'));
 assert(css.includes('animation-name:mcq-loader-spin'));
 assert(css.includes('animation-iteration-count:infinite'));
 assert(css.includes('.mcq-spinner'));
 assert(css.includes('.global-spinner'));
 assert(css.includes('.button-spinner'));
 assert(css.includes('position:fixed'));
 assert(css.includes('backdrop-filter:blur(5px)'));
 assert(!html.includes('<video'));
});

const service=fs.readFileSync(path.join(frontend,'assets/js/service.js'),'utf8');
const auth=fs.readFileSync(path.join(frontend,'assets/js/auth.js'),'utf8');
test('Database API is authoritative for authentication and persistent writes',()=>{
 assert(service.includes('function hydrate(snapshot,user)'));
 assert(service.includes('function mergeCore(snapshot)'));
 assert(auth.includes("credentials:'same-origin'"));
 assert(auth.includes("request('/startup')"));
 assert(auth.includes("endpoint='/bootstrap'"));
 assert(auth.includes("'/commands'"));
 assert(auth.includes('backendLoading(true)'));
 assert(auth.includes('finally{backendLoading(false)'));
 assert(auth.includes("async function request(path,body,{loading=false,timeout=15000}={})"));
 assert(auth.includes("timeout:action==='action:import-confirm'?60000:15000"));
 assert(auth.includes('setButtonLoading'));
 assert(auth.includes("action==='action:import-confirm'"));
 assert(auth.includes('let majorTransition=null'));
 assert(auth.includes('UI.closeDropdowns();'));
 assert(auth.includes("request('/auth/switch-role',{role})"));
 assert(auth.includes("request('/auth/logout',{})"));
 assert(auth.includes('backendLoading(true)'));
 assert(auth.includes('applyCommandResult'));
 assert(!auth.includes('if(!data.snapshot)'));
 assert(auth.includes("if(data.refresh==='bootstrap')"));
 assert(!auth.includes("hydrate(data.snapshot,data.user)"));
 const logoutBlock=auth.slice(auth.indexOf('async function logout()'),auth.indexOf('async function start()'));
 assert(!logoutBlock.includes('await check()'),'logout must not re-bootstrap');
 assert(service.includes('function upsert(type,row)'));
 assert(service.includes('function remove(type,idsToRemove)'));
 const authSubmitStart=auth.indexOf("const data=await request('/auth/'+endpoint,values)");
 const loginStart=auth.indexOf("if(type==='login')",authSubmitStart);
 const loginEnd=auth.indexOf("}else",loginStart);
 const loginBlock=auth.slice(loginStart,loginEnd);
 assert(authSubmitStart>=0&&loginStart>=0&&loginEnd>loginStart);
 assert(!loginBlock.includes("request('/bootstrap')"),'login must not wait for bootstrap');
 assert(auth.includes('async function validateSession(force=false)'));
 assert(auth.includes('now-lastSessionValidation<300000'));
 const visibilityBlock=auth.slice(auth.indexOf("document.addEventListener('visibilitychange'"),auth.indexOf("document.addEventListener('input'"));
 assert(!visibilityBlock.includes('check()'),'tab restore must not run full check/bootstrap');
 assert(auth.includes("endpoint='/admin/'+key"));
 assert(auth.includes('const unique=[...new Set(wants)]'));
 assert(!auth.includes("wants.push('overview','users')"),'overview must not preload users');
 assert(auth.includes('ensureRouteData'));
});

test('Auth/startup architecture avoids large repeated profile payloads',()=>{
 const serializers=fs.readFileSync(path.join(root,'core/serializers.py'),'utf8');
 const services=fs.readFileSync(path.join(root,'core/services.py'),'utf8');
 assert(serializers.includes('def user_identity_dict'));
 assert(serializers.includes('def user_profile_dict'));
 assert(!serializers.slice(serializers.indexOf('def user_identity_dict'),serializers.indexOf('def user_profile_dict')).includes("'avatar'"));
 const snapshot=services.slice(services.indexOf('def snapshot(user):'),services.indexOf('def learner_dashboard_data'));
 assert(!snapshot.includes('Attempt.objects'));
 assert(!snapshot.includes('Bookmark.objects'));
 assert(!snapshot.includes('SavedPaper.objects'));
 assert(!snapshot.includes('Post.objects'));
 assert(!snapshot.includes('Guide.objects'));
 assert(!snapshot.includes('AdPlacement.objects'));
 assert(services.includes('def public_content_data'));
});

test('No demo data/adapters or Render configuration are packaged',()=>{
 const forbidden=['demo/demo-data.js','demo/demo-adapter.js','render.yaml','private-data/seed.json','core/management/commands/import_seed.py'];
 for(const rel of forbidden)assert(!fs.existsSync(path.join(root,rel)),rel+' should not exist');
});

console.log(`\n${count} integration groups passed.`);



test('Bulk import complete-data preview exposes merged hierarchy clearly',()=>{
 const admin=fs.readFileSync(path.join(frontend,'assets/js/admin.js'),'utf8');
 assert(admin.includes('Each visible row is one final MCQ candidate.'));
 assert(admin.includes('class="admin-mcq-full-table import-preview-table"'));
 assert(admin.includes('<th class="mcq-col-meta">Organization / Board</th>'));
 assert(admin.includes('<th class="mcq-col-meta">Past Paper</th>'));
 assert(!admin.includes('<th class="mcq-col-meta">Job / Post</th>'));
 assert(admin.includes('Final stored MCQ data'));
 assert(admin.includes('const importedFull=imported.length?table(imported,false)'));
});


test('Admin MCQ pagination stays low-egress and progressive',()=>{
 const auth=fs.readFileSync(path.join(frontend,'assets/js/auth.js'),'utf8');
 const admin=fs.readFileSync(path.join(frontend,'assets/js/admin.js'),'utf8');
 const services=fs.readFileSync(path.join(root,'core/services.py'),'utf8');
 const views=fs.readFileSync(path.join(root,'core/views.py'),'utf8');
 assert(auth.includes('const ADMIN_PAGE_SIZES=[10],ADMIN_DEFAULT_PAGE_SIZE=10;'));
 assert(admin.includes('const ADMIN_MCQ_PAGE_SIZE=10,IMPORT_PAGE_SIZE=50;'));
 assert(admin.includes('function progressivePageNumbers'));
 assert(admin.includes("btn('Next ›','import-page'"));
 assert(!admin.includes('Show entries'));
 assert(services.includes("max_page_size=50 if is_admin(user)"));
 assert(services.includes("'importedIds':imported_ids"));
 assert(services.includes("'pageSize':50"));
 assert(views.includes("'ids'"));
});


test('Public and hierarchy lists use click-triggered ten-row database pages',()=>{
 const auth=fs.readFileSync(path.join(frontend,'assets/js/auth.js'),'utf8');
 const publicJs=fs.readFileSync(path.join(frontend,'assets/js/public.js'),'utf8');
 const admin=fs.readFileSync(path.join(frontend,'assets/js/admin.js'),'utf8');
 const ui=fs.readFileSync(path.join(frontend,'assets/js/ui.js'),'utf8');
 const services=fs.readFileSync(path.join(root,'core/services.py'),'utf8');
 const views=fs.readFileSync(path.join(root,'core/views.py'),'utf8');
 assert(auth.includes("wants.push('public-mcqs')"));
 assert(auth.includes("wants.push('entity-page')"));
 assert(auth.includes("q.set('page_size',String(['mcq','practice'].includes(resolvedBase)?1:10))"));
 assert(auth.includes("return '/entities?'"));
 assert(publicJs.includes('only 10 load per page'));
 assert(publicJs.includes('activeServerMcqPage'));
 assert(publicJs.includes('activeEntityPage'));
 assert(admin.includes('10 load per page'));
 assert(ui.includes('Math.floor((current-1)/5)*5+1'));
 assert(services.includes('def entity_page_data'));
 assert(services.includes("'siteCounts':site_counts"));
 assert(services.includes("page_size=10"));
 assert(views.includes("def entities(request):"));
});
