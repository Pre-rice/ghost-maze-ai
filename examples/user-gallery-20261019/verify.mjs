import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DataSerializer, ReplaySerializer, WALL_TYPES as W, validateMapData } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { shouldDrawBoundary } from '../../../ghost-maze/src/view/renderer.js';

export const submissions = [
 {title:'同调',slug:'paired-controls',code:'AADB8fHx8fAAAAE14DAaBvgSwtwUggCgHOArgK4FVAAAAAYwCUFSCzzkEAAAAAAIAMIAADA'},
 {title:'换边',slug:'side-change',code:'AWM4wZDw4UMCAwNjUIMPkwIvA8MCF-4vAqwMILCFs0T4AyeYySIAAA'}
];
export const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};
export function assertEdges(map){
 const checked=validateMapData(map);assert(checked.valid,checked.error);
 for(const l of map.layers)for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  if(!l.activeCells[y][x])continue;
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(!l.activeCells[y+dy]?.[x+dx]){
   const xx=x+(dx===1?1:0),yy=y+(dy===1?1:0),wall=l[dx?'vWalls':'hWalls'][yy][xx];
   // 分享码允许边界为默认EMPTY；渲染强制画实墙，移动和视线在虚空停止。拒绝原始机关边，不改用户原码。
   assert(wall.type===W.EMPTY||wall.type===W.SOLID);
   assert(shouldDrawBoundary(xx,yy,!dx,l.activeCells,map.width,map.height));
  }
 }
}
export function auditDefaultBoundaries(map){
 const solid=structuredClone(map),edges=[];
 map.layers.forEach((l,li)=>{for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(l.activeCells[y][x])for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(!l.activeCells[y+dy]?.[x+dx]){
  const axis=dx?'v':'h',xx=x+(dx===1?1:0),yy=y+(dy===1?1:0);
  if(l[axis+'Walls'][yy][xx].type===W.EMPTY){edges.push([li,axis,xx,yy]);solid.layers[li][axis+'Walls'][yy][xx]={type:W.SOLID,keys:0};}
 }});
 const physical=state=>JSON.stringify({p:[state.player.x,state.player.y,state.player.layer,state.player.keys,state.player.hp],dead:state.isDead,won:state.isWon,layers:state.layerStates.map((l,li)=>({ghosts:l.ghosts.map(g=>[g.x,g.y]),items:l.items,walls:['h','v'].map(axis=>l.wallStates[axis].map((row,y)=>row.map((w,x)=>{const ac=map.layers[li].activeCells;return ac[y]?.[x]&&(axis==='h'?ac[y-1]?.[x]:ac[y]?.[x-1])?w:null;})))}))});
 const env=createReferenceEnvironment(map),other=createReferenceEnvironment(solid),q=[[env.initialState(),other.initialState()]],seen=new Set([env.stateKey(q[0][0])]);let compared=0;
 for(let head=0;head<q.length;head++){
  assert(q.length<1000000);const[s,t]=q[head];assert.equal(physical(s),physical(t));if(s.isDead||s.isWon)continue;
  for(const a of env.actions){const n=env.step(s,a),m=other.step(t,a);assert.equal(physical(n),physical(m));compared++;if(n===s||n.isDead)continue;const k=env.stateKey(n);if(!seen.has(k)){seen.add(k);q.push([n,m]);}}
 }
 return {defaultEmptyEdges:edges,renderedSolid:true,allReachableInternalSuccessorsEqual:true,reachable:q.length,compared,includesFatalActions:true,originalMapCodeUnchanged:true};
}
export function groupMap(map){
 const q=createBreadthFirstSearch(createReferenceEnvironment(map),{allOptimal:true,classifyState:ghostFrame});assert.equal(q.run(budget).status,'solved');
 const g=createTrajectoryGroups(q.optimalGraph()),result=g.run(budget);assert.equal(result.status,'solved');
 const routes=[...g.routes()];return {...result,routes,codes:routes.map(actions=>{const r=ReplaySerializer.generateShareCode(map,actions);assert(r.success);return r.code;})};
}
export function inspectSubmission(row){
 const d=DataSerializer.loadFromShareCode(row.code);assert(d.success,d.error);const map=d.data.mapData;assertEdges(map);
 const qa=auditMap(map,row.code),grouping=groupMap(map),defaultBoundaryAudit=auditDefaultBoundaries(map);
 assert(qa.cold);assert(qa.entry.initialInteriorEqual);assert(qa.entry.wholeOptimalRoutesInteriorEqual);
 const l=map.layers[0],cells=l.activeCells.flat().filter(Boolean).length,xs=[],ys=[];
 l.activeCells.forEach((a,y)=>a.forEach((active,x)=>{if(active){xs.push(x);ys.push(y);}}));
 return {title:row.title,slug:row.slug,mapCode:row.code,map,qa,grouping,defaultBoundaryAudit,cells,ghosts:l.ghosts.length,keys:l.items.filter(i=>i.type==='key').length,width:Math.max(...xs)-Math.min(...xs)+1,height:Math.max(...ys)-Math.min(...ys)+1,humanQuality:null,role:'physics_and_implementation_QA_not_player_feedback'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 for(const row of submissions){const stored=JSON.parse(fs.readFileSync(new URL(row.slug+'/evidence.json',import.meta.url))),fresh=inspectSubmission(row);
  for(const field of ['mapCode','map','cells','ghosts','keys','width','height'])assert.deepEqual(fresh[field],stored[field]);
  for(const field of ['mapId','ruleset','cold','count','routes','physicalAudit','entry'])assert.deepEqual(fresh.qa[field],stored.qa[field]);
  assert.deepEqual(fresh.grouping.routes,stored.grouping.routes);assert.equal(fresh.grouping.count,stored.grouping.count);
  assert.deepEqual(fresh.defaultBoundaryAudit,stored.defaultBoundaryAudit);
  console.log(JSON.stringify({title:row.title,N:fresh.qa.allResult.totalActions,rawOptimal:fresh.qa.count,ghostTrajectories:fresh.grouping.count,cold:fresh.qa.cold,entry:fresh.qa.entry}));
 }
}
