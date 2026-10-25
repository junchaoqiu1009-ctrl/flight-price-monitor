import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultConfig,clone,validate,estimate,search,departureDates,monthDates,itinerary,makeOffers,combinations,historicalCoverage,cabinFor,utcAt,localParts,dayDiff} from '../src/core.mjs';
test('A/B 默认设置不共享对象；B 不强制广州或首站允许名单',()=>{
 const a=defaultConfig('A'),b=defaultConfig('B');a.stops[0].min=3;a.allowed.push('HND');assert.equal(defaultConfig('A').stops[0].min,5);assert.equal(b.stops[0].code,'HND');assert.equal(validate(b),true);
 b.stops=[{code:'CAN',min:5,max:5},{code:'TPE',min:7,max:9}];assert.equal(validate(b),true);assert.ok(search(b).results.length);
 a.stops=[{code:'CAN',min:5,max:5},{code:'TPE',min:7,max:9}];assert.throws(()=>validate(a),/允许名单/);
});
test('A 严格执行广州第一站及正式停留，修改白名单才允许台北/东京/札幌',()=>{
 for(const code of ['TPE','HND','CTS']){const c=defaultConfig();c.stops=[{code:'CAN',min:3,max:3},{code,min:8,max:12}];assert.throws(()=>validate(c),/允许名单/);c.allowed.push(code);assert.equal(validate(c),true)}
 const c=defaultConfig();c.stops[0].min=0;assert.throws(()=>validate(c),/停留夜数/);c.stops[0].min=5;c.stops[0].code='BKK';assert.throws(()=>validate(c),/先在广州/);
});
test('月份限定出发日而非返程日；快速7天与整月30天明确区分',()=>{
 const c=defaultConfig();assert.equal(monthDates('2027-09').length,30);assert.equal(monthDates('2028-02').length,29);assert.equal(departureDates(c).length,7);assert.equal(departureDates(c).at(-1),'2027-09-30');
 c.scope='full';const r=search(c);assert.equal(r.budget.dates,30);assert.equal(Object.keys(r.bestByDate).length,30);assert.ok(r.results.some(p=>p.trip.returnDate.startsWith('2027-10')));assert.ok(r.results.every(p=>p.trip.start.startsWith('2027-09')));
});
test('支持14～15天和各城市独立范围；固定停留不被延长以凑总天数',()=>{
 const c=defaultConfig();c.durationMax=15;const r=search(c);assert.ok(r.bestByDays[14]);assert.ok(r.bestByDays[15]);for(const p of r.results){assert.equal(p.trip.stays[0].nights,5);assert.equal(p.trip.stays[1].nights,4);assert.ok(p.trip.stays[2].nights>=3&&p.trip.stays[2].nights<=5)}
 c.stops[2].max=3;const none=search(c);assert.equal(none.results.length,0);assert.match(Object.keys(none.errors)[0],/固定停留不会被自动改写/);
});
test('7、10、21、30、60及365天可搜索，无12～18天限制',()=>{
 for(const days of [7,10,14,18,21,30,60,365]){const c=defaultConfig();c.durationMin=days;c.durationMax=days;c.stops=[{code:'CAN',min:3,max:3},{code:'BKK',min:days-4,max:days-4}];const r=search(c);assert.ok(r.results.length,days+'天');for(const p of r.results){assert.equal(p.trip.days,days);assert.equal(dayDiff(p.trip.start,p.trip.endOriginDate),days)}}
});
test('B 支持悉尼到伦敦异地结束、单程和城市顺序比较',()=>{
 const c=defaultConfig('B');c.origin='SYD';c.end='LHR';c.returnToOrigin=false;c.stops=[{code:'SIN',min:12,max:14}];c.durationMin=12;c.durationMax=18;assert.ok(search(c).results.some(p=>p.trip.route.join(',')==='SYD,SIN,LHR'));
 c.origin='MEL';c.end='SIN';c.stops=[];c.durationMin=1;c.durationMax=2;const r=search(c);assert.ok(r.results.length);assert.equal(r.results[0].trip.journeys.length,1);
 c.returnToOrigin=true;c.stops=[{code:'CAN',min:4,max:4},{code:'TPE',min:8,max:9}];c.durationMin=12;c.durationMax=18;c.reorder=true;assert.equal(estimate(c).routes,2);
});
test('必经和避开适用于真实结构：HKG短时转机不计到访，但计入避开机场',()=>{
 const c=defaultConfig();c.required=['HKG'];assert.equal(search(c).results.length,0);c.required=[];c.avoid=['HKG'];const r=search(c);assert.equal(r.results.length,0);assert.ok(Object.keys(r.errors).some(e=>e.includes('需要避开')));c.avoid=[];c.maxTransit=2;assert.equal(search(c).results.length,0);
});
test('机票精确覆盖不重不漏；非相邻开口往返、往返与多城市整票有独立报价',()=>{
 const c=defaultConfig();c.missing=false;const trip=itinerary(c,'2027-09-01',[{code:'CAN',nights:5},{code:'BKK',nights:4},{code:'TPE',nights:4}]);assert.equal(trip.journeys.length,4);assert.equal(trip.flights.length,5);assert.ok(!trip.stays.some(s=>s.code==='HKG'));
 const offers=makeOffers(trip,c,'economy').offers,plans=combinations(trip,c,'economy',offers),full=offers.find(o=>o.indices.length===4);assert.ok(offers.some(o=>o.indices.join(',')==='0,3'&&o.type==='开口往返票'));assert.notEqual(full.totalAUD,offers.filter(o=>o.indices.length===1).reduce((s,o)=>s+o.totalAUD,0));
 for(const p of plans){assert.deepEqual(p.tickets.flatMap(o=>o.indices).sort(),[0,1,2,3]);assert.equal(p.total,Math.round(p.tickets.reduce((s,o)=>s+o.totalAUD,0)*100)/100);assert.equal(p.savings,Math.round((full.totalAUD-p.total)*100)/100)}
 const b=defaultConfig('B'),t=itinerary(b,'2027-09-01',[{code:'HND',nights:13}]);assert.ok(makeOffers(t,b,'economy').offers.some(o=>o.type==='往返票'));
});
test('缺失整票不由单程补造；张数、含税/汇率/行李、逐段混舱正确',()=>{
 const c=defaultConfig();c.missing=false;const t=itinerary(c,'2027-09-01',[{code:'CAN',nights:5},{code:'BKK',nights:4},{code:'TPE',nights:4}]);const offers=makeOffers(t,c,'mixed').offers,singles=offers.filter(o=>o.indices.length===1);c.maxTickets=3;assert.equal(combinations(t,c,'mixed',singles).length,0);c.maxTickets=4;const p=combinations(t,c,'mixed',singles)[0];assert.equal(p.baseline,null);assert.equal(p.savings,null);
 for(const o of offers){assert.equal(o.fareAUD,Math.round(o.original*o.rate*100)/100);assert.equal(o.totalAUD,Math.round((o.fareAUD+o.baggageExtra)*100)/100);assert.equal(o.simulated,true);assert.equal(o.taxIncluded,true)}assert.equal(cabinFor(t.flights[0],'mixed'),'business');assert.equal(cabinFor(t.flights[1],'mixed'),'economy');
});
test('预算在计算前判断且V1外部调用/费用为0；限制候选量而非旅行长度',()=>{
 const c=defaultConfig();assert.equal(estimate(c).externalCalls,0);assert.equal(estimate(c).costAUD,0);c.stops[2].max=5000;assert.equal(estimate(c).overLimit,true);assert.throws(()=>search(c),/分批/);c.stops[2].min=5000;c.durationMin=5000;c.durationMax=5015;assert.equal(estimate(c).overLimit,false);
});
test('历史12个月从未生成模拟价格，不把缺失填0或做便宜月份排名',()=>{
 const rows=historicalCoverage(new Date('2026-10-25T12:00:00Z'));assert.equal(rows.length,12);assert.equal(rows[0].month,'2025-10');assert.equal(rows.at(-1).month,'2026-09');assert.ok(rows.every(r=>r.price===null&&r.source===null&&r.samples===0));
});
test('时区、夏令时与输入校验；无效月份/城市范围不被静默修正',()=>{
 for(const date of ['2027-03-01','2027-06-01','2027-10-05'])assert.equal(localParts(utcAt(date,10,'Australia/Melbourne'),'Australia/Melbourne').stamp,date+' 10:00');
 assert.throws(()=>monthDates('2027-13'));const c=defaultConfig();c.durationMin=30;c.durationMax=14;assert.throws(()=>validate(c),/最短旅行天数/);c.durationMin=14;c.stops[0].min=NaN;assert.throws(()=>validate(c),/停留夜数/);
});
