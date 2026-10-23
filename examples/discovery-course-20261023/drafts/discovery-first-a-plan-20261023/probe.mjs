import fs from 'node:fs';
import {room} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
for(const width of [3,4]){
const height=3,x=width-1,params={start:[0,0],end:[width,2],ghosts:[[x,2]],cells:[...Array.from({length:width},(_,x)=>[x,0]),[0,1],[x,1],...Array.from({length:width},(_,x)=>[x,2]),[width,2]],buttons:[[x,1,1,0,'A']],edges:[['h',x,1,W.LETTER_DOOR,{letter:'A',initialState:'open'}],['v',width,2,W.LETTER_DOOR,{letter:'A',initialState:'closed'}]]},map=room(width+1,height,params),e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000}),routes=result.status==='solved'?[...q.routes()]:[];
fs.writeFileSync(`/workspace/work/discovery-first-a-plan-20261023/ring-${width}.json`,JSON.stringify({params,map,result,routes,humanQuality:null},null,2)+'\n');console.log(JSON.stringify({width,result,routes}));}
