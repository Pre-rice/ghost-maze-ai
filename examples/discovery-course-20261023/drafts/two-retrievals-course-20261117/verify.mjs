import fs from'node:fs';import assert from'node:assert/strict';
import{DataSerializer,normalizeVoidWalls}from'../../../../src/reference/engine.js';
import{createReferenceEnvironment}from'../../../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../../../ghost-maze/src/solver/breadthFirst.js';
import{analyzeOrdinaryPlans}from'../../../../src/design/ordinary-plans.js';
import{solveContinuation}from'../../../../src/design/continuation.js';
import{auditPuzzleBoundaries}from'../../../../src/design/rule-boundaries.js';
import{auditMap}from'../../../gallery-adjustments-20261014/verify.mjs';
import{assertExterior}from'../../../spatial-clearance-20261019/verify.mjs';
import{auditEntryPath}from'../../entry-path.mjs';import{room,buildLevel}from'../../build.mjs';
import{analyzeRetrievals}from'./queries.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),record=read('reconstruction.json'),histories=read('analysis.json'),economy=read('economy.json'),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const signature=r=>[r.result.status,r.result.totalActions,r.actions],rows=[];
for(const r of record.cases){
 const cells=new Set(r.params.cells.map(c=>c.join(',')));
 for(const[a,x,y,type]of r.params.edges)if(type!==0&&type!==1)assert(cells.has([x,y].join(','))&&cells.has([a==='v'?x-1:x,a==='h'?y-1:y].join(',')),'功能边必须原始输入即为内边');
 const map=room(6,5,r.params);assertExterior(map);const decoded=DataSerializer.loadFromShareCode(r.mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,map);
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);assert.equal(env.mapId,r.mapId);assert.equal(env.ruleset,record.ruleset);assert.deepEqual([result.status,result.totalActions,q.firstActions()],[r.result.status,r.result.totalActions,r.actions]);assert.equal(q.routeCount().toString(),r.count);
 if(r.ordinary){const ordinary=analyzeOrdinaryPlans(map,{...budget,totalBudgetMs:120000});assert.equal(ordinary.conclusion,r.ordinary.conclusion);assert.deepEqual(signature(ordinary.baseline),signature(r.ordinary.baseline));assert.deepEqual(ordinary.queries.filter(q=>q.kind==='complete_sequential').map(signature),r.ordinary.orders.map(signature));}
 if(r.size>=19)continue;
 const qa=auditMap(map,r.mapCode);assert(qa.cold);assert.equal(qa.boundary.status,'safe');assert.deepEqual(qa.physicalAudit,r.physicalAudit);assert.equal(qa.noEndSafeRoutes,2);
 const entry=auditEntryPath(map,qa.routes,{external:[0,3,0],externalCells:[[3,0]],actions:['D','D']});assert.deepEqual(entry,r.entry);
 const old=histories.find(h=>h.size===r.size),fresh=analyzeRetrievals(map,qa.actions);assert.equal(fresh.mapId,old.mapId);assert.deepEqual(fresh.trace,old.trace);assert.deepEqual(fresh.queries.map(q=>[q.name,q.allowOverlap,...signature(q)]),old.queries.map(q=>[q.name,q.allowOverlap,...signature(q)]));assert(fresh.queries.every(q=>q.result.status==='proven_unsat'));
 const nn=structuredClone(map);nn.layers[0].endPos=null;const no=createReferenceEnvironment(nn);
 for(const p of old.prefixes){const s=env.replay(p.prefix).state;assert.equal(s.player.keys,p.keys);for(const reference of[false,true]){const answer=solveContinuation(map,p.prefix,{...budget,reference});assert.equal(answer.status,p.fast.status);if(answer.actions){assert.equal(p.prefix.length+answer.actions.length,p.total);assert(!no.replay([...p.prefix,...answer.actions]).state.isDead);}}}
 rows.push({size:r.size,T:result.totalActions,raw:r.count,entryStates:entry.allInternalSuccessorsEqual.states});
}
const map=buildLevel('73'),stored=read('../../levels/73/map.json'),env=createReferenceEnvironment(map);assert.deepEqual(map,stored);assert.equal(env.mapId,record.selectedForCourse.mapId);assert.equal(economy.mapId,env.mapId);
function checkChanged(m,old){assertExterior(m);m=normalizeVoidWalls(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);assert.equal(e.mapId,old.mapId);assert.deepEqual([result.status,result.totalActions,q.firstActions()],[old.result.status,old.result.totalActions,old.actions]);assert.equal(q.routeCount().toString(),old.count);return m;}
for(const r of economy.deletions){const[x,y]=r.cell,m=structuredClone(map),l=m.layers[0];l.activeCells[y][x]=false;for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};checkChanged(m,r);assert.equal(r.result.status,'proven_unsat');}
for(const r of economy.tasks){const m=structuredClone(map);m.layers[0].items=r.task==='no_resources'?[]:m.layers[0].items.filter(k=>r.task==='only_left'?k.x===2:k.x===5);m.layers[0].vWalls[4][2]={type:3,keys:r.task==='no_resources'?0:1};checkChanged(m,r);assert.equal(auditPuzzleBoundaries(m,budget).status,'safe');}
for(const r of economy.deaths)assert(env.step(env.replay(r.prefix).state,r.action).isDead);
for(const r of economy.invalids){const s=env.replay(r.prefix).state;assert.equal(env.step(s,r.action),s);}
assert.equal(record.originalTemporaryFilesAvailable,false);assert.equal(record.humanQuality,null);assert.equal(record.reconstructedOn,'2026-11-17');
console.log(JSON.stringify({id:'73',selected:18,T:22,raw:2,timedGhostGroups:1,allOptimalSafe:true,historyQueries:20,allUnsat:true,allKeysWrongPrefix14:true,singleDeletions:12,otherSize:rows.find(r=>r.size===17),entryStates:181,entryTransitions:900,scope:'按记录重建后的新验收，不冒称原始临时文件或真人体验'}));
