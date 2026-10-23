import fs from 'node:fs';import {room} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls,DataSerializer} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
const lower=room(4,3,{start:[0,1],end:[0,2],cells:[...Array.from({length:4},(_,x)=>[x,0]),...Array.from({length:4},(_,x)=>[x,1]),[0,2]],edges:[['v',2,0,W.DOOR],['h',1,1,W.SOLID],['h',0,2,W.LOCKED,{keys:1}]]}).layers[0];
const upper=room(4,1,{start:[0,0],end:[3,0],ghosts:[[2,0]],items:[[3,0]]}).layers[0];upper.customStartPos=null;upper.endPos=null;
const stairs=[0,3].flatMap(x=>[{layer:0,x,y:0,direction:'up'},{layer:1,x,y:0,direction:'down'}]);
const map=normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:true,layerCount:2,layers:[lower,upper],stairs}));
const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),r=q.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000}),routes=r.status==='solved'?[...q.routes()]:[];
const share=DataSerializer.generateShareCode(map);if(!share.success)throw Error(share.error);fs.writeFileSync('/workspace/work/discovery-stair-transfer-20261023/map.json',JSON.stringify(map,null,2));fs.writeFileSync('/workspace/work/discovery-stair-transfer-20261023/search.json',JSON.stringify({result:r,routes,code:share.code,humanQuality:null},null,2));console.log({result:r,routes});
if(routes.length){let s=env.initialState();for(const a of routes[0]){s=env.step(s,a);console.log(a,[s.player.layer,s.player.x,s.player.y,s.player.keys],s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])));}}
