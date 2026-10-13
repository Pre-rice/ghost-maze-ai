import{createReferenceEnvironment}from'../../src/reference/environment.js';import{GameLogic,actionFromName}from'../../src/reference/engine.js';
export function withoutCornerBlockAfterReuse(map,{requireHelperReuse=false,nodeBudget=900000,budgetMs=25000}={}){
 const env=createReferenceEnvironment(map),started=Date.now(),initial=env.initialState(),entries=[{state:initial,presses:0,stationarySeen:false,movedAfterSecond:false,cornerBlocked:false,parent:-1,action:null}],key=e=>env.stateKey(e.state)+'|'+[e.presses,Number(e.stationarySeen),Number(e.movedAfterSecond),Number(e.cornerBlocked)].join(','),seen=new Set([key(entries[0])]);let expanded=0,transitions=0;
 const finish=(status,reason,head=null,action=null)=>{let actions=null;if(head!==null){actions=[action];for(let i=head;entries[i].parent!==-1;i=entries[i].parent)actions.push(entries[i].action);actions.reverse();}return{status,reason,totalActions:actions?.length,actions,search:{expanded,transitions,discovered:seen.size,elapsedMs:Date.now()-started,exhausted:status==='proven_unsat',nodeBudget,budgetMs},scope:requireHelperReuse?'禁止：原下鬼曾真正静止于普通门西侧(2,3)，在已按至少两A后再移动，原上鬼真正受其阻挡静止于(4,4)，之后再按A；完整无伤无复活成功路线范围':'禁止：已按至少两A后，原上鬼真正因另一鬼阻挡停在(4,4)，之后再按A；不是任意鬼占4,4'};};
 for(let head=0;head<entries.length;head++){
  if(expanded>=nodeBudget||Date.now()-started>=budgetMs)return finish('unknown',expanded>=nodeBudget?'node_budget':'time_budget');const e=entries[head];expanded++;
  for(const action of env.actions){const next=env.step(e.state,action);transitions++;if(next===e.state||next.isDead)continue;const same=e.state.player.x===next.player.x&&e.state.player.y===next.player.y,pressed=same&&e.state.player.x===4&&e.state.player.y===1&&action==='U',oldHelper=e.state.layerStates[0].ghosts[0],helper=next.layerStates[0].ghosts[0],oldGuard=e.state.layerStates[0].ghosts[1],guard=next.layerStates[0].ghosts[1],helperMoved=oldHelper.x!==helper.x||oldHelper.y!==helper.y;
   const stationarySeen=e.stationarySeen||(!helperMoved&&helper.x===2&&helper.y===3),movedAfterSecond=e.movedAfterSecond||(e.presses>=2&&e.stationarySeen&&helperMoved);let actualCornerBlock=false;
   if(e.presses>=2&&guard.x===4&&guard.y===4&&oldGuard.x===guard.x&&oldGuard.y===guard.y){const copy=e.state.clone();copy.layerStates[0].ghosts=[copy.layerStates[0].ghosts[1]];const alone=GameLogic.calculateNextState(copy,actionFromName(action),env.mapDefinition,{trails:false,visibility:false}).layerStates[0].ghosts[0];actualCornerBlock=alone.x!==guard.x||alone.y!==guard.y;}
   if(pressed&&e.cornerBlocked)continue;
   const entry={state:next,presses:Math.min(2,e.presses+Number(pressed)),stationarySeen:requireHelperReuse?stationarySeen:false,movedAfterSecond:requireHelperReuse?movedAfterSecond:false,cornerBlocked:e.cornerBlocked||(actualCornerBlock&&(!requireHelperReuse||movedAfterSecond)),parent:head,action};
   if(next.isWon)return finish('solved','counterexample_found',head,action);const k=key(entry);if(seen.has(k))continue;seen.add(k);entries.push(entry);
  }e.state=null;
 }
 return finish('proven_unsat','frontier_exhausted');
}
