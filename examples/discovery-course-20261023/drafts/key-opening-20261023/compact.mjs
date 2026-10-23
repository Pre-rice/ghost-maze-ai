import fs from 'node:fs';
import {room} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
const map=room(4,3,{start:[1,2],end:[0,2],ghosts:[[3,2]],items:[[0,0],[3,0]],edges:[['v',1,2,W.LOCKED,{keys:2}],['h',0,2,W.SOLID],['v',2,0,W.SOLID],['v',2,1,W.LOCKED,{keys:1}],['v',2,2,W.DOOR]]});
const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000}),routes=result.status==='solved'?[...q.routes()]:[];
fs.writeFileSync('/workspace/work/discovery-keys-opening-20261023/map-compact.json',JSON.stringify(map,null,2));fs.writeFileSync('/workspace/work/discovery-keys-opening-20261023/proof-compact.json',JSON.stringify({result,routes},null,2));console.log({result,routes});if(routes.length){let s=env.initialState();for(const a of routes[0]){s=env.step(s,a);console.log(a,[s.player.x,s.player.y,s.player.keys],s.layerStates[0].ghosts.map(g=>[g.x,g.y]));}}
