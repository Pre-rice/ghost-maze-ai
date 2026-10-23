import fs from 'node:fs';
import {room} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W,GameLogic,actionFromName} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {solveReferenceMap} from '/workspace/ghost-maze-ai/src/search/reference-solver.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
const cells=[[2,0],[2,1],[3,1],...Array.from({length:6},(_,x)=>[x,2]),...Array.from({length:4},(_,i)=>[i+2,3]),[0,3],[2,4],[2,5]];
const map=room(6,6,{start:[3,2],end:[2,0],ghosts:[[0,2],[2,4]],items:[[0,3],[2,5]],cells,buttons:[[2,3,-1,0,'A']],edges:[['v',3,2,W.LOCKED,{keys:0}],['v',4,2,W.LETTER_DOOR,{letter:'A',initialState:'open'}],['v',5,2,W.DOOR],['v',3,3,W.DOOR],['h',4,3,W.SOLID],['h',2,1,W.LOCKED,{keys:2}]]});
fs.writeFileSync(new URL('map.json',import.meta.url),JSON.stringify(map,null,2)+'\n');
const budget={nodeBudget:250000,stateBudget:250000,budgetMs:15000},result=solveReferenceMap(map,budget),e=createReferenceEnvironment(map),trace=[];
if(result.status==='solved'){let s=e.initialState();for(const[i,a]of result.solution.actions.entries()){const diagnostics=[];s=GameLogic.calculateNextState(s,actionFromName(a),e.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:diagnostics});trace.push({step:i+1,a,p:[s.player.x,s.player.y],g:s.layerStates[0].ghosts.map(g=>[g.x,g.y]),keys:s.player.keys,diagnostics});}}
const queries=[];
if(result.status==='solved')for(const excluded of ['any','left-role','bottom-role']){const q=createBreadthFirstSearch(e,{monitor:{initial:()=>[],advance:(h,s,a,n)=>{const ds=[];GameLogic.calculateNextState(s,actionFromName(a),e.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:ds});if(ds.some(d=>d.decision==='visible_target_priority'&&(excluded==='any'||d.contenders.some(c=>c.seesAfter&&c.from.x===s.layerStates[0].ghosts[excluded==='left-role'?0:1].x&&c.from.y===s.layerStates[0].ghosts[excluded==='left-role'?0:1].y))))return null;return h;}}});queries.push({excluded,result:q.run(budget),actions:q.firstActions()});}
fs.writeFileSync(new URL('probe.json',import.meta.url),JSON.stringify({result,trace,queries,role:'design_probe_not_human_quality'},null,2)+'\n');console.log(JSON.stringify({status:result.status,T:result.solution?.totalActions,actions:result.solution?.actions,conflicts:trace.filter(t=>t.diagnostics.length),queries:queries.map(q=>({excluded:q.excluded,status:q.result.status,T:q.result.totalActions}))}));
