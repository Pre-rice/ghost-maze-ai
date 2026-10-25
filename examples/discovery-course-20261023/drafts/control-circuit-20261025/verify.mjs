import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls} from '../../../../src/reference/engine.js';
const map=buildLevel('50'),e=createReferenceEnvironment(map),budget={nodeBudget:100000,stateBudget:100000,budgetMs:10000};
const button=(s,a,n)=>s.player.x===n.player.x&&s.player.y===n.player.y?map.layers[0].buttons.find(b=>b.x===s.player.x&&b.y===s.player.y&&b.direction.dx==={U:0,D:0,L:-1,R:1}[a]&&b.direction.dy==={U:-1,D:1,L:0,R:0}[a]):null;
function monitorQuery(monitor){const q=createBreadthFirstSearch(e,{monitor}),result=q.run(budget);return{result,actions:q.firstActions()};}
const oneB=monitorQuery({initial:()=>[0],advance:(p,s,a,n)=>{const count=p[0]+Number(button(s,a,n)?.letter==='B');return count>1?null:[count];}});
const noArrow=monitorQuery({initial:()=>[],advance:(p,s,a,n)=>s.player.x===1&&s.player.y===1&&n.player.x===2&&n.player.y===1?null:p});
assert.equal(oneB.result.status,'proven_unsat');assert.equal(noArrow.result.status,'proven_unsat');
const states=[e.initialState()],index=new Map([[e.stateKey(states[0]),0]]),predecessors=[[]];let transitions=0;
for(let i=0;i<states.length;i++)if(!states[i].isWon)for(const a of e.actions){const n=e.step(states[i],a);transitions++;assert(!n.isDead);if(n===states[i])continue;const key=e.stateKey(n);if(!index.has(key)){index.set(key,states.length);states.push(n);predecessors.push([]);}predecessors[index.get(key)].push(i);}
const reachableFromGoal=new Set(states.flatMap((s,i)=>s.isWon?[i]:[])),queue=[...reachableFromGoal];for(let i=0;i<queue.length;i++)for(const p of predecessors[queue[i]])if(!reachableFromGoal.has(p)){reachableFromGoal.add(p);queue.push(p);}
assert.equal(reachableFromGoal.size,states.length);
function query(m){const x=createReferenceEnvironment(m),q=createBreadthFirstSearch(x,{allOptimal:true}),result=q.run(budget);return{mapId:x.mapId,result,count:q.routeCount().toString(),actions:q.firstActions()};}
const gates=[];for(const axis of['h','v'])for(const[y,row]of map.layers[0][axis+'Walls'].entries())for(const[x,w]of row.entries())if([W.LETTER_DOOR,W.ONE_WAY].includes(w.type))for(const type of w.type===W.ONE_WAY?[W.DOOR,W.SOLID]:[W.EMPTY]){const m=structuredClone(map);m.layers[0][axis+'Walls'][y][x]={type,keys:0};gates.push({at:[axis,x,y],was:w,replacement:type,...query(m)});}
const l=map.layers[0],protectedCells=new Set([l.customStartPos,l.endPos,...l.buttons].map(p=>`${p.x},${p.y}`)),cells=[];
for(const[y,row]of l.activeCells.entries())for(const[x,active]of row.entries())if(active&&!protectedCells.has(`${x},${y}`)){const m=structuredClone(map);m.layers[0].activeCells[y][x]=false;cells.push({removed:[x,y],scope:'删格并清理成为边界的旧机关；不保留非法空边',...query(normalizeVoidWalls(normalizeMapData(m)))});}
const out={mapId:e.mapId,ruleset:e.ruleset,role:'原生机关计划诊断，不是趣味、盲AI或真人学习证据',humanQuality:null,atMostOneB:oneB,withoutUsingArrow:noArrow,recovery:{scope:'完整可达局面，包括非最优试探；原生动作图反向核对均有通关续解，不等于人会找到',states:states.length,transitions,allHaveWinningContinuation:reachableFromGoal.size===states.length},gates,cells};
fs.writeFileSync(new URL('./adopted-analysis.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({mapId:e.mapId,atMostOneB:oneB.result.status,withoutArrow:noArrow.result.status,recovery:out.recovery,gateAlternatives:gates.map(g=>({at:g.at,replacement:g.replacement,result:g.result.status,T:g.result.totalActions})),singleCellResults:cells.map(c=>({cell:c.removed,result:c.result.status,T:c.result.totalActions}))}));
