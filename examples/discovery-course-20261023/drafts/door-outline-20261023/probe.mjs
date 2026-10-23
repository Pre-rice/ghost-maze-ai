import fs from 'node:fs';
import {room,buildLevel} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W,DataSerializer} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
for(const mode of ['room18','free13','linear11']){
 const cells=mode==='room18'?null:[...Array.from({length:4},(_,x)=>[x,1]),...Array.from({length:mode==='free13'?3:1},(_,i)=>[mode==='free13'?i+1:3,2]),...[0,1,2].flatMap(y=>[[4,y],[5,y]])];
 const map=room(6,3,{start:[3,2],end:[4,0],ghosts:[[0,1]],cells,edges:[['v',4,0,W.SOLID],['v',4,1,W.DOOR],['v',4,2,W.SOLID],['h',4,1,W.SOLID]]});
 const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000}),routes=r.status==='solved'?[...q.routes()]:[];
 const states=[env.initialState()],seen=new Map([[env.stateKey(states[0]),0]]),incoming=[],out=[];let wins=[];
 for(let h=0;h<states.length;h++){const s=states[h];out[h]=[];if(s.isWon){wins.push(h);continue;}for(const a of env.actions){const n=env.step(s,a);if(n===s||n.isDead)continue;const k=env.stateKey(n);let i=seen.get(k);if(i===undefined){i=states.length;seen.set(k,i);states.push(n);}out[h].push(i);(incoming[i]??=[]).push(h);}}
 const good=new Set(wins),queue=[...wins];for(let h=0;h<queue.length;h++)for(const i of incoming[queue[h]]??[])if(!good.has(i)){good.add(i);queue.push(i);}
 const encoded=DataSerializer.generateShareCode(map);const evidence={mode,cells:map.layers[0].activeCells.flat().filter(Boolean).length,r,routes,initialEffective:env.actions.filter(a=>env.step(states[0],a)!==states[0]),initialSafe:env.actions.filter(a=>{const n=env.step(states[0],a);return n!==states[0]&&!n.isDead}),reachableSafe:states.length,softlocks:states.length-good.size,immediateStalemates:out.filter(a=>!a.length).length-wins.length,code:encoded.code};
 fs.writeFileSync(`/workspace/work/discovery-door-compact-20261023/${mode}.json`,JSON.stringify({map,evidence},null,2));console.log(JSON.stringify(evidence));
}
