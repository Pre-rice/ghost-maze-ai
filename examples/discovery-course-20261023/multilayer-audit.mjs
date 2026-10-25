import assert from 'node:assert/strict';
import {DataSerializer,ReplaySerializer,GameLogic,actionFromName,WALL_TYPES as W,validateMapData} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {solveReferenceMap} from '../../src/search/reference-solver.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../src/design/rule-boundaries.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';

const budget={nodeBudget:300000,stateBudget:300000,budgetMs:30000};
const physical=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.hp,s.player.keys],dead:s.isDead,won:s.isWon,layers:s.layerStates.map(l=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),items:l.items,walls:l.wallStates}))});

/** 两鬼跨层课程的完整原生验收；每个局面依当前所在层排列，不沿用初始层内下标。 */
export function auditMultilayerMap(map,mapCode){
 assert(map.layers.length>1);assert.equal(map.layers.reduce((n,l)=>n+l.ghosts.length,0),2,'此验收器限定两鬼，不能冒称其它数量已全排列');
 assert(validateMapData(map).valid);assertButtonAttachments(map);
 for(const l of map.layers)for(const[y,row]of l.activeCells.entries())for(const[x,on]of row.entries())if(on)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(!l.activeCells[y+dy]?.[x+dx])assert.equal(l[(dx?'v':'h')+'Walls'][y+(dy===1?1:0)][x+(dx===1?1:0)].type,W.SOLID);
 const env=createReferenceEnvironment(map),reference=solveReferenceMap(map,budget),fast=solveFastMap(map,budget);
 assert.equal(reference.status,'solved');assert.equal(fast.status,'solved');assert.equal(fast.solution.totalActions,reference.solution.totalActions);
 const all=createBreadthFirstSearch(env,{allOptimal:true}),allResult=all.run(budget);assert.equal(allResult.status,'solved');assert.equal(allResult.totalActions,reference.solution.totalActions);assert(all.routeCount()<=10000n);
 const boundary=auditPuzzleBoundaries(map,budget);assert.equal(boundary.status,'safe',JSON.stringify(boundary));
 const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);const decoded=DataSerializer.loadFromShareCode(mapCode??encoded.code);assert(decoded.success);assert.deepEqual(decoded.data.mapData,map);
 const initial=env.initialState(),playerLayer=initial.player.layer;
 const cold=initial.layerStates[playerLayer].ghosts.every(g=>!GameLogic._canGhostSeePlayer(g,initial.player,env.mapDefinition.layers[playerLayer],initial.layerStates[playerLayer]))&&GameLogic._getGhostStairChaseIntents(initial,initial.player,env.mapDefinition).length===0;
 assert(cold);
 const queue=[initial],seen=new Set([env.stateKey(initial)]);let transitions=0,compared=0;
 for(let head=0;head<queue.length;head++){
  assert(queue.length<300000);const s=queue[head];if(s.isWon||s.isDead)continue;
  for(const a of env.actions){const next=env.step(s,a);transitions++;assert.equal(next.layerStates.reduce((n,l)=>n+l.ghosts.length,0),2);
   for(const reverse of[false,true]){const changed=s.clone();let index=0;for(const l of changed.layerStates){if(reverse)l.ghosts.reverse();for(const g of l.ghosts)g.id=733-(index++)*509;}assert.equal(physical(next),physical(env.step(changed,a)));compared++;}
   if(next===s||next.isDead)continue;const key=env.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
  }
 }
 const withoutEnd=structuredClone(map);withoutEnd.layers.forEach(l=>l.endPos=null);const noEnd=createReferenceEnvironment(withoutEnd),routes=[];
 for(const actions of all.routes()){
  const encodedReplay=ReplaySerializer.generateShareCode(map,actions);assert(encodedReplay.success);assert.deepEqual(ReplaySerializer.loadFromShareCode(map,encodedReplay.code).actions,actions);
  let s=env.initialState(),loaded=createReferenceEnvironment(decoded.data.mapData).initialState();const loadedEnv=createReferenceEnvironment(decoded.data.mapData),trace=[],controls=[];
  for(const[i,a]of actions.entries()){const before=s,diagnostics=[];s=GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});loaded=loadedEnv.step(loaded,a);assert.equal(physical(s),physical(loaded));assert(!s.isDead);
   if(before.player.layer===s.player.layer&&before.player.x===s.player.x&&before.player.y===s.player.y){const b=map.layers[before.player.layer].buttons.find(b=>b.x===before.player.x&&b.y===before.player.y&&b.direction.dx==={U:0,D:0,L:-1,R:1}[a]&&b.direction.dy==={U:-1,D:1,L:0,R:0}[a]);assert(b);controls.push({step:i+1,letter:b.letter,at:[b.x,b.y],layer:before.player.layer});}
   trace.push({step:i+1,action:a,p:[s.player.layer,s.player.x,s.player.y],ghosts:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),diagnostics});
  }
  assert(s.isWon);assert(!noEnd.replay(actions).state.isDead);routes.push({actions,replayCode:encodedReplay.code,controls,trace});
 }
 return JSON.parse(JSON.stringify({mapId:env.mapId,ruleset:env.ruleset,reference,fast,allResult,count:all.routeCount().toString(),boundary,cold,entry:null,physicalAudit:{reachable:queue.length,transitions,compared,permutations:2,scope:'两鬼当前层内的全部排列与全局重新编号，包含跨层后分布',includesFatalActions:true},noEndSafeRoutes:routes.length,mapCode:mapCode??encoded.code,replayCode:routes[0].replayCode,actions:routes[0].actions,routes,role:'physical_QA_not_human_quality'}));
}
