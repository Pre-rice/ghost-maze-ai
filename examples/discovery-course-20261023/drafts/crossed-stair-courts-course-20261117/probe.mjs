import fs from 'node:fs';
import {room} from '../../build.mjs';
import {DataSerializer,WALL_TYPES as W} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';

const root=new URL('./',import.meta.url),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
const lower=room(5,4,{start:[1,3],end:[4,2],ghosts:[[0,2]],cells:[[0,2],[1,2],[2,2],[3,2],[4,2],[1,3],[2,3],[3,3]],edges:[['v',4,2,W.LOCKED,{keys:1}]]}).layers[0];
const upper=room(4,5,{start:[2,2],end:[2,4],ghosts:[[2,0]],items:[[2,4]],cells:[[2,0],[2,1],[2,2],[2,3],[2,4],[3,2],[3,3],[3,4]]}).layers[0];
upper.endPos=null;upper.customStartPos=null;
const map={width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:true,layerCount:2,layers:[lower,upper],stairs:[[2,2],[3,3]].flatMap(([x,y])=>[{x,y,layer:0,direction:'up'},{x,y,layer:1,direction:'down'}])};
const env=createReferenceEnvironment(map),q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=env.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=env.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(env,s,a,n)});s=n;}
const output={createdOn:'2026-11-17',humanQuality:null,map,mapId:env.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};
fs.writeFileSync(new URL('prototype.json',root),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({result,count:output.count,boundary:boundary?.status,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
