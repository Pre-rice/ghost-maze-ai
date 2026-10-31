import assert from'node:assert/strict';
import{createReferenceEnvironment}from'../../../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../../../ghost-maze/src/solver/breadthFirst.js';
import{inspectGhostInfluence}from'../../../../src/design/ghost-influence.js';

// 唯一编号只追溯角色；角色位置与事件历史进入完整搜索键，不修改物理。
export function analyzeRelay(map,actions){
const env=createReferenceEnvironment(map),nn=structuredClone(map);nn.layers.forEach(l=>l.endPos=null);
const no=createReferenceEnvironment(nn),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000},where=(s,id)=>s.layerStates.flatMap((l,k)=>l.ghosts.filter(g=>g.id===id).map(g=>[k,g.x,g.y]))[0],same=(a,b)=>a?.join(',')===b?.join(','),initial=()=>{const s=env.initialState();s.layerStates[0].ghosts[0].id=10;s.layerStates[1].ghosts[0].id=20;return s;},tagged={...env,initialState:initial,stateKey:s=>env.stateKey(s)+'|roles:'+JSON.stringify([where(s,10),where(s,20)])},out={mapId:env.mapId,ruleset:env.ruleset,rows:[],trace:[]};
let state=initial();for(const[i,a]of actions.entries()){const n=env.step(state,a),influence=inspectGhostInfluence(env,state,a,n);out.trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],lower:where(n,10),upper:where(n,20),keys:n.player.keys,influence});state=n;}
for(const name of['no_actual_influence','never_first_hold','never_second_hold','never_recall_upper','upper_stays_after_first_park','first_right_return_before_recall','key_before_recall','first_ascent_without_lower_preparation','some_ghost_changes_layer']){
 const q=createBreadthFirstSearch(tagged,{monitor:{initial:()=>[0,0,0,0,0,0],advance(h,b,a,n){
  if(n.isWon&&no.step(b,a).isDead)return null;if(n.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size!==l.ghosts.length))return null;
  const lb=where(b,10),ln=where(n,10),ub=where(b,20),un=where(n,20);assert(lb&&ln&&ub&&un);const recall=same(ub,[1,2,3])&&same(un,[1,2,4]),park=same(un,[1,2,3]),movesLower=!same(lb,ln),migration=lb[0]!==ln[0]||ub[0]!==un[0],firstUp=a==='STAIR'&&b.player.layer===0&&b.player.x===2&&b.player.y===2&&!h[4],rightDown=a==='STAIR'&&b.player.layer===1&&b.player.x===4&&b.player.y===2;
  const hist=[h[0]||recall?1:0,h[1]||park?1:0,h[2]||migration?1:0,h[3]||movesLower?1:0,h[4]||firstUp?1:0,h[5]||(name==='first_right_return_before_recall'&&rightDown&&!h[0])||(name==='key_before_recall'&&n.player.keys>b.player.keys&&!h[0])||(name==='first_ascent_without_lower_preparation'&&firstUp&&!h[3])?1:0];
  const f=inspectGhostInfluence(env,b,a,n),first=f.kind==='motion'&&f.changes.some(c=>same(c.from,[0,2,2])&&same(c.actual,[0,2,2])&&same(c.alone,[1,2,2])),second=f.kind==='motion'&&f.changes.some(c=>same(c.from,[1,4,2])&&same(c.actual,[1,4,2])&&same(c.alone,[0,4,2]));
  if(name==='no_actual_influence'&&f.kind==='motion'||name==='never_first_hold'&&first||name==='never_second_hold'&&second||name==='never_recall_upper'&&recall||name==='upper_stays_after_first_park'&&h[1]&&!same(ub,un))return null;
  if(n.isWon&&(['first_right_return_before_recall','key_before_recall','first_ascent_without_lower_preparation'].includes(name)&&!hist[5]||name==='some_ghost_changes_layer'&&!hist[2]))return null;
  return hist;
 }}}),result=q.run(budget),r={name,result,actions:q.firstActions()};out.rows.push(r);
}
return out;
}
