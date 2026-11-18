import fs from 'node:fs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),old=JSON.parse(fs.readFileSync(new URL('guard-offset.json',root))),map=structuredClone(old.map),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
// 原2,1目标有一条16步利用先判胜的参考；把目标移入既有封闭格3,1，原格成为需安全站住的前室。
map.layers[0].endPos={x:3,y:1};map.layers[0].vWalls[1][3]={type:0,keys:0};
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null,nm=structuredClone(map);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);let noEndSafe=0;const failures=[];
for(const as of q.routes()){let st=no.initialState(),failure=null;for(const[i,a]of as.entries()){st=no.step(st,a);if(st.isDead){failure=i+1;break;}}if(failure===null)noEndSafe++;else failures.push({actions:as,step:failure});}
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.x,n.player.y],g:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const manual=[...old.manual.actions,'R'];let ms=e.initialState(),failure=null;for(const[i,a]of manual.entries()){const n=e.step(ms,a);if(n===ms||n.isDead){failure={step:i+1,a,invalid:n===ms,dead:n.isDead};break;}ms=n;}
let manualNoEnd=null;if(!failure){let st=no.initialState();for(const a of manual)st=no.step(st,a);manualNoEnd=!st.isDead;}
const out={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,noEndSafeRoutes:noEndSafe,noEndFailures:failures,trace,manual:{actions:manual,failure,won:ms.isWon,noEndSafe:manualNoEnd}};fs.writeFileSync(new URL('goal-recess.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({result,count:out.count,boundary:boundary?.status,noEndSafe,failures,manual:out.manual,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
