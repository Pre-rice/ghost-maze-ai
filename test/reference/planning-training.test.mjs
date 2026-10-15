import test from 'node:test';
import assert from 'node:assert/strict';
import {enumeratePlanningGraph,reverseDistances} from '../../src/training/planning-graph.js';
import {createPlanningEncoder} from '../../src/training/planning-features.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {smallMap,keyDetourMap,stairMap} from './fixtures.mjs';

test('完整图的标签包含所有并列最优动作；预算未知不提供精确距离',()=>{
 const m=smallMap([[1,1],[2,1],[1,2],[2,2]],[1,1],[2,2]),g=enumeratePlanningGraph(m);assert.equal(g.status,'exhausted');assert.equal(g.distance[0],2);assert.deepEqual(g.nodes[0].edges.filter(e=>g.distance[e.to]===1).map(e=>e.action).sort(),['D','R']);
 const limited=enumeratePlanningGraph(m,{stateBudget:1});assert.equal(limited.status,'unknown');assert.equal(limited.distance,undefined);
});
test('安全反向距离排除重合后继，不把不同范围的值冒充同一标签',()=>{
 const nodes=[{state:{isWon:false},overlap:false,edges:[{to:1},{to:2}]},{state:{isWon:true},overlap:true,edges:[]},{state:{isWon:false},overlap:false,edges:[{to:3}]},{state:{isWon:true},overlap:false,edges:[]}];
 assert.equal(reverseDistances(nodes)[0],1);assert.equal(reverseDistances(nodes,{avoidOverlap:true})[0],2);
});
test('特征不包含步号、观察记录、鬼编号；输入局面不被修改',()=>{
 const map=keyDetourMap(),env=createReferenceEnvironment(map),encode=createPlanningEncoder(map),s=env.initialState(),next=env.step(s,'R'),original=JSON.stringify(s),feature=encode.encode(s,'R',next),copy=structuredClone(s);copy.player.steps=999;copy.seenCells.forEach(l=>l.forEach(r=>r.fill(true)));for(const l of copy.layerStates)for(const g of l.ghosts)g.id+=100;
 assert.deepEqual(encode.encode(copy,'R',next),feature);assert.equal(JSON.stringify(s),original);assert(feature.every(Number.isFinite));
});
test('单层与楼梯动作使用同维输入；距离标签经共同规则确认',()=>{
 const a=keyDetourMap(),b=stairMap(),ae=createReferenceEnvironment(a),be=createReferenceEnvironment(b),av=ae.initialState(),bv=be.step(be.initialState(),'R');
 assert.equal(createPlanningEncoder(a).encode(av,'R',ae.step(av,'R')).length,createPlanningEncoder(b).encode(bv,'STAIR',be.step(bv,'STAIR')).length);
 const graph=enumeratePlanningGraph(b);assert.equal(graph.distance[0],3);assert.equal(graph.safeDistance[0],3);
});
