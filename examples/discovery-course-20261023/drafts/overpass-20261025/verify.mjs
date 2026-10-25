import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {WALL_TYPES as W} from '../../../../src/reference/engine.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
const input={variants:[JSON.parse(fs.readFileSync(new URL('../../levels/54/evidence.json',import.meta.url)))]},map=buildLevel('54'),e=createReferenceEnvironment(map),budget={nodeBudget:200000,stateBudget:200000,budgetMs:15000};
function query(m,advance){const env=createReferenceEnvironment(m),copy=structuredClone(m);copy.layers.forEach(l=>l.endPos=null);const noEnd=createReferenceEnvironment(copy),q=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance:(p,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:advance(p,s,a,n)}}),result=q.run(budget);assert.notEqual(result.status,'unknown');const actions=q.firstActions();if(actions)noEnd.replay(actions);return{mapId:env.mapId,result,actions,noEndSafe:actions?true:null};}
const grew=(s,n)=>n.layerStates[1].ghosts.length>s.layerStates[1].ghosts.length;
const count=(s,x,y)=>s.layerStates[1].ghosts.filter(g=>g.x===x&&g.y===y).length;
const tests={noGhostUpNorth:query(map,(p,s,a,n)=>grew(s,n)&&count(n,2,1)>count(s,2,1)?null:p),keyWithoutGhostAbove:query(map,(p,s,a,n)=>n.player.keys>s.player.keys&&count(n,2,2)>0?null:p),noNorthStair:query(map,(p,s,a,n)=>a==='STAIR'&&s.player.x===2&&s.player.y===1?null:p),noSouthStair:query(map,(p,s,a,n)=>a==='STAIR'&&s.player.x===2&&s.player.y===3?null:p)};
const empty=structuredClone(map);empty.layers[1].hWalls[3][2]={type:W.EMPTY,keys:0};tests.bridgeDoorEmpty=query(empty,p=>p);
const wrongPrefix=['L','L','R','R','U','STAIR','U','U','STAIR'];const wrong=e.replay(wrongPrefix).state;assert.equal(wrong.layerStates[1].ghosts.filter(g=>g.x===2&&g.y===3).length,1);const q=createBreadthFirstSearch({...e,initialState:()=>wrong}),continuation=q.run(budget);assert.equal(continuation.status,'proven_unsat');
const noEnd=structuredClone(map);noEnd.layers.forEach(l=>l.endPos=null);for(const r of input.variants[0].routes)createReferenceEnvironment(noEnd).replay(r.actions);
const out={mapId:e.mapId,ruleset:e.ruleset,role:'新终局下的原图事件和错误入口方向查询，非真人感受',humanQuality:null,tests,wrongCarrySide:{prefix:wrongPrefix,scene:{p:[wrong.player.layer,wrong.player.x,wrong.player.y],ghosts:wrong.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y]))},continuation},allOptimalNoEndSafe:input.variants[0].routes.length,qualitativeScope:'新目标把桥上停位纳入之后入口；不是仅将鬼移到钥匙投影上就声称有新意。是否有趣仍缺实际反馈。'};
const old=JSON.parse(fs.readFileSync(new URL('./current-analysis.json',import.meta.url)));const stable=v=>JSON.parse(JSON.stringify(v,(k,x)=>['elapsedMs','expanded','transitions','discovered'].includes(k)?undefined:x));assert.deepEqual(stable(out),stable(old));console.log(JSON.stringify({tests:Object.fromEntries(Object.entries(tests).map(([k,v])=>[k,{status:v.result.status,T:v.result.totalActions}])),wrongCarry:continuation,allOptimalNoEndSafe:out.allOptimalNoEndSafe}));
