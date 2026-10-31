import fs from'node:fs';import assert from'node:assert/strict';
import{DataSerializer,normalizeVoidWalls,validateMapData}from'../../../../src/reference/engine.js';
import{createReferenceEnvironment}from'../../../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../../../ghost-maze/src/solver/breadthFirst.js';
import{solveContinuation}from'../../../../src/design/continuation.js';
import{auditPuzzleBoundaries}from'../../../../src/design/rule-boundaries.js';
import{auditMultilayerMap}from'../../multilayer-audit.mjs';import{auditEntryPath}from'../../entry-path.mjs';
import{assertExterior}from'../../../spatial-clearance-20261019/verify.mjs';import{buildLevel}from'../../build.mjs';
import{analyzeRelay}from'./queries.mjs';
const root=new URL('.',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),map=read('../../levels/72/map.json'),stored=read('analysis.json'),env=createReferenceEnvironment(map),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};assert.deepEqual(buildLevel('72'),map);assert.equal(env.mapId,stored.mapId);assert.equal(env.ruleset,stored.ruleset);assertExterior(map);
const qa=auditMultilayerMap(map,read('../../levels/72/share.json').mapCode);assert.equal(qa.allResult.totalActions,31);assert.equal(qa.count,'1');assert(qa.cold);assert.equal(qa.noEndSafeRoutes,1);
const sig=r=>[r.result.status,r.result.totalActions,r.actions],fresh=analyzeRelay(map,qa.actions);assert.deepEqual(fresh.rows.map(sig),stored.rows.map(sig));assert.deepEqual(fresh.trace,stored.trace);
const effects=fresh.trace.filter(r=>r.influence.kind==='motion');assert.deepEqual(effects.map(r=>r.step),[5,17]);assert(fresh.trace.every(r=>r.lower[0]===0&&r.upper[0]===1));
const econ=read('economy.json');
function check(m,old){assertExterior(m);const checked=validateMapData(m);assert(checked.valid);m=normalizeVoidWalls(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);assert.equal(e.mapId,old.mapId);assert.deepEqual([result.status,result.totalActions,q.firstActions()],[old.result.status,old.result.totalActions,old.actions]);assert.equal(q.routeCount().toString(),old.count);if(old.boundary){const b=auditPuzzleBoundaries(m,budget);assert.equal(b.status,old.boundary.status);assert.equal(b.reason,old.boundary.reason);}return m;}
for(const r of econ.changes){const m=structuredClone(map);if(r.name==='no_A'){m.layers[0].vWalls[2][3]={type:0,keys:0};m.layers[1].buttons=[];}else if(r.name==='open_corner')m.layers[0].hWalls[3][4]={type:0,keys:0};else{const li=r.name.startsWith('upper')?1:0;m.layers[li][li?'vWalls':'hWalls'][3][li?3:2]={type:r.name.endsWith('ordinary')?2:1,keys:0};}check(m,r);}
for(const r of econ.deletions){const[li,x,y]=r.name.split(',').map(Number),m=structuredClone(map),l=m.layers[li];l.activeCells[y][x]=false;for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};check(m,r);}
const entry=auditEntryPath(map,qa.routes,{external:[0,1,4],externalCells:[[1,4],[1,3]],actions:['U','U']});assert.deepEqual(entry,econ.entry);assert.deepEqual(entry.allInternalSuccessorsEqual,{states:709,transitions:3505,includesFatalActions:true});
const wrong=read('wrongs.json'),nn=structuredClone(map);nn.layers.forEach(l=>l.endPos=null);const no=createReferenceEnvironment(nn);
for(const w of wrong.wrongs){for(const reference of[false,true]){const a=solveContinuation(map,w.prefix,{...budget,reference});assert.equal(a.status,w.fast.status);assert.equal(w.prefix.length+a.actions.length,w.total);assert(!no.replay([...w.prefix,...a.actions]).state.isDead);}}
for(const w of wrong.deaths)assert(env.step(env.replay(w.prefix).state,w.action).isDead);
for(const w of wrong.invalids){const s=env.replay(w.prefix).state;assert.equal(env.step(s,w.action),s);}
const a=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance:(h,b,action,n)=>b.player.layer===1&&b.player.x===3&&b.player.y===3&&action==='U'||n.isWon&&no.step(b,action).isDead?null:h}});assert.equal(a.run(budget).status,'proven_unsat');
for(const r of read('construction-history.json').layouts){const d=DataSerializer.loadFromShareCode(r.mapCode);assert(d.success);const e=createReferenceEnvironment(d.data.mapData),q=createBreadthFirstSearch(e,{allOptimal:true}),answer=q.run(budget);assert.equal(e.mapId,r.mapId);assert.equal(answer.totalActions,r.result.totalActions);assert.equal(q.routeCount().toString(),r.count);assert.deepEqual(q.firstActions(),r.actions);assert.equal(auditPuzzleBoundaries(d.data.mapData,budget).status,r.allOptimalBoundary);}
console.log(JSON.stringify({id:'72',T:31,raw:1,timedGhostGroups:1,allOptimalSafe:true,reciprocalStairHolds:[5,17],noInfluenceMinimum:37,lateRecallMinimum:35,ghostMigrationMinimum:41,nonEntitySingleDeletions:14,actualEntryStates:709,humanQuality:null}));
