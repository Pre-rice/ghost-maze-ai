import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const source=read('source.json'),record=read('screen.json');
const original=createReferenceEnvironment(source.map);
assert.equal(original.mapId,source.sourceMapId);
assert.equal(original.ruleset,source.ruleset);
assert.equal(record.sourceMapId,original.mapId);
assert.equal(record.ruleset,original.ruleset);
const budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
for(const r of record.cases){
 const map=structuredClone(source.map),[gy,a,b]=r.spawn;
 map.layers[0].buttons=[];
 map.layers[0].hWalls[3][4]={type:r.type,keys:0};
 map.layers[0].ghosts=[{x:4,y:gy,id:0},{x:b,y:3,id:1},{x:a,y:3,id:2}];
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true});
 const result=q.run(budget);
 assert.equal(env.mapId,r.mapId);
 assert.equal(result.status,r.result.status);
 assert.equal(result.totalActions,r.result.totalActions);
 assert.equal(q.routeCount().toString(),r.count);
 if(result.status!=='solved')continue;
 assert.deepEqual(q.firstActions(),r.actions);
 const boundary=auditPuzzleBoundaries(map,budget);
 assert.equal(boundary.status,'conflict');
 assert.equal(boundary.reason,'optimal_solution_uses_overlap');
 assert.deepEqual(JSON.parse(JSON.stringify(boundary.observedNonFatalOverlap)),r.boundary.observedNonFatalOverlap);
 const noMap=structuredClone(map);noMap.layers[0].endPos=null;
 const noEnd=createReferenceEnvironment(noMap);
 const safe=createBreadthFirstSearch(env,{monitor:{
  initial:()=>[],
  advance:(h,b,a,n)=>n.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size!==l.ghosts.length)||n.isWon&&noEnd.step(b,a).isDead?null:h
 }});
 assert.equal(safe.run(budget).status,'proven_unsat');
 assert.equal(r.withoutOverlap.result.status,'proven_unsat');
}
console.log(JSON.stringify({fixedCases:14,adopted:0,nonOverlappingSolution:false,scope:'当前固定骨架与列明初位，不作全局不可行判断'}));
