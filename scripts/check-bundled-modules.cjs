'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=['frontend/js/bootstrap.js','frontend/js/admin-loader.js','frontend/js/integrations.js',
'frontend/js/modules/service.js','frontend/js/modules/ui.js','frontend/js/modules/public-layout.js',
'frontend/js/modules/public.js','frontend/js/modules/carousel.js','frontend/js/modules/seo.js',
'frontend/js/modules/motion.js','frontend/js/modules/auth.js','frontend/js/app.js',
'frontend/js/admin/importer.js','frontend/js/admin/enhancements.js','frontend/js/admin/admin.js'];
let failed=false;
for(const relative of files){const file=path.join(root,relative);if(!fs.existsSync(file)){console.error('Missing frontend module:',relative);failed=true;continue}
const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(result.status!==0){console.error('Syntax check failed:',relative);if(result.stderr)process.stderr.write(result.stderr);failed=true}else console.log('Syntax OK:',relative)}
if(failed)process.exit(1);
