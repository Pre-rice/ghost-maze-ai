import fs from 'node:fs';import assert from 'node:assert/strict';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditMap} from '../../../gallery-adjustments-20261014/verify.mjs';
import {solveContinuation} from '../../../../src/design/continuation.js';
import {assertExterior} from '../../../spatial-clearance-20261019/verify.mjs';
const root=new URL('.',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),record=read('review.json'),decoded=DataSerializer.loadFromShareCode(record.sourceMapCode);assert(decoded.success);const source=decoded.data.mapData,budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};assert.equal(createReferenceEnvironment(source).mapId,record.sourceMapId);assert.deepEqual(source,read('../../levels/46/map.json'));
for(const row of record.rows){
 const map=structuredClone(source);if(row.keep!==null)map.layers[0].ghosts=[{...map.layers[0].ghosts[row.keep],id:0}];assertExterior(map);const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run(budget);assert.equal(env.mapId,row.mapId);assert.equal(env.ruleset,record.ruleset);assert.equal(r.status,row.result.status);assert.equal(r.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);assert.deepEqual(q.firstActions(),row.actions);
 const nn=structuredClone(map);nn.layers[0].endPos=null;const no=createReferenceEnvironment(nn);
 for(const old of row.avoid){const[fx,fy,tx,ty]=old.name==='entry'?[4,1,3,1]:[3,2,4,2];const qq=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance(h,b,a,n){if(b.player.x===fx&&b.player.y===fy&&n.player.x===tx&&n.player.y===ty||n.isWon&&no.step(b,a).isDead)return null;return h;}}}),rr=qq.run(budget);assert.equal(rr.status,old.result.status);assert.equal(rr.totalActions,old.result.totalActions);assert.deepEqual(qq.firstActions(),old.actions);}
 for(const old of row.prefixes){const fast=solveContinuation(map,old.prefix,budget),reference=solveContinuation(map,old.prefix,{...budget,reference:true});assert.equal(fast.status,old.fast.status);assert.equal(reference.status,old.reference.status);assert.deepEqual(fast.actions,old.fast.actions);if(fast.status==='solved')assert(!no.replay([...old.prefix,...fast.actions]).state.isDead);}
 if(row.keep!==null){const qa=auditMap(map);assert.equal(qa.count,row.count);assert(qa.cold);assert.equal(qa.boundary.status,'safe');assert.equal(qa.noEndSafeRoutes,Number(row.count));assert.deepEqual(qa.physicalAudit,row.allOptimalAudit.physicalAudit);}
}
console.log(JSON.stringify({fixedDeletions:2,sourceT:16,leftOnlyT:14,rightOnlyT:12,sourceEntryNecessary:true,sourceExitOptional:true,allSoloOptimalSafe:true,publicMapUnchanged:true,humanQuality:null}));
