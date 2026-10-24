import fs from 'node:fs';
import assert from 'node:assert/strict';
import {definitions,buildLevel,sourceMapCode} from './build.mjs';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {auditMap as auditMoreGhosts} from '../staged-workroom-20261018/audit.mjs';
import {assertExterior} from '../spatial-clearance-20261019/verify.mjs';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {DataSerializer} from '../../src/reference/engine.js';
const id=process.argv[2];const d=definitions.find(x=>x.id===id);assert(d);
const map=buildLevel(id);assertExterior(map);const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);
const mapCode=sourceMapCode(id)??encoded.code;
let qa;
if(map.layers[0].ghosts.length)qa=(map.layers[0].ghosts.length>3?auditMoreGhosts:auditMap)(map,mapCode);
else{
 const env=createReferenceEnvironment(map),search=createBreadthFirstSearch(env,{allOptimal:true}),result=search.run({nodeBudget:100000,stateBudget:100000,budgetMs:10000});assert.equal(result.status,'solved');
 const decoded=DataSerializer.loadFromShareCode(mapCode);assert(decoded.success);assert.deepEqual(decoded.data.mapData,map);
 const routes=[...search.routes()].map(actions=>{assert(env.replay(actions).state.isWon);return {actions};});
 qa={mapId:env.mapId,ruleset:env.ruleset,allResult:result,count:search.routeCount().toString(),routes,cold:true,boundary:{status:'safe',reason:'没有鬼、玻璃或楼梯；重合、编号和去终点死亡不适用'},replayCode:null,entry:null,scope:'独立关卡；不声称整图接入已验证'};
}
assert.equal(qa.boundary.status,'safe');
const dir=new URL(`./levels/${id}/`,import.meta.url);fs.mkdirSync(dir,{recursive:true});
for(const [name,data]of Object.entries({'map.json':map,'source.json':{...d,createdOn:d.createdOn??'2026-10-23',humanQuality:null,role:'discovery_level_design_not_human_learning_evidence'},'evidence.json':qa,'share.json':{mapCode,replayCode:qa.replayCode,url:`https://ghostmaze.novic.cc/?map=${mapCode}`}}))fs.writeFileSync(new URL(name,dir),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({id,cells:map.layers[0].activeCells.flat().filter(Boolean).length,T:qa.allResult.totalActions,routes:qa.count,cold:qa.cold,code:mapCode}));
