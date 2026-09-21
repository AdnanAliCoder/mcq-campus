// Dependency-free static development server. This is not the production backend.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2);const arg=(k,f)=>{const i=args.indexOf(k);return i>=0?args[i+1]:f};
const root=path.resolve(__dirname,'../frontend');const port=Number(arg('--port',process.env.PORT||4173));const host=arg('--host','0.0.0.0');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webm':'video/webm','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{let relative;try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end('Invalid URL');return}const file=path.resolve(root,'.'+relative+(relative.endsWith('/')?'index.html':''));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes)})}).listen(port,host,()=>console.log(`MCQ Campus static preview on port ${port}`));

