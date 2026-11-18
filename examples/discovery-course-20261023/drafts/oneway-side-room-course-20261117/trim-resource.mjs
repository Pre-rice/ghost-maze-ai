import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DataSerializer,normalizeVoidWalls} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),old=JSON.parse(fs.readFileSync(new URL('separated-resource.json',root))),budget={nodeBudget:750000,stateBudget:750000,budgetMs:30000};let map=structuredClone(old.map);const l=map.layers[0];
// 右下两格使错误次序能环绕并以重合合并队列；手工的中上引动与左侧返回不需要它们。
for(const[x,y]of [[3,4],[4,4]]){l.activeCells[y][x]=false;for(const[a,xx,yy]of [['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]])l[a+'Walls'][yy][xx]={type:1,keys:0};}map=normalizeVoidWalls(map);
const rows=[];for(const [name,type]of [['down_arrow',4],['ordinary',2],['empty',0],['wall',1]]){const m=structuredClone(map);m.layers[0].hWalls[4][2]={type,keys:0,...(type===4?{direction:{dx:0,dy:1}}:{})};const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(m,budget):null,nm=structuredClone(m);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);let safe=0;for(const as of q.routes()){let st=no.initialState();for(const a of as)st=no.step(st,a);if(!st.isDead)safe++;}
 const queries=[];if(result.status==='solved')for(const mode of ['no_actual_influence','never_cross_exit']){const query=createBreadthFirstSearch(e,{monitor:{initial:()=>[],advance(h,b,a,n){if(n.isWon&&no.step(b,a).isDead)return null;if(mode==='no_actual_influence'&&inspectGhostInfluence(e,b,a,n).kind!=='none'||mode==='never_cross_exit'&&b.player.x===2&&b.player.y===3&&a==='D')return null;return h;}}}),r=query.run(budget);assert(['solved','proven_unsat'].includes(r.status));queries.push({mode,result:r,actions:query.firstActions()});}
 rows.push({name,map:m,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(m).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,noEndSafeRoutes:safe,queries});
}
fs.writeFileSync(new URL('trimmed-resource.json',root),JSON.stringify({createdOn:'2026-11-17',humanQuality:null,scope:'同一明确23格构造的四种单口反事实；原图不利用联合影响／不从上方跨口是分别查询，不把必要性当趣味。',rows},null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({name:r.name,status:r.result.status,T:r.result.totalActions,raw:r.count,boundary:r.boundary?.status,noEnd:r.noEndSafeRoutes,queries:r.queries.map(q=>({mode:q.mode,status:q.result.status,T:q.result.totalActions}))}))));
