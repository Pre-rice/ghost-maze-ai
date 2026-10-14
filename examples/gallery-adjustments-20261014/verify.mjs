import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DataSerializer,ReplaySerializer,GameLogic,actionFromName,WALL_TYPES as W,normalizeVoidWalls,validateMapData} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {solveReferenceMap} from '../../src/search/reference-solver.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../src/design/rule-boundaries.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';
const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000};
const canon=v=>JSON.parse(JSON.stringify(v));
const physical=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.hp,s.player.keys],dead:s.isDead,won:s.isWon,l:s.layerStates.map(l=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),items:l.items,walls:l.wallStates}))});
const orders=n=>n===1?[[0]]:n===2?[[0,1],[1,0]]:[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
export function auditMap(map,mapCode){
 assertButtonAttachments(map);assert(validateMapData(map).valid);const env=createReferenceEnvironment(map),reference=solveReferenceMap(map,budget),fast=solveFastMap(map,budget);
 assert.equal(reference.status,'solved');assert.equal(fast.status,'solved');assert.equal(fast.solution.totalActions,reference.solution.totalActions);
 const all=createBreadthFirstSearch(env,{allOptimal:true}),allResult=all.run(budget);assert.equal(allResult.status,'solved');assert.equal(allResult.totalActions,reference.solution.totalActions);
 const boundary=auditPuzzleBoundaries(map,budget);assert.equal(boundary.status,'safe',JSON.stringify(boundary));
 const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);const decoded=DataSerializer.loadFromShareCode(mapCode??encoded.code);assert(decoded.success);assert.deepEqual(decoded.data.mapData,map);
 const initial=env.initialState(),cold=map.layers[0].ghosts.every(g=>!GameLogic._canGhostSeePlayer(g,initial.player,env.mapDefinition.layers[0],initial.layerStates[0]));
 const queue=[initial],seen=new Set([env.stateKey(initial)]),permutations=orders(map.layers[0].ghosts.length);let transitions=0,compared=0;
 for(let head=0;head<queue.length;head++){
  assert(queue.length<1000000);const s=queue[head];if(s.isWon||s.isDead)continue;
  for(const action of env.actions){const next=env.step(s,action);transitions++;
   for(const order of permutations){const altered=s.clone(),old=altered.layerStates[0].ghosts;altered.layerStates[0].ghosts=order.map(i=>old[i]);altered.layerStates[0].ghosts.forEach((g,i)=>g.id=733-i*509);assert.equal(physical(next),physical(env.step(altered,action)));compared++;}
   if(next===s||next.isDead)continue;const key=env.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
  }
 }
 const interior=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,g:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),i:s.layerStates.map(l=>l.items),w:s.layerStates.map((l,li)=>Object.fromEntries(['h','v'].map(axis=>[axis,l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{const ac=map.layers[li].activeCells;return ac[y]?.[x]&&(axis==='h'?ac[y-1]?.[x]:ac[y]?.[x-1])?[[x,y,w]]:[];}))])))});
 const start=map.layers[0].customStartPos;let entry=null,entryEnv=null,firstMismatch=null;
 const arrivals=[{x:start.x,y:start.y,settle:[]}];
 for(const[dx,dy,settle]of[[1,0,'L'],[-1,0,'R'],[0,1,'U'],[0,-1,'D']])if(map.layers[0].activeCells[start.y+dy]?.[start.x+dx])arrivals.push({x:start.x+dx,y:start.y+dy,settle:[settle]});
 entrySearch:for(const target of arrivals)for(const[dx,dy,action]of[[1,0,'R'],[-1,0,'L'],[0,1,'D'],[0,-1,'U']]){
  const x=target.x-dx,y=target.y-dy,l=map.layers[0];if(x<0||y<0||x>=map.width||y>=map.height||l.activeCells[y][x])continue;
  const entryMap=structuredClone(map),el=entryMap.layers[0];el.activeCells[y][x]=true;el.customStartPos={x,y};
  for(const[ex,ey]of[[1,0],[-1,0],[0,1],[0,-1]])if(el.activeCells[y+ey]?.[x+ex])el[(ex?'v':'h')+'Walls'][y+(ey===1?1:0)][x+(ex===1?1:0)]={type:W.SOLID,keys:0};
  el[(dx?'v':'h')+'Walls'][Math.max(target.y,y)][Math.max(target.x,x)]={type:W.ONE_WAY,keys:0,direction:{dx,dy}};
  const checked=validateMapData(normalizeVoidWalls(entryMap));if(!checked.valid)continue;
  const tryEnv=createReferenceEnvironment(checked.mapData),prefix=[action,...target.settle];let state=tryEnv.initialState(),valid=true;
  for(const a of prefix){const next=tryEnv.step(state,a);if(next===state||next.isDead){valid=false;break;}state=next;}
  if(!valid||state.player.x!==start.x||state.player.y!==start.y)continue;
  const observed={external:[0,x,y],actions:prefix,unitArrival:[0,target.x,target.y],internal:[0,start.x,start.y],keys:0,externalGhosts:0,exteriorSealedExceptEntrance:true,initialInteriorEqual:interior(initial)===interior(state),afterGhosts:state.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y]))};
  if(observed.initialInteriorEqual){entry=observed;entryEnv=tryEnv;break entrySearch;}
  firstMismatch??=observed;
 }
 entry??=firstMismatch;
 const noEnd=structuredClone(map);noEnd.layers[0].endPos=null;const noEndEnv=createReferenceEnvironment(noEnd),routes=[];assert(all.routeCount()<=10000n,'路线过多，须分开证据而不是跳过边界审查');
 for(const actions of all.routes()){
  const replay=ReplaySerializer.generateShareCode(map,actions);assert(replay.success);assert.deepEqual(ReplaySerializer.loadFromShareCode(map,replay.code).actions,actions);
  let state=env.initialState(),entered=entry?.initialInteriorEqual?entry.actions.reduce((s,a)=>entryEnv.step(s,a),entryEnv.initialState()):null;const trace=[],controls=[];
  for(const[i,a]of actions.entries()){const before=state,diagnostics=[];state=GameLogic.calculateNextState(state,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});
   assert(!state.isDead);if(entered){entered=entryEnv.step(entered,a);assert.equal(interior(state),interior(entered));}
   if(before.player.x===state.player.x&&before.player.y===state.player.y){const b=map.layers[0].buttons.find(b=>b.x===before.player.x&&b.y===before.player.y&&((a==='U'&&b.direction.dy===-1)||(a==='D'&&b.direction.dy===1)||(a==='L'&&b.direction.dx===-1)||(a==='R'&&b.direction.dx===1)));assert(b);controls.push({step:i+1,letter:b.letter,at:[b.x,b.y]});}
   trace.push({step:i+1,action:a,p:[state.player.layer,state.player.x,state.player.y],ghosts:state.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),diagnostics});
  }
  assert(state.isWon);assert(!noEndEnv.replay(actions).state.isDead);routes.push({actions,replayCode:replay.code,controls,trace});
 }
 if(entry?.initialInteriorEqual)entry.wholeOptimalRoutesInteriorEqual=true;
 return canon({mapId:env.mapId,ruleset:env.ruleset,reference,fast,allResult,count:all.routeCount().toString(),boundary,cold,entry,physicalAudit:{reachable:queue.length,transitions,permutations:permutations.length,compared,includesFatalActions:true},noEndSafeRoutes:routes.length,mapCode:mapCode??encoded.code,replayCode:routes[0].replayCode,actions:routes[0].actions,routes,role:'physical_QA_not_human_quality'});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('.',import.meta.url)),index=JSON.parse(fs.readFileSync(root+'index.json'));
 for(const row of index.maps){const map=JSON.parse(fs.readFileSync(root+row.directory+'/map.json')),stored=JSON.parse(fs.readFileSync(root+row.directory+'/evidence.json')),fresh=auditMap(map,stored.mapCode);assert.equal(fresh.mapId,stored.mapId);assert.equal(fresh.ruleset,stored.ruleset);assert.deepEqual(fresh.routes,stored.routes);console.log(JSON.stringify({title:row.title,T:fresh.allResult.totalActions,count:fresh.count,boundary:fresh.boundary.status,cold:fresh.cold,entry:fresh.entry}));}
}
