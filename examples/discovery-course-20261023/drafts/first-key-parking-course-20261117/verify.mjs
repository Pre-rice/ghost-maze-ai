import fs from 'node:fs';
import assert from 'node:assert/strict';
import {construct,analyzeKeyPlans,budget} from './analyze.mjs';
import {compareGoalLeaf} from './compare-goal-leaf.mjs';
import {buildLevel} from '../../build.mjs';
import {DataSerializer,normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {solveContinuation} from '../../../../src/design/continuation.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),task=read('goal-shape.json'),economy=read('economy.json'),
 map=construct(),env=createReferenceEnvironment(map),qa=auditMap(map),signature=r=>[r.result.status,r.result.totalActions,r.actions];
assertExterior(map);assert.deepEqual(map,task.map);assert.deepEqual(map,buildLevel('77'));assert.deepEqual(map,read('../../levels/77/map.json'));
assert.equal(qa.mapId,task.qa.mapId);assert.equal(qa.allResult.totalActions,14);assert.equal(qa.count,'6');assert.equal(qa.noEndSafeRoutes,6);
assert.deepEqual(qa.routes,task.qa.routes);assert(qa.cold);assert.equal(task.humanQuality,null);
assert.equal(new Set(qa.routes.map(r=>JSON.stringify(r.trace.map(t=>t.ghosts)))).size,4);
assert.deepEqual([...new Set(task.routes.map(r=>r.strategy))].sort(),['park_ghost_outside_then_take_key','take_key_then_leave_ghost_inside']);
assert.deepEqual(auditEntryPath(map,qa.routes,read('../../levels/77/source.json').entryPath),task.entry);
const fresh=analyzeKeyPlans(map);assert.deepEqual(fresh.queries.map(q=>[q.name,...signature(q)]),economy.history.queries.map(q=>[q.name,...signature(q)]));
assert.equal(fresh.queries[0].result.totalActions,14);assert(fresh.queries.slice(1).every(q=>q.result.status==='proven_unsat'));
assert.deepEqual(compareGoalLeaf(),read('goal-leaf-comparison.json'));
function check(m,r){assertExterior(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);
 assert.equal(e.mapId,r.mapId);assert.deepEqual([result.status,result.totalActions,q.firstActions()],signature(r));assert.equal(q.routeCount().toString(),r.count);
 const decoded=DataSerializer.loadFromShareCode(r.mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,m);
}
for(const r of economy.deletions){const m=structuredClone(map),l=m.layers[0],[x,y]=r.cell;l.activeCells[y][x]=false;
 for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};check(normalizeVoidWalls(m),r);}
for(const r of economy.alternatives){const m=structuredClone(map);m.layers[0][r.removedDoor[0]+'Walls'][r.removedDoor[2]][r.removedDoor[1]]={type:0,keys:0};check(m,r);}
for(const r of economy.prefixes)for(const reference of[false,true]){const a=solveContinuation(map,r.prefix,{...budget,reference});assert.equal(a.status,r.fast.status);
 if(a.actions){assert.equal(r.prefix.length+a.actions.length,r.total);assert(env.replay([...r.prefix,...a.actions]).state.isWon);}}
for(const r of economy.deaths)assert(env.step(env.replay(r.prefix).state,r.action).isDead);
for(const r of economy.invalids){const s=env.replay(r.prefix).state;assert.equal(env.step(s,r.action),s);}
const probe=env.replay(economy.goalProbe.prefix).state;assert.equal(probe.player.keys,0);assert.equal(env.step(probe,'U'),probe);
assert.deepEqual(probe.layerStates[0].ghosts.map(g=>[g.x,g.y]),[[0,0]]);
for(const r of read('analysis.json').rows){const m=construct(r.compact?'compact':'original'),e=createReferenceEnvironment(m),q=auditMap(m);
 assert.equal(q.mapId,r.qa.mapId);assert.deepEqual(q.routes,r.qa.routes);assert(e.replay(r.hand).state.isWon);
 assert.deepEqual(analyzeKeyPlans(m).queries.map(q=>signature(q)),r.queries.map(q=>signature(q)));
}
const cluster=read('analysis.json').additionalFixedCounterplan,m=buildLevel('63');m.layers[0].ghosts[1].x=0;m.layers[0].ghosts[1].y=1;check(m,cluster);
console.log(JSON.stringify({id:'77',T:14,raw:6,timedGhostClasses:4,designStrategies:2,allOptimalAndNoEndSafe:true,
 leafIsomorphismStates:115,leafTransitions:560,entryStates:115,entryTransitions:560,safeGoalProbe:true,
 rightParkNotRequiredBeforeKey:true,lowerParkWithKeyUnsat:true,humanQuality:null}));
