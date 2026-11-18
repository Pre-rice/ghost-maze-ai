import fs from 'node:fs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),old=JSON.parse(fs.readFileSync(new URL('goal-recess.json',root))),map=structuredClone(old.map),l=map.layers[0],budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
// 无资源任务仍有19步完全不穿单向口、不借鬼的完整方案。改为必须从侧室取物再离开，非只把钥匙贴在必经路。
l.items=[{x:3,y:1,type:'key'}];l.endPos={x:0,y:0};l.hWalls[1][0]={type:1,keys:0};l.vWalls[0][1]={type:3,keys:1};
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null,nm=structuredClone(map);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);let safe=0;const failures=[];
for(const as of q.routes()){let st=no.initialState(),failure=null;for(const[i,a]of as.entries()){st=no.step(st,a);if(st.isDead){failure=i+1;break;}}if(failure===null)safe++;else failures.push({actions:as,step:failure});}
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.x,n.player.y],g:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),keys:n.player.keys,influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const manual=[...old.manual.actions,'L','U','L','L'];let ms=e.initialState(),failure=null;for(const[i,a]of manual.entries()){const n=e.step(ms,a);if(n===ms||n.isDead){failure={step:i+1,a,invalid:n===ms,dead:n.isDead};break;}ms=n;}
const out={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,noEndSafeRoutes:safe,noEndFailures:failures,trace,manual:{actions:manual,failure,won:ms.isWon}};fs.writeFileSync(new URL('key-return.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({result,count:out.count,boundary:boundary?.status,safe,failures,manual:out.manual,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
