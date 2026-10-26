import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const pack=JSON.parse(fs.readFileSync(new URL('variants.json',import.meta.url))),budget={nodeBudget:500000,stateBudget:500000,budgetMs:30000};
for(const row of pack.rows){
 const map=structuredClone(pack.baseMap);for(const edit of row.edits){let target=map;for(const key of edit.path.slice(0,-1))target=target[key];target[edit.path.at(-1)]=structuredClone(edit.value);}
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);assert.equal(env.mapId,row.mapId);assert.equal(result.status,row.result.status);assert.notEqual(result.status,'unknown');assert.equal(result.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);
 if(row.boundary)assert.equal(auditPuzzleBoundaries(map,budget).status,row.boundary.status);
 if(result.status==='solved'){assert(env.replay(row.actions).state.isWon);const z=structuredClone(map);z.layers.forEach(layer=>layer.endPos=null);const noEnd=createReferenceEnvironment(z);assert.equal([...q.routes()].every(actions=>{try{noEnd.replay(actions);return true;}catch{return false;}}),row.allNoEnd);}
}
console.log(JSON.stringify({comparisons:pack.rows.length,scope:'只读原型复验；必要性及最优分支过滤不作趣味结论'}));
