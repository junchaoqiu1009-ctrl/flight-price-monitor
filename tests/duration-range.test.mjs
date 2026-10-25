import test from 'node:test';
import assert from 'node:assert/strict';
import {linkDurationRange,defaultConfig} from '../src/core.mjs';
test('用户示例：5～5，最短改7→7～7，最长改15→7～15，最长改6→6～6',()=>{
 let r=linkDurationRange(5,5,'min',7);assert.deepEqual(r,{min:7,max:7});r=linkDurationRange(r.min,r.max,'max',15);assert.deepEqual(r,{min:7,max:15});r=linkDurationRange(r.min,r.max,'max',6);assert.deepEqual(r,{min:6,max:6});
});
test('无冲突时另一端保持不变；固定14～14、7天及长旅行均允许',()=>{
 assert.deepEqual(linkDurationRange(7,15,'min',10),{min:10,max:15});assert.deepEqual(linkDurationRange(7,15,'max',30),{min:7,max:30});assert.deepEqual(linkDurationRange(14,14,'max',14),{min:14,max:14});assert.deepEqual(linkDurationRange(14,14,'min',365),{min:365,max:365});
 for(const mode of ['A','B']){const c=defaultConfig(mode);assert.equal(c.durationMin,14);assert.equal(c.durationMax,14)}
});
test('不接受小数、负数及空数值；不完整另一端可由有效修改补齐',()=>{
 for(const value of [0,-1,1.5,NaN,Infinity])assert.throws(()=>linkDurationRange(14,14,'min',value));assert.deepEqual(linkDurationRange(NaN,15,'max',20),{min:20,max:20});assert.deepEqual(linkDurationRange(7,NaN,'min',10),{min:10,max:10});
});
