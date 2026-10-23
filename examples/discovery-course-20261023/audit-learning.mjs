import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildLevel,definitions} from './build.mjs';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../ghost-maze/src/solver/breadthFirst.js';
import {DataSerializer,GameLogic,actionFromName,WALL_TYPES as W} from '../../src/reference/engine.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const budget={nodeBudget:250000,stateBudget:250000,budgetMs:10000};
const moved=(s,n)=>s.layerStates.some((l,i)=>l.ghosts.some((g,j)=>g.x!==n.layerStates[i].ghosts[j].x||g.y!==n.layerStates[i].ghosts[j].y));
const stationary=(s,n)=>s.player.x===n.player.x&&s.player.y===n.player.y;
const results=[];
const e2=createReferenceEnvironment(buildLevel('02')),q2=read('levels/02/evidence.json');
const ghostMoveCounts=q2.routes.map(r=>{let s=e2.initialState(),count=0;for(const a of r.actions){const n=e2.step(s,a);count+=Number(moved(s,n));s=n;}return count;});assert(ghostMoveCounts.every(n=>n>=3));
const upper2=e2.step(e2.initialState(),'U');assert.equal(upper2.layerStates[0].ghosts[0].x,3);assert.equal(e2.step(upper2,'U'),upper2);
results.push({id:'02',allOptimalGhostMoveCounts:ghostMoveCounts,wallInputDoesNotAdvanceAdjacentGhost:true,scope:'连续追击和无效输入的可见证据；并不要求主动引开终点守卫，也不证明玩家已注意到'});
for(const id of ['02','03','04']){
 const env=createReferenceEnvironment(buildLevel(id)),q=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance:(h,s,a,n)=>moved(s,n)?null:h}}),r=q.run(budget);assert.equal(r.status,'proven_unsat');results.push({id,query:'从未引动鬼的完整无伤通关',result:r.status,expanded:r.expanded,scope:'鬼必须实际移动，不证明玩家理解追击条件'});
}
const q3=read('levels/03/evidence.json');assert(q3.routes.every(r=>r.trace.some((t,i)=>i>0&&JSON.stringify(t.ghosts)===JSON.stringify(r.trace[i-1].ghosts))));
const q4=read('levels/04/evidence.json'),q7=read('levels/07/evidence.json');assert(q4.routes.every(r=>r.trace.every(t=>t.ghosts[0][0][0]<3)));assert(q7.routes.every(r=>r.trace.some(t=>t.ghosts[0][0][0]>=4)));
const onlyDoor=buildLevel('04');onlyDoor.layers[0].vWalls[1][4].type=W.LOCKED;assert.deepEqual(onlyDoor,buildLevel('07'));
results.push({ids:['04','07'],ordinaryDoor:'所有最优鬼均留在左侧',zeroGate:'所有最优鬼均进入右侧',scope:'相同布局只换门的直接观察对照，不当作新颖挑战'});
const m6=buildLevel('06'),e6=createReferenceEnvironment(m6);for(const r of read('levels/06/evidence.json').routes){const s=e6.replay(r.actions).state;assert.equal(s.player.keys,1);assert.equal(s.layerStates[0].wallStates.v[1][1].type,W.EMPTY);assert.equal(s.layerStates[0].wallStates.v[1][2].type,W.EMPTY);}
results.push({id:'06',evidence:'一钥匙通过两扇1门，通关仍有一钥匙，两门均为空',scope:'不消耗钥匙与开门后消失'});
const e10=createReferenceEnvironment(buildLevel('10')),q10=createBreadthFirstSearch(e10,{monitor:{initial:()=>[],advance:(h,s,a,n)=>stationary(s,n)&&moved(s,n)?null:h}}),r10=q10.run(budget);assert.equal(r10.status,'proven_unsat');results.push({id:'10',query:'从不在原地按钮操作时引动鬼的完整无伤通关',result:r10.status,expanded:r10.expanded});
const e11=createReferenceEnvironment(buildLevel('11')),q11=createBreadthFirstSearch(e11,{monitor:{initial:()=>[],advance:(h,s,a,n)=>stationary(s,n)?null:h}}),r11=q11.run(budget);assert.equal(r11.status,'proven_unsat');for(const r of read('levels/11/evidence.json').routes){let s=e11.initialState();for(const a of r.actions){const n=e11.step(s,a);if(n.player.keys>s.player.keys)assert.equal(n.layerStates[0].wallStates.h[1][2].currentState,'closed');s=n;}}
results.push({id:'11',withoutButton:r11.status,allOptimalKeyPickupAfterClosingA:true,scope:'全部最优中的保护顺序；不扩大为玩家主观发现或全部解的唯一停位'});
const q17=read('levels/17/evidence.json');const winners=new Set();for(const route of q17.routes){const events=route.trace.flatMap(t=>t.diagnostics).filter(d=>d.decision==='visible_target_priority');assert(events.length);for(const d of events){const w=d.contenders.find(c=>c.seesAfter);winners.add(JSON.stringify(w.from));}}assert.equal(winners.size,2);results.push({id:'17',allOptimalObserveVisiblePriority:true,twoDifferentGhostsCanTakePriority:true,scope:'两条方向选择均可比较，不声称玩家必然自行重玩另一支'});
for(const[id,role]of [['18',null],['19',null],['25',null],['25',0],['25',1]]){
 const env=createReferenceEnvironment(buildLevel(id)),q=createBreadthFirstSearch(env,{monitor:{initial:()=>[],advance:(h,s,a)=>{const ds=[];GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:ds});return ds.some(d=>d.decision==='visible_target_priority'&&(role===null||d.contenders.some(c=>c.seesAfter&&c.from.x===s.layerStates[0].ghosts[role].x&&c.from.y===s.layerStates[0].ghosts[role].y)))?null:h;}}}),r=q.run(budget);assert.equal(r.status,'proven_unsat');results.push({id,mapId:env.mapId,forbiddenPriorityWinner:role===null?'任何鬼':role,result:r.status,expanded:r.expanded,scope:'全部无伤无复活通关，允许合法非最优重合；不证明玩家主观理解'});
}
const gallery=read('gallery-sources.json');
function signature(s,map){return JSON.stringify({p:s.player,dead:s.isDead,won:s.isWon,l:s.layerStates.map((l,li)=>({g:l.ghosts.map(g=>[g.x,g.y]),items:l.items,walls:Object.fromEntries(['h','v'].map(axis=>[axis,l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{const ac=map.layers[li].activeCells;return ac[y]?.[x]&&(axis==='h'?ac[y-1]?.[x]:ac[y]?.[x-1])?[[x,y,w]]:[];}))]))}))});}
for(const d of definitions.filter(d=>d.galleryTitle&&!d.goalExtension&&fs.existsSync(new URL(`levels/${d.id}/map.json`,import.meta.url)))){
 const original=DataSerializer.loadFromShareCode(gallery.maps[d.galleryTitle].mapCode);assert(original.success);const source=original.data.mapData,course=buildLevel(d.id),a=createReferenceEnvironment(source),b=createReferenceEnvironment(course),queue=[[a.initialState(),b.initialState()]],seen=new Set([a.stateKey(queue[0][0])]);let compared=0;
 assert.deepEqual(source.layers[0].activeCells,course.layers[0].activeCells);
 for(let h=0;h<queue.length;h++){
  const[s,t]=queue[h];assert.equal(signature(s,source),signature(t,course));if(s.isDead||s.isWon)continue;
  assert(queue.length<250000);
  for(const action of a.actions){const n=a.step(s,action),o=b.step(t,action);assert.equal(signature(n,source),signature(o,course));compared++;if(n===s||n.isDead)continue;const k=a.stateKey(n);if(!seen.has(k)){seen.add(k);queue.push([n,o]);}}
 }
 results.push({id:d.id,title:d.galleryTitle,courseVariant:'仅补齐外围墙',allReachableInteriorPhysicalSuccessorsUnchanged:true,reachable:queue.length,compared,includesFatalActions:true,scope:'只排除外围墙补齐的物理影响；不转移原图好评到学习流程'});
}
const old16=read('levels/16/revisions/v01/evidence.json'),new16=read('levels/16/evidence.json');assert.equal(new16.allResult.totalActions,old16.allResult.totalActions+1);assert.deepEqual(new16.routes.map(r=>JSON.stringify(r.actions)).sort(),old16.routes.map(r=>JSON.stringify([...r.actions,'L'])).sort());
const source16=DataSerializer.loadFromShareCode(gallery.maps['接力'].mapCode).data.mapData,course16=buildLevel('16');source16.layers[0].endPos=null;course16.layers[0].endPos=null;const eOld=createReferenceEnvironment(source16),eNew=createReferenceEnvironment(course16);for(const route of old16.routes){let s=eOld.initialState(),t=eNew.initialState();for(const a of route.actions){s=eOld.step(s,a);t=eNew.step(t,a);assert.equal(signature(s,source16),signature(t,source16));}}results.push({id:'16',goalSeparatedFromGhost:true,allOriginalOptimalPrefixesPreserved:true,oldT:31,newT:32,routes:old16.routes.length,comparison:'原图去终点与课程副本去终点逐动作内部物理一致，最后新增L进入独立终点',scope:'保证目标可见，不把多一步当难度提升'});
for(const id of ['15','16'].filter(id=>fs.existsSync(new URL(`levels/${id}/evidence.json`,import.meta.url)))){const q=read(`levels/${id}/evidence.json`);assert(q.routes.every(r=>r.trace.every(t=>t.diagnostics.length===0)));results.push({id,allOptimalNoGhostConflict:true,scope:'前置双鬼关不暗中依赖尚未介绍的争位'});}
function observedRoute(id,actions){const env=createReferenceEnvironment(buildLevel(id));let s=env.initialState();const events=[];for(const [index,a]of actions.entries()){const n=env.step(s,a),g=s.layerStates[0].ghosts[0],ng=n.layerStates[0].ghosts[0];if(g)events.push({step:index+1,action:a,pBefore:[s.player.x,s.player.y],pAfter:[n.player.x,n.player.y],gBefore:[g.x,g.y],gAfter:[ng.x,ng.y],sawBefore:GameLogic._canGhostSeePlayer(g,s.player,env.mapDefinition.layers[0],s.layerStates[0]),seesAfter:GameLogic._canGhostSeePlayer(g,n.player,env.mapDefinition.layers[0],n.layerStates[0]),moved:g.x!==ng.x||g.y!==ng.y,stationary:stationary(s,n)});s=n;}return events;}
const observations=[];for(const[id,belief,match]of[
 ['02','鬼总在玩家动作前行动',(e)=>!e.sawBefore&&e.seesAfter&&e.moved],
 ['03','看不到玩家后当步立即停止',(e)=>e.sawBefore&&!e.seesAfter&&e.moved],
 ['04','普通门只挡脚步而不挡视线',(e)=>e.pAfter[0]>=4&&e.gAfter[0]===2&&!e.sawBefore&&!e.seesAfter&&!e.moved],
 ['07','所有门都永久阻止鬼通过',(e)=>e.gBefore[0]<4&&e.gAfter[0]>=4],
 ['10','原地操作按钮不会推进鬼',(e)=>e.stationary&&e.sawBefore&&e.seesAfter&&e.moved],
 ['11','看见过玩家就能穿过刚关的门',(e)=>e.stationary&&e.sawBefore&&!e.seesAfter&&!e.moved]
]){const q=read(`levels/${id}/evidence.json`),witnesses=q.routes.map(r=>observedRoute(id,r.actions).find(match));assert(witnesses.every(Boolean));observations.push({id,falseBelief:belief,witness:witnesses[0],allOptimalRoutesContainEvidence:true,scope:'玩家可见的反例存在；不证明玩家一定注意到或据此总结'});}
const memoryWitnesses=[];for(const route of q3.routes){const env=createReferenceEnvironment(buildLevel('03'));let s=env.initialState(),witness=null;for(let i=0;i<route.actions.length-1;i++){const n=env.step(s,route.actions[i]),g=s.layerStates[0].ghosts[0],ng=n.layerStates[0].ghosts[0];const before=GameLogic._canGhostSeePlayer(g,s.player,env.mapDefinition.layers[0],s.layerStates[0]),after=GameLogic._canGhostSeePlayer(g,n.player,env.mapDefinition.layers[0],n.layerStates[0]);if(before&&!after&&moved(s,n)){const next=env.step(n,route.actions[i+1]);if(!moved(n,next)){const path=GameLogic._findShortestPath(ng,s.player,env.mapDefinition.layers[0],next.layerStates[0]);assert(path&&path.length>1);witness={lostSightStep:i+1,stoppedStep:i+2,lastSeenPlayer:[s.player.x,s.player.y],stoppedGhost:[ng.x,ng.y],remainingPathToLastSeen:path.length-1};break;}}s=n;}assert(witness);memoryWitnesses.push(witness);}observations.push({id:'03',falseBelief:'失去视线后仍会一直追到最后看见的位置',witness:memoryWitnesses[0],allOptimalRoutesContainEvidence:true,scope:'鬼尚有通向旧目标的可走路径却不继续；这是可见反例，不是玩家实际总结'});
const order=read('course-order.json');assert.equal(new Set(order).size,order.length);for(const id of order){const m=buildLevel(id),l=m.layers[0];assert.equal(m.gameMode,'death-loop');assert(!l.ghosts.some(g=>g.x===l.endPos.x&&g.y===l.endPos.y));}
const report={createdOn:'2026-10-23',humanLearningValidated:false,role:'可观察事件与物理对照，不是未知规则真人试玩结果',checks:results,observationalCounterexamples:observations,courseOrder:order,allGoalsVisible:true,deathLoopOnly:true};fs.writeFileSync(new URL('learning-evidence.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:results.length,humanLearningValidated:false}));
