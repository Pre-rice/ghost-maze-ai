import fs from 'node:fs';
import {buildLevel} from '../../build.mjs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const root=new URL('./',import.meta.url),map=buildLevel('56'),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
map.layers[0].ghosts=map.layers[0].ghosts.filter(g=>g.x!==3||g.y!==2);
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){s=e.step(s,a);trace.push({step:i+1,a,p:[s.player.x,s.player.y],g:s.layerStates[0].ghosts.map(g=>[g.x,g.y]),keys:s.player.keys});}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};fs.writeFileSync(new URL('prototype.json',root),JSON.stringify(o,null,2)+'\n');console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,trace}));
