import {buildLevel} from '../../build.mjs';
import {normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
export const budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
export function construct(kind='balanced'){
 const map=buildLevel('63'),l=map.layers[0];l.ghosts=l.ghosts.filter((_,i)=>i===0);
 if(kind==='original')return map;
 if(!['compact','balanced'].includes(kind))throw Error('未知固定稿');
 l.activeCells[2][4]=false;
 for(const[a,x,y]of[['h',4,2],['h',4,3],['v',4,2],['v',5,2]])l[a+'Walls'][y][x]={type:1,keys:0};
 if(kind==='compact'){
  l.endPos={x:3,y:2};l.vWalls[2][3]={type:1,keys:0};l.hWalls[3][3]={type:3,keys:1};
 }else{
  l.activeCells[1][3]=true;
  for(const[a,x,y]of[['h',3,1],['h',3,2],['v',3,1],['v',4,1]])l[a+'Walls'][y][x]={type:1,keys:0};
  l.hWalls[2][3]={type:3,keys:1};l.endPos={x:3,y:1};
 }
 return normalizeVoidWalls(map);
}
export function analyzeKeyPlans(map){
 const env=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers[0].endPos=null;
 const no=createReferenceEnvironment(nm),queries=[];
 for(const name of ['never_right_park_before_key','lower_park_before_key','ghost_static_after_key']){
  const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0,0],advance(h,b,a,n){
   if(n.isWon&&no.step(b,a).isDead)return null;
   const g=n.layerStates[0].ghosts[0],was=b.layerStates[0].ghosts[0],empty=b.player.keys===0&&n.player.keys===0,
    right=h[0]||empty&&n.player.x===1&&n.player.y===1&&g.x===2&&g.y===1,
    lower=h[1]||empty&&n.player.x===1&&n.player.y===1&&g.x===1&&g.y===2;
   // 本条件仅禁止取物后的任何鬼移动；不冒称它检测“静止后再召回”。
   if(name==='ghost_static_after_key'&&b.player.keys>0&&(g.x!==was.x||g.y!==was.y))return null;
   if(n.isWon&&(name==='never_right_park_before_key'&&right||name==='lower_park_before_key'&&!lower))return null;
   return[Number(right),Number(lower)];
  }}}),result=q.run(budget);queries.push({name,result,actions:q.firstActions()});
 }
 return{mapId:env.mapId,ruleset:env.ruleset,scope:'取物前右侧／下侧停车旗标进入完整键；排除到达死亡；第三项只指取物后静止，不等同再召回。',queries};
}
