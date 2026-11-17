import fs from 'node:fs';
import assert from 'node:assert/strict';
import {construct,analyzeReturn,budget} from './analyze.mjs';
import {buildLevel} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {analyzeOrdinaryPlans} from '../../../../src/design/ordinary-plans.js';
import {solveContinuation} from '../../../../src/design/continuation.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),shape=read('shape-comparison.json'),
 chosen=shape.rows[0],economy=read('final-economy.json'),base={zeroType:0,removeCells:[[2,4],[2,5]]},
 map=construct(base),env=createReferenceEnvironment(map),qa=auditMap(map),signature=r=>[r.result.status,r.result.totalActions,r.actions];
assertExterior(map);
assert.deepEqual(map,chosen.map);
assert.deepEqual(map,buildLevel('75'));
assert.deepEqual(map,read('../../levels/75/map.json'));
assert.equal(env.mapId,economy.mapId);
assert.equal(qa.allResult.totalActions,26);
assert.equal(qa.count,'4');
assert.equal(qa.noEndSafeRoutes,4);
assert.deepEqual(qa.routes,chosen.qa.routes);
assert(qa.cold);
assert.deepEqual(qa.physicalAudit,chosen.qa.physicalAudit);
assert.deepEqual(auditEntryPath(map,qa.routes,read('../../levels/75/source.json').entryPath),chosen.entry);
const fresh=analyzeReturn(map,qa.actions);
assert.deepEqual(fresh.trace,chosen.history.trace);
assert.deepEqual(fresh.queries.map(q=>[q.name,q.allowOverlap,...signature(q)]),chosen.history.queries.map(q=>[q.name,q.allowOverlap,...signature(q)]));
assert.equal(fresh.queries.length,10);
assert(fresh.queries.every(q=>q.result.status==='proven_unsat'));
const ordinary=analyzeOrdinaryPlans(map,{...budget,totalBudgetMs:60000});
assert.equal(ordinary.conclusion,'no_complete_sequential_plan_within_scope');
assert.deepEqual(ordinary.queries.map(signature),chosen.ordinary.queries.map(signature));
assert.equal(new Set(qa.routes.map(r=>JSON.stringify(r.trace.map(s=>s.ghosts.map(l=>l.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1])))))).size,2);
function check(m,r){assertExterior(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);
 assert.equal(e.mapId,r.mapId);assert.deepEqual([result.status,result.totalActions,q.firstActions()],signature(r));assert.equal(q.routeCount().toString(),r.count);
 const decoded=DataSerializer.loadFromShareCode(r.mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,m);
 if(r.boundary)assert.equal(auditPuzzleBoundaries(m,budget).status,r.boundary.status);
}
for(const r of economy.deletions)check(construct({...base,removeCell:r.cell}),r);
for(const r of economy.alternatives){const m=construct({...base,...r.options});if(r.task){m.layers[0].items=m.layers[0].items.filter(k=>r.task==='only_left'?k.x===2:r.task==='only_right'?k.x===5:false);m.layers[0].hWalls[1][1].keys=r.task==='no_keys'?0:1;}check(m,r);}
const noMap=structuredClone(map);noMap.layers[0].endPos=null;const no=createReferenceEnvironment(noMap);
for(const r of economy.prefixes){for(const reference of[false,true]){const a=solveContinuation(map,r.prefix,{...budget,reference});assert.equal(a.status,r.fast.status);
 if(a.actions)assert.equal(r.prefix.length+a.actions.length,r.total);}
 if(r.fast.actions){let s=no.initialState();for(const a of[...r.prefix,...r.fast.actions]){const n=no.step(s,a);assert(!n.isDead);assert.notEqual(inspectGhostInfluence(no,s,a,n).kind,'overlap');s=n;}assert.equal(r.cleanNoEndReference,true);}}
for(const r of economy.deaths)assert(env.step(env.replay(r.prefix).state,r.action).isDead);
for(const r of economy.invalids){const s=env.replay(r.prefix).state;assert.equal(env.step(s,r.action),s);}
// 初稿的0并非必要：只声明十条最优的动作及逐帧角色、资源保持，不扩张为错误探索等价。
const initial=read('construction.json').cases[0],twenty=read('without-zero-20.json');
const old=DataSerializer.loadFromShareCode(initial.mapCode);assert(old.success);const oldQA=read('analysis.json').qa;
assert.equal(oldQA.mapId,createReferenceEnvironment(old.data.mapData).mapId);
assert.deepEqual(oldQA.routes.map(r=>r.actions),twenty.qa.routes.map(r=>r.actions));
assert.deepEqual(oldQA.routes.map(r=>r.trace.map(t=>[t.p,t.ghosts])),twenty.qa.routes.map(r=>r.trace.map(t=>[t.p,t.ghosts])));
const oldEnv=createReferenceEnvironment(old.data.mapData),plainEnv=createReferenceEnvironment(twenty.map);
for(const route of oldQA.routes){let a=oldEnv.initialState(),b=plainEnv.initialState();for(const action of route.actions){
 a=oldEnv.step(a,action);b=plainEnv.step(b,action);
 assert.deepEqual([a.player.x,a.player.y,a.player.keys,a.layerStates[0].items],
  [b.player.x,b.player.y,b.player.keys,b.layerStates[0].items]);
}}
assert.equal(read('../../levels/75/source.json').humanQuality,null);
console.log(JSON.stringify({id:'75',title:'伴归',cells:18,T:26,rawRoutes:4,timedGhostClasses:2,allOptimalAndNoEndSafe:true,
 historyQueries:10,allUnsat:true,ordinaryCompleteOrdersUnsat:2,singleDeletions:12,entryStates:194,entryTransitions:965,humanQuality:null}));
