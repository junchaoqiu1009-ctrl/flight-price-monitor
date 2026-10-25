export const CITIES={MEL:{name:'墨尔本',zone:'Australia/Melbourne'},CAN:{name:'广州',zone:'Asia/Shanghai'},BKK:{name:'曼谷',zone:'Asia/Bangkok'},SIN:{name:'新加坡',zone:'Asia/Singapore'},KUL:{name:'吉隆坡',zone:'Asia/Kuala_Lumpur'},TPE:{name:'台北',zone:'Asia/Taipei'},HND:{name:'东京·羽田',zone:'Asia/Tokyo'},NRT:{name:'东京·成田',zone:'Asia/Tokyo'},CTS:{name:'札幌',zone:'Asia/Tokyo'},HKG:{name:'香港',zone:'Asia/Hong_Kong'}};
export const DEFAULTS={earliest:'2027-03-01',latest:'2027-03-03',durationMin:14,durationMax:14,flex:0,stops:[{code:'CAN',nights:5},{code:'AUTO',nights:4},{code:'TPE',nights:3}],allowed:['BKK','SIN','KUL'],enforce:true,cabin:'compare',maxTickets:4,passengers:1,baggage:true,viaHKG:true,redEye:true,longTransit:false,maxTransit:6,target:1500,missing:true,custom:{}};
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
export function validate(config){
 const cities=citiesFor(config);if(!Array.isArray(config.stops)||!Array.isArray(config.allowed))throw new Error('停留城市和允许名单格式无效。');if(!config.allowed.every(code=>typeof code==='string'&&/^[A-Z]{3}$/.test(code)&&Object.hasOwn(cities,code)))throw new Error('允许名单中的机场须先存在于机场列表；请先添加自定义机场。');dateAdd(config.earliest,0);dateAdd(config.latest,0);
 if(config.latest<config.earliest)throw new Error('最晚出发日期不能早于最早出发日期。');
 for(const [key,min,label] of [['durationMin',1,'最短旅行天数'],['durationMax',1,'最长旅行天数'],['flex',0,'日期浮动'],['maxTickets',1,'最多机票张数'],['passengers',1,'成人数量']])integer(config[key],min,label);
 if(config.durationMin>config.durationMax)throw new Error('最短旅行天数不能大于最长旅行天数。');
 if(config.stops.length<2||config.stops[0].code!=='CAN')throw new Error('A 模式要求先在广州停留，并安排广州后的停留城市。');
 if(config.stops.length>5)throw new Error('V1 最多比较 5 个停留城市（旅行总天数不受此限制）。');
 const seen=new Set(['MEL']);
 for(const stop of config.stops){integer(stop.nights,1,'每个城市的停留夜数');if(stop.code==='AUTO'){if(stop!==config.stops[1])throw new Error('自动比较只可用于广州后的首个停留城市。');continue}if(typeof stop.code!=='string'||!/^[A-Z]{3}$/.test(stop.code)||!Object.hasOwn(cities,stop.code))throw new Error('请先补充机场 '+stop.code+' 的名称和时区。');if(seen.has(stop.code))throw new Error('V1 请勿重复添加同一停留机场：'+stop.code);seen.add(stop.code)}
 if(config.enforce&&config.stops[1].code!=='AUTO'&&!config.allowed.includes(config.stops[1].code))throw new Error('广州后的首个停留城市不在允许名单中：'+config.stops[1].code+'。转机不能替代正式停留。');
 if(config.stops[1].code==='AUTO'&&!config.allowed.some(code=>cities[code]&&!seen.has(code)))throw new Error('允许名单中没有可供自动比较的首站。');
 if(!Number.isFinite(Number(config.maxTransit))||config.maxTransit<0)throw new Error('最大转机时间不能为负数。');
 if(!['compare','economy','business','mixed'].includes(config.cabin))throw new Error('舱位设置无效。');
 const dates=dayDiff(config.earliest,config.latest)+1+2*config.flex,durations=config.durationMax-config.durationMin+1,variants=config.stops[1].code==='AUTO'?config.allowed.length:1;
 if(dates*durations*variants>5000)throw new Error('本次模拟超过 5,000 个日期/天数/路线组合。请缩小搜索区间后分批比较；不是对旅行总天数设限。');
 return true;
}
const hours=(from,to)=>({MELCAN:9.5,CANBKK:3,CANSIN:4,CANKUL:4,CANTPE:2,CANHND:4.5,CANCTS:5,BKKTPE:3.5,SINTPE:4.5,KULTPE:4.5,TPEHKG:2,HNDHKG:5,CTSHKG:5.5,HKGMEL:9,CANMEL:9.5,BKKMEL:9,SINMEL:7.5,KULMEL:8,TPEMEL:9,HNDMEL:10,CTSMEL:11}[from+to]||4);
const airline=(from,to)=>from==='MEL'||from==='CAN'||to==='CAN'?'CZ':to==='MEL'||to==='HKG'?'CX':from==='SIN'?'SQ':from==='KUL'?'MH':'BR';
export const AIRLINES={CZ:'中国南方航空',CX:'国泰航空',SQ:'新加坡航空',MH:'马来西亚航空',BR:'长荣航空'};
function flight(from,to,departure,cities,id){const duration=hours(from,to);return {id,from,to,departure,arrival:departure+duration*3600000,hours:duration,airline:airline(from,to),dep:localParts(departure,cities[from].zone),arr:localParts(departure+duration*3600000,cities[to].zone),simulated:true}}
export function itinerary(config,start,days,stops){
 const cities=citiesFor(config),journeys=[],stays=[];let from='MEL',depart=utcAt(start,10,cities.MEL.zone);
 for(let i=0;i<stops.length;i++){
  const stop=stops[i],f=flight(from,stop.code,depart,cities,'J'+i+'F0');journeys.push({index:i,from,to:stop.code,flights:[f],hours:f.hours,transit:0});
  const leaveDate=dateAdd(f.arr.date,stop.nights);stays.push({code:stop.code,arrival:f.arr.date,departure:leaveDate,nights:stop.nights,minimum:stop.nights});
  from=stop.code;depart=utcAt(leaveDate,10,cities[from].zone);
 }
 const returnDate=dateAdd(start,days),last=stays.at(-1);const returnDepartDate=dateAdd(returnDate,-1);
 if(returnDepartDate<last.departure)throw new Error('停留时间及飞行日超出总旅行天数。');
 last.departure=returnDepartDate;last.nights=dayDiff(last.arrival,last.departure);depart=utcAt(returnDepartDate,14,cities[from].zone);
 if(depart<journeys.at(-1).flights.at(-1).arrival)throw new Error('返程早于抵达最后一站。');
 let flights;
 if(config.viaHKG&&from!=='HKG'){
  const first=flight(from,'HKG',depart,cities,'R0'),second=flight('HKG','MEL',first.arrival+3*3600000,cities,'R1');flights=[first,second];
 }else flights=[flight(from,'MEL',depart,cities,'R0')];
 if(flights.at(-1).arr.date!==returnDate)throw new Error('模拟时刻表无法满足所选返程抵达日期，请调整路线。');
 journeys.push({index:journeys.length,from,to:'MEL',flights,hours:flights.reduce((sum,f)=>sum+f.hours,0),transit:flights.length>1?3:0});
 if(!config.longTransit&&journeys.some(j=>j.transit>config.maxTransit))throw new Error('转机时间超过所设上限。');
 if(!config.redEye&&journeys.some(j=>j.flights.some(f=>{const hours=Number(f.dep.time.slice(0,2));return hours>=22||hours<6||f.arr.date>f.dep.date})))throw new Error('所选模拟航班包含夜间飞行，当前不允许红眼航班。');
 return {start,days,returnDate,stays,journeys,flights:journeys.flatMap(j=>j.flights),route:['MEL',...stops.map(s=>s.code),'MEL'],simulated:true};
}
export function cabinFor(flight,cabin){return cabin==='mixed'?(flight.hours>=6?'business':'economy'):cabin}
export function makeOffers(trip,config,cabin){
 const n=trip.journeys.length,offers=[];let missing=0;
 function offer(indices){
  const key=indices.join('-'),h=hash(trip.start+'|'+trip.days+'|'+trip.route.join('-')+'|'+key+'|'+cabin),span=indices.length;
  if(config.missing&&span>1&&h%9===0){missing++;return}
  const includesStart=indices.includes(0),includesEnd=indices.includes(n-1),contiguous=indices.every((v,i)=>!i||v===indices[i-1]+1);
  // 独立的模拟整票价目表，不把单程票相加后改名为联程报价。
  let whole=includesStart&&includesEnd?(contiguous?1390+span*35:1050):includesStart?(span===1?660:840+span*65):includesEnd?(span===1?640:700+span*90):150+span*115;
  whole*=cabin==='business'?2.9:cabin==='mixed'?(includesStart||includesEnd?2.15:1):1;
  const dateFactor=0.84+(hash(trip.start+':'+trip.days+':'+key)%33)/100;
  whole=Math.round(whole*dateFactor*(0.97+h%8/100))*config.passengers;
  const currency=h%3===0?'CNY':'AUD',rate=currency==='CNY'?0.21:1,original=Math.round(whole/rate*100)/100;
  const checked=h%5===0?0:cabin==='business'?30:23;
  const baggageExtra=config.baggage&&checked===0?80*config.passengers:0;
  const fareAUD=Math.round(original*rate*100)/100,totalAUD=Math.round((fareAUD+baggageExtra)*100)/100;
  const journeys=indices.map(i=>trip.journeys[i]);
  const type=!contiguous?(trip.journeys[0].to===trip.journeys.at(-1).from?'往返票':'开口往返票'):span>1?'多城市联程票':journeys[0].flights.length>1?'转机联程票':'独立单程票';
  offers.push({id:'SIM-'+key+'-'+h,indices,mask:indices.reduce((mask,i)=>mask|(1<<i),0),type,original,currency,rate,fareAUD,baggageExtra,totalAUD,checked,journeys,cabin,source:'V1 独立模拟整票价目表',taxIncluded:true,simulated:true});
 }
 for(let start=0;start<n;start++)for(let end=start;end<n;end++)offer(Array.from({length:end-start+1},(_,i)=>start+i));
 if(n>2)offer([0,n-1]);
 return {offers,missing};
}
export function combinations(trip,config,cabin,offers){
 const n=trip.journeys.length,full=(1<<n)-1,results=[];
 function walk(mask,chosen){
  if(mask===full){const sorted=[...chosen].sort((a,b)=>a.indices[0]-b.indices[0]);const total=Math.round(sorted.reduce((sum,o)=>sum+o.totalAUD,0)*100)/100;const baseline=offers.find(o=>o.mask===full);results.push({id:trip.start+'|'+trip.days+'|'+trip.route.join('-')+'|'+cabin+'|'+sorted.map(o=>o.id).join('|'),trip,cabin,tickets:sorted,total,baseline:baseline?.totalAUD??null,savings:baseline?Math.round((baseline.totalAUD-total)*100)/100:null,simulated:true});return}
  if(chosen.length>=config.maxTickets)return;
  let next=0;while(mask&(1<<next))next++;
  for(const o of offers)if((o.mask&(1<<next))&&!(o.mask&mask))walk(mask|o.mask,[...chosen,o]);
 }
 walk(0,[]);return results;
}
export function search(config){
 validate(config);const start=dateAdd(config.earliest,-config.flex),end=dateAdd(config.latest,config.flex),cities=citiesFor(config);
 let variants=[clone(config.stops)];if(config.stops[1].code==='AUTO')variants=config.allowed.filter(code=>cities[code]&&!config.stops.some(s=>s.code===code)&&!['MEL','CAN'].includes(code)).map(code=>config.stops.map((s,i)=>({...s,code:i===1?code:s.code})));
 const cabins=config.cabin==='compare'?['economy','business','mixed']:[config.cabin],results=[],errors={},bestByDays={};let attempted=0,feasible=0,missing=0,totalResults=0;
 const order=(a,b)=>a.total-b.total||a.tickets.length-b.tickets.length||a.id.localeCompare(b.id);
 for(let date=start;date<=end;date=dateAdd(date,1))for(let days=config.durationMin;days<=config.durationMax;days++)for(const stops of variants){
  attempted++;let trip;try{trip=itinerary(config,date,days,stops)}catch(e){errors[e.message]=(errors[e.message]||0)+1;continue}feasible++;
  for(const cabin of cabins){const catalog=makeOffers(trip,config,cabin);missing+=catalog.missing;const found=combinations(trip,config,cabin,catalog.offers);totalResults+=found.length;for(const r of found)if(!bestByDays[days]||r.total<bestByDays[days].total)bestByDays[days]=r;results.push(...found);if(results.length>4000){results.sort(order);results.length=2000;}}
 }
 results.sort(order);if(results.length>2000)results.length=2000;
 return {results,totalResults,bestByDays,attempted,feasible,missing,errors,generatedAt:new Date().toISOString(),config:clone(config),source:'模拟数据 · 非真实航班或可购买报价'};
}
