import test from 'node:test';
import assert from 'node:assert/strict';
import {sameDynamicSituation,createEventSuccessors} from '../../src/training/event-actions.js';
import {createIncrementalPlanner} from '../../src/training/incremental-planner.js';
import {createFastEnvironment} from '../../src/search/fast-environment.js';
import {hasGhostOverlap,enumeratePlanningGraph} from '../../src/training/planning-graph.js';
import {createDecisionSuccessors} from '../../src/training/decision-actions.js';
import {smallMap,keyDetourMap,stairMap} from './fixtures.mjs';

function setup(map){
    const env=createFastEnvironment(map,{canonicalGhosts:true}),goal=s=>s.isWon;
    const macro=createEventSuccessors({stateKey:env.stateKey,step:env.step,actions:env.reference.actions,isGoal:goal,isAllowed:s=>!s.isDead&&!hasGhostOverlap(s)});
    return{env,macro,goal};
}
test('纯行走保留精确长度，钥匙／消耗门／楼梯都是事件',()=>{
    const map=smallMap([[1,1],[2,1],[3,1]],[1,1],[3,1]),{env,macro}=setup(map),edges=macro.generate(env.initialState());
    assert.equal(edges.length,1);assert.deepEqual(edges[0].actions,['R','R']);assert.equal(edges[0].cost,2);assert(edges[0].state.isWon);
    const k=setup(keyDetourMap()),initial=k.env.initialState(),before=k.env.step(initial,'U'),pickup=k.env.step(before,'U');
    assert(sameDynamicSituation(initial,before));assert(!sameDynamicSituation(before,pickup));
    let state=pickup;for(const a of ['D','D','R'])state=k.env.step(state,a);const open=k.env.step(state,'R');assert(!sameDynamicSituation(state,open));
    const stairs=setup(stairMap()),landing=stairs.env.step(stairs.env.initialState(),'R');assert(!sameDynamicSituation(landing,stairs.env.step(landing,'STAIR')));
});
test('鬼移动／门态变化不能当走路压掉，编号与数组顺序不造伪事件',()=>{
    const map=smallMap([[1,1],[2,1],[3,1],[1,2],[2,2],[3,2]],[1,1],[3,2]);map.initialGhosts=[{x:3,y:1,id:1},{x:3,y:2,id:2}];
    const{env}=setup(map),initial=env.initialState(),copy=initial.clone();copy.layerStates[0].ghosts.reverse().forEach(g=>g.id+=100);assert(sameDynamicSituation(initial,copy));
    const moved=initial.clone();moved.layerStates[0].ghosts[0].x=2;assert(!sameDynamicSituation(initial,moved));
    const changed=initial.clone();changed.setWall(0,'v',2,1,{type:1});assert(!sameDynamicSituation(initial,changed));
});
test('不等长边按成本出队后才证明最短，保留完整真实操作',()=>{
    const edges=[[{action:'R',actions:['R','R','R','R','R'],cost:5,state:2},{action:'U',actions:['U'],cost:1,state:1}],
                 [{action:'D',actions:['D'],cost:1,state:2}],[]];
    const p=createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===2,successors:s=>edges[s],strategy:'dijkstra'});
    assert.equal(p.advance({additionalExpansions:1}).status,'unknown');const r=p.advance({additionalExpansions:1});assert.equal(r.optimality,'proven');assert.equal(r.solution.totalActions,2);assert.deepEqual(r.solution.actions,['U','D']);
    assert.throws(()=>createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===2,successors:s=>edges[s]}).advance(),/BFS/);
    const duplicate=createIncrementalPlanner({initial:0,stateKey:s=>s,isGoal:s=>s===2,strategy:'dijkstra',
        successors:()=>[{action:'R',actions:['R','R','R'],cost:3,state:2},{action:'U',actions:['U','U'],cost:2,state:2}]});
    assert.deepEqual(duplicate.advance().solution.actions,['U','U']);
});
test('全部小构造的行动段最短与逐步搜索相同，逐步真实回放一致',()=>{
    for(const map of [keyDetourMap(),stairMap(),smallMap([[1,1],[2,1],[1,2],[2,2]],[1,1],[2,2])]){
        const{env,macro,goal}=setup(map),initial=env.initialState(),graph=enumeratePlanningGraph(map);
        const p=createIncrementalPlanner({initial,stateKey:env.stateKey,isGoal:goal,successors:macro.generate,strategy:'dijkstra'});
        let r;do{r=p.advance({additionalExpansions:1});}while(r.status==='unknown');
        assert.equal(r.status,'solved');assert.equal(r.solution.totalActions,graph.safeDistance[0]);assert(env.reference.replay(r.solution.actions).state.isWon);
    }
});
test('连续追逐仅一种安全走法可合成，但完整鬼时序与成本保持',()=>{
    const map=smallMap([[1,1],[2,1],[3,1],[4,1],[5,1],[6,1]],[2,1],[6,1]);map.initialGhosts=[{x:1,y:1,id:17}];
    const env=createFastEnvironment(map,{canonicalGhosts:true}),goal=s=>s.isWon,initial=env.initialState();
    const macro=createDecisionSuccessors({stateKey:env.stateKey,step:env.step,actions:env.reference.actions,isGoal:goal,isAllowed:s=>!s.isDead&&!hasGhostOverlap(s)});
    const edges=macro.generate(initial);assert.equal(edges.length,1);assert.deepEqual(edges[0].actions,['R','R','R','R']);assert.equal(edges[0].cost,4);
    const replay=env.reference.replay(edges[0].actions);assert.equal(env.stateKey(replay.state),env.stateKey(edges[0].state));assert(replay.state.isWon);
});
