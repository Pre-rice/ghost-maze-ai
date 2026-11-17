import fs from 'node:fs';
import {normalizeVoidWalls,WALL_TYPES as W,DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('goal-return.json',root))).map,l=map.layers[0],budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
// 不以对称争空作为解法：上层入口横侧为墙，沿纵向离开才有可见的新目标优先。
map.layers[1].vWalls[2][3]={type:W.SOLID,keys:0};
// 原下院回梯后无离开空间；右侧扩一列，作为两只追者在返回时的实际调动区。
for(const y of [2,3]){l.activeCells[y][4]=true;for(const[a,x,yy]of[['v',4,y],['v',5,y],['h',4,y],['h',4,y+1]])l[a+'Walls'][yy][x]={type:W.SOLID,keys:0};l.vWalls[y][4]={type:W.EMPTY,keys:0};}
l.hWalls[3][4]={type:W.EMPTY,keys:0};normalizeVoidWalls(map);
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};
fs.writeFileSync(new URL('return-bay.json',root),JSON.stringify(o,null,2)+'\n');
console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
