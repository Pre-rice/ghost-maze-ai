import{createReferenceEnvironment}from'../../src/reference/environment.js';import{GameLogic,actionFromName}from'../../src/reference/engine.js';
export function proveAvoidingStaging(map,kind,{nodeBudget=500000,budgetMs=10000,checkpointMode='pickup'}={}){
const env=createReferenceEnvironment(map),initial=env.initialState(),queue=[{state:initial,flag:false,visited:false,parent:-1,action:null}],seen=new Set([env.stateKey(initial)+'|stage:false|visited:false']),started=Date.now();let expanded=0,transitions=0;
const finish=(status,head=-1,action=null)=>{let witness=null;if(head>=0){witness=action?[action]:[];for(let i=head;queue[i].parent>=0;i=queue[i].parent)witness.push(queue[i].action);witness.reverse();}return{status,kind,mapId:env.mapId,ruleset:env.ruleset,expanded,transitions,discovered:seen.size,exhausted:status==='proven_unsat',witness,elapsedMs:Date.now()-started,scope:'共同GameLogic完整无伤无复活状态BFS；精确指定位置/指定鬼，事件与首次到达标记入完整状态键；禁止事件后到达指定按钮格／取该钥匙，找反例而不是解长代理'};};
for(let head=0;head<queue.length;head++){if(expanded>=nodeBudget||Date.now()-started>=budgetMs)return finish('unknown');const node=queue[head];if(node.state.isWon)return finish('solved',head);expanded++;
for(const action of env.actions){const before=node.state,next=env.step(before,action);transitions++;if(next===before||next.isDead)continue;const beforeKey=checkpointMode==='visit'?!node.visited:before.layerStates[0].items.some(i=>i.type==='key'&&i.x===3&&i.y===4),afterKey=checkpointMode==='visit'?!(node.visited||(next.player.x===3&&next.player.y===4)):next.layerStates[0].items.some(i=>i.type==='key'&&i.x===3&&i.y===4),old=before.layerStates[0].ghosts[0],g=next.layerStates[0].ghosts[0];let event=false;
if(beforeKey&&afterKey&&old.x===g.x&&old.y===g.y){
if(kind==='stationary_exit_front_before_first_arrival')event=g.x===4&&g.y===2;
else if(kind==='blocked_on_button_before_first_arrival'&&g.x===3&&g.y===4){const copy=before.clone();copy.layerStates[0].ghosts=[copy.layerStates[0].ghosts[0]];const shadow=GameLogic.calculateNextState(copy,actionFromName(action),env.mapDefinition,{trails:false,visibility:false}).layerStates[0].ghosts[0];event=shadow.x!==g.x||shadow.y!==g.y;}
else if(!['blocked_on_button_before_first_arrival','stationary_exit_front_before_first_arrival'].includes(kind))throw Error('unknown staging kind');
}
const flag=node.flag||event;if(beforeKey&&!afterKey&&flag)continue;if(next.isWon)return finish('solved',head,action);const visited=checkpointMode==='visit'?(node.visited||!afterKey):!afterKey;const key=env.stateKey(next)+'|stage:'+flag+'|visited:'+visited;if(seen.has(key))continue;seen.add(key);queue.push({state:next,flag,visited,parent:head,action});}
}
return finish('proven_unsat');
}
