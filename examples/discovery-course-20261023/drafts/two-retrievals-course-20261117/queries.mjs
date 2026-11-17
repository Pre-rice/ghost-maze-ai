import{createReferenceEnvironment}from'../../../../src/reference/environment.js';
import{createBreadthFirstSearch}from'../../../../../ghost-maze/src/solver/breadthFirst.js';
import{inspectGhostInfluence}from'../../../../src/design/ghost-influence.js';

const budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const same=(a,b)=>a?.join(',')===b?.join(',');

/** 只查询列明的完整历史；右／左角色由初始数组追溯，编号不参与物理。 */
export function analyzeRetrievals(map,actions){
 const env=createReferenceEnvironment(map),nn=structuredClone(map);nn.layers[0].endPos=null;
 const no=createReferenceEnvironment(nn),out={mapId:env.mapId,ruleset:env.ruleset,queries:[],trace:[]};
 let s=env.initialState();
 for(const[i,action]of actions.entries()){const n=env.step(s,action);out.trace.push({step:i+1,action,p:[n.player.x,n.player.y],keys:n.player.keys,g:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),influence:inspectGhostInfluence(env,s,action,n)});s=n;}
 for(const allowOverlap of[false,true])for(const name of['no_actual_influence_or_overlap','first_key_is_left','never_hold_right_at3_4','never_hold_left_at4_2','never_recall_right_after3_4']){
  const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0,0],advance(h,b,action,n){
   if(n.isWon&&no.step(b,action).isDead)return null;
   if(!allowOverlap&&n.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size!==l.ghosts.length))return null;
   const f=inspectGhostInfluence(env,b,action,n),rb=b.layerStates[0].ghosts[1],rn=n.layerStates[0].ghosts[1],lb=b.layerStates[0].ghosts[0];
   const first=h[0]||n.player.keys>b.player.keys&&b.player.keys===0&&n.player.x===2&&n.player.y===3,park=h[1]||rn.x===3&&rn.y===4;
   if(name==='no_actual_influence_or_overlap'&&['motion','overlap'].includes(f.kind))return null;
   if(name==='never_hold_right_at3_4'&&rb.x===3&&rb.y===4&&f.kind==='motion'&&f.changes.some(c=>same(c.from,[0,3,4])&&same(c.actual,[0,3,4])&&same(c.alone,[0,3,3])))return null;
   if(name==='never_hold_left_at4_2'&&lb.x===4&&lb.y===2&&f.kind==='motion'&&f.changes.some(c=>same(c.from,[0,4,2])&&same(c.actual,[0,4,2])&&same(c.alone,[0,3,2])))return null;
   if(name==='never_recall_right_after3_4'&&h[1]&&(rb.x!==rn.x||rb.y!==rn.y))return null;
   if(n.isWon&&name==='first_key_is_left'&&!first)return null;
   return[first?1:0,park?1:0];
  }}}),result=q.run(budget);out.queries.push({name,allowOverlap,result,actions:q.firstActions()});
 }
 return out;
}
