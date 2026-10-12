import{writeFileSync,readFileSync}from'node:fs';
import{createReferenceEnvironment}from'../../src/reference/environment.js';
import{createFastEnvironment}from'../../src/search/fast-environment.js';
import{compileRestrictions}from'../../src/search/restrictions.js';
const map=JSON.parse(readFileSync(new URL('map.json',import.meta.url)));
function search(reference){
 const fast=createFastEnvironment(map),env=reference?fast.reference:fast;
 const detect=compileRestrictions(fast.reference.mapDefinition,[{id:'block',sequence:[{type:'ghost_blocked',index:1}]}]);
 const q=[{state:env.initialState(),blocks:0,first:false,parent:-1,action:null}],seen=new Set();
 const key=n=>env.stateKey(n.state)+'|'+n.first+'|'+(n.first?0:n.blocks);
 seen.add(key(q[0]));let expanded=0;const started=Date.now(),nodeBudget=500000,budgetMs=15000;
 for(let head=0;head<q.length;head++){
  if(expanded>=nodeBudget||Date.now()-started>=budgetMs)return{status:'unknown',expanded,discovered:seen.size,reference};
  const n=q[head];expanded++;
  if(n.state.isWon&&n.first){const actions=[];for(let i=head;q[i].parent>=0;i=q[i].parent)actions.push(q[i].action);actions.reverse();fast.reference.replay(actions);return{status:'solved',actions,expanded,discovered:seen.size,reference};}
  for(const a of fast.reference.actions){
   const after=env.step(n.state,a);if(after===n.state||after.isDead)continue;
   const pickup=after.player.keys>n.state.player.keys;
   // 查找首次拾钥匙之前严格少于两次阻挡的胜利；同动作阻挡不算此前。
   if(!n.first&&pickup&&n.blocks>=2)continue;
   const blocked=detect.advance([0],n.state,a,after)===null;
   const next={state:after,blocks:Math.min(2,n.blocks+Number(blocked)),first:n.first||pickup,parent:head,action:a};
   const k=key(next);if(seen.has(k))continue;seen.add(k);q.push(next);
  }
 }
 return{status:'proven_unsat',expanded,discovered:seen.size,reference,exhausted:true};
}
const result={date:'2026-10-12',claim:'至少两次阻挡严格发生于首次拾钥匙之前',scope:'真实物理搜索；首次拾钥匙与饱和阻挡次数进入完整状态键；同动作事件不计此前',fast:search(false),reference:search(true)};
writeFileSync(new URL('first-key-evidence.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
