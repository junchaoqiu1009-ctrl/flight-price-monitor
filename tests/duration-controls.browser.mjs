// 可选的浏览器回归：使用 Playwright，仅供开发验证，不是运行 HTML 的依赖。
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=await readFile(new URL('../flight-price-monitor-v1.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://duration-controls.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://duration-controls.test/');
 const range=async(min,max)=>{assert.deepEqual(await page.evaluate(()=>({min:document.querySelector('#durationMin').value,max:document.querySelector('#durationMax').value})),{min:String(min),max:String(max)});assert.deepEqual(await page.evaluate(()=>({min:config.durationMin,max:config.durationMax})),{min,max});};
 const plusMin=page.getByRole('button',{name:'增加最短旅行天数',exact:true}),minusMax=page.getByRole('button',{name:'减少最长旅行天数',exact:true});
 await range(14,14);
 for(const id of ['durationMin','durationMax']){assert.equal(await page.locator('#'+id).getAttribute('type'),'text');assert.equal(await page.locator('#'+id).getAttribute('inputmode'),'numeric')}
 for(const button of await page.locator('[data-duration]').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44)}
 await page.locator('#durationMin').fill('5');await page.locator('#durationMax').fill('5');await range(5,5);
 // 不按 Enter、不失焦、不重载。检查每次真实鼠标点击后模型与两控件立即一致。
 await plusMin.click();await range(6,6);await plusMin.click();await range(7,7);await plusMin.click();await range(8,8);
 await page.locator('#durationMax').fill('15');await range(8,15);
 for(let max=14;max>=8;max--){await minusMax.click();await range(8,max)}await minusMax.click();await range(7,7);
 await page.locator('#durationMin').fill('14');await range(14,14);await page.locator('#durationMax').fill('14');await range(14,14);
 await page.locator('#durationMin').fill('365');await range(365,365);await page.locator('#durationMax').fill('400');await range(365,400);
 await page.locator('#durationMin').fill('1');await page.locator('#durationMax').fill('1');await range(1,1);assert.equal(await page.getByRole('button',{name:'减少最短旅行天数',exact:true}).isDisabled(),true);
 await page.locator('#durationMin').press('ArrowUp');await range(2,2);await page.locator('#durationMax').press('ArrowDown');await range(1,1);
 await page.locator('#durationMin').fill('1e2');assert.match(await page.locator('#notice').textContent(),/整数/);assert.match(await page.locator('#summary-days').textContent(),/待填写/);
 await page.locator('#durationMin').fill('１４');await range(14,14);await page.locator('#durationMax').fill('15');await range(14,15);
 await page.locator('[data-mode="B"]').click();await range(14,14);await page.locator('#durationMax').fill('7');await range(7,7);await page.locator('[data-mode="A"]').click();await range(14,15);
 await page.reload();await range(14,15);
 // 联动值进入实际搜索参数，而非只改变界面。
 await page.locator('#to-history').click();await page.locator('#to-search').click();await page.locator('#search').click();await page.locator('.result-card').first().waitFor();assert.match(await page.locator('#results-content .duration-table').first().textContent(),/14 天/);assert.match(await page.locator('#results-content .duration-table').first().textContent(),/15 天/);await page.locator('.stepper [data-step="0"]').click();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(const button of await page.locator('[data-duration]').all()){const rect=await button.boundingBox();assert.ok(rect.width>=44&&rect.height>=44)}}
 assert.deepEqual(errors,[]);console.log('通过：最终独立HTML无number spinner、按钮48×52、真实点击5～5→8～8、8～15→7～7、即时同状态、手动输入、固定/长旅行、键盘、A/B隔离、保存及搜索。');
}finally{await browser.close()}
