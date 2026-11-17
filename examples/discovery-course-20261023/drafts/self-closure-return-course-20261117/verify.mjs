import fs from 'node:fs';
import assert from 'node:assert/strict';
import {construct,analyzeClosure,budget} from './analyze.mjs';
import {buildLevel} from '../../build.mjs';
import {DataSerializer,normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditMap} from '../../../staged-workroom-20261018/audit.mjs';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {solveContinuation} from '../../../../src/design/continuation.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),d=read('final-task.json'),
 map=construct(d.options),env=createReferenceEnvironment(map),qa=auditMap(map),signature=r=>[r.result.status,r.result.totalActions,r.actions];
assertExterior(map);assert.deepEqual(map,d.map);assert.deepEqual(map,buildLevel('76'));
assert.deepEqual(map,read('../../levels/76/map.json'));assert.equal(d.humanQuality,null);
assert.equal(qa.allResult.totalActions,18);assert.equal(qa.count,'1');assert.equal(qa.noEndSafeRoutes,1);
assert.deepEqual(qa.routes,d.qa.routes);assert.equal(qa.physicalAudit.reachable,99);
assert.equal(qa.physicalAudit.transitions,490);assert.equal(map.layers[0].ghosts.length,0);
assert.deepEqual(auditEntryPath(map,qa.routes,read('../../levels/76/source.json').entryPath),d.entry);
const history=analyzeClosure(map);assert.deepEqual(history.queries.map(q=>[q.name,...signature(q)]),d.history.queries.map(q=>[q.name,...signature(q)]));
assert.equal(history.queries.filter(q=>q.result.status==='proven_unsat').length,6);
function check(m,r){assertExterior(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);
 assert.equal(e.mapId,r.mapId);assert.deepEqual([result.status,result.totalActions,q.firstActions()],signature(r));assert.equal(q.routeCount().toString(),r.count);
 const decoded=DataSerializer.loadFromShareCode(r.mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,m);
}
for(const r of d.deletions){const m=structuredClone(map),l=m.layers[0],[x,y]=r.cell;l.activeCells[y][x]=false;
 for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};check(normalizeVoidWalls(m),r);}
for(const r of d.alternatives){const m=structuredClone(map);m.layers[0][r.at[0]+'Walls'][r.at[2]][r.at[1]]={type:r.replacement,keys:0};check(m,r);}
const ordinary=structuredClone(map);ordinary.layers[0].vWalls[2][3]={type:2,keys:0};
const crossing=analyzeClosure(ordinary).queries.find(q=>q.name==='first_arrow_with_B_unrestored');
assert.deepEqual(signature(crossing),signature(d.ordinaryCrossing));assert.equal(crossing.result.totalActions,22);
for(const r of d.prefixes)for(const reference of[false,true]){const a=solveContinuation(map,r.prefix,{...budget,reference});assert.equal(a.status,r.fast.status);
 if(a.actions){assert.equal(r.prefix.length+a.actions.length,r.total);assert(env.replay([...r.prefix,...a.actions]).state.isWon);}}
for(const r of d.invalids){const s=env.replay(r.prefix).state;assert.equal(env.step(s,r.action),s);}
const first=read('construction.json');check(construct(),first);assert(env.ruleset===first.qa.ruleset);
for(const r of read('variants.json').rows){const m=construct(r.options);check(m,{...r.qa,result:r.qa.allResult,actions:r.qa.actions});
 assert.deepEqual(analyzeClosure(m).queries.map(q=>[q.name,...signature(q)]),r.history.queries.map(q=>[q.name,...signature(q)]));}
console.log(JSON.stringify({id:'76',title:'闭环',cells:16,T:18,raw:1,allOptimalAndNoEndSafe:true,
 fullHistoryQueries:8,unsat:6,firstAAfterKey:22,lateAAtOuterControl:26,ordinaryAllowsLateB:22,
 singleDeletions:10,entryStates:99,entryTransitions:490,ghostPermutation:'not_applicable_no_ghosts',humanQuality:null}));
