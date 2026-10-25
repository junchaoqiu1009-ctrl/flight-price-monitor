import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const core=(await readFile(new URL('src/core.mjs',root),'utf8')).replace(/^export /gm,'');
const app=(await readFile(new URL('src/app.mjs',root),'utf8')).replace(/^import .*?;\n/,'');
const worker=core+'\nself.onmessage=e=>{try{self.postMessage({ok:true,data:search(e.data)})}catch(error){self.postMessage({ok:false,error:error.message})}};';
const script=core+'\nconst WORKER_SOURCE='+JSON.stringify(worker)+';\n'+app;
const readCSS=await readFile(new URL('src/style.css',root),'utf8');
const html=(await readFile(new URL('src/template.html',root),'utf8')).replace('/*STYLE*/',()=>readCSS).replace('/*SCRIPT*/',()=>script.replace(/<\/script/gi,'<\\/script'));

for(const name of ['flight-price-monitor-v1.html','flight-price-monitor-v1-a.html'])await writeFile(new URL(name,root),html);
console.log('已生成三步式 A/B 独立 HTML，并覆盖旧 A 模式输出文件。');
