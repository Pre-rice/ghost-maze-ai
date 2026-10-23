import fs from 'node:fs';
import assert from 'node:assert/strict';
import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls,validateMapData} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '/workspace/ghost-maze-ai/src/design/rule-boundaries.js';
const root='/workspace/work/discovery-shunting-return-20261023/';
const source=JSON.parse(fs.readFileSync(root+'two-keys-return.json')).map;
const changes=[['side-door',W.DOOR],['side-open',W.EMPTY],['side-left',W.ONE_WAY,{direction:{dx:-1,dy:0}}],['side-right',W.ONE_WAY,{direction:{dx:1,dy:0}}]];
for(const[name,type,extra={}]of changes){
 let map=structuredClone(source);assert.equal(map.layers[0].vWalls[2][3].type,W.SOLID);map.layers[0].vWalls[2][3]={type,keys:0,...extra};map=normalizeVoidWalls(normalizeMapData(map));assert(validateMapData(map).valid);
 const env=createReferenceEnvironment(map),search=createBreadthFirstSearch(env,{allOptimal:true}),result=search.run({nodeBudget:1000000,stateBudget:1000000,budgetMs:30000}),routes=[];
 if(result.status==='solved')for(const r of search.routes()){routes.push(r);if(routes.length>=1000)break;}
 const boundary=result.status==='solved'?auditPuzzleBoundaries(map,{nodeBudget:1000000,stateBudget:1000000,budgetMs:30000}):null;
 const data={name,changes:'原左上凹室的右墙改为另一出入口，两个物品均为新目标；不是正式图改动',map,result,totalRawOptimalCount:search.routeCount().toString(),routes,boundary,humanQuality:null,scope:'手工设计原型的最优及重合初检，尚非完整交付或体验评价'};
 fs.writeFileSync(root+name+'.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({name,status:result.status,T:result.totalActions,count:search.routeCount().toString(),boundary:boundary?.status,actions:routes[0]}));
}
