import test from 'node:test';
import assert from 'node:assert/strict';
import { smallMap } from '../../src/design/grid.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { auditPuzzleBoundaries, assertPuzzleBoundarySafety } from '../../src/design/rule-boundaries.js';

const map = () => smallMap([[3, 3], [4, 3], [3, 2], [3, 4]], [3, 3], [4, 3]);

test('最优解通过重合时给出完整通关见证并拒绝交付', () => {
    const m = smallMap([[3, 3], [4, 3], [5, 3], [3, 2], [3, 4]], [3, 3], [5, 3]);
    m.initialGhosts = [{ x: 3, y: 2 }, { x: 3, y: 4 }];
    const result = auditPuzzleBoundaries(m);
    assert.equal(result.status, 'conflict'); assert.equal(result.reason, 'optimal_solution_uses_overlap');
    assert.equal(result.optimum, 2); assert.deepEqual(result.witness, ['R', 'R']);
    assert.throws(() => assertPuzzleBoundarySafety(m), /optimal_solution_uses_overlap/);
});

test('非最优走法出现重合可以保留，不能升级为最优解违规', () => {
    const m = smallMap([[3, 3], [4, 3], [2, 3], [3, 2], [3, 4]], [3, 3], [4, 3]);
    m.initialGhosts = [{ x: 3, y: 2 }, { x: 3, y: 4 }];
    const result = auditPuzzleBoundaries(m);
    assert.equal(result.status, 'safe'); assert.equal(result.optimum, 1);
    assert.deepEqual(result.observedNonFatalOverlap.witness, ['L']);
});

test('玻璃允许观察，但全物理策略必须与换实墙一致', () => {
    const safe = map(); safe.hWalls[3][3] = { type: W.GLASS, keys: 0 };
    const result = auditPuzzleBoundaries(safe);
    assert.equal(result.status, 'safe'); assert.equal(result.glassCount, 1);
    const cells = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => [x + 1, y + 1])).flat();
    const unsafe = smallMap(cells, [3, 3], [5, 5]); unsafe.initialGhosts = [{ x: 3, y: 1 }];
    unsafe.hWalls[2][3] = { type: W.GLASS, keys: 0 };
    const mismatch = auditPuzzleBoundaries(unsafe);
    assert.equal(mismatch.status, 'conflict'); assert.equal(mismatch.reason, 'functional_glass');
    assert(mismatch.witness.length > 0);
});

test('预算未完成明确返回未知，不能被当作通过', () => {
    const result = auditPuzzleBoundaries(map(), { nodeBudget: 0 });
    assert.equal(result.status, 'unknown');
    assert.throws(() => assertPuzzleBoundarySafety(map(), { nodeBudget: 0 }), /unknown/);
});

test('同一出发点与鬼重叠不能作为候选交付', () => {
    const m = map(); m.initialGhosts = [{ x: 3, y: 3 }];
    assert.equal(auditPuzzleBoundaries(m).reason, 'ghost_on_spawn');
});

test('夹击重合触发死亡不影响地图验收', () => {
    const m = smallMap([[3, 3], [3, 2], [2, 2], [4, 2], [4, 3]], [3, 3], [4, 3]);
    m.initialGhosts = [{ x: 2, y: 2 }, { x: 4, y: 2 }];
    const result = auditPuzzleBoundaries(m);
    assert.equal(result.status, 'safe'); assert.equal(result.optimum, 1);
    assert(result.ignoredFatalOverlap > 0);
});

test('已有安全最优解也要检查同长解，不能漏掉并列的重合通关路线', () => {
    const cells = Array.from({ length: 6 }, (_, y) => Array.from({ length: 5 }, (_, x) => [x + 1, y])).flat();
    const m = smallMap(cells, [1, 3], [5, 1]);
    m.initialGhosts = [{ x: 3, y: 1 }, { x: 3, y: 5 }];
    m.hWalls[1][3] = { type: W.DOOR, keys: 0 };
    m.vWalls[1][5] = { type: W.SOLID, keys: 0 };
    m.hWalls[2][5] = { type: W.SOLID, keys: 0 };
    const result = auditPuzzleBoundaries(m);
    assert.equal(result.optimum, 8);
    assert.equal(result.status, 'conflict');
    assert.equal(result.reason, 'optimal_solution_uses_overlap');
    assert.equal(result.safeOptimalWitness.length, 8);
    assert.equal(result.witness.length, 8);
});
