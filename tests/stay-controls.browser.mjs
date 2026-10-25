// 开发用 Playwright 检查；不影响用户双击 HTML，也不增加运行依赖。
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=await readFile(new URL('../flight-price-monitor-v1.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://stay-controls.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://stay-controls.test/');
 const min=i=>page.locator('input[data-min="'+i+'"]'),max=i=>page.locator('input[data-max="'+i+'"]');
 const button=(i,field,delta)=>page.locator('[data-stay-index="'+i+'"][data-stay-field="'+field+'"][data-stay-delta="'+delta+'"]');
 async function pair(i,a,b){assert.equal(await min(i).inputValue(),String(a));assert.equal(await max(i).inputValue(),String(b));assert.deepEqual(await page.evaluate(i=>({min:config.stops[i].min,max:config.stops[i].max}),i),{min:a,max:b});assert.equal(await page.locator('#notice.error').count(),0)}
 async function cases(i){
  await min(i).fill('5');await max(i).fill('7');await min(i).fill('8');await pair(i,8,8);
  await max(i).fill('15');await max(i).fill('6');await pair(i,6,6);
  await min(i).fill('8');await max(i).fill('15');await min(i).fill('10');await pair(i,10,15);
  await min(i).fill('8');await max(i).fill('15');await max(i).fill('20');await pair(i,8,20);
  await min(i).fill('5');await max(i).fill('7');for(let n=6;n<=8;n++){await button(i,'min',1).click();await pair(i,n,Math.max(7,n))}
  await max(i).fill('15');for(let n=14;n>=6;n--){await button(i,'max',-1).click();await pair(i,Math.min(8,n),n)}
 }
 assert.equal(await page.locator('#stops input[type="number"]').count(),0);assert.equal(await min(0).getAttribute('type'),'text');await min(0).fill('16');await pair(0,16,16);assert.match(await page.locator('.fixed-stop').first().textContent(),/广州/);await cases(0);
 await page.locator('[data-mode="B"]').click();await page.locator('[data-city="0"]').selectOption('SYD');await cases(0);
 await page.locator('#add-stop').click();const added=await page.locator('#stops .stop').count()-1;await cases(added);assert.equal(await min(added).getAttribute('type'),'text');await page.locator('summary').filter({hasText:'路线限制'}).click();await page.locator('#custom-code').fill('DAD');await page.locator('#custom-name').fill('岘港');await page.locator('#add-city').click();await page.locator('[data-city="'+added+'"]').selectOption('DAD');await cases(added);
 // 下方总旅行天数继续通过四组直接输入场景，且不按Enter、不失焦、不重载。
 for(const [beforeA,beforeB,id,value,a,b] of [[5,7,'durationMin',8,8,8],[8,15,'durationMax',6,6,6],[8,15,'durationMin',10,10,15],[8,15,'durationMax',20,8,20]]){
  await page.locator('#durationMin').fill(String(beforeA));await page.locator('#durationMax').fill(String(beforeB));await page.locator('#'+id).fill(String(value));assert.equal(await page.locator('#durationMin').inputValue(),String(a));assert.equal(await page.locator('#durationMax').inputValue(),String(b));assert.equal(await page.locator('#notice.error').count(),0);
 }
 for(const width of [390,768,1024,1440]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);for(const el of await page.locator('[data-stay-delta]').all()){const box=await el.boundingBox();assert.ok(box.width>=44&&box.height>=44)}for(const input of await page.locator('#stops input').all())assert.equal(await input.getAttribute('type'),'text')}
 // A/B独立、保存重开，重新生成的行仍然有按钮。
 await page.reload();assert.equal(await page.locator('[data-city="0"]').inputValue(),'SYD');assert.equal(await page.locator('#stops input[type="number"]').count(),0);await page.locator('[data-mode="A"]').click();assert.equal(await min(0).inputValue(),'6');assert.equal(await max(0).inputValue(),'6');
 await min(0).fill('16');await max(0).fill('16');await page.setViewportSize({width:1440,height:1100});await page.locator('#stops').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.STAY_SCREENSHOT||'/tmp/flight-stay-controls.png'});assert.deepEqual(errors,[]);
 console.log('通过：广州16～16无spinner；广州/悉尼/新增城市的大按钮均≥44×44；四组上下限输入及实际点击即时同步，无范围红色提示；下方总天数四场景也通过；A/B保存与四种宽度正常。');
}finally{await browser.close()}
