import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const core=(await readFile(new URL('src/core.mjs',root),'utf8')).replace(/^export /gm,'');
const app=(await readFile(new URL('src/app.mjs',root),'utf8')).replace(/^import .*?;\n/,'');
const worker=core+'\nself.onmessage=e=>{try{self.postMessage({ok:true,data:search(e.data)})}catch(error){self.postMessage({ok:false,error:error.message})}};';
const script=core+'\nconst WORKER_SOURCE='+JSON.stringify(worker)+';\n'+app;
const html=(await readFile(new URL('src/template.html',root),'utf8')).replace('/*STYLE*/',await readFile(new URL('src/style.css',root),'utf8')).replace('/*SCRIPT*/',()=>script.replace(/<\/script/gi,'<\\/script'));
await writeFile(new URL('flight-price-monitor-v1-a.html',root),html);console.log('已生成独立 HTML：flight-price-monitor-v1-a.html');
