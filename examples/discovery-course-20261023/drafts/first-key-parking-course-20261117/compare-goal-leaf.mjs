import assert from 'node:assert/strict';
import {construct} from './analyze.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';

/** 仅比较去右鬼后的两份14格；目标叶室作动作／坐标映射，不复制物理。 */
export function compareGoalLeaf(){
 const old=construct('original'),map=construct(),a=createReferenceEnvironment(old),b=createReferenceEnvironment(map),common=[];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(old.layers[0].activeCells[y][x]&&map.layers[0].activeCells[y][x])
  for(const[axis,nx,ny]of[['h',x,y-1],['v',x-1,y]])if(old.layers[0].activeCells[ny]?.[nx]&&map.layers[0].activeCells[ny]?.[nx])common.push([axis,x,y]);
 const physical=(s,isOld)=>{const atGoal=isOld?s.player.x===4&&s.player.y===2:s.player.x===3&&s.player.y===1;
  return JSON.stringify({p:[s.player.layer,atGoal?'goal':s.player.x,atGoal?'goal':s.player.y,s.player.keys,s.player.hp],
   ghosts:s.layerStates[0].ghosts.map(g=>[g.x,g.y]),items:s.layerStates[0].items,
   walls:common.map(([axis,x,y])=>s.layerStates[0].wallStates[axis][y][x]),
   goalDoor:isOld?s.layerStates[0].wallStates.v[2][4]:s.layerStates[0].wallStates.h[2][3],dead:s.isDead,won:s.isWon});};
 const oldNo=structuredClone(old),newNo=structuredClone(map);oldNo.layers[0].endPos=null;newNo.layers[0].endPos=null;
 const an=createReferenceEnvironment(oldNo),bn=createReferenceEnvironment(newNo),queue=[[a.initialState(),b.initialState()]],
  seen=new Set([a.stateKey(queue[0][0])]);let transitions=0,goalArrivals=0;
 for(let i=0;i<queue.length;i++){const[x,y]=queue[i];assert.equal(physical(x,true),physical(y,false));if(x.isDead||x.isWon)continue;
  for(const act of a.actions){const mapped=x.player.x===3&&x.player.y===2?act==='R'?'U':act==='U'?'R':act:act,
   n=a.step(x,act),m=b.step(y,mapped);assert.equal(n===x,m===y);assert.equal(physical(n,true),physical(m,false));transitions++;
   if(n.isWon){const na=an.step(x,act),nb=bn.step(y,mapped);assert(!na.isDead&&!nb.isDead);assert.equal(physical(na,true),physical(nb,false));goalArrivals++;}
   if(n===x||n.isDead)continue;const key=a.stateKey(n);if(!seen.has(key)){seen.add(key);queue.push([n,m]);}
  }
 }
 return{sourceMapId:a.mapId,targetMapId:b.mapId,ruleset:a.ruleset,matchedStates:queue.length,transitions,
  includesInvalidAndFatal:true,allGoalArrivalSuccessorsWithoutEndEqual:true,goalArrivals,
  scope:'仅比较去右鬼后的14格与旋转目标叶室的14格；在(3,2)交换U/R，目标坐标和门边按语义映射，其余物理后继一致。不是原双鬼图等价，不证明视觉或趣味相同。'};
}
