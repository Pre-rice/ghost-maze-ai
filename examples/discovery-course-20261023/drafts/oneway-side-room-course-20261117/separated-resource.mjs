import fs from 'node:fs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),old=JSON.parse(fs.readFileSync(new URL('key-return.json',root))),map=structuredClone(old.map),l=map.layers[0],budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
l.customStartPos={x:0,y:2};l.endPos={x:0,y:4};l.hWalls[1][0]={type:0,keys:0};l.vWalls[0][1]={type:0,keys:0};
l.hWalls[4][0]={type:3,keys:1};l.vWalls[4][1]={type:1,keys:0};l.hWalls[3][2]={type:1,keys:0};l.hWalls[4][1]={type:0,keys:0};l.vWalls[3][1]={type:0,keys:0};
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null,nm=structuredClone(map);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);let safe=0;const failures=[];
for(const as of q.routes()){let st=no.initialState(),failure=null;for(const[i,a]of as.entries()){st=no.step(st,a);if(st.isDead){failure=i+1;break;}}if(failure===null)safe++;else failures.push({actions:as,step:failure});}
let st=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(st,a);trace.push({step:i+1,a,p:[n.player.x,n.player.y],g:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),keys:n.player.keys,influence:inspectGhostInfluence(e,st,a,n)});st=n;}
const out={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,noEndSafeRoutes:safe,noEndFailures:failures,trace};fs.writeFileSync(new URL('separated-resource.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({result,count:out.count,boundary:boundary?.status,safe,failures,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
