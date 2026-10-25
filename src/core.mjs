export const CITIES={MEL:{name:'墨尔本',zone:'Australia/Melbourne',lat:-37.67,lon:144.84},SYD:{name:'悉尼',zone:'Australia/Sydney',lat:-33.94,lon:151.18},CAN:{name:'广州',zone:'Asia/Shanghai',lat:23.39,lon:113.3},BKK:{name:'曼谷',zone:'Asia/Bangkok',lat:13.69,lon:100.75},SIN:{name:'新加坡',zone:'Asia/Singapore',lat:1.36,lon:103.99},KUL:{name:'吉隆坡',zone:'Asia/Kuala_Lumpur',lat:2.75,lon:101.71},TPE:{name:'台北',zone:'Asia/Taipei',lat:25.08,lon:121.23},HND:{name:'东京·羽田',zone:'Asia/Tokyo',lat:35.55,lon:139.78},NRT:{name:'东京·成田',zone:'Asia/Tokyo',lat:35.77,lon:140.39},CTS:{name:'札幌',zone:'Asia/Tokyo',lat:42.78,lon:141.69},HKG:{name:'香港',zone:'Asia/Hong_Kong',lat:22.31,lon:113.91},LHR:{name:'伦敦·希思罗',zone:'Europe/London',lat:51.47,lon:-0.45},DXB:{name:'迪拜',zone:'Asia/Dubai',lat:25.25,lon:55.36},CDG:{name:'巴黎',zone:'Europe/Paris',lat:49,lon:2.55},LAX:{name:'洛杉矶',zone:'America/Los_Angeles',lat:33.94,lon:-118.41},JFK:{name:'纽约',zone:'America/New_York',lat:40.64,lon:-73.78}};
const SHARED={month:'2027-09',durationMin:14,durationMax:14,cabin:'compare',maxTickets:4,passengers:1,baggage:true,redEye:true,longTransit:false,maxTransit:6,missing:true,custom:{},required:[],avoid:[],reorder:false,scope:'quick'};
export const DEFAULTS_A={...SHARED,mode:'A',origin:'MEL',returnToOrigin:true,end:'MEL',stops:[{code:'CAN',min:5,max:5},{code:'AUTO',min:4,max:4},{code:'TPE',min:3,max:5}],allowed:['BKK','SIN','KUL'],enforce:true,viaHKG:true};
export const DEFAULTS_B={...SHARED,mode:'B',origin:'MEL',returnToOrigin:true,end:'MEL',stops:[{code:'HND',min:12,max:15}],allowed:[],enforce:false,viaHKG:false};
export function defaultConfig(mode='A'){return clone(mode==='B'?DEFAULTS_B:DEFAULTS_A)}
export const AIRLINES={CZ:'中国南方航空',CX:'国泰航空',SQ:'新加坡航空',MH:'马来西亚航空',BR:'长荣航空',QF:'澳洲航空'};
export const clone=value=>JSON.parse(JSON.stringify(value));
export const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n);
export function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function dateAdd(date,days){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('日期格式无效。');const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error('日期无效。');d.setUTCDate(d.getUTCDate()+days);if(!Number.isFinite(d.getTime())||d.getUTCFullYear()>9999||d.getUTCFullYear()<1000)throw new Error('旅行天数超出日期系统可表示范围。');return d.toISOString().slice(0,10)}
export const dayDiff=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const formatters=new Map();
export function localParts(ms,zone){if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));const p=Object.fromEntries(formatters.get(zone).formatToParts(ms).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,stamp:`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`}}
export function utcAt(date,hour,zone){const target=Date.parse(date+`T${String(hour).padStart(2,'0')}:00:00Z`);let guess=target;for(let i=0;i<4;i++){const p=localParts(guess,zone);const shown=Date.parse(p.date+'T'+p.time+':00Z');guess+=target-shown}return guess}
export function citiesFor(config){return {...CITIES,...config.custom}}
const integer=(n,min,label)=>{if(!Number.isSafeInteger(n)||n<min)throw new Error(label+'必须是'+min+'以上的整数。')};
// 修改哪端就以哪端为准，只在发生冲突时联动另一端。
export function linkDurationRange(min,max,changed,value){
 if(!['min','max'].includes(changed)||!Number.isSafeInteger(value)||value<1)throw new Error('旅行天数必须为1以上的整数。');
 return changed==='min'?{min:value,max:Number.isSafeInteger(max)&&max>=value?max:value}:{min:Number.isSafeInteger(min)&&min>=1&&min<=value?min:value,max:value};
}
export function monthDates(month){if(!/^\d{4}-\d{2}$/.test(month))throw new Error('请选择有效的出发月份。');const year=Number(month.slice(0,4)),m=Number(month.slice(5));if(year<1000||year>9998||m<1||m>12)throw new Error('出发月份超出可表示范围。');const count=new Date(Date.UTC(year,m,0)).getUTCDate();return Array.from({length:count},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))}
export function departureDates(config){const dates=monthDates(config.month);if(config.scope==='full')return dates;const indices=new Set([0,5,10,15,20,25,dates.length-1].filter(i=>i<dates.length));return [...indices].sort((a,b)=>a-b).map(i=>dates[i])}
export const finalAirport=config=>config.returnToOrigin?config.origin:config.end;
function permutations(items){if(items.length<2)return [items];return items.flatMap((item,i)=>permutations(items.filter((_,j)=>j!==i)).map(tail=>[item,...tail]))}
export function routeVariants(config){
 const cities=citiesFor(config);let variants=[clone(config.stops)];
 if(config.mode==='A'&&config.stops[1]?.code==='AUTO')variants=config.allowed.filter(code=>Object.hasOwn(cities,code)&&!config.stops.some(s=>s.code===code)&&!['MEL','CAN'].includes(code)).map(code=>config.stops.map((stop,i)=>({...stop,code:i===1?code:stop.code})));
 if(config.mode==='B'&&config.reorder)variants=variants.flatMap(stops=>permutations(stops));return variants;
}
export function validate(config){
 if(!config||!['A','B'].includes(config.mode))throw new Error('模式必须为 A 或 B。');const cities=citiesFor(config);monthDates(config.month);
 const known=code=>typeof code==='string'&&/^[A-Z]{3}$/.test(code)&&Object.hasOwn(cities,code);
 if(!known(config.origin)||!known(finalAirport(config)))throw new Error('出发或结束机场无效，请先添加机场名称及时区。');
 for(const [key,label] of [['durationMin','最短旅行天数'],['durationMax','最长旅行天数'],['maxTickets','最多机票张数'],['passengers','成人数量']])integer(config[key],1,label);
 if(config.durationMin>config.durationMax)throw new Error('最短旅行天数不能大于最长旅行天数。');
 if(!Array.isArray(config.stops)||config.stops.length>5)throw new Error('V1 最多设置 5 个旅游停留城市；旅行天数没有 12～18 天限制。');
 if(config.mode==='A'&&(config.origin!=='MEL'||!config.returnToOrigin||config.stops.length<2||config.stops[0].code!=='CAN'))throw new Error('A 模式必须墨尔本出发并返回、先在广州停留，再去下一停留城市。');
 const seen=new Set([config.origin]);for(const [i,stop] of config.stops.entries()){
  integer(stop.min,1,'城市最短停留夜数');integer(stop.max,1,'城市最长停留夜数');if(stop.min>stop.max)throw new Error('城市最短停留不能超过最长停留。');
  if(stop.code==='AUTO'){if(config.mode!=='A'||i!==1)throw new Error('自动首站只用于 A 模式广州之后。');continue}
  if(!known(stop.code))throw new Error('未知停留机场：'+stop.code);if(seen.has(stop.code))throw new Error('V1 请勿重复添加同一停留机场：'+stop.code);if(stop.code===finalAirport(config))throw new Error('结束机场不用重复放进停留列表；它会作为行程最后一站。');seen.add(stop.code);
 }
 for(const key of ['allowed','required','avoid']){if(!Array.isArray(config[key])||!config[key].every(known))throw new Error('机场名单格式无效，未知机场须先添加名称和时区。')}
 if(config.mode==='A'&&config.enforce&&config.stops[1].code!=='AUTO'&&!config.allowed.includes(config.stops[1].code))throw new Error('广州后的首个停留城市不在允许名单中。转机不能代替旅游停留。');
 if(!routeVariants(config).length)throw new Error('允许名单中没有可以使用的首站，请检查是否与已有城市重复。');
 if(!['economy','business','mixed','compare'].includes(config.cabin)||!['quick','full'].includes(config.scope))throw new Error('舱位或搜索范围无效。');
 if(typeof config.maxTransit!=='number'||!Number.isFinite(config.maxTransit)||config.maxTransit<0)throw new Error('最大转机小时数无效。');
 return true;
}
export function estimate(config){
 validate(config);const dates=departureDates(config),variants=routeVariants(config);let nightOptions=1;for(const stop of config.stops)nightOptions*=stop.max-stop.min+1;
 const schedules=dates.length*variants.length*nightOptions,cabins=config.cabin==='compare'?3:1,n=config.stops.length+1;
 const offersUpper=schedules*cabins*(n*(n+1)/2+(n>2?1:0));
 return {dates:dates.length,monthDates:monthDates(config.month).length,routes:variants.length,nightOptions,schedules,offersUpper,cabins,limit:6000,overLimit:!Number.isSafeInteger(schedules)||schedules>6000,externalCalls:0,costAUD:0};
}
function durationHours(from,to,cities){
 const table={MELCAN:9.5,CANMEL:9.5,CANBKK:3,CANSIN:4,CANKUL:4,CANTPE:2,CANHND:4.5,CANCTS:5,BKKTPE:3.5,SINTPE:4.5,KULTPE:4.5,TPEHKG:2,HNDHKG:5,CTSHKG:5.5,HKGMEL:9,BKKMEL:9,SINMEL:7.5,KULMEL:8,TPEMEL:9,HNDMEL:10,CTSMEL:11};if(table[from+to])return table[from+to];if(table[to+from])return table[to+from];
 const a=cities[from],b=cities[to];if(!Number.isFinite(a.lat)||!Number.isFinite(b.lat))return 4;
 const rad=v=>v*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return Math.max(1,Math.round((2*6371*Math.asin(Math.min(1,Math.sqrt(h)))/850+0.8)*2)/2);
}
const airline=(from,to)=>from==='CAN'||to==='CAN'?'CZ':from==='HKG'||to==='HKG'?'CX':from==='SIN'||to==='SIN'?'SQ':from==='KUL'||to==='KUL'?'MH':from==='MEL'||to==='MEL'?'QF':'BR';
function flight(from,to,departure,cities,id){const hours=durationHours(from,to,cities);return {id,from,to,departure,arrival:departure+hours*3600000,hours,airline:airline(from,to),dep:localParts(departure,cities[from].zone),arr:localParts(departure+hours*3600000,cities[to].zone),simulated:true}}
export function itinerary(config,start,stops){
 const cities=citiesFor(config),end=finalAirport(config),journeys=[],stays=[];let from=config.origin,depart=utcAt(start,10,cities[from].zone);
 for(let i=0;i<stops.length;i++){
  const stop=stops[i],f=flight(from,stop.code,depart,cities,'J'+i+'F0');journeys.push({index:i,from,to:stop.code,flights:[f],transit:0});
  const leave=dateAdd(f.arr.date,stop.nights);stays.push({code:stop.code,nights:stop.nights,arrival:f.arr.date,departure:leave});from=stop.code;depart=utcAt(leave,i===stops.length-1?14:10,cities[from].zone);
 }
 let flights;if(config.viaHKG&&from!=='HKG'&&end!=='HKG'){const first=flight(from,'HKG',depart,cities,'R0'),second=flight('HKG',end,first.arrival+3*3600000,cities,'R1');flights=[first,second]}else flights=[flight(from,end,depart,cities,'R0')];
 journeys.push({index:journeys.length,from,to:end,flights,transit:flights.length>1?3:0});
 const all=journeys.flatMap(j=>j.flights),arrival=all.at(-1),endOriginDate=localParts(arrival.arrival,cities[config.origin].zone).date,days=Math.max(1,dayDiff(start,endOriginDate)),route=[config.origin,...stops.map(s=>s.code),end];
 if(days<config.durationMin||days>config.durationMax)throw new Error('停留夜数和飞行时间不符合总天数范围；固定停留不会被自动改写。');
 if(!config.longTransit&&journeys.some(j=>j.transit>config.maxTransit))throw new Error('模拟转机超过最大允许时长。');
 if(!config.redEye&&all.some(f=>{const h=Number(f.dep.time.slice(0,2));return h>=22||h<6||f.arr.date>f.dep.date}))throw new Error('所选模拟时刻包含夜间/跨夜飞行，当前不允许红眼。');
 if(config.required.some(code=>!route.includes(code)))throw new Error('路线未到访全部必经机场；短时转机不计到访。');
 if(config.avoid.some(code=>all.some(f=>f.from===code||f.to===code)))throw new Error('路线或转机经过了需要避开的机场。');
 if(config.mode==='A'&&config.enforce&&!config.allowed.includes(stops[1]?.code))throw new Error('广州后首个正式停留不符合允许名单。');
 return {start,days,returnDate:arrival.arr.date,endOriginDate,stays,journeys,flights:all,route,simulated:true};
}
export const cabinFor=(flight,cabin)=>cabin==='mixed'?(flight.hours>=6?'business':'economy'):cabin;
export function makeOffers(trip,config,cabin){
 const n=trip.journeys.length,offers=[];let missing=0;
 function offer(indices){const key=indices.join('-'),signature=trip.flights.map(f=>f.from+f.to+f.dep.stamp).join('|'),h=hash(signature+'|'+key+'|'+cabin),span=indices.length;
  if(config.missing&&span>1&&h%9===0){missing++;return}
  const first=indices.includes(0),last=indices.includes(n-1),contiguous=indices.every((v,i)=>!i||v===indices[i-1]+1),journeys=indices.map(i=>trip.journeys[i]);
  // 各整票产品的独立模拟目录，绝非单程报价相加后冒充联程价格。
  let base=first&&last?(contiguous?1270+span*45:1030):first?(span===1?650:810+span*70):last?(span===1?620:680+span*85):145+span*100;
  base*=cabin==='business'?2.9:cabin==='mixed'?(first||last?2.15:1):1;
  const factor=0.82+(hash(signature+'|'+key)%37)/100;const fare=Math.round(base*factor*(0.97+h%8/100))*config.passengers;
  const currency=h%3===0?'CNY':'AUD',rate=currency==='CNY'?0.21:1,original=Math.round(fare/rate*100)/100,fareAUD=Math.round(original*rate*100)/100;
  const checked=h%5===0?0:cabin==='business'?30:23,baggageExtra=config.baggage&&!checked?80*config.passengers:0,totalAUD=Math.round((fareAUD+baggageExtra)*100)/100;
  const reciprocal=span===2&&journeys[0].from===journeys[1].to&&journeys[0].to===journeys[1].from;
  const closed=trip.route[0]===trip.route.at(-1);
  const type=reciprocal?'往返票':!contiguous?(closed?'开口往返票':'非相邻多城市票'):span>1?'多城市联程票':journeys[0].flights.length>1?'转机联程票':'单程票';
  offers.push({id:'SIM-'+key+'-'+h,indices,mask:indices.reduce((m,i)=>m|(1<<i),0),type,original,currency,rate,fareAUD,baggageExtra,totalAUD,checked,journeys,cabin,source:'V1 独立模拟整票目录',taxIncluded:true,simulated:true});
 }
 for(let a=0;a<n;a++)for(let b=a;b<n;b++)offer(Array.from({length:b-a+1},(_,i)=>a+i));if(n>2)offer([0,n-1]);return {offers,missing};
}
export function combinations(trip,config,cabin,offers){const full=(1<<trip.journeys.length)-1,out=[];
 function walk(mask,chosen){if(mask===full){const tickets=[...chosen].sort((a,b)=>a.indices[0]-b.indices[0]),total=Math.round(tickets.reduce((s,t)=>s+t.totalAUD,0)*100)/100,baseline=offers.find(o=>o.mask===full);out.push({id:trip.start+'|'+trip.stays.map(s=>s.code+s.nights).join('-')+'|'+cabin+'|'+tickets.map(t=>t.id).join(':'),trip,cabin,tickets,total,baseline:baseline?.totalAUD??null,savings:baseline?Math.round((baseline.totalAUD-total)*100)/100:null,simulated:true});return}if(chosen.length>=config.maxTickets)return;let first=0;while(mask&(1<<first))first++;for(const o of offers)if((o.mask&(1<<first))&&!(o.mask&mask))walk(mask|o.mask,[...chosen,o])}walk(0,[]);return out;
}
function nightAssignments(stops,i=0,built=[]){if(i===stops.length)return [built];const result=[];for(let nights=stops[i].min;nights<=stops[i].max;nights++)result.push(...nightAssignments(stops,i+1,[...built,{code:stops[i].code,nights}]));return result}
export function search(config){
 const budget=estimate(config);if(budget.overLimit)throw new Error('本次超过 6,000 个候选时刻组合，请缩小停留范围、关闭顺序优化或分批搜索；旅行总天数本身不设 12～18 天限制。');
 const dates=departureDates(config),cabins=config.cabin==='compare'?['economy','business','mixed']:[config.cabin],results=[],bestByDays={},bestByDate={},errors={};let attempted=0,feasible=0,missing=0,totalResults=0;
 const order=(a,b)=>a.total-b.total||a.tickets.length-b.tickets.length||a.id.localeCompare(b.id);
 for(const stops of routeVariants(config))for(const concrete of nightAssignments(stops))for(const date of dates){attempted++;let trip;try{trip=itinerary(config,date,concrete)}catch(e){errors[e.message]=(errors[e.message]||0)+1;continue}feasible++;
  for(const cabin of cabins){const catalog=makeOffers(trip,config,cabin);missing+=catalog.missing;const found=combinations(trip,config,cabin,catalog.offers);totalResults+=found.length;
   for(const r of found){if(!bestByDays[trip.days]||r.total<bestByDays[trip.days].total)bestByDays[trip.days]=r;if(!bestByDate[date]||r.total<bestByDate[date].total)bestByDate[date]=r}
   results.push(...found);if(results.length>4000){results.sort(order);results.length=2000}
  }
 }
 results.sort(order);if(results.length>2000)results.length=2000;
 return {results,totalResults,bestByDays,bestByDate,attempted,feasible,missing,errors,budget,scope:config.scope,generatedAt:new Date().toISOString(),config:clone(config),source:'模拟数据，不是实际航班或可购买报价'};
}
export function historicalCoverage(now=new Date()){
 const year=now.getFullYear(),month=now.getMonth();return Array.from({length:12},(_,i)=>{const d=new Date(year,month-12+i,1);return {month:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),price:null,samples:0,source:null,status:'未接入可验证的历史整票数据库'}});
}
