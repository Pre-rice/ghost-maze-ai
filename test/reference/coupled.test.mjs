import { freshDecode, historicalPhysical, withoutGoal } from './current-format.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coupledMap, hypotheses, failedPlans } from '../../examples/coupled-singlelayer/build.mjs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { DataSerializer, normalizeMapData, WALL_TYPES as W } from '../../src/reference/engine.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { physicalState } from '../../src/search/fast-environment.js';

const read = file => JSON.parse(readFileSync(new URL(`../../examples/coupled-singlelayer/${file}`, import.meta.url), 'utf8'));

test('单层组合题可复建，起点可见守门鬼与终点，按钮不覆盖可通行边', () => {
    const map = read('map.json'), env = createReferenceEnvironment(map);
    assert.deepEqual(normalizeMapData(map), normalizeMapData(coupledMap()));
    assert.equal(map.activeCells.flat().filter(Boolean).length, 18);
    assert.equal(map.initialGhosts.length, 1);
    assert(env.initialState().seenCells[0][2][4]);
    assert(env.initialState().seenCells[0][2][5]);
    for (const button of map.buttons) assert.equal(map.hWalls[button.y][button.x].type, W.SOLID);
});

test('组合题证书原引擎与分享码逐步一致；去终点仍可安全完成', () => {
    const map = read('map.json'), evidence = read('evidence.json');
    const env = createReferenceEnvironment(map);
    assert.notEqual(env.mapId, evidence.mapId, '新规则标识不得冒充历史规则标识');
    const decoded = freshDecode(map);
    assert(decoded.success);
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
    let state = env.initialState(), other = restored.initialState();
    for (const [i, action] of evidence.analysis.baseline.solution.actions.entries()) {
        state = env.step(state, action); other = restored.step(other, action);
        assert.deepEqual(physicalState(other), physicalState(state));
        assert.deepEqual(historicalPhysical({player:state.player}), historicalPhysical({player:{...state.player,...evidence.trace[i + 1].player}}));
        assert.deepEqual(state.layerStates[0].ghosts.map(g => [g.x, g.y]), evidence.trace[i + 1].ghosts);
        assert(!state.isDead);
    }
    assert(state.isWon);
    assert.equal(state.player.steps, 37);
    const exit = createReferenceEnvironment(withoutGoal(map)).replay(evidence.analysis.baseline.solution.actions);
    assert.deepEqual(historicalPhysical(physicalState(exit.state),map), historicalPhysical(evidence.exitWithoutGoal,map));
});

test('组合题关键顺序与鬼的两次位移必要，保留更长的替代路线而不宣称唯一解', () => {
    const map = coupledMap(), evidence = read('evidence.json');
    assert.equal(solveFastMap(map).solution.totalActions, 37);
    for (const restriction of hypotheses) {
        assert.equal(solveFastMap(map, { restrictions: [restriction], nodeBudget: 10000, stateBudget: 10000, budgetMs: 5000 }).status, 'proven_unsat');
    }
    assert.equal(evidence.alternative.status, 'solved');
    assert(evidence.alternative.solution.totalActions > 37);
    assert(createReferenceEnvironment(map).replay(evidence.alternative.solution.actions).state.isWon);
    assert.equal(evidence.humanPreference, null);
});

test('三条指定直觉路线在真实规则中死亡，不能把它们当作其他所有策略的证明', () => {
    const env = createReferenceEnvironment(coupledMap());
    for (const plan of failedPlans) {
        let state = env.initialState();
        for (const action of plan.actions) {
            const next = env.step(state, action);
            assert.notEqual(next, state);
            state = next;
        }
        assert(state.isDead);
    }
});
