import fs from 'node:fs';
import {WALL_TYPES as W,DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('return-bay.json',root))).map,budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
// 南端钥匙不受上守卫实际阻挡，且两追者从两面汇到同格；改为取守卫身后的物件。
// 一扇普通门只提供中间暂存，停在左梯旁的上守卫仍妨碍返回；下环用于再引动。
map.layers[1].items=[{x:2,y:1,type:'key'}];
map.layers[1].vWalls[3][3]={type:W.DOOR,keys:0};
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.layer,n.player.x,n.player.y],g:n.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const o={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,trace};
fs.writeFileSync(new URL('guarded-key.json',root),JSON.stringify(o,null,2)+'\n');
console.log(JSON.stringify({result,count:o.count,boundary:boundary?.status,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
