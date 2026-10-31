import fs from 'node:fs';
import assert from 'node:assert/strict';
import {room} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
import {analyzeOrdinaryPlans} from '../../../../src/design/ordinary-plans.js';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';

const record=JSON.parse(fs.readFileSync(new URL('cases.json',import.meta.url))),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const equalQuery=(actual,old)=>{assert.equal(actual.result.status,old.result.status);assert.equal(actual.result.totalActions,old.result.totalActions);assert.deepEqual(actual.actions,old.actions);};
let solved=0,conflict=0;
for(const row of record.cases){
 const map=room(...row.size,row.params);assertExterior(map);
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);
 assert.equal(env.mapId,row.mapId);assert.equal(result.status,row.result.status);assert.equal(result.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);assert.deepEqual(q.firstActions(),row.actions);
 if(result.status==='solved'){
  solved++;
  if(row.audit){const qa=auditMap(map);assert(qa.cold);assert.equal(qa.count,row.audit.count);assert.equal(qa.noEndSafeRoutes,row.audit.noEndSafeRoutes);assert.deepEqual(qa.physicalAudit,row.audit.physicalAudit);assert.equal(qa.mapCode,row.audit.mapCode);}
  else {const qa=auditPuzzleBoundaries(map,budget);assert.equal(qa.status,'conflict');assert.equal(qa.reason,'optimal_solution_uses_overlap');conflict++;}
 }
 const nn=structuredClone(map);nn.layers[0].endPos=null;const no=createReferenceEnvironment(nn);
 for(const old of row.nativeQueries){
  const name=old.name,query=createBreadthFirstSearch(env,{monitor:{initial:()=>row.group==='exported-escort'?[0]:[0,0],advance(h,b,a,n){
   if(n.isWon&&no.step(b,a).isDead)return null;
   const gs=n.layerStates[0].ghosts;
   if(row.group!=='exported-escort'&&new Set(gs.map(g=>g.x+','+g.y)).size!==2)return null;
   const outside=gs[0].x>=3,history=row.group==='exported-escort'?[h[0]||outside?1:0]:h;
   if(name==='never_inside_ghost_outside'&&outside||name==='key_before_inside_ghost_outside'&&n.player.keys>b.player.keys&&(h[0]||outside)||name==='never_G1_at_east_niche'&&gs[1].x===4&&gs[1].y===1)return null;
   if(name==='no_mutual_influence_or_overlap'){const f=inspectGhostInfluence(env,b,a,n);if(f.kind==='motion'||f.kind==='overlap')return null;}
   return history;
  }}}),r=query.run(budget);equalQuery({result:r,actions:query.firstActions()},old);
 }
 if(row.ordinary){const fresh=analyzeOrdinaryPlans(map,{...budget,totalBudgetMs:120000});assert.equal(fresh.conclusion,row.ordinary.conclusion);equalQuery(fresh.baseline,row.ordinary.baseline);for(let i=0;i<fresh.queries.length;i++)equalQuery(fresh.queries[i],row.ordinary.queries[i]);assert.deepEqual(fresh.completeOrders,row.ordinary.completeOrders);}
}
assert.equal(record.adopted,0);assert.equal(record.humanQuality,null);
console.log(JSON.stringify({fixedManualCases:record.cases.length,solved,conflictingAllOptimal:conflict,adopted:0,publicLevelsUnchanged:47,scope:'列明构图，不证明单向门或静态双鬼普遍无潜力'}));
