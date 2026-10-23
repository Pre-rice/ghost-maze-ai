import fs from 'node:fs';
import {room} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W,GameLogic} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
const map=room(4,2,{start:[0,1],end:[3,1],ghosts:[[3,0]],buttons:[[0,0,0,-1,'A']],edges:[['v',1,0,W.LETTER_DOOR,{letter:'A',initialState:'open'}],['v',3,1,W.LETTER_DOOR,{letter:'A',initialState:'closed'}],['h',1,1,W.SOLID],['h',3,1,W.SOLID]]});
fs.writeFileSync('/workspace/work/discovery-closing-step-20261023/map-initial.json',JSON.stringify(map,null,2));
const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000}),routes=r.status==='solved'?[...q.routes()]:[];fs.writeFileSync('/workspace/work/discovery-closing-step-20261023/initial-search.json',JSON.stringify({r,routes},null,2));console.log({r,routes});if(routes.length){let s=env.initialState();for(const a of routes[0]){const n=env.step(s,a),g=s.layerStates[0].ghosts[0];console.log(a,[n.player.x,n.player.y],n.layerStates[0].ghosts.map(g=>[g.x,g.y]),{before:GameLogic._canGhostSeePlayer(g,s.player,env.mapDefinition.layers[0],s.layerStates[0]),after:GameLogic._canGhostSeePlayer(g,n.player,env.mapDefinition.layers[0],n.layerStates[0])});s=n;}}
