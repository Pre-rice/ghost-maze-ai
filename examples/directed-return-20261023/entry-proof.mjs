import assert from 'node:assert/strict';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {assertExterior} from '../spatial-clearance-20261019/verify.mjs';

/** 将单元右移一格提供真实外部入口；只比较原单元内的物理量，不计中性进场的五步。 */
export function auditActualEntry(map,routes){
 const wall=()=>({type:W.SOLID,keys:0}),old=map.layers[0],l={activeCells:Array.from({length:8},()=>Array(8).fill(false)),hWalls:Array.from({length:9},()=>Array.from({length:8},wall)),vWalls:Array.from({length:8},()=>Array.from({length:9},wall)),ghosts:old.ghosts.map(g=>({...g,x:g.x+1})),items:old.items.map(i=>({...i,x:i.x+1})),buttons:old.buttons.map(b=>({...b,x:b.x+1})),customStartPos:{x:0,y:3},endPos:{...old.endPos,x:old.endPos.x+1}};
 for(let y=0;y<6;y++)for(let x=0;x<5;x++)l.activeCells[y][x+1]=old.activeCells[y][x];
 for(let y=0;y<=6;y++)for(let x=0;x<5;x++)l.hWalls[y][x+1]=structuredClone(old.hWalls[y][x]);
 for(let y=0;y<6;y++)for(let x=0;x<=5;x++)l.vWalls[y][x+1]=structuredClone(old.vWalls[y][x]);
 l.activeCells[3][0]=true;l.vWalls[3][1]={type:W.ONE_WAY,keys:0,direction:{dx:1,dy:0}};
 const raw={...structuredClone(map),layers:[l]};assertExterior(raw);const enteredMap=normalizeVoidWalls(normalizeMapData(raw)),e=createReferenceEnvironment(map),entered=createReferenceEnvironment(enteredMap);
 const physical=(state,offset)=>{
  const layer=state.layerStates[0],walls=[];
  for(const axis of ['h','v'])for(let y=0;y<map.height+(axis==='h'?1:0);y++)for(let x=0;x<map.width+(axis==='v'?1:0);x++)if(old.activeCells[y]?.[x]&&(axis==='h'?old.activeCells[y-1]?.[x]:old.activeCells[y]?.[x-1]))walls.push([axis,x,y,layer.wallStates[axis][y][x+offset]]);
  return {p:[state.player.layer,state.player.x-offset,state.player.y,state.player.keys,state.player.hp],dead:state.isDead,won:state.isWon,ghosts:layer.ghosts.map(g=>[g.x-offset,g.y]),items:layer.items.map(i=>({...i,x:i.x-offset})),walls};
 };
 const prefix=['R','R','R','R','U'];let arrival=entered.initialState();
 for(const a of prefix){const next=entered.step(arrival,a);assert.notEqual(next,arrival);assert(!next.isDead&&!next.isWon);assert.deepEqual(next.layerStates[0].ghosts.map(g=>[g.x-1,g.y]),old.ghosts.map(g=>[g.x,g.y]));arrival=next;}
 assert.deepEqual(physical(e.initialState(),0),physical(arrival,1));
 for(const actions of routes){let s=e.initialState(),t=arrival;for(const a of actions){s=e.step(s,a);t=entered.step(t,a);assert.deepEqual(physical(s,0),physical(t,1));}}
 return {externalInExtendedMap:[0,0,3],unitTranslation:[1,0],firstUnitCell:[0,0,3],actions:prefix,internal:[0,old.customStartPos.x,old.customStartPos.y],keys:0,externalGhosts:0,exteriorSealedExceptEntrance:true,allFiveActionsNeutralForGhosts:true,initialInteriorEqual:true,wholeOptimalRoutesInteriorEqual:true,optimalRoutesCompared:routes.length,scope:'右移单元仅为容纳真实外部格；进入后五步到既定出生，比较原单元全部内部物理后继，不比较迷雾知识与累计步数。'};
}
