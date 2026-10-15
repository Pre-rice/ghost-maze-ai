import test from 'node:test';
import assert from 'node:assert/strict';
import {createIncrementalPlanner} from '../../src/training/incremental-planner.js';
import {createFastEnvironment} from '../../src/search/fast-environment.js';
import {hasGhostOverlap} from '../../src/training/planning-graph.js';
import {keyDetourMap,smallMap} from './fixtures.mjs';

function graph(strategy='bfs',rankCandidate=null){
    const edges=[[['A',1],['B',2]],[['C',3]],[['D',4]],[['E',4]],[]];
    return createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===4,
        successors:s=>edges[s].map(([action,state])=>({action,state})),strategy,rankCandidate});
}
test('未知保留队列，分段与一次展开给出同样最短路线',()=>{
    const resumable=graph();assert.equal(resumable.advance({additionalExpansions:0}).status,'unknown');
    assert.equal(resumable.advance({additionalExpansions:1}).search.expanded,1);
    assert.equal(resumable.advance({additionalExpansions:1}).status,'unknown');
    const finished=resumable.advance({additionalExpansions:1});
    assert.equal(finished.status,'solved');assert.equal(finished.optimality,'proven');assert.deepEqual(finished.solution.actions,['B','D']);
    assert.deepEqual(graph().advance({additionalExpansions:3}).solution.actions,finished.solution.actions);
    assert.deepEqual(resumable.advance({additionalExpansions:100}),finished);
});
test('贪心可找到较长解，不能冒称最优；BFS不受敌对排序破坏',()=>{
    const rank=(before,action,after)=>after===2?99:0;
    const greedy=graph('greedy',rank).advance({additionalExpansions:20});assert.deepEqual(greedy.solution.actions,['A','C','E']);assert.equal(greedy.optimality,null);
    const exact=graph('bfs',rank).advance({additionalExpansions:20});assert.equal(exact.solution.totalActions,2);assert.equal(exact.optimality,'proven');
});
test('局部唯一后继仍需与其余前沿比较，不能省掉它的真实排序',()=>{
    const rank=(before,action,after)=>after===3?100:after===2?1:0;
    const r=graph('greedy',rank).advance({additionalExpansions:20});assert.deepEqual(r.solution.actions,['B','D']);
});
test('闭环预算未知与真正穷尽无解严格区分，零时间不弹出前沿',()=>{
    const make=()=>createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:()=>false,successors:s=>[{action:'R',state:1-s}]});
    const p=make();assert.equal(p.advance({timeBudgetMs:0}).search.expanded,0);assert.equal(p.advance({additionalExpansions:1}).status,'unknown');
    const done=p.advance({additionalExpansions:1});assert.equal(done.status,'proven_unsat');assert.equal(done.search.expanded,2);
});
test('最末预算展开发现目标与初态目标均准确返回',()=>{
    const p=createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===1,successors:()=>[{action:'R',state:1}]});
    assert.equal(p.advance({additionalExpansions:1}).status,'solved');
    const q=createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:()=>true,successors:()=>{throw Error('不能展开已完成目标');}});
    assert.equal(q.advance({additionalExpansions:0}).solution.totalActions,0);
});
test('更短重开使用独立父链，不把旧父链改成另一条证书',()=>{
    const edges=[[['A',1],['B',2]],[['C',3]],[['D',4]],[['E',4]],[['F',5],['J',7]],[['G',8]],[],[],[]];
    const p=createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===8,
        successors:s=>edges[s].map(([action,state])=>({action,state})),strategy:'greedy',rankCandidate:(s,a,n)=>n===2?50:[5,7].includes(n)?100:0});
    const r=p.advance({additionalExpansions:20});assert.equal(r.solution.actions.length,r.solution.totalActions);
    assert.equal(r.search.reopened,1);assert.deepEqual(r.solution.actions,['B','D','F','G']);
    let state=0;for(const a of r.solution.actions)state=edges[state].find(([action])=>action===a)[1];assert.equal(state,8);
});
test('排序只用于分叉，预算和无效数值明确拒绝',()=>{
    assert.throws(()=>graph().advance({additionalExpansions:-1}),/预算/);assert.throws(()=>graph().advance({timeBudgetMs:NaN}),/预算/);
    assert.throws(()=>graph('greedy',()=>NaN).advance(),/有限/);
    const p=createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===2,
        successors:s=>[{action:'R',state:s+1}],rankCandidate:()=>{throw Error('唯一新分支不应调用模型');}});
    assert.equal(p.advance().solution.totalActions,2);
});
test('原生地图分段求解、死亡过滤与证书重放，共用权威规则',()=>{
    for(const map of [keyDetourMap(),smallMap([[1,1],[2,1],[1,2],[2,2]],[1,1],[2,2])]){
        const env=createFastEnvironment(map,{canonicalGhosts:true}),initial=env.initialState();
        const p=createIncrementalPlanner({initial,stateKey:env.stateKey,isGoal:s=>s.isWon,
            successors:s=>env.reference.actions.map(action=>({action,state:env.step(s,action)})).filter(n=>n.state!==s&&!n.state.isDead&&!hasGhostOverlap(n.state))});
        let r;do{r=p.advance({additionalExpansions:1});}while(r.status==='unknown');
        assert.equal(r.status,'solved');assert.equal(r.optimality,'proven');assert(env.reference.replay(r.solution.actions).state.isWon);
    }
});
