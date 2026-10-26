import fs from 'node:fs';import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const root=new URL('.',import.meta.url),budget={nodeBudget:500000,stateBudget:500000,budgetMs:30000},reports=[];
function restore(pack,row){const m=structuredClone(pack.baseMap);for(const edit of row.edits){let t=m;for(const k of edit.path.slice(0,-1))t=t[k];t[edit.path.at(-1)]=structuredClone(edit.value);}return m;}
for(const name of ['staggered-chambers','protective-slot-targets','double-loop']){
 const pack=JSON.parse(fs.readFileSync(new URL(name+'.json',root)));let solved=0,noEndFailures=0;
 for(const row of pack.rows){
  const map=restore(pack,row),e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),r=q.run(budget);assert.equal(e.mapId,row.mapId);assert.notEqual(r.status,'unknown');assert.equal(r.status,row.result.status);assert.equal(r.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);
  if(row.boundary)assert.equal(auditPuzzleBoundaries(map,budget).status,row.boundary.status);
  if(r.status==='solved'){
   solved++;assert(e.replay(row.actions).state.isWon);const z=structuredClone(map);z.layers.forEach(l=>l.endPos=null);const ne=createReferenceEnvironment(z),allNoEnd=[...q.routes()].every(a=>{try{ne.replay(a);return true;}catch{return false;}});assert.equal(allNoEnd,row.allNoEnd);if(!allNoEnd)noEndFailures++;
  }
  if(name==='double-loop'){
   // 箭头允许方向从终点出发，正常终局之前根本不能使用；同一物理图可固定为墙。
   const wall=structuredClone(map);wall.layers[0].hWalls[1][3]={type:1,keys:0};const w=createReferenceEnvironment(wall),queue=[[e.initialState(),w.initialState()]],seen=new Set([e.stateKey(queue[0][0])]);
   const physical=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,g:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),items:s.layerStates.map(l=>l.items),walls:s.layerStates.map(l=>['h','v'].map(axis=>l.wallStates[axis].map((a,y)=>a.map((v,x)=>axis==='h'&&x===3&&y===1?null:v))))});
   for(let i=0;i<queue.length;i++){const [a,b]=queue[i];assert(queue.length<100000);assert.equal(physical(a),physical(b));if(a.isWon||a.isDead)continue;for(const action of e.actions){const n=e.step(a,action),m=w.step(b,action);assert.equal(physical(n),physical(m));assert.equal(n===a,m===b);if(n===a||n.isDead)continue;const k=e.stateKey(n);if(!seen.has(k)){seen.add(k);queue.push([n,m]);}}}
  }
 }
 reports.push({name,rows:pack.rows.length,solved,noEndFailures});
}
console.log(JSON.stringify({reports,scope:'只读有限构造复验；双环箭头固定墙核对全部非终局后继含死亡，不作一般单向门价值否定'}));
