import fs from 'node:fs';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
export const budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
export function construct(lowerType=1){const map=JSON.parse(fs.readFileSync(new URL('../../levels/37/revisions/v02/map.json',import.meta.url)));
 map.layers[0].vWalls[1][2]={type:2,keys:0};map.layers[0].hWalls[2][1]={type:lowerType,keys:0};return map;}
export function analyzeRelocation(map){
 const env=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers[0].endPos=null;
 const no=createReferenceEnvironment(nm),queries=[];
 for(const name of ['max_one_A','never_far_cell','never_park_right','no_A_after_ghost_moved']){
  const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0,0],advance(h,b,a,n){
   if(n.isWon&&no.step(b,a).isDead)return null;
   const press=n!==b&&n.player.x===b.player.x&&n.player.y===b.player.y,
    count=h[0]+Number(press),g=n.layerStates[0].ghosts[0],moved=h[1]||g.x!==0||g.y!==2;
   if(name==='max_one_A'&&count>1||name==='never_far_cell'&&n.player.x===0&&n.player.y===0||
    name==='never_park_right'&&g.x===2&&g.y===1&&n.player.x===1&&n.player.y===1||
    name==='no_A_after_ghost_moved'&&press&&h[1])return null;
   return[Math.min(2,count),Number(moved)];
  }}}),result=q.run(budget);queries.push({name,result,actions:q.firstActions()});
 }
 return{mapId:env.mapId,ruleset:env.ruleset,scope:'A次数饱和至2、鬼是否曾离初位进入完整键；完整到达另查去终点；不把最优阶段关系等同全部体验。',queries};
}
