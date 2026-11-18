import fs from 'node:fs';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),old=JSON.parse(fs.readFileSync(new URL('prototype.json',root))),map=structuredClone(old.map),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};
// 首稿右守卫离南侧接近点过近，手工计划第10步死亡；同时上排单独引走目标鬼有10步无单向口捷径。
// 将右守卫上移一格：南侧接近保持两步距离，上排接近则会同时引动两鬼；不加墙封住那条路。
map.layers[0].ghosts[1].y=0;
const e=createReferenceEnvironment(map),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;
let s=e.initialState();const trace=[];for(const[i,a]of(q.firstActions()??[]).entries()){const n=e.step(s,a);trace.push({step:i+1,a,p:[n.player.x,n.player.y],g:n.layerStates[0].ghosts.map(g=>[g.x,g.y]),influence:inspectGhostInfluence(e,s,a,n)});s=n;}
const nm=structuredClone(map);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);let noEnd=0;const noEndFailures=[];for(const as of q.routes()){let st=no.initialState(),failure=null;for(const[i,a]of as.entries()){st=no.step(st,a);if(st.isDead){failure=i+1;break;}}if(failure===null)noEnd++;else noEndFailures.push({actions:as,step:failure});}
let ms=e.initialState(),failure=null;for(const[i,a]of old.manual.actions.entries()){const n=e.step(ms,a);if(n===ms||n.isDead){failure={step:i+1,a,invalid:n===ms,dead:n.isDead};break;}ms=n;}
let manualNoEnd=null;if(!failure){let st=no.initialState();for(const a of old.manual.actions)st=no.step(st,a);manualNoEnd=!st.isDead;}
const out={createdOn:'2026-11-17',humanQuality:null,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,noEndSafeRoutes:noEnd,noEndFailures,trace,manual:{actions:old.manual.actions,failure,won:ms.isWon,noEndSafe:manualNoEnd}};fs.writeFileSync(new URL('guard-offset.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({result,count:out.count,boundary:boundary?.status,noEnd,noEndFailures,manual:out.manual,trace:trace.map(t=>({...t,influence:t.influence.kind}))}));
