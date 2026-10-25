import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {WALL_TYPES as W,GameLogic,actionFromName} from '../../../../src/reference/engine.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
const data=JSON.parse(fs.readFileSync(new URL('./folded.json',import.meta.url))),qa=JSON.parse(fs.readFileSync(new URL('../../levels/53/evidence.json',import.meta.url))),base={...data.variants[0],map:buildLevel('53'),routes:qa.routes.map(r=>r.actions)},budget={nodeBudget:300000,stateBudget:300000,budgetMs:15000};
function query(map,which){const physical=createReferenceEnvironment(map),m=structuredClone(map);m.layers[0].endPos=null;const noEnd=createReferenceEnvironment(m),e={...physical,stateKey:s=>physical.stateKey(s)+'|tracked-right:'+s.layerStates[0].ghosts.filter(g=>g.id===1).map(g=>[g.x,g.y]).join(';')};
 const q=createBreadthFirstSearch(e,{monitor:{initial:()=>[],advance:(p,s,a,n)=>{
  if(n.isWon&&noEnd.step(s,a).isDead)return null;
  const rg=n.layerStates[0].ghosts.find(g=>g.id===1),lg=s.layerStates[0].ghosts.find(g=>g.id===0),nl=n.layerStates[0].ghosts.find(g=>g.id===0);
  if(which==='noRightPrepBeforeKey'&&s.player.keys===0&&rg?.x===2&&rg?.y===4)return null;
  if(which==='noRightPrepBeforeOpening'&&s.layerStates[0].wallStates.v[3][2].type===W.LOCKED&&rg?.x===2&&rg?.y===4)return null;
  if(which==='noLeftLeavesRoom'&&lg?.x===1&&lg?.y===3&&nl?.x===2&&nl?.y===3)return null;
  return p;
 }}}),result=q.run(budget);assert.notEqual(result.status,'unknown');const actions=q.firstActions();if(actions)noEnd.replay(actions);return{mapId:physical.mapId,result,actions,noEndSafe:actions?true:null};}
const tests={noRightPrepBeforeKey:query(base.map,'noRightPrepBeforeKey'),noRightPrepBeforeOpening:query(base.map,'noRightPrepBeforeOpening'),noLeftLeavesRoom:query(base.map,'noLeftLeavesRoom'),ordinaryKeyFirst:query((()=>{const m=structuredClone(base.map);m.layers[0].vWalls[3][2]={type:W.DOOR,keys:0};return m;})(),'noRightPrepBeforeKey')};
const e=createReferenceEnvironment(base.map),prefix=['L','L','R','U','U'],wrong=e.replay(prefix).state;assert.equal(wrong.player.keys,1);const follow=createBreadthFirstSearch({...e,initialState:()=>wrong}),continuation=follow.run(budget);
const previewPrefix=['L','R','D','U'],preview=e.replay(previewPrefix).state;const suffix=createBreadthFirstSearch({...e,initialState:()=>preview}),previewResult=suffix.run(budget);
const noEndMap=structuredClone(base.map);noEndMap.layers[0].endPos=null;const noEnd=createReferenceEnvironment(noEndMap);for(const actions of base.routes)noEnd.replay(actions);
const out={mapId:e.mapId,ruleset:e.ruleset,role:'原图含来源角色的事件查询，不把编号写入物理规则；非真人体验',humanQuality:null,tests,keyFirst:{prefix,p:[wrong.player.x,wrong.player.y],ghosts:wrong.layerStates[0].ghosts.map(g=>[g.x,g.y]),keys:wrong.player.keys,continuation},earlyPeek:{prefix:previewPrefix,zeroOpened:preview.layerStates[0].wallStates.v[3][2].type===W.EMPTY,rightGuard:[preview.layerStates[0].ghosts[1].x,preview.layerStates[0].ghosts[1].y],result:previewResult,actions:suffix.firstActions(),scope:'可先过0探看再返回准备；不是一进门就失去全部后路。'},allOptimalNoEndSafe:base.routes.length,roleKey:'完整物理键另带原右鬼坐标，避免按无编号位置排序时丢失事件的来源角色；物理规则仍编号无关。'};
const old=JSON.parse(fs.readFileSync(new URL('./analysis.json',import.meta.url))); const stable=value=>JSON.parse(JSON.stringify(value,(key,v)=>['elapsedMs','expanded','discovered','transitions'].includes(key)?undefined:v));assert.deepEqual(stable(out),stable(old));noEnd.replay([...previewPrefix,...suffix.firstActions()]);console.log(JSON.stringify({mapId:e.mapId,queryResultsCurrent:true,keyFirstContinuation:continuation.status,earlyPeekAllowed:true,allOptimalNoEndSafe:base.routes.length}));
