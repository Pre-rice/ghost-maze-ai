import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DataSerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { traceState } from '../../src/review/trace-core.js';

const root = new URL('../../examples/user-refinements/', import.meta.url);
const map = JSON.parse(readFileSync(new URL('user-01.json', root), 'utf8'));
const evidence = JSON.parse(readFileSync(new URL('user-01-evidence.json', root), 'utf8'));
test('用户优化图保持分享码原始内容，40 次动作可无伤通关', () => {
    const decoded = DataSerializer.loadFromShareCode(evidence.sharecode);
    assert(decoded.success);
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    assert.deepEqual(map, { ...mapData, gameMode, initialHealth, initialStamina });
    const env = createReferenceEnvironment(map);
    assert.equal(env.mapId, evidence.mapId);
    const result = solveFastMap(map);
    assert.equal(result.solution.totalActions, 40);
    assert.equal(result.solution.movementCost, 34);
    const final = env.replay(result.solution.actions).state;
    assert(final.isWon);
    assert(traceState(final).isWon);
});
test('用户优化图至少按三次 A 和三次 B，必要性不限于给定最短路线', () => {
    for (const letter of ['A', 'B']) {
        const restrictions = [{ id: `third-${letter}`, sequence: Array.from({ length: 3 }, () => ({ type: 'press', letter })) }];
        assert.equal(solveFastMap(map, { restrictions, nodeBudget: 10000, stateBudget: 10000, budgetMs: 5000 }).status, 'proven_unsat');
    }
});
