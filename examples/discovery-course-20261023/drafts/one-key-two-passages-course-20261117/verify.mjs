import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
const root=new URL('./',import.meta.url),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000},rows=[];
for(const name of ['prototype','corridor-guard']){
 const frozen=JSON.parse(fs.readFileSync(new URL(name+'.json',root))),e=createReferenceEnvironment(frozen.map),nm=structuredClone(frozen.map);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);
 assert.equal(e.mapId,frozen.mapId);const q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget);assert.equal(result.status,'solved');assert.equal(result.totalActions,frozen.result.totalActions);assert.equal(q.routeCount().toString(),frozen.count);
 let noEndSafeRoutes=0;for(const a of q.routes())if(!no.replay(a).state.isDead)noEndSafeRoutes++;assert.equal(noEndSafeRoutes,Number(frozen.count));
 const unopened=createBreadthFirstSearch(e,{monitor:{initial:()=>[0],advance(h,b,a,n){if(n.layerStates[0].wallStates.h[4][4].type!==3)return null;if(n.isWon&&no.step(b,a).isDead)return null;return h;}}}),neverLower=unopened.run(budget);assert.equal(neverLower.status,'solved');assert.equal(neverLower.totalActions,result.totalActions);
 rows.push({name,mapId:e.mapId,result,count:frozen.count,noEndSafeRoutes,neverLower,actions:unopened.firstActions()});
}
fs.writeFileSync(new URL('complete-review.json',root),JSON.stringify({createdOn:'2026-11-17',humanQuality:null,scope:'分别保留上守卫或走廊守卫；禁开原下1的完整查询，及全部最优去终点。不是原双鬼必要性的移植。',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,T:r.result.totalActions,raw:r.count,neverLowerT:r.neverLower.totalActions,noEndSafeRoutes:r.noEndSafeRoutes}))));
