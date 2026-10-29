import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {solveContinuation} from '../../../../src/design/continuation.js';
import {normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {buildLevel} from '../../build.mjs';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {auditEntryPath} from '../../entry-path.mjs';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';

const root=new URL('.',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const map=read('../../levels/69/map.json'),e=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers[0].endPos=null;
const no=createReferenceEnvironment(nm),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const g=s=>s.layerStates[0].ghosts[0],at=(s,x,y)=>g(s).x===x&&g(s).y===y;
const move=(b,n)=>g(b).x!==g(n).x||g(b).y!==g(n).y,open=(s,x,y)=>s.layerStates[0].wallStates.h[y][x].type===0;
const stored=read('constraints.json');assert.equal(stored.mapId,e.mapId);assert.equal(stored.ruleset,e.ruleset);
for(const row of stored.rows){
 const name=row.name,q=createBreadthFirstSearch(e,{monitor:{initial:()=>[0,0,0],advance(h,b,a,n){
  if(n.isWon&&no.step(b,a).isDead)return null;
  const first=!h[0]&&move(b,n),early=open(n,3,3)&&n.player.keys===0,park=at(b,3,3)&&at(n,3,3);
  if(name==='never_open_lower_zero'&&open(n,1,4)||name==='never_open_upper_zero'&&open(n,3,3)||name==='first_activation_distance_at_most_two'&&first&&Math.abs(n.player.x-g(b).x)+Math.abs(n.player.y-g(b).y)>2||name==='never_G_stationary_at_3_3'&&park||name==='never_G_moves_after_key'&&b.player.keys>0&&move(b,n)||name==='never_G_y3'&&g(n).y===3||name==='never_recall_after_3_3'&&h[2]&&move(b,n))return null;
  const history=[h[0]||first?1:0,h[1]||early?1:0,h[2]||park?1:0];
  if(n.isWon&&name==='upper_zero_before_key'&&!history[1])return null;
  return history;
 }}}),result=q.run(budget);
 assert.equal(result.status,row.result.status);assert.equal(result.totalActions,row.result.totalActions);assert.deepEqual(q.firstActions(),row.actions);
}
for(const row of stored.comparisons){
 const[axis,x,y]=row.edge,m=structuredClone(map);m.layers[0][axis+'Walls'][y][x]={type:row.type,keys:0};assertExterior(m);
 const env=createReferenceEnvironment(m),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run(budget);
 assert.equal(env.mapId,row.mapId);assert.equal(r.status,row.result.status);assert.equal(r.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);assert.deepEqual(q.firstActions(),row.actions);
}
for(const row of stored.wrongs){
 const s=e.replay(row.prefix).state;assert(!s.isDead);const fast=solveContinuation(map,row.prefix,budget),reference=solveContinuation(map,row.prefix,{...budget,reference:true});
 assert.equal(fast.status,row.fast.status);assert.equal(reference.status,row.reference.status);assert.deepEqual(fast.actions,row.fast.actions);
 if(fast.status==='solved'){assert(e.replay([...row.prefix,...fast.actions]).state.isWon);assert(!no.replay([...row.prefix,...fast.actions]).state.isDead);assert.equal(row.prefix.length+fast.actions.length,26);}
}
assert(e.step(e.replay(['R','U','U','L','L']).state,'U').isDead);
assertExterior(map);assert.deepEqual(buildLevel('69'),map);
const qa=auditMap(map);assert.equal(qa.allResult.totalActions,24);assert.equal(qa.count,'4');assert(qa.cold);assert.equal(qa.boundary.status,'safe');assert.equal(qa.physicalAudit.permutations,1);
const groups=routes=>new Set(routes.map(r=>JSON.stringify(r.trace.map(t=>t.ghosts))));assert.equal(groups(qa.routes).size,4);
assert.deepEqual(auditEntryPath(map,qa.routes,read('../../levels/69/source.json').entryPath).allInternalSuccessorsEqual,{states:290,transitions:1420,includesFatalActions:true});
const economy=read('economy.json');
for(const row of economy.singleCell){
 const[x,y]=row.cell,m=structuredClone(map),l=m.layers[0];l.activeCells[y][x]=false;
 for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};
 assertExterior(m);const env=createReferenceEnvironment(normalizeVoidWalls(m)),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run(budget);
 assert.equal(env.mapId,row.mapId);assert.equal(r.status,'proven_unsat');assert.equal(row.result.status,r.status);assert.equal(q.routeCount().toString(),'0');
}
for(const row of economy.relocated){const m=structuredClone(map);m.layers[0].customStartPos={x:row.pos[0],y:row.pos[1]};const env=createReferenceEnvironment(m),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run(budget);assert.equal(env.mapId,row.mapId);assert.equal(r.totalActions,row.result.totalActions);assert.deepEqual(q.firstActions(),row.actions);}
{
 const earlier=read('earlier-layout.json');assertExterior(earlier.map);const old=auditMap(earlier.map);assert.equal(old.mapId,earlier.mapId);assert.equal(old.count,'16');assert.equal(old.allResult.totalActions,24);assert.deepEqual(groups(old.routes),groups(qa.routes));
 const changed=structuredClone(earlier.map),l=changed.layers[0];for(const[x,y]of[[2,1],[3,1],[4,1]]){l.activeCells[y][x]=false;for(const[a,xx,yy]of[['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};}assertExterior(changed);assert.deepEqual(normalizeVoidWalls(changed),map);
 for(const r of qa.routes)assert(old.routes.some(rr=>JSON.stringify(rr.actions)===JSON.stringify(r.actions)));
}
for(const r of stored.routes){let s=e.initialState();const events=[];for(const[i,a]of r.actions.entries()){const n=e.step(s,a);for(const[x,y]of[[1,4],[3,3]])if(!open(s,x,y)&&open(n,x,y))events.push({step:i+1,type:'open',edge:['h',x,y],keys:n.player.keys});if(s.player.keys!==n.player.keys)events.push({step:i+1,type:'pickup',keys:n.player.keys});s=n;}assert(s.isWon);assert.deepEqual(events,r.events);}
assert(stored.routes.some(r=>r.events.some(x=>x.type==='open'&&x.edge[1]===3&&x.keys===1)));
console.log(JSON.stringify({id:'69',T:24,raw:4,timedGhostGroups:4,fullHistoryQueries:8,unsatQueries:7,original19Raw:16,legalSingleDeletions:12,actualEntryStates:290,actualEntrySuccessors:1420,allOptimalSafe:true,humanQuality:null}));
