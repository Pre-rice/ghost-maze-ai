import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DataSerializer} from '../../../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';
const root=new URL('./',import.meta.url),parent=JSON.parse(fs.readFileSync(new URL('parent.json',root))),old=DataSerializer.loadFromShareCode(parent.mapCode).data.mapData,map=structuredClone(old),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};map.layers[0].customStartPos={x:1,y:3};
const e=createReferenceEnvironment(map),oe=createReferenceEnvironment(old),q=createBreadthFirstSearch(e,{allOptimal:true}),result=q.run(budget),boundary=result.status==='solved'?auditPuzzleBoundaries(map,budget):null,oldQ=createBreadthFirstSearch(oe,{allOptimal:true});oldQ.run(budget);
// 两地图出生不同，mapId必然不同；只剥去状态键中的mapId比较真实物理，不比较观察或玩家判断。
const physical=(env,s)=>JSON.stringify(JSON.parse(env.stateKey(s)).slice(1));
let mappedOldRoutes=0;for(const a of oldQ.routes()){assert.equal(a[0],'U');const b=['D',...a.slice(1)];let os=oe.initialState(),ns=e.initialState();for(const[i,action]of a.entries()){os=oe.step(os,action);ns=e.step(ns,b[i]);assert(physical(oe,os)===physical(e,ns),'首步映射后逐局面不等，第'+(i+1)+'步');}assert(ns.isWon);mappedOldRoutes++;}
const nm=structuredClone(map);nm.layers[0].endPos=null;const no=createReferenceEnvironment(nm);let noEndSafeRoutes=0;for(const a of q.routes())if(!no.replay(a).state.isDead)noEndSafeRoutes++;
const out={createdOn:'2026-11-17',humanQuality:null,parent,map,mapId:e.mapId,mapCode:DataSerializer.generateShareCode(map).code,result,count:q.routeCount().toString(),actions:q.firstActions(),boundary,mappedOldRoutes,noEndSafeRoutes};fs.writeFileSync(new URL('prototype.json',root),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({result,count:out.count,boundary:boundary?.status,mappedOldRoutes,noEndSafeRoutes,first:q.firstActions()}));
