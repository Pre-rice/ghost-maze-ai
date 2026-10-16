import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeArrangements,createArrangementPredicate} from '../../src/design/arrangements.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {solveContinuation} from '../../src/design/continuation.js';
import {smallMap} from './fixtures.mjs';

const map=JSON.parse(readFileSync(new URL('../../examples/seat-exchange-20261016/map.json',import.meta.url)));
const env=createReferenceEnvironment(map),report=analyzeArrangements(map);

// 重新逐步调用共同引擎，不使用分析器返回的节点、边或反向距离。
function reachableWithout(predicate){
    const initial=env.initialState(),queue=[initial],seen=new Set([env.stateKey(initial)]);
    for(let head=0;head<queue.length;head++){
        const state=queue[head];if(state.isWon)return true;
        for(const action of env.actions){
            const next=env.step(state,action);
            if(next===state||next.isDead||predicate(next))continue;
            const key=env.stateKey(next);if(!seen.has(key)){seen.add(key);queue.push(next);}
        }
    }
    return false;
}

test('自动安排发现按A前后及换到普通门右侧的准备，独立原生搜索核对全部通关必要性',()=>{
    assert.equal(report.status,'exhausted');assert.equal(report.N,30);assert.equal(report.allWinning,3);
    const necessary=report.goals.filter(goal=>goal.necessity==='all_winning');
    const left=necessary.filter(goal=>JSON.stringify(goal.data.ghosts)==='[[[2,4],[4,6]]]');
    const right=necessary.find(goal=>JSON.stringify(goal.data.ghosts)==='[[[3,4],[4,6]]]');
    assert.equal(left.length,2);assert(right);
    const before=left.find(goal=>goal.data.doors.find(door=>door.axis==='v').state==='open');
    const after=left.find(goal=>goal.data.doors.find(door=>door.axis==='v').state==='closed');
    assert.deepEqual(report.reduced,[[after.id,right.id],[before.id,after.id]]);
    for(const goal of necessary)assert.equal(reachableWithout(createArrangementPredicate(env,report,goal.id)),false);
    assert.equal(report.qualityScore,null);
});

test('目标保留玩家活动区域与门态，鬼顺序和编号变化不改变目标',()=>{
    const goal=report.goals.find(goal=>goal.necessity==='all_winning'&&goal.data.ghosts[0][0][0]===3);
    const predicate=createArrangementPredicate(env,report,goal.id);
    const state=env.replay(['R','L','D','R','D','R','R','U','U','U','L','L','R','D','D','L']).state;
    assert(predicate(state));
    const reversed=state.clone();reversed.layerStates[0].ghosts.reverse().forEach((g,i)=>g.id=900-i*201);
    assert(predicate(reversed));
    const otherPhase=state.clone();otherPhase.layerStates[0].wallStates.v[3][4].currentState='open';assert(!predicate(otherPhase));
    // 两个真正可达的局面只有玩家位置不同；同一安置不能代表已获得同样的后路。
    const beforeChange=report.goals.find(g=>g.necessity==='all_winning'&&g.data.ghosts[0][0][0]===2
        &&g.data.doors.find(d=>d.axis==='v').state==='closed');
    const matches=createArrangementPredicate(env,report,beforeChange.id);
    const goodPrefix=['R','L','D','R','D','R','R'];
    const badPrefix=[...goodPrefix,'U','U','U','L','L','R','D','L','D','D'];
    const good=env.replay(goodPrefix).state,bad=env.replay(badPrefix).state;
    assert.deepEqual(good.layerStates,bad.layerStates);assert.equal(good.player.keys,bad.player.keys);
    assert(matches(good));assert(!matches(bad));
    assert.equal(solveContinuation(map,badPrefix,{reference:true}).status,'proven_unsat');
});

test('原图目标不能套到删门图，未完成分析不提供可用必要性谓词',()=>{
    const altered=structuredClone(map);altered.layers[0].vWalls[3][4]={type:0,keys:0};
    assert.throws(()=>createArrangementPredicate(createReferenceEnvironment(altered),report,0),/不匹配/);
    assert.throws(()=>createArrangementPredicate(env,{...report,status:'unknown'},0),/不匹配/);
    assert.throws(()=>createArrangementPredicate(env,report,-1),/未知安排/);
});

test('预算不足为未知且没有部分必要性结果；原图已证无解与输入错误分开',()=>{
    for(const budget of [{nodeBudget:0},{stateBudget:1},{candidateBudget:0},{budgetMs:0}]){
        const result=analyzeArrangements(map,budget);assert.equal(result.status,'unknown');
        assert(!Object.hasOwn(result,'goals'));assert(!Object.hasOwn(result,'allWinning'));
    }
    const blocked=smallMap([[1,1],[3,1]],[1,1],[3,1]);assert.equal(analyzeArrangements(blocked).status,'base_unsat');
    const noEnd=smallMap([[1,1]],[1,1],null);assert.throws(()=>analyzeArrangements(noEnd),/需要终点/);
    for(const options of [null,[],{candidateBudget:-1},{stateBudget:0},{extra:1}])assert.throws(()=>analyzeArrangements(map,options),TypeError);
});
