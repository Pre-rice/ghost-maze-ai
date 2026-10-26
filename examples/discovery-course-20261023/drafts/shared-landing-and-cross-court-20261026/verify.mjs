import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {auditEntryPath} from '../../entry-path.mjs';
const root=new URL('.',import.meta.url),budget={nodeBudget:500000,stateBudget:500000,budgetMs:30000},reports=[];
for(const name of ['shared-landing','cross-first','cross-entry','twin-caches','oneway-return']){
 const pack=JSON.parse(fs.readFileSync(new URL(name+'.json',root)));
 for(const row of pack.rows){
  const map=structuredClone(pack.baseMap);
  for(const edit of row.edits){let target=map;for(const key of edit.path.slice(0,-1))target=target[key];target[edit.path.at(-1)]=structuredClone(edit.value);}
  const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);
  assert.equal(env.mapId,row.mapId);assert.equal(result.status,row.result.status);assert.notEqual(result.status,'unknown');assert.equal(result.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);
  if(row.boundary)assert.equal(auditPuzzleBoundaries(map,budget).status,row.boundary.status);
  if(result.status==='solved'){
   assert(env.replay(row.actions).state.isWon);const withoutGoal=structuredClone(map);withoutGoal.layers.forEach(layer=>layer.endPos=null);const noEnd=createReferenceEnvironment(withoutGoal);
   assert.equal([...q.routes()].every(actions=>{try{noEnd.replay(actions);return true;}catch{return false;}}),row.allNoEnd);
  }
  if(row.entry){const entry=auditEntryPath(map,[...q.routes()].map(actions=>({actions})),{external:row.entry.external,externalCells:row.entry.externalCells,actions:row.entry.actions});assert.deepEqual(entry,row.entry);}
  reports.push({name,variant:row.variant??row.rightY,status:result.status,T:result.totalActions});
 }
}
console.log(JSON.stringify({reports,scope:'只读41项实际构造；安全和必要性不作趣味评价'}));
