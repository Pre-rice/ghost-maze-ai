import fs from 'node:fs';
import {normalizeVoidWalls,WALL_TYPES as W,DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('prototype.json',root))).map,l=map.layers[0],budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
// 旧目标只是安全离开的叶格，左鬼并未阻挡它；把完整目标改到守卫身后。
l.activeCells[2][4]=false;l.activeCells[1][0]=true;l.endPos={x:0,y:1};
for(const[a,x,y]of[['v',4,2],['v',5,2],['h',4,2],['h',4,3],['v',0,1],['v',1,1],['h',0,1]])l[a+'Walls'][y][x]={type:W.SOLID,keys:0};
l.hWalls[2][0]={type:W.LOCKED,keys:1};
normalizeVoidWalls(map);
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};
fs.writeFileSync(new URL('goal-return.json',root),JSON.stringify(o,null,2)+'\n');
console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
