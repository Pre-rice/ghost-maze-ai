import fs from 'node:fs';
import {room,wall} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
const m=room(5,3,{start:[1,2],end:[0,2],ghosts:[[4,2]],items:[[0,0],[4,0]],edges:[['v',1,2,W.LOCKED,{keys:2}],['v',3,0,W.SOLID],['v',3,1,W.LOCKED,{keys:1}],['v',3,2,W.DOOR]]});
const env=createReferenceEnvironment(m),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000});
const routes=r.status==='solved'?[...q.routes()]:[];
fs.writeFileSync('/workspace/work/discovery-keys-opening-20261023/map-initial.json',JSON.stringify(m,null,2));fs.writeFileSync('/workspace/work/discovery-keys-opening-20261023/proof-initial.json',JSON.stringify({result:r,routes},null,2));
console.log(JSON.stringify({result:r,routes:routes.slice(0,6)}));
if(routes.length){let s=env.initialState();for(const a of routes[0]){s=env.step(s,a);console.log(a,[s.player.x,s.player.y,s.player.keys],s.layerStates[0].ghosts.map(g=>[g.x,g.y]));}}
