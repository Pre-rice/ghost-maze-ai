import fs from 'node:fs';
import {room} from '../../build.mjs';
import {DataSerializer,WALL_TYPES as W} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
// 下层左梯靠近原两步外引鬼位置，整条桥与上层相应左移一格、下移一格。
// 不缩短两梯间隔：到达下层右梯时，左守卫仍需隔两格才能不当步抓住玩家。
const lower=room(5,5,{start:[1,3],end:[0,0],ghosts:[[0,1]],cells:[[0,0],[0,1],[0,2],...[0,1,2,3,4].map(x=>[x,3]),...[1,2,3,4].map(x=>[x,4])],edges:[['h',0,1,W.LOCKED,{keys:1}],['h',1,4,W.ONE_WAY,{direction:{dx:0,dy:-1}}],['h',3,4,W.SOLID]]}).layers[0];
const upper=room(4,7,{start:[1,3],end:[1,2],ghosts:[[1,1]],items:[[1,2]],cells:[[1,1],[1,2],[1,3],[3,3],[1,4],[2,4],[3,4],[1,5],[2,5],[1,6],[2,6]],edges:[['v',2,4,W.ONE_WAY,{direction:{dx:1,dy:0}}]]}).layers[0];upper.customStartPos=null;upper.endPos=null;
const map={width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:true,layerCount:2,layers:[lower,upper],stairs:[[1,3],[3,3]].flatMap(([x,y])=>[{x,y,layer:0,direction:'up'},{x,y,layer:1,direction:'down'}])};
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};fs.writeFileSync(new URL('compact.json',root),JSON.stringify(o,null,2)+'\n');console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
