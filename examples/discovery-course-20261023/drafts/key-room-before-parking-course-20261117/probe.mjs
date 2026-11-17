import fs from 'node:fs';
import {DataSerializer,normalizeVoidWalls,WALL_TYPES as W} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};let map=JSON.parse(fs.readFileSync(new URL('../../levels/72/revisions/v01/map.json',root)));const l=map.layers[0],u=map.layers[1];
l.items=[];l.endPos={x:0,y:0};l.ghosts=[{x:0,y:1,id:0}];l.hWalls[1][0]={type:W.LOCKED,keys:1};l.vWalls[2][3]={type:W.EMPTY,keys:0};
for(const x of [0,1]){l.activeCells[3][x]=true;for(const[ax,xx,y]of[['h',x,3],['h',x,4],['v',x,3],['v',x+1,3]])l[ax+'Walls'][y][xx]={type:W.SOLID,keys:0};l.hWalls[3][x]={type:W.EMPTY,keys:0};}
l.vWalls[3][1]={type:W.EMPTY,keys:0};l.vWalls[3][2]={type:W.EMPTY,keys:0};
u.activeCells[3][1]=false;u.endPos=null;u.items=[{x:2,y:1,type:'key'}];u.buttons=[];
for(const[ax,x,y]of[['h',1,3],['h',1,4],['v',1,3],['v',2,3]])u[ax+'Walls'][y][x]={type:W.SOLID,keys:0};
map=normalizeVoidWalls(map);
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};fs.writeFileSync(new URL('prototype.json',root),JSON.stringify(o,null,2)+'\n');console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
