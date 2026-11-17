import {room} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';

export const budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
export function construct({closedSide=true,zeroType=3,ordinaryType=2,removeGhost=null,removeCell=null,removeCells=[]}={}) {
 const removed=[...removeCells,...(removeCell?[removeCell]:[])];
 const cells=[...[1,2,3].flatMap(y=>[1,2,3].map(x=>[x,y])),...[3,4,5].flatMap(y=>[3,4,5].map(x=>[x,y])),[2,4],[2,5],[1,0]]
  .filter((p,i,all)=>all.findIndex(q=>q.join()===p.join())===i)
  .filter(p=>!removed.some(r=>p.join()===r.join()));
 const edges=[['h',3,3,ordinaryType],['v',3,3,zeroType,{keys:0}],['h',1,1,3,{keys:2}],
  ['h',4,4,1],['h',4,5,1],['v',4,4,1],['v',5,4,1],...(closedSide?[['v',3,4,1]]:[])];
 const map=room(6,6,{start:[2,3],end:[1,0],ghosts:[[3,1],[5,5]].filter((_,i)=>i!==removeGhost),
  items:[[2,1],[5,4]],cells,edges});
 if(removed.length)for(const layer of map.layers)for(const axis of ['h','v']){
  const rows=layer[axis+'Walls'];
  for(const [y,row]of rows.entries())for(const[x,w]of row.entries()){
   const adjacent=axis==='h'?[[x,y-1],[x,y]]:[[x-1,y],[x,y]];
   const count=adjacent.filter(p=>cells.some(c=>c.join()===p.join())).length;
   if(count!==2)rows[y][x]={type:count===1?1:0,keys:0};
  }
 }
 return map;
}
const overlap=s=>s.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size<l.ghosts.length);
export function analyzeReturn(map,actions){
 const env=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers[0].endPos=null;
 const no=createReferenceEnvironment(nm),trace=[];let s=env.initialState();
 for(const[i,a]of actions.entries()){const n=env.step(s,a);trace.push({step:i+1,action:a,p:[n.player.x,n.player.y],keys:n.player.keys,
  ghosts:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),influence:inspectGhostInfluence(env,s,a,n)});s=n;}
 const queries=[];
 const names=['no_actual_influence','right_key_first','never_left_parked_3_2',
  'never_use_ordinary','left_stays_after_right_moves'];
 if(map.layers[0].vWalls[3][3].type===3)names.push('zero_before_any_key','zero_only_after_both_keys');
 for(const allowOverlap of[false,true])for(const name of names){
  const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance(h,b,a,n){
   if(n.isWon&&no.step(b,a).isDead||!allowOverlap&&overlap(n))return null;
   const gs=n.layerStates[0].ghosts,was=b.layerStates[0].ghosts,
    rightMoved=h[0]||gs[1].x!==was[1].x||gs[1].y!==was[1].y;
   if(name==='no_actual_influence'&&['motion','overlap'].includes(inspectGhostInfluence(env,b,a,n).kind))return null;
   if(name==='right_key_first'&&b.player.keys===0&&n.player.keys===1&&n.player.x===2&&n.player.y===1)return null;
   if(name==='never_left_parked_3_2'&&gs[0].x===3&&gs[0].y===2)return null;
   if(name==='never_use_ordinary'&&b.player.x===3&&n.player.x===3&&[b.player.y,n.player.y].sort().join()==='2,3')return null;
   const crossedZero=b.player.y===3&&n.player.y===3&&[b.player.x,n.player.x].sort().join()==='2,3';
   if(name==='zero_before_any_key'&&crossedZero&&b.player.keys!==0)return null;
   if(name==='zero_only_after_both_keys'&&crossedZero&&b.player.keys!==2)return null;
   if(name==='left_stays_after_right_moves'&&h[0]&&(gs[0].x!==was[0].x||gs[0].y!==was[0].y))return null;
   return[rightMoved?1:0];
  }}}),result=q.run(budget);
  queries.push({name,allowOverlap,result,actions:q.firstActions()});
 }
 return{mapId:env.mapId,ruleset:env.ruleset,scope:'完整历史条件含右鬼是否已动；允许及排除非最优重合分开；全部到达另查去终点。单层参考键保留来源数组，不按编号决定行动。',trace,queries};
}
