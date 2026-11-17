import fs from 'node:fs';
import assert from 'node:assert/strict';
import {construct,analyzeRelocation,budget} from './analyze.mjs';
import {buildLevel} from '../../build.mjs';
import {DataSerializer,normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {solveContinuation} from '../../../../src/design/continuation.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),d=read('final-task.json'),map=construct(),
 env=createReferenceEnvironment(map),qa=auditMap(map),signature=r=>[r.result.status,r.result.totalActions,r.actions];
assertExterior(map);assert.deepEqual(map,d.map);assert.deepEqual(map,buildLevel('37'));assert.deepEqual(map,read('../../levels/37/map.json'));
assert.equal(qa.allResult.totalActions,15);assert.equal(qa.count,'1');assert.equal(qa.noEndSafeRoutes,1);assert(qa.cold);
assert.deepEqual(qa.routes,d.qa.routes);assert.equal(env.mapId,d.qa.mapId);assert.equal(d.humanQuality,null);
assert.deepEqual(auditEntryPath(map,qa.routes,read('../../levels/37/source.json').entryPath),d.entry);
assert.deepEqual(analyzeRelocation(map).queries.map(q=>[q.name,...signature(q)]),d.history.queries.map(q=>[q.name,...signature(q)]));
assert(d.history.queries.every(q=>q.result.status==='proven_unsat'));
assert(env.replay([...'ULURULLRRDLULDD']).state.isWon);
function check(m,r){assertExterior(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);
 assert.equal(e.mapId,r.mapId);assert.deepEqual([result.status,result.totalActions,q.firstActions()],signature(r));assert.equal(q.routeCount().toString(),r.count);
 const decoded=DataSerializer.loadFromShareCode(r.mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,m);
}
for(const r of d.deletions){const m=structuredClone(map),l=m.layers[0],[x,y]=r.cell;l.activeCells[y][x]=false;
 for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};check(normalizeVoidWalls(m),r);}
for(const r of d.alternatives){const m=structuredClone(map);if(r.kind==='remove_ghost')m.layers[0].ghosts=[];else m.layers[0].vWalls[1][2]={type:r.replacement,keys:0};check(m,r);}
for(const r of d.prefixes)for(const reference of[false,true]){const a=solveContinuation(map,r.prefix,{...budget,reference});assert.equal(a.status,r.fast.status);
 if(a.actions){assert.equal(r.prefix.length+a.actions.length,r.total);assert(env.replay([...r.prefix,...a.actions]).state.isWon);}}
for(const r of d.deaths)assert(env.step(env.replay(r.prefix).state,r.action).isDead);
for(const r of d.invalids){const s=env.replay(r.prefix).state;assert.equal(env.step(s,r.action),s);}
for(const r of read('construction.json').rows){const m=construct(r.lowerType),fresh=auditMap(m);assert.equal(fresh.mapId,r.qa.mapId);assert.deepEqual(fresh.routes,r.qa.routes);
 assert.deepEqual(analyzeRelocation(m).queries.map(q=>[q.name,...signature(q)]),r.queries.map(q=>[q.name,...signature(q)]));
 for(const query of r.queries.filter(q=>q.actions)){const nm=structuredClone(m);nm.layers[0].endPos=null;assert(!createReferenceEnvironment(nm).replay(query.actions).state.isDead);}
}
assert.equal(read('../../levels/37/revisions/v02/evidence.json').allResult.totalActions,19);
assert.equal(read('../../levels/37/source.json').revision,3);
console.log(JSON.stringify({id:'37',revision:3,T:15,oldT:19,raw:1,allOptimalAndNoEndSafe:true,
 fullHistoryQueries:4,allUnsat:true,lowerOpenVariantHasOneA:20,singleDeletions:6,entryStates:24,entryTransitions:115,humanQuality:null}));
