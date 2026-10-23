import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from './build.mjs';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
const root=new URL('./',import.meta.url),all=JSON.parse(fs.readFileSync(new URL('course-order.json',root))),cutoff=all.indexOf('15');assert(cutoff>0);const order=all.slice(0,cutoff),report=[];
for(const id of order){
 const env=createReferenceEnvironment(buildLevel(id)),states=[env.initialState()],indices=new Map([[env.stateKey(states[0]),0]]),out=[],incoming=[],parents=[null];let wins=[];
 for(let h=0;h<states.length;h++){
  assert(states.length<100000);out[h]=[];incoming[h]??=[];const s=states[h];if(s.isWon){wins.push(h);continue;}
  for(const a of env.actions){const n=env.step(s,a);if(n===s||n.isDead)continue;const k=env.stateKey(n);let ix=indices.get(k);if(ix===undefined){ix=states.length;indices.set(k,ix);states.push(n);parents.push([h,a]);}out[h].push({action:a,to:ix});(incoming[ix]??=[]).push(h);}
 }
 const good=new Set(wins),queue=[...wins];for(let h=0;h<queue.length;h++)for(const i of incoming[queue[h]]||[])if(!good.has(i)){good.add(i);queue.push(i);}
 const soft=states.map((_,i)=>i).filter(i=>!good.has(i)),frontiers=[];
 function prefix(i){const actions=[];while(parents[i]){actions.push(parents[i][1]);i=parents[i][0];}return actions.reverse();}
 for(let h=0;h<states.length;h++)if(good.has(h))for(const edge of out[h])if(!good.has(edge.to)){const s=states[edge.to];frontiers.push({actions:[...prefix(h),edge.action],p:[s.player.x,s.player.y],ghosts:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),safeNextActions:out[edge.to].map(e=>e.action),remainingKeys:s.layerStates.flatMap(l=>l.items).length});}
 const result={id,mapId:env.mapId,reachableSafeIncludingWins:states.length,canStillWin:good.size,softlockedSafeStates:soft.length,immediateSafeActionDeadEnds:soft.filter(i=>!out[i].length).length,shortestLostWinningRoute:frontiers.sort((a,b)=>a.actions.length-b.actions.length)[0]??null,scope:'完整有限物理图、无伤无复活；不能继续获胜不等于玩家困惑，尚无新手反馈'};if(['01','02','03'].includes(id))assert.equal(result.softlockedSafeStates,0,'最早三关应保留安全试探的恢复可能');report.push(result);console.log(JSON.stringify({id,safe:states.length,canStillWin:good.size,lost:soft.length}));
}
fs.writeFileSync(new URL('recoverability-evidence.json',root),JSON.stringify({humanLearningValidated:false,resetAndUndoAvailableInUI:true,results:report},null,2)+'\n');
