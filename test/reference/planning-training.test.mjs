import test from 'node:test';
import assert from 'node:assert/strict';
import {enumeratePlanningGraph,reverseDistances} from '../../src/training/planning-graph.js';
import {createPlanningEncoder} from '../../src/training/planning-features.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {smallMap,keyDetourMap,stairMap} from './fixtures.mjs';
import {createTreePredictor} from '../../src/training/tree-predictor.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {solveBacktracking} from '../../src/training/backtracking-solver.js';
import {buildGhostRelaxation} from '../../src/search/ghost-relaxation.js';

test('完整图的标签包含所有并列最优动作；预算未知不提供精确距离',()=>{
 const m=smallMap([[1,1],[2,1],[1,2],[2,2]],[1,1],[2,2]),g=enumeratePlanningGraph(m);assert.equal(g.status,'exhausted');assert.equal(g.distance[0],2);assert.deepEqual(g.nodes[0].edges.filter(e=>g.distance[e.to]===1).map(e=>e.action).sort(),['D','R']);
 const limited=enumeratePlanningGraph(m,{stateBudget:1});assert.equal(limited.status,'unknown');assert.equal(limited.distance,undefined);
});
test('安全反向距离排除重合后继，不把不同范围的值冒充同一标签',()=>{
 const nodes=[{state:{isWon:false},overlap:false,edges:[{to:1},{to:2}]},{state:{isWon:true},overlap:true,edges:[]},{state:{isWon:false},overlap:false,edges:[{to:3}]},{state:{isWon:true},overlap:false,edges:[]}];
 assert.equal(reverseDistances(nodes)[0],1);assert.equal(reverseDistances(nodes,{avoidOverlap:true})[0],2);
});
test('特征不包含步号、观察记录、鬼编号；输入局面不被修改',()=>{
 const map=keyDetourMap(),env=createReferenceEnvironment(map),encode=createPlanningEncoder(map),s=env.initialState(),next=env.step(s,'R'),original=JSON.stringify(s),feature=encode.encode(s,'R',next),copy=structuredClone(s);copy.player.steps=999;copy.seenCells.forEach(l=>l.forEach(r=>r.fill(true)));for(const l of copy.layerStates)for(const g of l.ghosts)g.id+=100;
 assert.deepEqual(encode.encode(copy,'R',next),feature);assert.equal(JSON.stringify(s),original);assert(feature.every(Number.isFinite));
});
test('单层与楼梯动作使用同维输入；距离标签经共同规则确认',()=>{
 const a=keyDetourMap(),b=stairMap(),ae=createReferenceEnvironment(a),be=createReferenceEnvironment(b),av=ae.initialState(),bv=be.step(be.initialState(),'R');
 assert.equal(createPlanningEncoder(a).encode(av,'R',ae.step(av,'R')).length,createPlanningEncoder(b).encode(bv,'STAIR',be.step(bv,'STAIR')).length);
 const graph=enumeratePlanningGraph(b);assert.equal(graph.distance[0],3);assert.equal(graph.safeDistance[0],3);
});
test('远处消耗过的数字门不能与未经过的门压成同一输入',()=>{
 const map=smallMap([[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[6,2]],[1,1],[6,2]);map.vWalls[1][5]={type:3,keys:0};const env=createReferenceEnvironment(map),initial=env.initialState();let consumed=initial;for(const action of ['R','R','R','R','L','L','L','L'])consumed=env.step(consumed,action);
 assert.equal(consumed.player.x,initial.player.x);assert.equal(consumed.layerStates[0].wallStates.v[1][5].type,0);
 const old=createPlanningEncoder(map,{version:1}),current=createPlanningEncoder(map);assert.deepEqual(old.encode(initial,'R',env.step(initial,'R')),old.encode(consumed,'R',env.step(consumed,'R')));assert.notDeepEqual(current.encode(initial,'R',env.step(initial,'R')),current.encode(consumed,'R',env.step(consumed,'R')));
});
test('导出树推理使用float32分裂，错误维数与环被拒绝',()=>{
 const model={schemaVersion:1,modelType:'extra_trees_binary',dimension:1,trees:[{left:[1,-1,-1],right:[2,-1,-1],feature:[0,-2,-2],threshold:[1.00000001,-2,-2],probability:[0.5,0.2,0.8]}]},predictor=createTreePredictor(model);
 assert.equal(predictor.predict([1.00000002]),0.2);assert.equal(predictor.predict([2]),0.8);assert.throws(()=>predictor.predict([]));assert.throws(()=>predictor.predict([NaN]));const bad=structuredClone(model);bad.trees[0].left[0]=0;assert.throws(()=>createTreePredictor(bad),/有环/);
});
test('敌对候选排序也不能改A*最优性，预算仍返回未知',()=>{
 for(const map of [keyDetourMap(),stairMap(),smallMap([[1,1],[2,1],[1,2],[2,2]],[1,1],[2,2])]){
  const baseline=solveFastMap(map),guided=solveFastMap(map,{rankCandidate:(s,a,next)=>1000*next.player.x-next.player.y});assert.equal(guided.optimality,'proven');assert.equal(guided.solution.totalActions,baseline.solution.totalActions);
 }
 assert.equal(solveFastMap(keyDetourMap(),{nodeBudget:0,rankCandidate:()=>0}).status,'unknown');assert.throws(()=>solveFastMap(keyDetourMap(),{rankCandidate:()=>NaN}),/有限/);
});
test('真实双鬼的数组顺序与编号不成为训练输入',()=>{
 const map=smallMap(Array.from({length:3},(_,y)=>Array.from({length:4},(_,x)=>[x+1,y+1])).flat(),[1,1],[4,1]);map.initialGhosts=[{x:3,y:3,id:0},{x:4,y:3,id:1}];const env=createReferenceEnvironment(map),s=env.initialState(),copy=structuredClone(s),encoder=createPlanningEncoder(map);copy.layerStates[0].ghosts.reverse().forEach((g,i)=>g.id=100+i);assert.deepEqual(encoder.summarize(s),encoder.summarize(copy));
});
test('原生回溯保留所有分支、重放证书，但不冒称最优',()=>{
 const result=solveBacktracking(keyDetourMap(),{rankCandidate:(s,a,n)=>-n.player.x});assert.equal(result.status,'solved');assert.equal(result.optimality,null);assert(createReferenceEnvironment(keyDetourMap()).replay(result.solution.actions).state.isWon);
 assert.equal(solveBacktracking(keyDetourMap(),{nodeBudget:0}).status,'unknown');assert.equal(solveBacktracking(keyDetourMap(),{stateBudget:1}).status,'unknown');assert.equal(solveBacktracking(keyDetourMap(),{budgetMs:0}).status,'unknown');
 const corridor=smallMap([[1,1],[2,1],[3,1]],[1,1],[3,1]);const forced=solveBacktracking(corridor,{rankCandidate:()=>{throw new Error('唯一新分支不应付推理成本');}});assert.equal(forced.status,'solved');assert.equal(forced.search.rankCalls,0);
});
test('关系输入区分隔门冷鬼与开门可见，不改变V2输入或物理局面',()=>{
 const map=smallMap([[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[4,2]],[1,1],[4,2]);map.initialGhosts=[{x:3,y:1,id:55}];map.vWalls[1][3]={type:6,letter:'A',initialState:'closed'};const env=createReferenceEnvironment(map),s=env.initialState(),open=structuredClone(s);open.layerStates[0].wallStates.v[1][3].currentState='open';const legacy=createPlanningEncoder(map,{version:2}),relational=createPlanningEncoder(map,{version:3}),n=legacy.summarize(s).length,before=JSON.stringify(s);assert.deepEqual(relational.summarize(s).slice(0,n),legacy.summarize(s));assert.equal(relational.summarize(s)[n],0);assert.equal(relational.summarize(open)[n],1);assert(relational.summarize(open)[n+1]<relational.summarize(s)[n+1]);assert.equal(JSON.stringify(s),before);
});
test('去鬼子问题保留资源与机关，完整时给下界、预算未知不给假精确值',()=>{
 const map=keyDetourMap(),env=createReferenceEnvironment(map),table=buildGhostRelaxation(map,{budgetMs:5000});assert.equal(table.status,'exhausted');assert.equal(table.lowerBound(env.initialState()),6);assert.equal(buildGhostRelaxation(map,{nodeBudget:0}).status,'unknown');assert.equal(buildGhostRelaxation(map,{nodeBudget:0}).lowerBound(env.initialState()),null);
 for(const m of [map,stairMap()]){const a=solveFastMap(m),b=solveFastMap(m,{ghostRelaxation:{budgetMs:5000}}),fallback=solveFastMap(m,{ghostRelaxation:{nodeBudget:0}});assert.equal(b.optimality,'proven');assert.equal(b.solution.totalActions,a.solution.totalActions);assert.equal(fallback.solution.totalActions,a.solution.totalActions);}
});
test('只复用对应地图的真实子问题表，拒绝伪造下界',()=>{
 const map=keyDetourMap(),table=buildGhostRelaxation(map,{budgetMs:5000}),result=solveFastMap(map,{ghostRelaxation:table});assert.equal(result.solution.totalActions,6);assert.equal(result.search.ghostRelaxation.reused,true);assert.throws(()=>solveFastMap(stairMap(),{ghostRelaxation:table}),/地图不一致/);assert.throws(()=>solveFastMap(map,{ghostRelaxation:{status:'exhausted',lowerBound:()=>999}}),TypeError);
});
