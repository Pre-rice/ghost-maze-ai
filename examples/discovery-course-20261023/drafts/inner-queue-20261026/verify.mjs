import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
import {solveContinuation} from '../../../../src/design/continuation.js';
import {buildLevel} from '../../build.mjs';
const root=new URL('.',import.meta.url),pack=JSON.parse(fs.readFileSync(new URL('variants.json',root))),budget={nodeBudget:500000,stateBudget:500000,budgetMs:30000};
for(const row of pack.rows){
 const map=structuredClone(pack.baseMap);
 for(const edit of row.edits){let target=map;for(const key of edit.path.slice(0,-1))target=target[key];target[edit.path.at(-1)]=structuredClone(edit.value);}
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);
 assert.equal(env.mapId,row.mapId);assert.notEqual(result.status,'unknown');assert.equal(result.status,row.result.status);assert.equal(result.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);
 if(row.boundary)assert.equal(auditPuzzleBoundaries(map,budget).status,row.boundary.status);
 if(result.status==='solved'){
  assert(env.replay(row.actions).state.isWon);const z=structuredClone(map);z.layers.forEach(layer=>layer.endPos=null);const noEnd=createReferenceEnvironment(z);
  assert.equal([...q.routes()].every(actions=>{try{noEnd.replay(actions);return true;}catch{return false;}}),row.allNoEnd);
 }
}
const proof=JSON.parse(fs.readFileSync(new URL('adopted-analysis.json',root))),map=buildLevel('57'),env=createReferenceEnvironment(map);assert.equal(env.mapId,proof.mapId);
for(const previous of proof.wrongPlan.continuations){const answer=solveContinuation(map,proof.wrongPlan.prefix,{...budget,reference:previous.reference});assert.equal(answer.status,'proven_unsat');}
const wrong=env.replay(proof.wrongPlan.prefix).state,right=env.replay(proof.preparedComparison.prefix).state,ghosts=state=>state.layerStates[0].ghosts.map(g=>[g.x,g.y]).sort();
assert.deepEqual([wrong.player.x,wrong.player.y],[right.player.x,right.player.y]);assert.deepEqual(ghosts(wrong),ghosts(right));assert.notEqual(wrong.layerStates[0].wallStates.h[1][2].currentState,right.layerStates[0].wallStates.h[1][2].currentState);
const z=structuredClone(map);z.layers[0].endPos=null;const noEnd=createReferenceEnvironment(z),q=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance:(h,b,a,n)=>n.isWon&&noEnd.step(b,a).isDead||['motion','overlap'].includes(inspectGhostInfluence(env,b,a,n).kind)?null:h}});assert.equal(q.run(budget).status,'proven_unsat');
console.log(JSON.stringify({variants:pack.rows.length,mapId:env.mapId,wrongPlan:'proven_unsat_fast_and_reference',withoutInfluence:'proven_unsat',scope:'只读原型与现行课程图；不是新手过程、趣味评分或训练'}));
