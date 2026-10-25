import {CITIES,defaultConfig,clone,money,citiesFor,validate,linkDurationRange,estimate,search,finalAirport,historicalCoverage,cabinFor,AIRLINES} from './core.mjs';
const $=id=>document.getElementById(id),KEY='flight-price-monitor-demand-v1-schema2';
const CABINS={economy:'经济舱',business:'商务舱',mixed:'混合舱位'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let profiles={A:defaultConfig('A'),B:defaultConfig('B')},saved={A:[],B:[]},mode='A',config=profiles.A,last=null,step=0,worker=null,generation=0,visible=20,cabinFilter='all',ticketFilter='all',storedProfiles=clone(profiles);
const numbers=['durationMin','durationMax','maxTickets','passengers','maxTransit'];
const booleans=['returnToOrigin','reorder','enforce','viaHKG','longTransit','baggage','redEye','missing'];
function notice(text,error=false){$('notice').className='notice'+(error?' error':'');$('notice').textContent=text}
function cityName(code){return citiesFor(config)[code]?.name||code}
function codes(text){return [...new Set(text.toUpperCase().split(/[,，\s]+/).filter(Boolean))]}
function read(){
 for(const key of ['origin','end','month','cabin','scope'])config[key]=$(key).value;
 for(const key of numbers)config[key]=['durationMin','durationMax'].includes(key)?durationValue($(key).value):$(key).value===''?NaN:Number($(key).value);
 for(const key of booleans)config[key]=$(key).checked;
 for(const key of ['allowed','required','avoid'])config[key]=codes($(key).value);
 if(mode==='A'){config.origin='MEL';config.returnToOrigin=true;config.end='MEL';config.reorder=false}
 if(config.returnToOrigin)config.end=config.origin;config.mode=mode;profiles[mode]=config;return config;
}
function cityOptions(current,excluded=[]){return Object.entries(citiesFor(config)).filter(([code])=>!excluded.includes(code)||code===current).map(([code,city])=>`<option value="${esc(code)}" ${code===current?'selected':''}>${esc(city.name)} ${esc(code)}</option>`).join('')}
function stayControl(index,field,value){
 const label='第'+(index+1)+'站'+(field==='min'?'最短':'最长')+'停留夜数';
 return `<div class="stay-control stay-${field}"><label class="stay-caption" for="stay-${index}-${field}">${field==='min'?'最短夜数':'最长夜数'}</label><div class="stay-stepper" role="group" aria-label="${label}"><button type="button" data-stay-index="${index}" data-stay-field="${field}" data-stay-delta="-1" aria-label="减少${label}" ${Number.isSafeInteger(value)&&value<=1?'disabled':''}>−</button><input id="stay-${index}-${field}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" role="spinbutton" aria-valuemin="1" ${Number.isSafeInteger(value)?'aria-valuenow="'+value+'"':''} data-${field}="${index}" value="${Number.isSafeInteger(value)?value:''}" aria-label="${label}"><button type="button" data-stay-index="${index}" data-stay-field="${field}" data-stay-delta="1" aria-label="增加${label}">＋</button></div></div>`;
}
function renderStayValues(index){
 const stop=config.stops[index];
 for(const field of ['min','max']){
  const input=$('stops').querySelector('input[data-'+field+'="'+index+'"]'),value=stop[field];
  input.value=Number.isSafeInteger(value)?String(value):'';
  if(Number.isSafeInteger(value))input.setAttribute('aria-valuenow',String(value));else input.removeAttribute('aria-valuenow');
  const minus=$('stops').querySelector('[data-stay-index="'+index+'"][data-stay-field="'+field+'"][data-stay-delta="-1"]');minus.disabled=Number.isSafeInteger(value)&&value<=1;
 }
}
function applyStay(index,field,value){
 const stop=config.stops[index],range=linkDurationRange(stop.min,stop.max,field,value);
 stop.min=range.min;stop.max=range.max;renderStayValues(index);edited();
}
function changeStay(index,field,input){
 const value=durationValue(input.value);
 if(!Number.isSafeInteger(value)){config.stops[index][field]=NaN;input.removeAttribute('aria-valuenow');edited();return}
 applyStay(index,field,value);
}
function stepStay(index,field,delta){
 const current=config.stops[index][field],base=Number.isSafeInteger(current)&&current>=1?current:delta>0?0:2,next=Math.max(1,base+delta);
 if(Number.isSafeInteger(next))applyStay(index,field,next);
}
function renderStops(){
 $('stops').innerHTML=config.stops.map((stop,i)=>{const locked=mode==='A'&&i===0,up=i>0&&!(mode==='A'&&i===1)&&stop.code!=='AUTO'&&config.stops[i-1]?.code!=='AUTO',down=i<config.stops.length-1&&!locked&&stop.code!=='AUTO'&&config.stops[i+1]?.code!=='AUTO';
 return `<div class="stop"><span class="stop-marker">${i+1}</span><div class="stop-city">${locked?'<div class="fixed-stop">广州 CAN <span>必停</span></div>':`<select data-city="${i}" aria-label="第${i+1}停留城市">${mode==='A'&&i===1?'<option value="AUTO" '+(stop.code==='AUTO'?'selected':'')+'>自动比较允许城市</option>':''}${cityOptions(stop.code,[config.origin,finalAirport(config),...(mode==='A'?['CAN']:[])])}</select>`}</div>${stayControl(i,'min',stop.min)}${stayControl(i,'max',stop.max)}<div class="stop-controls">${locked?'':`<button class="icon-btn" data-up="${i}" ${up?'':'disabled'} aria-label="上移第${i+1}站">↑</button><button class="icon-btn" data-down="${i}" ${down?'':'disabled'} aria-label="下移第${i+1}站">↓</button><button class="icon-btn" data-remove="${i}" aria-label="删除第${i+1}站">×</button>`}</div></div>`}).join('');
 $('add-stop').disabled=config.stops.length>=5;
 $('stops').querySelectorAll('[data-city]').forEach(el=>el.onchange=()=>{config.stops[Number(el.dataset.city)].code=el.value;renderStops();edited()});
 for(const field of ['min','max'])$('stops').querySelectorAll('input[data-'+field+']').forEach(el=>{
  const index=Number(el.dataset[field]);el.oninput=()=>changeStay(index,field,el);el.onchange=()=>changeStay(index,field,el);
  el.onkeydown=e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepStay(index,field,e.key==='ArrowUp'?1:-1)}};
 });
 $('stops').querySelectorAll('[data-stay-delta]').forEach(button=>button.onclick=()=>stepStay(Number(button.dataset.stayIndex),button.dataset.stayField,Number(button.dataset.stayDelta)));
 $('stops').querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{config.stops.splice(Number(el.dataset.remove),1);renderStops();edited()});
 for(const [name,delta] of [['up',-1],['down',1]])$('stops').querySelectorAll('[data-'+name+']').forEach(el=>el.onclick=()=>{const i=Number(el.dataset[name]);[config.stops[i],config.stops[i+delta]]=[config.stops[i+delta],config.stops[i]];renderStops();edited()});
}
function summary(){
 const route=[config.origin,...config.stops.map(s=>s.code==='AUTO'?'允许首站':s.code),finalAirport(config)];
 $('summary-route').innerHTML=route.map(esc).join('<span>→</span>');$('summary-mode').textContent=mode==='A'?'A · 个人专用':'B · 通用旅行';$('summary-month').textContent=config.month||'请选择';$('summary-days').textContent=(Number.isSafeInteger(config.durationMin)&&Number.isSafeInteger(config.durationMax)?(config.durationMin===config.durationMax?config.durationMin:config.durationMin+'～'+config.durationMax):'待填写')+' 天';
 $('side-mode').textContent=mode==='A'?'A · 个人专用':'B · 通用旅行';$('rule-badge').textContent=mode==='A'?'广州必停'+(config.enforce?' · 首站受限':' · 首站名单已关闭'):'自由起终点 · 无广州限制';
 $('mode-rule').textContent=mode==='A'?'A 模式必须 MEL 出发并返回、广州先停留；广州后首站默认只允许 BKK / SIN / KUL。转机不能替代正式停留。修改规则需要明确调整设置。':'B 模式无广州要求，可设置单程、往返或异地结束；若是无停留的单程，通常需要将总时长设为 1～2 天。不会继承 A 模式限制。';
 document.querySelectorAll('[data-mode]').forEach(el=>{const selected=el.dataset.mode===mode;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected))});
 $('saved-note').textContent='当前只显示 '+mode+' 模式的已保存方案；两个模式的设置和记录独立。模拟价格不会用于真实历史趋势。';
}
function hydrate(){
 $('origin').innerHTML=cityOptions(config.origin);$('end').innerHTML=cityOptions(finalAirport(config));
 for(const key of ['origin','end','month','cabin','scope',...numbers])$(key).value=Number.isNaN(config[key])?'':config[key];
 for(const key of booleans)$(key).checked=config[key];for(const key of ['allowed','required','avoid'])$(key).value=config[key].join(', ');
 $('origin').disabled=mode==='A';$('returnToOrigin').disabled=mode==='A';$('end').disabled=config.returnToOrigin;$('reorder').disabled=mode==='A';$('allowed-field').hidden=mode!=='A';$('enforce-field').hidden=mode!=='A';renderStops();summary();updateDurationButtons();
}
function setBusy(on){$('search').disabled=on;$('cancel').hidden=!on;$('scope').disabled=on;$('busy-label').textContent=on?'正在本地比较独立整票和拆票组合…':''}
function cancel(){generation++;worker?.terminate();worker=null;setBusy(false)}
function invalidate(){cancel();last=null;$('query-note').textContent='条件变化，旧结果已失效';$('results-content').innerHTML='<div class="empty">请按当前条件重新点击“开始搜索”。</div>'}
function persist(){
 for(const m of ['A','B']){try{validate(profiles[m]);storedProfiles[m]=clone(profiles[m])}catch{}}
 try{localStorage.setItem(KEY,JSON.stringify({schema:2,profiles:storedProfiles,saved,mode}));return true}catch{notice('浏览器不允许保存到本地。请导出 JSON 备份；本次仍可继续使用。',true);return false}
}
function edited(){read();invalidate();summary();try{validate(config);notice('');persist()}catch(e){notice(e.message,true)}if(step===2)renderBudget()}
function valid(){read();try{validate(config);notice('');return true}catch(e){notice(e.message,true);return false}}
function go(next){if(next>0&&!valid())return;step=next;for(let i=0;i<3;i++)$('step-'+i).hidden=i!==step;document.querySelectorAll('[data-step]').forEach(el=>{const selected=Number(el.dataset.step)===step;el.classList.toggle('selected',selected);el.classList.toggle('active',selected);if(selected)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')});if(step===1)renderHistory();if(step===2)renderBudget();document.querySelector('.stepper').scrollIntoView({block:'start',behavior:'smooth'})}
function renderHistory(){
 $('history-route').textContent=[config.origin,...config.stops.map(s=>s.code==='AUTO'?'允许首站':s.code),finalAirport(config)].join(' → ')+' · '+(CABINS[config.cabin]||'比较三种舱位')+' · 当前路线没有接入真实历史数据库';
 $('history-months').innerHTML=historicalCoverage().map(row=>`<tr><td>${esc(row.month)}</td><td>未取得有效样本</td><td>—</td><td>未接入可验证来源</td></tr>`).join('');
}
function renderBudget(){
 read();try{const b=estimate(config);$('search-summary').textContent=`${mode} 模式 · ${config.month} 出发 · ${config.durationMin}～${config.durationMax} 天 · ${config.passengers} 位成人 · ${CABINS[config.cabin]||'经济/商务/混合比较'}`;
 $('scope-hint').textContent=config.scope==='quick'?`将比较 ${b.dates} 个分布在月初、月中、月末的候选出发日；不代表覆盖整个月最低价，未使用虚构历史价格筛选。`:`将比较本月 ${b.monthDates} 个出发日；返程可跨月，结果仍仅属于本模拟目录和所设条件。`;
 $('budget').innerHTML=[['候选出发日',b.dates+' / '+b.monthDates,'日'],['路线顺序',b.routes,'种'],['停留夜数组合',b.nightOptions,'组'],['本地时刻候选上界',b.schedules,'组']].map(([name,value,unit])=>`<div class="budget-stat"><span>${name}</span><strong>${value} <small>${unit}</small></strong></div>`).join('');
 $('budget-warning').className='notice'+(b.overLimit?' error':'');$('budget-warning').textContent=b.overLimit?'本次超过 6,000 个时刻候选。请缩小停留夜数范围、选快速搜索或关闭城市顺序比较后分批运行；不是限制旅行长度。':`最多生成约 ${b.offersUpper.toLocaleString()} 个模拟整票报价模型；不会自动尝试全年或未选城市。`;
 }catch(e){$('budget').innerHTML='';$('budget-warning').className='notice error';$('budget-warning').textContent=e.message}
}
function execute(){
 if(!valid())return;const budget=estimate(config);if(budget.overLimit){renderBudget();notice('候选量超出本地计算预算，请先缩小范围。',true);return}
 cancel();const id=++generation,snapshot=clone(config);setBusy(true);notice('');
 const complete=data=>{if(id!==generation)return;last=data;visible=20;cabinFilter='all';ticketFilter='all';setBusy(false);renderResults();$('query-note').scrollIntoView({block:'start',behavior:'smooth'})};
 const fail=text=>{if(id!==generation)return;setBusy(false);notice(text,true)};
 if(typeof Worker!=='undefined'){
  let url;try{url=URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'}));const active=new Worker(url);worker=active;URL.revokeObjectURL(url);active.onmessage=e=>{if(id!==generation){active.terminate();return}if(worker===active)worker=null;active.terminate();if(e.data.ok)complete(e.data.data);else fail(e.data.error)};active.onerror=()=>{active.terminate();if(id!==generation)return;if(worker===active)worker=null;fail('浏览器无法运行本地计算线程。请使用 Edge 打开；材料和设置未被删除。')};active.postMessage(snapshot)}catch(e){if(url)URL.revokeObjectURL(url);fail('无法启动计算：'+e.message)}
 }else setTimeout(()=>{if(id!==generation)return;try{complete(search(snapshot))}catch(e){fail(e.message)}},30);
}
function routeHTML(trip){return trip.route.map(code=>`<b>${esc(code)}</b>`).join('<span>→</span>')}
function ticketHTML(o,index,trip){
 const route=o.indices.map(i=>{const j=trip.journeys[i];return esc(j.from)+' → '+(j.flights.length>1?j.flights.slice(0,-1).map(f=>esc(f.to)+'〔转机〕 → ').join(''):'')+esc(j.to)}).join('　 /　');
 return `<div class="ticket"><div class="ticket-top"><div><strong>机票 ${index+1}</strong> · ${esc(o.type)}<br><small>${esc(o.id)} · 独立模拟整票价，不是单程价格之和</small></div><div style="text-align:right"><strong>${money(o.totalAUD)}</strong><br><small>原币 ${esc(o.currency)} ${o.original.toLocaleString('en-US',{maximumFractionDigits:2})}${o.baggageExtra?'<br>另含模拟行李 '+money(o.baggageExtra):''}</small></div></div><div class="coupon-route">${route}</div><small>模拟含税票价 ${money(o.fareAUD)} · 托运 ${o.checked?o.checked+' kg':o.baggageExtra?'模拟补足 23 kg':'未包含，费用未计入'} · ${o.currency==='AUD'?'AUD 原币':'模拟汇率：1 CNY = 0.21 AUD（非实时）'}</small>${o.journeys.flatMap(j=>j.flights).map(f=>`<div class="flight"><div><b>${esc(f.from)} → ${esc(f.to)}</b><br>${esc(AIRLINES[f.airline]||f.airline)} · 模拟</div><div>${CABINS[cabinFor(f,o.cabin)]}<br>飞行 ${f.hours} 小时</div><div>${esc(f.dep.stamp)} 起飞<br>${esc(f.arr.stamp)} 抵达 <span class="zone-label">均为机场当地时间</span></div></div>`).join('')}</div>`;
}
function planHTML(r,i){
 const t=r.trip,transits=t.journeys.reduce((n,j)=>n+j.flights.length-1,0),separate=r.tickets.length>1;
 return `<article class="panel result-card"><div class="result-main"><div class="result-body"><div class="result-top"><span class="tag ${r.cabin}">${CABINS[r.cabin]}</span><span class="tag">${r.tickets.length} 张机票</span>${i===0&&cabinFilter==='all'&&ticketFilter==='all'?'<span class="tag">当前显示最低模拟价</span>':''}</div><div class="route-line" style="margin-top:10px">${routeHTML(t)}</div><div class="result-meta">${esc(t.start)} 出发 · ${esc(t.returnDate)} 抵达 ${esc(cityName(t.route.at(-1)))} · ${t.days} 天 · ${config.passengers} 位成人<br>${t.flights.length} 个飞行航段 · ${t.journeys.length} 个旅行段 · ${transits} 次转机${transits?'（香港 3 小时，不计旅游停留）':''}<br>${t.stays.map(s=>esc(cityName(s.code))+' '+s.nights+' 夜'+(s.nights>s.minimum?'〔最低 '+s.minimum+'〕':'')).join('　')}</div></div><div class="result-price"><strong>${money(r.total)}</strong><small>全员模拟含税总价 · AUD</small><button class="button save-plan" data-save="${esc(r.id)}">＋ 保存方案</button></div></div><div class="result-footer"><span>${r.savings===null?'未取得同条件整张行程模拟报价，不计算节省':r.savings>0?'较同日期 / 路线 / 舱位的整张行程模拟票节省 '+money(r.savings):r.savings<0?'比同条件整张行程模拟票高 '+money(-r.savings):'与同条件整张行程模拟票价格相同'}</span><span>模拟数据 · 不可预订</span></div><details class="result-details"><summary>展开 ${r.tickets.length} 张机票 · 航班时间、行李和风险</summary>${r.tickets.map((o,i)=>ticketHTML(o,i,t)).join('')}<div class="risk">${separate?'分开出票：不同机票之间不假定存在联程保护。本方案的机票边界安排在旅游停留处；行李能否直挂、是否需提取并重办登机仍须核实。':'一张模拟整票：不代表实际可购买或具有任何航空公司的真实保障。'}${transits?' 返程香港转机在同一张模拟票内；是否满足实际机场最短转机要求尚未核实。':''} 所有航班、航空公司组合、行李及规则仅为演示。签证、入境和过境要求须自行核实。</div></details></article>`;
}
function renderResults(){
 if(!last)return;
 const all=last.results,filtered=all.filter(r=>(cabinFilter==='all'||r.cabin===cabinFilter)&&(ticketFilter==='all'||r.tickets.length===Number(ticketFilter)));
 $('query-note').textContent=`${new Date(last.generatedAt).toLocaleString('zh-CN',{hour12:false})} · ${last.scope==='quick'?'候选日期搜索，未覆盖整月':'整月模拟搜索'} · 共 ${last.attempted} 个日期 / 停留 / 路线组合`;
 if(!all.length){$('results-content').innerHTML=`<div class="empty"><span class="empty-icon">⌁</span>没有符合条件的完整模拟购票组合。<br>${Object.keys(last.errors).map(esc).join('<br>')||'可能是整票报价缺失或机票张数上限过低。'}<br>请调整停留夜数、总旅行天数或筛选条件；系统不会自动放宽规则。</div>`;return}
 const best=all[0],days=Object.keys(last.bestByDays).map(Number).sort((a,b)=>a-b),baseline=last.bestByDays[14]||last.bestByDays[days[0]],baseLabel=last.bestByDays[14]?'14 天最低模拟价':days[0]+' 天最低模拟价';
 let html=`<div class="stats"><div class="stat"><span>最低全程模拟价</span><strong>${money(best.total)}</strong></div><div class="stat"><span>完整购票组合</span><strong>${last.totalResults??all.length}<small> 个</small></strong></div><div class="stat"><span>可行路线 / 日期 / 天数</span><strong>${last.feasible}<small> 组</small></strong></div><div class="stat"><span>缺失的整票报价</span><strong>${last.missing}<small> 种，未参与计算</small></strong></div></div>`;
 html+=`<section class="panel"><div class="section-head"><div><h3>旅行天数与价格差异</h3><p>每个天数取当前筛选条件下最低模拟总价；出发日、首站和出票组合可能不同，不能归因于天数单一因素。</p></div></div><div class="scroll-table"><table class="duration-table"><thead><tr><th>旅行天数</th><th>全程最低模拟价</th><th>相比 ${esc(baseLabel)}</th><th>最低价方案</th></tr></thead><tbody>${days.map(day=>{const r=last.bestByDays[day],diff=r.total-baseline.total;return `<tr><td>${day} 天</td><td class="price">${money(r.total)}</td><td>${diff<0?'省 '+money(-diff):diff>0?'高 '+money(diff):'基准 / 同价'}</td><td>${esc(r.trip.start)} · ${esc(r.trip.route[2])} · ${CABINS[r.cabin]} · ${r.tickets.length} 张</td></tr>`}).join('')}</tbody></table></div><p class="note">未列出的天数没有完整可行方案。${Object.entries(last.errors).map(([reason,count])=>esc(reason)+'（'+count+' 组）').join('；')}</p></section>`;
 html+=`<section class="panel"><details style="margin:0"><summary>查看各候选出发日的最低模拟价（${Object.keys(last.bestByDate).length} 日有完整方案）</summary><div class="scroll-table"><table class="duration-table"><thead><tr><th>出发日期</th><th>当地抵达日期</th><th>旅行长度</th><th>全程模拟价</th><th>路线 / 购票张数</th></tr></thead><tbody>${Object.entries(last.bestByDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,r])=>`<tr><td>${esc(date)}</td><td>${esc(r.trip.returnDate)}</td><td>${r.trip.days} 天</td><td class="price">${money(r.total)}</td><td>${r.trip.route.map(esc).join(' → ')} · ${r.tickets.length} 张</td></tr>`).join('')}</tbody></table></div></details></section>`;
 html+=`<div class="result-filters"><select id="result-cabin" aria-label="筛选结果舱位"><option value="all">所有舱位</option>${Object.entries(CABINS).map(([value,label])=>`<option value="${value}" ${cabinFilter===value?'selected':''}>${label}</option>`).join('')}</select><select id="result-tickets" aria-label="筛选机票张数"><option value="all">所有机票张数</option>${[1,2,3,4,5,6].map(n=>`<option ${ticketFilter===String(n)?'selected':''} value="${n}">${n} 张机票</option>`).join('')}</select><small>按全程总价升序 · 显示 ${Math.min(visible,filtered.length)} / ${filtered.length} 个${last.totalResults>all.length?'；为保证浏览流畅，仅保留最便宜的 '+all.length+' 个结果，天数汇总仍基于全部结果':''}</small></div>`;
 html+=filtered.slice(0,visible).map(planHTML).join('')||'<div class="empty">此结果筛选下没有方案，可更改舱位或张数。</div>';
 if(filtered.length>visible)html+='<button id="more" class="button" style="margin-bottom:20px">再显示 30 个方案</button>';
 $('results-content').innerHTML=html;
 $('result-cabin').value=cabinFilter;$('result-tickets').value=ticketFilter;
 $('result-cabin').onchange=e=>{cabinFilter=e.target.value;visible=30;renderResults()};$('result-tickets').onchange=e=>{ticketFilter=e.target.value;visible=30;renderResults()};
 $('more')?.addEventListener('click',()=>{visible+=30;renderResults()});
 $('results-content').querySelectorAll('[data-save]').forEach(el=>el.onclick=()=>{const r=all.find(r=>r.id===el.dataset.save);if(r)saveEntry(r)});
}
function saveEntry(plan=null){if(!valid())return;const summary=plan?{route:plan.trip.route,start:plan.trip.start,days:plan.trip.days,total:plan.total,cabin:plan.cabin,tickets:plan.tickets.length,simulated:true}:null;saved[mode].unshift({id:'P'+Date.now()+Math.random().toString(36).slice(2,6),at:new Date().toISOString(),config:clone(config),summary});saved[mode]=saved[mode].slice(0,30);const ok=persist();renderSaved();if(ok)notice('已保存到 '+mode+' 模式，另一个模式不受影响。');$('saved').scrollIntoView({block:'start',behavior:'smooth'})}
function renderSaved(){
 $('saved-list').innerHTML=saved[mode].length?saved[mode].map(entry=>`<div class="panel saved-card"><div><b>${entry.summary?entry.summary.route.map(esc).join(' → '):mode+' 模式旅行条件'}</b><p>${esc(new Date(entry.at).toLocaleString('zh-CN'))} · ${entry.summary?entry.summary.days+' 天 · '+CABINS[entry.summary.cabin]+' · '+money(entry.summary.total)+' · 模拟数据':'已保存月份、天数范围、城市及规则'}</p></div><div class="actions"><button class="button" data-load="${esc(entry.id)}">恢复设置</button><button class="button" data-delete="${esc(entry.id)}">删除</button></div></div>`).join(''):'<p class="note">当前模式还没有已保存方案。保存设置或模拟结果后显示在这里。</p>';
 $('saved-list').querySelectorAll('[data-load]').forEach(el=>el.onclick=()=>{const entry=saved[mode].find(e=>e.id===el.dataset.load);if(!entry)return;invalidate();config=clone(entry.config);profiles[mode]=config;hydrate();go(0);notice('已恢复 '+mode+' 模式设置，未自动开始搜索。旧模拟价格不是当前可购买报价。')});
 $('saved-list').querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{saved[mode]=saved[mode].filter(e=>e.id!==el.dataset.delete);persist();renderSaved()});
}
function decodeConfig(value,expected){if(!value||!['A','B'].includes(value.mode)||expected&&value.mode!==expected)throw new Error('模式不匹配。');const c=defaultConfig(value.mode);for(const key of Object.keys(c))if(key in value)c[key]=clone(value[key]);if(!c.custom||typeof c.custom!=='object'||Array.isArray(c.custom))throw new Error('自定义机场格式无效。');for(const [code,city] of Object.entries(c.custom)){if(!/^[A-Z]{3}$/.test(code)||Object.hasOwn(CITIES,code)||!city||typeof city.name!=='string'||city.name.length>30||typeof city.zone!=='string')throw new Error('机场字段无效。');new Intl.DateTimeFormat('en',{timeZone:city.zone})}validate(c);return c}
function cleanSummary(summary,c){if(!summary||summary.simulated!==true||!Array.isArray(summary.route)||summary.route.length>7||!summary.route.every(code=>typeof code==='string'&&Object.hasOwn(citiesFor(c),code))||!Number.isFinite(summary.total)||summary.total<0||!CABINS[summary.cabin]||!Number.isSafeInteger(summary.days)||!Number.isSafeInteger(summary.tickets))return null;return {route:summary.route,start:String(summary.start||''),days:summary.days,total:summary.total,cabin:summary.cabin,tickets:summary.tickets,simulated:true}}
function cleanEntries(entries,m){if(!Array.isArray(entries))throw new Error('已保存记录格式无效。');return entries.slice(0,30).map(entry=>{const c=decodeConfig(entry.config,m);return {id:'I'+Math.random().toString(36).slice(2),at:Number.isFinite(Date.parse(entry.at))?entry.at:new Date().toISOString(),config:c,summary:cleanSummary(entry.summary,c)}})}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('to-history').onclick=()=>go(1);$('to-search').onclick=()=>go(2);$('search').onclick=execute;$('cancel').onclick=()=>{cancel();notice('本次搜索已停止，没有后台任务。')};$('save-settings').onclick=()=>saveEntry();
for(const el of document.querySelectorAll('[data-step]'))el.onclick=()=>go(Number(el.dataset.step));
for(const el of document.querySelectorAll('[data-mode]'))el.onclick=()=>{if(el.dataset.mode===mode)return;read();persist();invalidate();mode=el.dataset.mode;config=profiles[mode];hydrate();renderSaved();go(0);notice('已切换到 '+mode+' 模式。设置独立保存，尚未开始搜索。');persist()};
for(const key of ['origin','end',...booleans])$(key).addEventListener('change',()=>{read();if(config.returnToOrigin)config.end=config.origin;hydrate();edited()});
for(const key of ['month','cabin',...numbers.filter(k=>!['durationMin','durationMax'].includes(k)),'allowed','required','avoid'])$(key).addEventListener('change',edited);
function durationValue(text){
 const digits=String(text).normalize('NFKC').trim();
 if(!/^\d+$/.test(digits))return NaN;
 const value=Number(digits);return Number.isSafeInteger(value)&&value>=1?value:NaN;
}
function renderDuration(){
 for(const id of ['durationMin','durationMax']){
  const value=config[id];$(id).value=Number.isSafeInteger(value)&&value>=1?String(value):'';
 }
 updateDurationButtons();
}
function updateDurationButtons(){
 for(const id of ['durationMin','durationMax']){
  const value=config[id];if(Number.isSafeInteger(value)&&value>=1)$(id).setAttribute('aria-valuenow',String(value));else $(id).removeAttribute('aria-valuenow');
 }
 for(const button of document.querySelectorAll('[data-duration]')){
  const value=config[button.dataset.duration];button.disabled=Number(button.dataset.delta)<0&&Number.isSafeInteger(value)&&value<=1;
 }
}
function applyDuration(id,value){
 // config 是这两个控件共用的状态；一次计算同时更新两端，再同步渲染。
 const range=linkDurationRange(config.durationMin,config.durationMax,id==='durationMin'?'min':'max',value);
 config.durationMin=range.min;config.durationMax=range.max;renderDuration();edited();
}
function changeDuration(id){
 const value=durationValue($(id).value);
 if(!Number.isSafeInteger(value)){edited();updateDurationButtons();return}
 applyDuration(id,value);
}
function stepDuration(id,delta){
 const current=config[id],base=Number.isSafeInteger(current)&&current>=1?current:delta>0?0:2;
 const next=Math.max(1,base+delta);if(!Number.isSafeInteger(next))return;applyDuration(id,next);
}
for(const id of ['durationMin','durationMax']){
 $(id).addEventListener('input',()=>changeDuration(id));$(id).addEventListener('change',()=>changeDuration(id));
 $(id).addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepDuration(id,e.key==='ArrowUp'?1:-1)}});
}
for(const button of document.querySelectorAll('[data-duration]'))button.onclick=()=>stepDuration(button.dataset.duration,Number(button.dataset.delta));
$('scope').onchange=()=>{edited();renderBudget()};
$('add-stop').onclick=()=>{read();if(config.stops.length>=5)return;const code=Object.keys(citiesFor(config)).find(code=>!config.stops.some(s=>s.code===code)&&![config.origin,finalAirport(config)].includes(code));if(code){config.stops.push({code,min:2,max:2});renderStops();edited()}};
$('add-city').onclick=()=>{const code=$('custom-code').value.trim().toUpperCase(),name=$('custom-name').value.trim(),zone=$('custom-zone').value;if(!/^[A-Z]{3}$/.test(code)||!name){notice('请填写 3 位英文机场代码和名称。',true);return}if(Object.hasOwn(citiesFor(config),code)){notice('该机场代码已存在。',true);return}read();config.custom[code]={name,zone};hydrate();edited();$('custom-code').value='';$('custom-name').value='';notice('已为 '+mode+' 模式添加 '+name+' '+code+'。飞行时间仍为模拟；作为 A 首站时还需加入允许名单。')};
$('nav-saved').onclick=()=>$('saved').scrollIntoView({block:'start',behavior:'smooth'});
$('export').onclick=()=>{if(!valid())return;download('flight-price-monitor-'+mode+'-v1.json',{app:'flight-price-monitor-demand',schema:2,mode,simulated:true,config:clone(config),saved:saved[mode],query:last?{generatedAt:last.generatedAt,source:last.source,scope:last.scope,bestByDays:Object.fromEntries(Object.entries(last.bestByDays).map(([day,r])=>[day,{total:r.total,route:r.trip.route,start:r.trip.start,simulated:true}]))}:null})};
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2000000)throw new Error('文件超过 2MB。');const data=JSON.parse(await file.text());if(data.app!=='flight-price-monitor-demand'||data.schema!==2||!['A','B'].includes(data.mode)||data.simulated!==true)throw new Error('不是本三步式 V1 的模式备份。');const c=decodeConfig(data.config,data.mode),entries=cleanEntries(data.saved||[],data.mode);read();invalidate();mode=data.mode;profiles[mode]=c;config=c;saved[mode]=entries;hydrate();renderSaved();go(0);persist();notice('已导入 '+mode+' 模式备份；另一模式未改变，未自动搜索。')}catch(error){notice('导入失败，未替换原设置：'+error.message,true)}finally{e.target.value=''}};
try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(data.schema===2){for(const m of ['A','B']){try{profiles[m]=decodeConfig(data.profiles[m],m);saved[m]=cleanEntries(data.saved?.[m]||[],m)}catch{profiles[m]=defaultConfig(m);saved[m]=[]}}mode=['A','B'].includes(data.mode)?data.mode:'A';storedProfiles=clone(profiles);config=profiles[mode]}}}catch{notice('本地存储不可用或旧记录无效。可使用默认设置并导出文件备份。')}
hydrate();renderSaved();go(0);
