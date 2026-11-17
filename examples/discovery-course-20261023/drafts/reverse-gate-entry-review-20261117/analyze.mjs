import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {createTrajectoryGroups,ghostFrame} from '../../../../../ghost-maze/src/solver/trajectoryGroups.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
export function analyzeEntry(map){
 const e=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers[0].endPos=null;
 const no=createReferenceEnvironment(nm),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000},opened=(b,n)=>b.layerStates[0].wallStates.h[5][5].type===3&&n.layerStates[0].wallStates.h[5][5].type===0,lower=s=>s.layerStates[0].ghosts.find(g=>g.id===20),initial=()=>{const s=e.initialState();s.layerStates[0].ghosts[0].id=10;s.layerStates[0].ghosts[1].id=20;return s;},tagged={...e,initialState:initial,stateKey:s=>e.stateKey(s)+'|roles:'+JSON.stringify(s.layerStates[0].ghosts.map(g=>[g.id,g.x,g.y]))},rows=[];
 for(const name of ['never_open_zero','first_opening_not_above','key_before_zero','no_actual_influence','never_left_first_lure','never_upper_first_lure','lower_static_until_open']){
  const q=createBreadthFirstSearch(tagged,{monitor:{initial:()=>[0],advance(h,b,a,n){
   if(n.isWon&&no.step(b,a).isDead)return null;
   const op=opened(b,n),bg=lower(b),ng=lower(n),moved=bg.x!==ng.x||bg.y!==ng.y,left=bg.x===3&&bg.y===4&&ng.x===2&&ng.y===4,upper=bg.x===3&&bg.y===4&&ng.x===3&&ng.y===3;
   if(name==='never_open_zero'&&op||name==='first_opening_not_above'&&op&&b.player.y===4||name==='key_before_zero'&&op&&b.player.keys===0||name==='no_actual_influence'&&inspectGhostInfluence(e,b,a,n).kind!=='none'||name==='never_left_first_lure'&&!h[0]&&left||name==='never_upper_first_lure'&&!h[0]&&upper||name==='lower_static_until_open'&&b.layerStates[0].wallStates.h[5][5].type===3&&moved)return null;
   return[Number(h[0]||moved)];
  }}}),result=q.run(budget);assert(['solved','proven_unsat'].includes(result.status));rows.push({name,result,actions:q.firstActions()});
 }
 const q=createBreadthFirstSearch(e,{allOptimal:true,classifyState:ghostFrame});q.run(budget);const groups=createTrajectoryGroups(q.optimalGraph()),groupResult=groups.run(budget);assert.equal(groupResult.status,'solved');
 return{mapId:e.mapId,ruleset:e.ruleset,rows,grouping:{count:groupResult.count,routes:[...groups.routes()]},humanQuality:null,scope:'原图事件查询，首次下鬼移动历史和两个角色坐标进入完整键。无伤无复活与到达去终点；只在无实际互相影响查询里排除全部联合影响，其余允许非最优重合。两种初始引动方向不等于鬼动停分类。'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const root=new URL('./',import.meta.url),s=JSON.parse(fs.readFileSync(new URL('prototype.json',root))),out=analyzeEntry(s.map);fs.writeFileSync(new URL('complete-plans.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({rows:out.rows.map(r=>({name:r.name,status:r.result.status,T:r.result.totalActions})),groups:out.grouping.count}));}
