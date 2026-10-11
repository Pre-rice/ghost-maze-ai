import { freshDecode, historicalPhysical, withoutGoal } from './current-format.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { constraints, referenceBudget } from '../../examples/twin-handoff-20261009/evaluate.mjs';

const read = name => JSON.parse(readFileSync(new URL('../../examples/twin-handoff-20261009/' + name, import.meta.url), 'utf8'));
const map = read('map.json'), e = read('evidence.json');

test('双鬼交接证书与原引擎、快实现、分享码逐状态一致；反序与移除终点仍安全', () => {
    const env = createReferenceEnvironment(map), fast = createFastEnvironment(map);
    assert.notEqual(env.mapId, e.mapId, '新规则标识不得冒充历史规则标识'); assert.equal(map.initialStamina, 100);
    assert.equal(map.activeCells.flat().filter(Boolean).length, 14);
    const glassReplacement = structuredClone(map);
    for (const rows of [glassReplacement.hWalls, glassReplacement.vWalls]) for (const row of rows) for (const wall of row) if (wall.type === W.GLASS) wall.type = W.SOLID;
    assert.deepEqual(glassReplacement, map);
    const decoded = freshDecode(map); assert(decoded.success);
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
    assert.equal(restored.mapId, createReferenceEnvironment(map).mapId);
    let a = env.initialState(), b = fast.initialState(), c = restored.initialState();
    for (const action of e.solution.solution.actions) {
        a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
        assert(!a.isDead); assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
        assert.deepEqual(a.seenCells, c.seenCells);
    }
    assert(a.isWon); assert.equal(a.player.steps, 31);
    const reversed = structuredClone(map); reversed.initialGhosts.reverse();
    assert(createReferenceEnvironment(reversed).replay(e.solution.solution.actions).state.isWon);
    assert.deepEqual(historicalPhysical(physicalState(createReferenceEnvironment(withoutGoal(map)).replay(e.solution.solution.actions).state),map), historicalPhysical(e.exitWithoutGoal,map));
    assert.equal(e.humanQuality, null); assert.equal(e.minimality.unresolved, 0);
});

test('独立 BFS 证明双鬼题最短及准备、捕获、重新配置与换站重开的全局依赖', () => {
    const result = solveReferenceMap(map, referenceBudget);
    assert.equal(result.status, 'solved'); assert.equal(result.solution.totalActions, 31);
    for (const condition of constraints) {
        const r = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
        assert.equal(r.status, 'proven_unsat', condition.id); assert(r.search.exhausted);
    }
});

test('B 捕获后不能就此结束：A 隔开上鬼，最终从内侧重开 B 时下鬼仍停在右室', () => {
    const env = createReferenceEnvironment(map); let state = env.initialState();
    for (const [i, action] of e.solution.solution.actions.entries()) {
        state = env.step(state, action);
        if (i + 1 === 21) {
            assert.deepEqual(state.layerStates[0].ghosts.map(g => [g.x, g.y]), [[3, 1], [4, 3]]);
            assert.equal(state.layerStates[0].wallStates.h[4][4].currentState, 'closed');
            assert.equal(state.layerStates[0].wallStates.v[3][4].currentState, 'closed');
        }
        if (i + 1 === 25) {
            assert.equal(state.layerStates[0].wallStates.h[3][2].currentState, 'open');
            assert.equal(state.layerStates[0].wallStates.v[1][3].currentState, 'closed');
        }
        if (i + 1 === 30) {
            assert.equal(state.layerStates[0].wallStates.h[4][4].currentState, 'open');
            assert.equal(state.layerStates[0].wallStates.v[3][4].currentState, 'open');
            assert.equal(state.layerStates[0].wallStates.v[1][2].currentState, 'open');
            assert.deepEqual(state.layerStates[0].ghosts.map(g => [g.x, g.y]), [[3, 1], [4, 3]]);
        }
    }
});
