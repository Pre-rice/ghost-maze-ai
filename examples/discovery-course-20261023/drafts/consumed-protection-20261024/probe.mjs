import fs from 'node:fs';import assert from 'node:assert/strict';
import {room} from '/workspace/ghost-maze-ai/examples/discovery-course-20261023/build.mjs';
import {WALL_TYPES as W,DataSerializer} from '/workspace/ghost-maze-ai/src/reference/engine.js';
import {createReferenceEnvironment} from '/workspace/ghost-maze-ai/src/reference/environment.js';
import {createBreadthFirstSearch} from '/workspace/ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '/workspace/ghost-maze-ai/src/design/rule-boundaries.js';
const root='/workspace/work/discovery-consumed-protection-20261023/';
const card={goal:'取左房钥匙并安全返回近处出口',knownPlan:'把守卫引出房间，穿过门后依靠门隔追，取物返回',contradiction:'旧的近入口开后消失，不能继续当作保护；死路钥匙还要求折返',intendedRevision:'要在开近口以前安排能持续隔开两鬼的关系，而不是每次遇鬼再找门',visibleBasis:'数字门、普通门、死路钥匙和回程目标均同时可见，没有新字母组',scope:'完整问题的手工原型，不是0门对照演示；若仍只是旧安置流程加赶路，则不接入'};
for(const [name,gate]of [['consumed',W.LOCKED],['ordinary',W.DOOR]]){
 const params={start:[3,3],end:[4,3],ghosts:[[0,2],[1,1]],items:[[0,3]],cells:[...Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>[x,y])).flat(),[4,3]],edges:[['v',1,1,gate,{keys:0}],['v',1,2,W.SOLID],['v',1,3,W.SOLID],['v',2,1,W.SOLID],['h',3,1,W.DOOR],['v',4,3,W.LOCKED,{keys:1}]]};
 const map=room(5,4,params),env=createReferenceEnvironment(map),search=createBreadthFirstSearch(env,{allOptimal:true}),result=search.run({nodeBudget:500000,stateBudget:500000,budgetMs:15000}),routes=[];
 if(result.status==='solved')for(const r of search.routes()){routes.push(r);if(routes.length>=1000)break;}
 const boundary=result.status==='solved'?auditPuzzleBoundaries(map,{nodeBudget:500000,stateBudget:500000,budgetMs:15000}):null,code=DataSerializer.generateShareCode(map);assert(code.success);
 const data={name,parentCourseId:'36',card,params,map,result,totalRawOptimalCount:search.routeCount().toString(),routes,boundary,mapCode:code.code,humanQuality:null,scope:'原生最优与重合初检，不是交付证书或体验评价'};
 fs.writeFileSync(root+name+'.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({name,status:result.status,T:result.totalActions,count:search.routeCount().toString(),boundary:boundary?.status,reference:routes[0]}));
}
