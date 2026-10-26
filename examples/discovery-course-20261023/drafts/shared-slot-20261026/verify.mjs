import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {solveContinuation} from '../../../../src/design/continuation.js';
import {normalizeMapData,normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
import {buildLevel} from '../../build.mjs';
const root=new URL('.',import.meta.url),pack=JSON.parse(fs.readFileSync(new URL('variants.json',root))),budget={nodeBudget:500000,stateBudget:500000,budgetMs:30000};
function restore(row){const map=structuredClone(pack.baseMap);for(const edit of row.edits){let target=map;for(const key of edit.path.slice(0,-1))target=target[key];target[edit.path.at(-1)]=structuredClone(edit.value);}return map;}
for(const row of pack.rows){
 const map=restore(row),env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);assert.equal(env.mapId,row.mapId);assert.notEqual(result.status,'unknown');assert.equal(result.status,row.result.status);assert.equal(result.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);
 if(row.boundary)assert.equal(auditPuzzleBoundaries(map,budget).status,row.boundary.status);
 if(result.status==='solved'){assert(env.replay(row.actions).state.isWon);const z=structuredClone(map);z.layers.forEach(layer=>layer.endPos=null);const noEnd=createReferenceEnvironment(z);assert.equal([...q.routes()].every(actions=>{try{noEnd.replay(actions);return true;}catch{return false;}}),row.allNoEnd);}
}
const proof=JSON.parse(fs.readFileSync(new URL('adopted-analysis.json',root))),map=buildLevel('58'),env=createReferenceEnvironment(map);assert.equal(env.mapId,proof.mapId);
const raw=restore(pack.rows.find(row=>row.group==='economy'&&row.index===4));assertExterior(raw);assert.deepEqual(normalizeVoidWalls(normalizeMapData(raw)),map);
const z=structuredClone(map);z.layers.forEach(layer=>layer.endPos=null);const noEnd=createReferenceEnvironment(z),overlap=state=>state.layerStates.some(layer=>new Set(layer.ghosts.map(g=>`${g.x},${g.y}`)).size!==layer.ghosts.length),parked=env.replay(proof.parkedPlan.prefix).state;
for(const previous of proof.parkedPlan.continuations){const answer=solveContinuation(map,proof.parkedPlan.prefix,{...budget,reference:previous.reference});assert.equal(answer.status,'solved');assert.equal(answer.actions.length,26);const actions=[...proof.parkedPlan.prefix,...answer.actions];assert(env.replay(actions).state.isWon);assert(!noEnd.replay(actions).state.isDead);let state=env.initialState();for(const action of actions){state=env.step(state,action);assert(!overlap(state));}}
const queries=[['keepInitialParking',{...env,initialState:()=>parked},(b,a,n)=>b.layerStates[1].ghosts.some(g=>g.x===2&&g.y===1)&&!n.layerStates[1].ghosts.some(g=>g.x===2&&g.y===1)],['noGhostReturnsDown',env,(b,a,n)=>n.layerStates[0].ghosts.length>b.layerStates[0].ghosts.length],['bothGhostsFinishUpstairs',env,(b,a,n)=>n.isWon&&n.layerStates[1].ghosts.length!==2],['noLetterOperation',env,(b,a,n)=>b.layerStates[0].wallStates.h[3][2].currentState!==n.layerStates[0].wallStates.h[3][2].currentState]];
for(const[name,e,reject]of queries){const q=createBreadthFirstSearch(e,{monitor:{initial:()=>[],advance:(h,b,a,n)=>overlap(n)||n.isWon&&noEnd.step(b,a).isDead||reject(b,a,n)?null:h}});assert.equal(q.run(budget).status,'proven_unsat',name);}
console.log(JSON.stringify({variants:pack.rows.length,mapId:env.mapId,originalParking:'recoverable_34_steps_but_cannot_remain_fixed',queries:queries.length,scope:'只读复验，机械事实不作趣味或真人学习结论'}));
