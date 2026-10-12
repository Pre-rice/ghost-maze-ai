import test from 'node:test';
import assert from 'node:assert/strict';
import { smallMap } from '../../src/design/grid.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { auditPuzzleBoundaries, assertPuzzleBoundarySafety } from '../../src/design/rule-boundaries.js';

const map = () => smallMap([[3, 3], [4, 3], [3, 2], [3, 4]], [3, 3], [4, 3]);

test('有效回程出现对称争位时给出真实动作见证并禁止交付', () => {
    const m = map(); m.endPos = { x: 3, y: 4 }; m.initialGhosts = [{ x: 3, y: 2 }, { x: 3, y: 4 }];
    const result = auditPuzzleBoundaries(m);
    assert.equal(result.status, 'conflict'); assert.equal(result.reason, 'symmetric_ghost_overlap');
    assert.deepEqual(result.witness, ['R']);
    assert.throws(() => assertPuzzleBoundarySafety(m), /symmetric_ghost_overlap/);
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

test('夹击重合即使只出现在死亡分支，也禁止用于谜题设计', () => {
    const m = smallMap([[3, 3], [3, 2], [2, 2], [4, 2], [4, 3]], [3, 3], [4, 3]);
    m.initialGhosts = [{ x: 2, y: 2 }, { x: 4, y: 2 }];
    const result = auditPuzzleBoundaries(m);
    assert.equal(result.status, 'conflict'); assert.equal(result.reason, 'ghost_capture_overlap');
    assert.deepEqual(result.witness, ['U']);
});
