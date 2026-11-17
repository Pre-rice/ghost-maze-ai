import {buildLevel} from '../../build.mjs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';

export const budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
export function construct({upperGate=true,birth=[3,0]}={}){
 const map=buildLevel('60'),l=map.layers[0];
 l.customStartPos={x:birth[0],y:birth[1]};l.endPos={x:2,y:0};l.items=[{x:4,y:3,type:'key'}];
 l.buttons=[{x:3,y:0,direction:{dx:0,dy:-1},letter:'A'},
  {x:4,y:2,direction:{dx:1,dy:0},letter:'B'},
  {x:0,y:2,direction:{dx:-1,dy:0},letter:'A'}];
 l.vWalls[0][2]={type:1,keys:0};l.vWalls[0][3]={type:1,keys:0};l.hWalls[1][2]={type:3,keys:1};
 l.hWalls[1][4]=upperGate?{type:6,keys:0,letter:'A',initialState:'closed'}:{type:0,keys:0};
 l.vWalls[1][2]={type:6,keys:0,letter:'A',initialState:'open'};
 return map;
}
export function pressed(map,b,a,n){
 if(n===b||n.player.x!==b.player.x||n.player.y!==b.player.y)return null;
 const delta={U:[0,-1],R:[1,0],D:[0,1],L:[-1,0]}[a];
 return delta&&map.layers[0].buttons.find(x=>x.x===b.player.x&&x.y===b.player.y&&x.direction.dx===delta[0]&&x.direction.dy===delta[1]);
}
export function analyzeClosure(map){
 const env=createReferenceEnvironment(map),out={mapId:env.mapId,ruleset:env.ruleset,queries:[],
  scope:'A/B操作次数均饱和至2后进入完整键；原图事件限制与门替代分别保存。无鬼不等于无软锁或有趣。'};
 for(const name of ['never_left_A','max_one_B','no_B_after_key','never_arrow',
  'first_A_after_key','second_A_after_key_at_birth_control','no_self_closure','first_arrow_with_B_unrestored']){
  const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0,0,0],advance(h,b,a,n){
   const p=pressed(map,b,a,n),A=p?.letter==='A',B=p?.letter==='B',leftA=A&&p.x===0,
    arrow=b.player.x===3&&b.player.y===2&&n.player.x===2&&n.player.y===2;
   if(name==='never_left_A'&&leftA||name==='max_one_B'&&B&&h[1]>=1||
    name==='no_B_after_key'&&B&&b.player.keys>0||name==='never_arrow'&&arrow||
    name==='first_A_after_key'&&A&&h[0]===0&&b.player.keys===0||
    name==='second_A_after_key_at_birth_control'&&A&&(h[0]===0&&b.player.keys>0||h[0]===1&&(p.x!==3||b.player.keys===0))||
    name==='no_self_closure'&&leftA&&b.layerStates[0].wallStates.v[2][1].currentState==='open'||
    name==='first_arrow_with_B_unrestored'&&arrow&&!h[2]&&b.layerStates[0].wallStates.v[1][1].currentState==='open')return null;
   return[Math.min(2,h[0]+Number(A)),Math.min(2,h[1]+Number(B)),Number(h[2]||arrow)];
  }}}),result=q.run(budget);out.queries.push({name,result,actions:q.firstActions()});
 }
 return out;
}
