import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from '../../build.mjs';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
const d=JSON.parse(fs.readFileSync(new URL('analysis.json',import.meta.url))),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const old=buildLevel('37'),candidate=structuredClone(old);candidate.layers[0].vWalls[1][2]={type:0,keys:0};
const qa=auditMap(candidate);assert.equal(qa.mapId,d.qa.mapId);assert.equal(qa.allResult.totalActions,17);assert.equal(qa.count,'2');
assert.deepEqual(qa.routes,d.qa.routes);assert.equal(qa.noEndSafeRoutes,2);
for(const [map,name]of[[old,'original'],[candidate,'candidate']]){
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance(h,b,a,n){
  const c=h[0]+Number(n!==b&&n.player.x===b.player.x&&n.player.y===b.player.y);return c>1?null:[c];}}}),result=q.run(budget);
 assert.equal(result.status,name==='original'?'proven_unsat':'solved');
 if(name==='candidate'){assert.equal(result.totalActions,20);assert.deepEqual(q.firstActions(),d.queries[0].actions);
  const nm=structuredClone(map);nm.layers[0].endPos=null;assert(!createReferenceEnvironment(nm).replay(q.firstActions()).state.isDead);}
}
assert.equal(d.humanQuality,null);assert(d.slowerWitnessNoEndSafe);
console.log(JSON.stringify({originalT:19,candidateT:17,allOptimalSafe:true,originalMaxOneA:'proven_unsat',candidateMaxOneA:20,adopted:0,publicCourseUnchanged:true,humanQuality:null}));
