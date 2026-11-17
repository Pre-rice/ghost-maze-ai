import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
import {inspectGhostInfluence} from '../../../../src/design/ghost-influence.js';
const root=new URL('./',import.meta.url),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000},rows=[];
for(const name of ['prototype','goal-return','return-bay','guarded-key','without-door','lower-door','split-return']){
 const frozen=JSON.parse(fs.readFileSync(new URL(name+'.json',root))),map=frozen.map,e=createReferenceEnvironment(map),nm=structuredClone(map);nm.layers.forEach(l=>l.endPos=null);const no=createReferenceEnvironment(nm);
 assert.equal(e.mapId,frozen.mapId);
 const all=createBreadthFirstSearch(e,{allOptimal:true}),result=all.run(budget);assert.equal(result.status,frozen.result.status);assert.equal(result.totalActions,frozen.result.totalActions);assert.equal(all.routeCount().toString(),frozen.count);
 const boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null;assert.equal(boundary?.status,frozen.boundary?.status);
 const clean=createBreadthFirstSearch(e,{monitor:{initial:()=>[0],advance(h,b,a,n){if(n.isWon&&no.step(b,a).isDead)return null;if(n.layerStates.some(l=>new Set(l.ghosts.map(g=>g.x+','+g.y)).size!==l.ghosts.length))return null;return h;}}}),cleanResult=clean.run(budget);assert(['solved','proven_unsat'].includes(cleanResult.status));
 let noEndSafeRoutes=0;for(const actions of all.routes())if(!no.replay(actions).state.isDead)noEndSafeRoutes++;
 const row={name,mapId:e.mapId,cells:map.layers.reduce((n,l)=>n+l.activeCells.reduce((s,r)=>s+r.filter(Boolean).length,0),0),result,count:frozen.count,boundary:boundary?.status,cleanResult,cleanActions:clean.firstActions(),noEndSafeRoutes};
 if(name==='guarded-key'){
  const q=createBreadthFirstSearch(e,{monitor:{initial:()=>[0],advance(h,b,a,n){if(n.isWon&&no.step(b,a).isDead)return null;if(inspectGhostInfluence(e,b,a,n).kind!=='none')return null;return h;}}});row.noActualInfluence=q.run(budget);row.noActualActions=q.firstActions();assert.equal(row.noActualInfluence.totalActions,19);
 }
 rows.push(row);
}
fs.writeFileSync(new URL('complete-review.json',root),JSON.stringify({createdOn:'2026-11-17',humanQuality:null,scope:'七份明确手画修订，不作任意位置生成；全部最优重合和全部去终点分别记录。干净方案查询不允许非死亡重合，到达另查不以终点掩盖死亡。没有发布证书或真人体验。',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,cells:r.cells,T:r.result.totalActions,raw:r.count,boundary:r.boundary,clean:r.cleanResult.status,cleanT:r.cleanResult.totalActions,noEndSafeRoutes:r.noEndSafeRoutes}))));
