import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {GameLogic,actionFromName,WALL_TYPES as W,DataSerializer,ReplaySerializer,validateMapData} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createSearchEnvironment} from '../../../ghost-maze/src/solver/searchEnvironment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {solveContinuation} from '../../src/design/continuation.js';
import {auditPuzzleBoundaries} from '../../src/design/rule-boundaries.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';
const dir=fileURLToPath(new URL('.',import.meta.url));
const map=JSON.parse(fs.readFileSync(dir+'map.json')),stored=JSON.parse(fs.readFileSync(dir+'evidence.json'));
assertButtonAttachments(map);assert(validateMapData(map).valid);const env=createReferenceEnvironment(map);assert.equal(env.mapId,stored.mapId);assert.equal(env.ruleset,stored.ruleset);
const budget={nodeBudget:250000,stateBudget:250000,budgetMs:30000},all=createBreadthFirstSearch(createSearchEnvironment(map),{allOptimal:true});const allResult=all.run(budget);assert.equal(allResult.totalActions,17);assert.equal(all.routeCount(),3n);
const physical=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,l:s.layerStates.map(l=>({g:l.ghosts.map(g=>[g.x,g.y]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),i:l.items,w:l.wallStates}))});
const queue=[env.initialState()],seen=new Set([env.stateKey(queue[0])]);let transitions=0,compared=0;
for(let head=0;head<queue.length;head++){assert(queue.length<250000);const state=queue[head];if(state.isWon||state.isDead)continue;
 for(const a of env.actions){const next=env.step(state,a);transitions++;
  for(const reverse of [false,true]){const perm=state.clone();if(reverse)perm.layerStates[0].ghosts.reverse();perm.layerStates[0].ghosts.forEach((g,i)=>g.id=501-i*119);assert.equal(physical(next),physical(env.step(perm,a)));compared++;}
  if(next===state||next.isDead)continue;const key=env.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
 }
}
const initial=env.initialState();assert(initial.layerStates[0].ghosts.every(g=>!GameLogic._canGhostSeePlayer(g,initial.player,env.mapDefinition.layers[0],initial.layerStates[0])));
const code=DataSerializer.generateShareCode(map);assert(code.success);assert.deepEqual(DataSerializer.loadFromShareCode(code.code).data.mapData,map);
const noEnd=structuredClone(map);noEnd.layers[0].endPos=null;
const entry=structuredClone(map);entry.layers[0].activeCells[1][4]=true;entry.layers[0].customStartPos={x:4,y:1};entry.layers[0].hWalls[2][4]={type:W.ONE_WAY,keys:0,direction:{dx:0,dy:1}};
const entryEnv=createReferenceEnvironment(entry);
const interior=s=>JSON.stringify({p:[s.player.layer,s.player.x,s.player.y,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,g:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),i:s.layerStates.map(l=>l.items),
 walls:s.layerStates.map((l,li)=>Object.fromEntries(['h','v'].map(axis=>[axis,l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{const on=map.layers[li].activeCells;return on[y]?.[x]&&(axis==='h'?on[y-1]?.[x]:on[y]?.[x-1])?[[x,y,w]]:[];}))])))});
const routeTraces=[],optimalSolutions=[];
for(const actions of all.routes()){
 let state=env.initialState(),entered=entryEnv.step(entryEnv.initialState(),'D');assert.equal(interior(state),interior(entered));const trace=[];
 const replay=ReplaySerializer.generateShareCode(map,actions);assert(replay.success);assert.deepEqual(ReplaySerializer.loadFromShareCode(map,replay.code).actions,actions);
 const decodedEnv=createReferenceEnvironment(DataSerializer.loadFromShareCode(code.code).data.mapData);let decoded=decodedEnv.initialState();
 for(const[i,a]of actions.entries()){const diagnostics=[];state=GameLogic.calculateNextState(state,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});entered=entryEnv.step(entered,a);decoded=decodedEnv.step(decoded,a);assert.equal(interior(state),interior(entered));assert.equal(physical(state),physical(decoded));trace.push({step:i+1,action:a,p:[state.player.layer,state.player.x,state.player.y],ghosts:state.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),diagnostics});}
 assert(state.isWon&&!state.isDead);assert(!createReferenceEnvironment(noEnd).replay(actions).state.isDead);routeTraces.push({actions,replayCode:replay.code,trace});optimalSolutions.push({actions,replayCode:replay.code});
}

const mapCopy=structuredClone(map);mapCopy.layers[0].hWalls[2][5]={type:W.EMPTY,keys:0};
const monitorFor=(reference,target,winner,loser)=>({initial:()=>[],advance(p,b,a,n){const d=[];GameLogic.calculateNextState(b,actionFromName(a),reference.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:d});return d.some(c=>c.decision==='visible_target_priority'&&!c.capturesPlayer&&c.target.x===target[0]&&c.target.y===target[1]&&c.contenders.some(k=>k.seesAfter&&k.from.x===winner[0]&&k.from.y===winner[1])&&c.contenders.some(k=>!k.seesAfter&&k.from.x===loser[0]&&k.from.y===loser[1]))?null:p;}});
const proofs=[];
for(const[name,target,winner,loser]of[['east_brakes_north',[3,3],[4,3],[3,2]],['north_brakes_east',[3,4],[3,3],[2,4]]]){
 const r=createBreadthFirstSearch(createSearchEnvironment(map),{monitor:monitorFor(env,target,winner,loser)}).run(budget);assert.equal(r.status,'proven_unsat');proofs.push({name,status:r.status});
}
const continuation=[];
for(const[name,prefix]of[['north_first',['L','D','D']],['direct_button',['L','D','L','D','R','D','D']]]){const a=solveContinuation(map,prefix,budget),b=solveContinuation(map,prefix,{...budget,reference:true});assert.equal(a.status,'proven_unsat');assert.equal(b.status,'proven_unsat');continuation.push({name,status:b.status});}
const contrastRef=createReferenceEnvironment(mapCopy),withoutFirst=createBreadthFirstSearch(createSearchEnvironment(mapCopy),{monitor:monitorFor(contrastRef,[3,3],[4,3],[3,2])}).run(budget);assert.equal(withoutFirst.status,'solved');assert.equal(withoutFirst.totalActions,18);
const boundary=auditPuzzleBoundaries(map,budget);assert.equal(boundary.status,'safe');
const source=JSON.parse(fs.readFileSync(dir+'/source.json')),share=JSON.parse(fs.readFileSync(dir+'/share.json'));assert.equal(source.humanQuality,null);assert.equal(share.mapCode,code.code);assert.deepEqual(share.optimalSolutions,optimalSolutions);assert.deepEqual(stored.routeTraces,JSON.parse(JSON.stringify(routeTraces)));
console.log(JSON.stringify({T:17,count:'3',proofs,continuation,physicalAudit:{reachable:queue.length,transitions,compared},entry:{wholeOptimalRoutesInteriorEqual:true},boundary:boundary.status,noEndSafeRoutes:3,goalGateRemoved:{withoutFirstBrake:18}}));
