import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { runLocalPolicy } from '../../src/design/local-policy.js';
import { compileRestrictions } from '../../src/search/restrictions.js';
import { constraints, commonPrefix, referenceBudget } from '../../examples/gate-handoff-20261008/evaluate.mjs';

const read = name => JSON.parse(readFileSync(new URL('../../examples/gate-handoff-20261008/' + name, import.meta.url), 'utf8'));
const map = read('map.json'), e = read('evidence.json');

test('七格交接题原引擎、快实现和分享码逐状态一致，终点移除仍安全，无玻璃', () => {
    const env = createReferenceEnvironment(map), fast = createFastEnvironment(map);
    assert.equal(env.mapId, e.mapId); assert.equal(map.initialStamina, 100);
    assert.equal(map.activeCells.flat().filter(Boolean).length, 7);
    const clone = structuredClone(map);
    for (const rows of [clone.hWalls, clone.vWalls]) for (const row of rows) for (const wall of row) if (wall.type === W.GLASS) wall.type = W.SOLID;
    assert.deepEqual(clone, map);
    const decoded = DataSerializer.loadFromShareCode(e.sharecode); assert(decoded.success);
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
    assert.equal(restored.mapId, e.decodedMapId);
    let a = env.initialState(), b = fast.initialState(), c = restored.initialState();
    for (const action of e.solution.solution.actions) {
        a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
        assert(!a.isDead); assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
        assert.deepEqual(a.seenCells, c.seenCells);
    }
    assert(a.isWon); assert.equal(a.player.steps, 12); assert.equal(a.player.stamina, 88);
    assert.deepEqual(physicalState(createReferenceEnvironment({ ...map, endPos: null }).replay(e.solution.solution.actions).state), e.exitWithoutGoal);
    assert.equal(e.humanQuality, null); assert.equal(e.minimality.unresolved, 0);
});

test('独立 BFS 证明七格题最短与提前准备、邻鬼保护、换站后重开关系', () => {
    const result = solveReferenceMap(map, referenceBudget);
    assert.equal(result.status, 'solved'); assert.equal(result.solution.totalActions, 19);
    for (const condition of constraints) {
        const r = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
        assert.equal(r.status, 'proven_unsat', condition.id); assert(r.search.exhausted);
    }
});

test('同一安全前缀的两种选择：开通后穷尽无解，先改逃生条件则仍可通关', () => {
    const env = createReferenceEnvironment(map), common = env.replay(commonPrefix).state;
    assert(!env.step(common, 'D').isDead); assert(!env.step(common, 'R').isDead);
    for (const reference of [false, true]) {
        const wrong = solveContinuation(map, [...commonPrefix, 'D'], { ...referenceBudget, reference });
        const right = solveContinuation(map, [...commonPrefix, 'R'], { ...referenceBudget, reference });
        assert.equal(wrong.status, 'proven_unsat'); assert(wrong.search.exhausted);
        assert.equal(right.status, 'solved'); assert(env.replay([...commonPrefix, 'R', ...right.actions]).state.isWon);
    }
    assert.throws(() => solveContinuation(map, ['L']), /前缀/);
});

test('新增开锁和鬼跨边事件在原引擎与快状态上只触发实际变化，不合并鬼身份', () => {
    const env = createReferenceEnvironment(map), fast = createFastEnvironment(map);
    const events = [constraints[0], constraints[2]], expected = [7, 10];
    for (const [i, condition] of events.entries()) {
        const monitor = compileRestrictions(env.mapDefinition, [condition]);
        let a = env.initialState(), b = fast.initialState();
        for (const [j, action] of e.solution.solution.actions.entries()) {
            const aa = env.step(a, action), bb = fast.step(b, action);
            assert.equal(monitor.advance([0], a, action, aa) === null, j + 1 === expected[i]);
            assert.deepEqual(monitor.advance([0], a, action, aa), monitor.advance([0], b, action, bb));
            a = aa; b = bb;
        }
    }
    assert.throws(() => compileRestrictions(env.mapDefinition, [{ id: 'bad', sequence: [{ type: 'locked_opened', layer: 0, axis: 'h', x: 4, y: 3 }] }]), /数字门/);
});

test('临场策略固定种子可复现，实际胜利经原引擎核对，同格不同方向按钮如实记录', () => {
    const options = { horizon: 3, seed: 29 }, a = runLocalPolicy(map, options), b = runLocalPolicy(map, options);
    assert.deepEqual(a, b); assert(a.won); assert.equal(a.completeSolverUsedForDecisions, false);
    const env = createReferenceEnvironment(map); assert(env.replay(a.actions).state.isWon);
    let state = env.initialState();
    for (const [i, action] of a.actions.entries()) {
        const next = env.step(state, action), direction = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] }[action];
        const button = map.buttons.find(v => v.x === state.player.x && v.y === state.player.y && v.direction.dx === direction[0] && v.direction.dy === direction[1]);
        assert.equal(a.decisions[i].button, button?.letter ?? null); state = next;
    }
});
