import fs from'node:fs';import{fileURLToPath}from'node:url';
import{buildMap}from'./build.mjs';import{createReferenceEnvironment}from'../../src/reference/environment.js';import{createBreadthFirstSearch}from'../../../ghost-maze/src/solver/breadthFirst.js';import{GameLogic,actionFromName}from'../../src/reference/engine.js';
const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000},middle=g=>g.y===1&&(g.x===4||g.x===5),moved=(s,n,i)=>s.layerStates[0].ghosts[i].x!==n.layerStates[0].ghosts[i].x||s.layerStates[0].ghosts[i].y!==n.layerStates[0].ghosts[i].y;
export function analyzeMap(map){
 const env=createReferenceEnvironment(map),m=structuredClone(map);m.layers[0].endPos=null;const noEnd=createReferenceEnvironment(m),safeLast=(s,a,n)=>!n.isWon||!noEnd.step(s,a).isDead;
 const specs=[];for(let i=0;i<3;i++)specs.push([`never-move-ghost-${i}`,()=>[],(h,s,a,n)=>moved(s,n,i)?null:h]);
 specs.push(['never-borrow-middle-for-left-ghost',()=>[],(h,s,a,n)=>n.layerStates[0].ghosts.slice(0,2).some(middle)?null:h]);
 specs.push(['right-starts-before-left-borrow',()=>[0],(h,s,a,n)=>{const flag=h[0]||moved(s,n,2)?1:0;return !flag&&n.layerStates[0].ghosts.slice(0,2).some(middle)?null:[flag];}]);
 specs.push(['finish-left-before-right-starts',()=>[0],(h,s,a,n)=>h[0]&&(moved(s,n,0)||moved(s,n,1))?null:[h[0]||moved(s,n,2)?1:0]]);
 specs.push(['never-use-priority',()=>[],(h,s,a)=>{const ds=[];GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:ds});return ds.some(d=>d.decision==='visible_target_priority')?null:h;}]);
 const queries=specs.map(([name,initial,advance])=>{const q=createBreadthFirstSearch(env,{monitor:{initial,advance:(h,s,a,n)=>safeLast(s,a,n)?advance(h,s,a,n):null}}),result=q.run(budget);return{name,result,actions:q.firstActions()};});
 const prefixes=[['natural-first-up',['U']],['natural-load',['U','D']],['natural-load-open-left',['U','D','L']],['borrow-left-first',['L','U','R','U']]].map(([name,prefix])=>{
  let s=env.initialState();for(const a of prefix){const n=env.step(s,a);if(n===s||n.isDead||n.isWon)throw Error('前缀无效');s=n;}
  const q=createBreadthFirstSearch({...env,initialState:()=>s},{monitor:{initial:()=>[],advance:(h,s,a,n)=>safeLast(s,a,n)?h:null}}),result=q.run(budget);return{name,prefix,result,suffix:q.firstActions(),state:{p:[s.player.x,s.player.y],g:s.layerStates[0].ghosts.map(g=>[g.x,g.y])}};
 });
 return {scope:'原图全部无伤无复活解；含非最优合法重合；所有历史进入完整键；到达终点当步去判胜安全。必要性不赋趣味或质量分。',queries,prefixes};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=analyzeMap(buildMap());fs.writeFileSync(new URL('analysis.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});for(const r of result.queries)console.log(JSON.stringify({name:r.name,status:r.result.status,N:r.result.totalActions}));for(const r of result.prefixes)console.log(JSON.stringify({name:r.name,prefix:r.prefix,status:r.result.status,suffixN:r.result.totalActions}));}
