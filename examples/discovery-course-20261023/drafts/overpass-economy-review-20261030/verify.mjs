import fs from 'node:fs';import assert from 'node:assert/strict';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {room} from '../../build.mjs';
import {auditMultilayerMap} from '../../multilayer-audit.mjs';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
const root=new URL('.',import.meta.url),record=JSON.parse(fs.readFileSync(new URL('review.json',root))),decoded=DataSerializer.loadFromShareCode(record.sourceMapCode);assert(decoded.success);
const original=decoded.data.mapData,source=createReferenceEnvironment(original),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};assert.equal(source.mapId,record.sourceMapId);assert.equal(source.ruleset,record.ruleset);assertExterior(original);
let compact;
for(const row of record.fixedCases){const m=structuredClone(original);m.layers[0]=room(5,5,row.params).layers[0];m.layers[0].endPos=null;assertExterior(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),r=q.run(budget);assert.equal(e.mapId,row.mapId);assert.equal(r.status,row.result.status);assert.equal(r.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);assert.deepEqual(q.firstActions(),row.actions);if(!row.north&&row.south)compact=m;}
const e=createReferenceEnvironment(compact),nm=structuredClone(compact);nm.layers.forEach(l=>l.endPos=null);const no=createReferenceEnvironment(nm),count=(s,x,y)=>s.layerStates[1].ghosts.filter(g=>g.x===x&&g.y===y).length;
for(const row of record.southCompressedHistoryQueries){const name=row.name,q=createBreadthFirstSearch(e,{monitor:{initial:()=>[0,0],advance(h,b,a,n){
 if(n.isWon&&no.step(b,a).isDead)return null;
 const grew=n.layerStates[1].ghosts.length>b.layerStates[1].ghosts.length,north=grew&&count(n,2,1)>count(b,2,1),south=grew&&count(n,2,3)>count(b,2,3),history=[h[0]||grew?1:0,h[1]||!h[0]&&south?1:0];
 const ghosts=s=>s.layerStates.flatMap((l,li)=>l.ghosts.map(g=>[g.id,li,g.x,g.y])).sort((a,b)=>a[0]-b[0]);
 if(name==='noGhostUpNorth'&&north||name==='keyWithoutGhostAbove'&&n.player.keys>b.player.keys&&count(n,2,2)>0||name==='noNorthStair'&&a==='STAIR'&&b.player.x===2&&b.player.y===1||name==='noSouthStair'&&a==='STAIR'&&b.player.x===2&&b.player.y===3||name==='noGhostMovesAfterKey'&&b.player.keys>0&&JSON.stringify(ghosts(b))!==JSON.stringify(ghosts(n)))return null;
 if(n.isWon&&name==='firstGhostUpSouth'&&!history[1])return null;
 return history;
 }}}),r=q.run(budget);assert.equal(r.status,row.result.status);assert.equal(r.status,'proven_unsat');}
for(const[name,map]of[['original25',original],['compact22',compact]]){
 const env=createReferenceEnvironment(map),queue=[{s:env.initialState(),actions:[]}],seen=new Set([env.stateKey(queue[0].s)]);let found=null;
 for(let i=0;i<queue.length&&!found;i++){const{s,actions}=queue[i];if(s.isWon||s.isDead)continue;for(const a of env.actions){const n=env.step(s,a);if(n===s||n.isDead)continue;const aa=[...actions,a];if(n.layerStates[1].ghosts.some(g=>g.x===2&&g.y===3)&&s.layerStates[1].ghosts.length===0){found={prefix:aa,scene:{p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y]))}};const q=createBreadthFirstSearch({...env,initialState:()=>n});assert.equal(q.run(budget).status,'proven_unsat');break;}const k=env.stateKey(n);if(!seen.has(k)){seen.add(k);queue.push({s:n,actions:aa});}}}
 const old=record.wrongSideReachability.find(r=>r.name===name);assert.equal(queue.length,old.expanded);assert.deepEqual(found,old.found?{prefix:old.found.prefix,scene:old.found.scene}:null);
 if(name==='compact22')assert.equal(queue.length,157);
}
const qa=auditMultilayerMap(compact);assert.equal(qa.count,'12');assert.equal(qa.allResult.totalActions,28);assert.equal(new Set(qa.routes.map(r=>JSON.stringify(r.trace.map(t=>t.ghosts)))).size,8);assert.equal(qa.boundary.status,'safe');
assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../../levels/54/map.json',root))),original);
console.log(JSON.stringify({fixedCases:3,compressedOptimal:28,raw:12,timedGhostGroups:8,allOptimalMechanicallySafe:true,originalWrongSideSafePrefix:7,compressedWrongSideReachable:false,compressedReachableStates:157,publicMapUnchanged:true,humanQuality:null}));
