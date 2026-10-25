import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,clone,validate,search,itinerary,makeOffers,combinations,dayDiff,utcAt,localParts,cabinFor} from '../src/core.mjs';
const settings=()=>clone(DEFAULTS);
test('A 模式：广州必停、首站白名单；BKK 仅转机不满足规则，台北/东京默认拒绝',()=>{
 const c=settings();assert.equal(validate(c),true);
 for(const code of ['TPE','HND','CTS']){c.stops=[{code:'CAN',nights:3},{code,nights:4}];assert.throws(()=>validate(c),/允许名单/)}
 c.allowed.push('HND');c.stops[1].code='HND';assert.equal(validate(c),true);
 c.stops[1].nights=0;assert.throws(()=>validate(c),/停留夜数/);c.stops[1].nights=2;c.stops[0].code='BKK';assert.throws(()=>validate(c),/先在广州/);
});
test('14天只是默认值，7/10/21/30/60天可行；城市停留独立可调，时区和抵达日期一致',()=>{
 for(const days of [7,10,14,18,21,30,60]){const c=settings();c.durationMin=days;c.durationMax=days;c.stops=[{code:'CAN',nights:3},{code:'BKK',nights:1}];const r=search(c);assert.ok(r.results.length,days+'天应有方案');for(const plan of r.results){assert.equal(dayDiff(plan.trip.start,plan.trip.returnDate),days);assert.equal(plan.trip.stays[0].nights,3);assert.equal(plan.trip.flights.at(-1).arr.date,plan.trip.returnDate);assert.ok(plan.trip.stays.every(s=>s.nights>=s.minimum));for(let i=1;i<plan.trip.flights.length;i++)assert.ok(plan.trip.flights[i].departure>plan.trip.flights[i-1].arrival)}}
});
test('旅行天数范围逐天比较；不合理停留给原因、不放宽要求',()=>{
 const c=settings();c.durationMin=10;c.durationMax=20;const r=search(c);assert.ok(!r.bestByDays[10]);assert.ok(r.bestByDays[14]);assert.ok(r.bestByDays[20]);assert.ok(Object.keys(r.errors).length);assert.deepEqual(c.stops[0],{code:'CAN',nights:5});assert.ok(new Set(Object.values(r.bestByDays).map(r=>r.total)).size>1);
 c.durationMax=9;assert.throws(()=>search(c),/最短旅行天数/);
});
test('一张票的报价独立；组合精确覆盖旅行段，含非相邻开口往返；总价和节省可追溯',()=>{
 const c=settings();c.missing=false;c.cabin='economy';const trip=itinerary(c,'2027-03-01',14,[{code:'CAN',nights:5},{code:'BKK',nights:4},{code:'TPE',nights:3}]);
 assert.equal(trip.journeys.length,4);assert.equal(trip.flights.length,5);assert.ok(!trip.stays.some(s=>s.code==='HKG'));
 const offers=makeOffers(trip,c,'economy').offers;assert.ok(offers.some(o=>o.type==='开口往返票'&&o.indices.join(',')==='0,3'));
 const full=offers.find(o=>o.indices.length===4),singles=offers.filter(o=>o.indices.length===1);assert.notEqual(full.totalAUD,singles.reduce((s,o)=>s+o.totalAUD,0));
 const plans=combinations(trip,c,'economy',offers);assert.ok(plans.some(p=>p.tickets.length===1));assert.ok(plans.some(p=>p.tickets.length===4));assert.ok(plans.some(p=>p.tickets.some(o=>o.indices.join(',')==='0,3')));
 for(const p of plans){assert.deepEqual(p.tickets.flatMap(t=>t.indices).sort(),[0,1,2,3]);assert.equal(p.total,Math.round(p.tickets.reduce((s,o)=>s+o.totalAUD,0)*100)/100);assert.equal(p.savings,Math.round((full.totalAUD-p.total)*100)/100);assert.equal(p.simulated,true)}
});
test('报价缺失不伪造联程价；缺整票时单程方案可存在，张数上限严格执行',()=>{
 const c=settings();c.missing=false;const trip=itinerary(c,'2027-03-01',14,[{code:'CAN',nights:5},{code:'BKK',nights:4},{code:'TPE',nights:3}]);const singles=makeOffers(trip,c,'economy').offers.filter(o=>o.indices.length===1);
 c.maxTickets=3;assert.equal(combinations(trip,c,'economy',singles).length,0);c.maxTickets=4;const r=combinations(trip,c,'economy',singles);assert.equal(r.length,1);assert.equal(r[0].baseline,null);assert.equal(r[0].savings,null);
});
test('含税票价+行李附加费+币种换算+乘客数量一致；混合舱位逐飞行段判断',()=>{
 const c=settings();c.missing=false;c.passengers=2;const trip=itinerary(c,'2027-03-01',14,[{code:'CAN',nights:5},{code:'BKK',nights:4},{code:'TPE',nights:3}]);const offers=makeOffers(trip,c,'mixed').offers;
 assert.ok(offers.some(o=>o.currency==='CNY'));for(const o of offers){assert.equal(o.fareAUD,Math.round(o.original*o.rate*100)/100);assert.equal(o.totalAUD,Math.round((o.fareAUD+o.baggageExtra)*100)/100);assert.equal(o.taxIncluded,true)}
 assert.equal(cabinFor(trip.flights[0],'mixed'),'business');assert.equal(cabinFor(trip.flights[1],'mixed'),'economy');assert.equal(cabinFor(trip.flights.at(-1),'mixed'),'business');
});
test('墨尔本夏令时换算；飞行时刻与真实日期计算，不以停留夜数相加冒充旅行总天数',()=>{
 for(const date of ['2027-03-01','2027-06-01','2027-10-05'])assert.equal(localParts(utcAt(date,10,'Australia/Melbourne'),'Australia/Melbourne').stamp,date+' 10:00');
 const c=settings();c.stops=[{code:'CAN',nights:7},{code:'BKK',nights:7}];c.durationMin=7;c.durationMax=7;const r=search(c);assert.equal(r.results.length,0);assert.match(Object.keys(r.errors)[0],/超出/);
});
test('不接受负数、空值、不合法日期；大范围提示分批但长旅行本身不受12～18天限制',()=>{
 for(const value of [0,-1,1.2,NaN]){const c=settings();c.durationMin=value;assert.throws(()=>search(c))}
 const c=settings();c.earliest='2027-02-30';assert.throws(()=>search(c),/日期无效/);
 const big=settings();big.durationMin=1;big.durationMax=6000;assert.throws(()=>search(big),/分批/);
});
