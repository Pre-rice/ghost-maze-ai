import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const root=new URL('.',import.meta.url),budget={nodeBudget:600000,stateBudget:600000,budgetMs:30000};
export function restore(pack,row){
 const map=structuredClone(pack.baseMap);
 for(const {path,value} of row.edits){assert(path.length);let target=map;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=structuredClone(value);}
 return map;
}
const reports=[];
for(const name of ['courtyard','single-shaft','control-court','four-chambers']){
 const pack=JSON.parse(fs.readFileSync(new URL(name+'.json',root)));let solved=0,unsat=0,boundaries=0;
 for(const row of pack.rows){
  const map=restore(pack,row),env=createReferenceEnvironment(map),copy=structuredClone(map);copy.layers.forEach(layer=>layer.endPos=null);const noEnd=createReferenceEnvironment(copy);
  if(row.mapId)assert.equal(env.mapId,row.mapId);
  const query=createBreadthFirstSearch(env,{allOptimal:row.count!==undefined,...(row.goalArrivalFilter?{monitor:{initial:()=>[],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:h}}:{})}),result=query.run(budget);
  assert.notEqual(result.status,'unknown');assert.equal(result.status,row.result.status,`${name}/${row.group}/${row.index}`);assert.equal(result.totalActions,row.result.totalActions);
  if(row.count!==undefined)assert.equal(query.routeCount().toString(),row.count);
  if(row.actions){assert(env.replay(row.actions).state.isWon);assert.equal(row.actions.length,result.totalActions);if(row.goalArrivalFilter)assert(!noEnd.replay(row.actions).state.isDead);}
  if(row.boundary){const boundary=auditPuzzleBoundaries(map,budget);assert.equal(boundary.status,row.boundary.status);assert.equal(boundary.optimum,row.boundary.optimum);boundaries++;}
  if(result.status==='solved')solved++;else unsat++;
 }
 reports.push({name,rows:pack.rows.length,solved,unsat,boundaries});
}
const pack=JSON.parse(fs.readFileSync(new URL('single-shaft.json',root))),row=pack.rows.find(x=>x.group==='return-aperture'&&x.index===1),env=createReferenceEnvironment(restore(pack,row)),copy=restore(pack,row);copy.layers.forEach(l=>l.endPos=null);const noEnd=createReferenceEnvironment(copy),nodes=[{state:env.initialState(),edges:[]}],ids=new Map([[env.stateKey(nodes[0].state),0]]),reverse=[],won=[];
for(let i=0;i<nodes.length;i++){
 const node=nodes[i];if(node.state.isWon){won.push(i);continue;}
 for(const action of env.actions){const next=env.step(node.state,action);if(next===node.state||next.isDead||next.isWon&&noEnd.step(node.state,action).isDead)continue;let to=ids.get(env.stateKey(next));if(to===undefined){to=nodes.length;ids.set(env.stateKey(next),to);nodes.push({state:next,edges:[]});}node.edges.push({action,to});(reverse[to]??=[]).push(i);}
 assert(nodes.length<100000);
}
const winning=new Set(won),todo=[...won];for(let i=0;i<todo.length;i++)for(const from of reverse[todo[i]]??[])if(!winning.has(from)){winning.add(from);todo.push(from);}
const stored=JSON.parse(fs.readFileSync(new URL('single-shaft-choices.json',root)));let state=env.initialState(),forced=0;
assert.equal(nodes.length,stored.reachableStates);assert.equal(winning.size,stored.winningStates);
for(const [i,action]of row.actions.entries()){const node=nodes[ids.get(env.stateKey(state))];if(node.edges.length===1)forced++;assert.deepEqual(node.edges.map(e=>({action:e.action,canEventuallyWin:winning.has(e.to)})),stored.choices[i].safeChoices);state=env.step(state,action);}
assert.equal(forced,stored.forcedImmediateSafeSteps);assert.equal(forced,5);
console.log(JSON.stringify({reports,singleShaft:{T:row.actions.length,forcedImmediateSafeSteps:forced},scope:'仅复验有限构造物理事实；不产生质量评价或真人学习结论'}));
