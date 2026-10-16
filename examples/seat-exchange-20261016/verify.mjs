import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {solveContinuation} from '../../src/design/continuation.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {applyEdit} from '../../src/design/edits.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import{enumeratePlanningGraph}from'../../src/training/planning-graph.js';import{GameLogic,actionFromName}from'../../src/reference/engine.js';
const at=(s,i,x,y)=>s.layerStates[0].ghosts[i]?.x===x&&s.layerStates[0].ghosts[i]?.y===y;
export function core(map){
 const g=enumeratePlanningGraph(map);if(g.status!=='exhausted')return{status:'unknown'};if(g.nodes[0].state.layerStates[0].ghosts.length!==2)return{status:'rejected',reason:'ghost_count'};
 const es=g.nodes.map(n=>n.edges.map(e=>{const ds=[],next=GameLogic.calculateNextState(n.state,actionFromName(e.action),g.env.mapDefinition,{visibility:false,trails:false,ghostDiagnostics:ds}),move=j=>n.state.layerStates[0].ghosts[j].x!==next.layerStates[0].ghosts[j].x||n.state.layerStates[0].ghosts[j].y!==next.layerStates[0].ghosts[j].y;
 return{...e,press:n.state.player.x===4&&n.state.player.y===5&&e.action==='R',oldLeft:at(n.state,1,2,4),rightPark:at(n.state,1,3,4)&&n.state.player.x===2&&n.state.player.y===4&&at(n.state,0,4,6),newMoves:move(0),oldMoves:move(1),oldPriority:ds.some(d=>d.decision==='visible_target_priority'&&at(n.state,1,d.contenders.find(c=>c.seesAfter).from.x,d.contenders.find(c=>c.seesAfter).from.y)),newPriority:ds.some(d=>d.decision==='visible_target_priority'&&at(n.state,0,d.contenders.find(c=>c.seesAfter).from.x,d.contenders.find(c=>c.seesAfter).from.y)),finalClose:at(n.state,0,4,4)&&n.state.player.x===4&&n.state.player.y===5&&e.action==='R'&&n.state.layerStates[0].wallStates.h[5][4].currentState==='open'};}));
 function prove(name,filter){const q=[{i:0,seenA:false,newStarted:false,parent:-1,a:null}],seen=new Set(['0,false,false']);for(let h=0;h<q.length;h++){const n=q[h];if(g.nodes[n.i].state.isWon){const actions=[];for(let k=h;q[k].parent>=0;k=q[k].parent)actions.push(q[k].a);actions.reverse();return{name,status:'solved',N:actions.length,actions,states:seen.size};}for(const e of es[n.i]){if(!filter(n,e))continue;const na=n.seenA||e.press,ns=n.newStarted||e.newMoves,key=`${e.to},${na},${ns}`;if(!seen.has(key)){seen.add(key);q.push({i:e.to,seenA:na,newStarted:ns,parent:h,a:e.action});}}}return{name,status:'proven_unsat',states:seen.size};}
 // seenA与newStarted都进入seen键，避免物理相同但历史不同的前缀互相吞并。
 const proofs=[prove('first_A_requires_old_left',(n,e)=>!e.press||n.seenA||!e.oldLeft),prove('old_right_after_A_while_new_at_start',(n,e)=>!(n.seenA&&e.rightPark)),prove('old_reactivation_after_new_started',(n,e)=>!(n.newStarted&&e.oldMoves)),prove('new_visible_priority',(n,e)=>!e.newPriority),prove('old_visible_priority',(n,e)=>!e.oldPriority)];
 return{status:'exhausted',mapId:g.env.mapId,states:g.nodes.length,N:g.distance[0],safeN:g.safeDistance[0],proofs};
}

export function verify() {
 const root=new URL('.',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('map.json',root))),qa=auditMap(map),c=core(map);
 assert.equal(qa.allResult.totalActions,30);assert.equal(qa.count,'3');assert(qa.cold&&qa.entry?.wholeOptimalRoutesInteriorEqual);assert.equal(c.status,'exhausted');
 for(const p of c.proofs.slice(0,4))assert.equal(p.status,'proven_unsat',p.name);
 assert.equal(c.proofs[4].status,'solved');assert.equal(c.proofs[4].N,31);
 const noEnd=structuredClone(map);noEnd.layers[0].endPos=null;assert(!createReferenceEnvironment(noEnd).replay(c.proofs[4].actions).state.isDead);
 for(const route of qa.routes)assert.equal(route.controls.length,1);
 const earlyPrefix=['D','D','D','U','U'],early=solveContinuation(map,earlyPrefix,{nodeBudget:10000,budgetMs:10000,reference:true});
 assert.equal(early.status,'proven_unsat');
 const wrongSidePrefix=['R','R','D','L','L'],wrongSide=solveContinuation(map,wrongSidePrefix,{nodeBudget:10000,budgetMs:10000,reference:true});assert.equal(wrongSide.status,'solved');
 const wallAblations=[];
 for(const [axis,x,y]of[['h',4,5],['v',4,3],['v',3,4]])for(const type of[0,1]){
  const altered=applyEdit(map,{type:'wall',axis,x,y,wall:{type,keys:0}}),result=solveFastMap(altered,{nodeBudget:10000,stateBudget:10000,budgetMs:3000});
  let noEndSafe=null;if(result.status==='solved'){const n=structuredClone(altered);n.layers[0].endPos=null;try{noEndSafe=!createReferenceEnvironment(n).replay(result.solution.actions).state.isDead;}catch{noEndSafe=false;}}
  wallAblations.push({axis,x,y,to:type,status:result.status,N:result.solution?.totalActions,noEndSafe});
 }
 const removeGhost=[0,1].map(index=>{const altered=applyEdit(map,{type:'remove_entity',field:'ghosts',index}),r=solveFastMap(altered,{nodeBudget:10000,stateBudget:10000,budgetMs:3000});return{removed:index,status:r.status,N:r.solution?.totalActions};});
 return{qa,core:c,earlyNewGhostPlan:early,wrongOrdinarySidePlan:wrongSide,wallAblations,removeGhost,humanQuality:null};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const r=verify();console.log(JSON.stringify({N:r.qa.allResult.totalActions,count:r.qa.count,cold:r.qa.cold,entry:r.qa.entry,physical:r.qa.physicalAudit,core:r.core,earlyNewGhostPlan:r.earlyNewGhostPlan,wallAblations:r.wallAblations,removeGhost:r.removeGhost}));
}
