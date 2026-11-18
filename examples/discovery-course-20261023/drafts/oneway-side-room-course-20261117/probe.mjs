import fs from 'node:fs';
import {room} from '../../build.mjs';
import {DataSerializer,WALL_TYPES as W} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000},edges=[['h',2,4,W.ONE_WAY,{direction:{dx:0,dy:1}}],['h',3,3,W.SOLID],['h',3,4,W.SOLID]];
for(const[x,y]of [[1,1],[3,1],[1,3]])for(const[a,xx,yy]of [['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])edges.push([a,xx,yy,W.SOLID]);
const map=room(5,5,{start:[1,4],end:[2,1],ghosts:[[2,0],[4,1]],edges}),e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.x,n.player.y],g:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const noMap=structuredClone(map);noMap.layers[0].endPos=null;const no=createReferenceEnvironment(noMap);let noEndSafe=0;for(const a of q.routes())if(!no.replay(a).state.isDead)noEndSafe++;
const manual='L U U R R D D R R U D L L L L U U R R U'.split(' ');let manualState=e.initialState(),manualFailure=null;for(const[i,a]of manual.entries()){const n=e.step(manualState,a);if(n===manualState||n.isDead){manualFailure={step:i+1,a,invalid:n===manualState,dead:n.isDead};break;}manualState=n;}
const out={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,noEndSafeRoutes:noEndSafe,trace,manual:{actions:manual,failure:manualFailure,won:manualState.isWon}};fs.writeFileSync(new URL('prototype.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({result,count:out.count,boundary:boundary?.status,noEndSafe,manual:out.manual,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
