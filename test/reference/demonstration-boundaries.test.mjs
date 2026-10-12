import test from 'node:test';
import assert from 'node:assert/strict';
import { smallMap } from '../../src/design/grid.js';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { traceState } from '../../src/review/trace-core.js';
import { prepareDemonstration } from '../../src/training/demonstration.js';

const options = { familyId: 'test-boundary-family', source: 'solver_certificate',
    budget: { nodeBudget: 10000, stateBudget: 10000, budgetMs: 10000 } };
function recording(map, actions) {
    const encoded = DataSerializer.generateShareCode(map);
    assert(encoded.success);
    const env = createReferenceEnvironment(map);
    return { schemaVersion: 1, coverage: 'retained_branch', id: 'test-boundary-demo',
        sharecode: encoded.code, actions, final: traceState(env.replay(actions).state) };
}

test('安全的最短示范有利用重合的同长解时，拒绝制备训练资料', () => {
    const cells = Array.from({ length: 6 }, (_, y) => Array.from({ length: 5 }, (_, x) => [x + 1, y])).flat();
    const map = smallMap(cells, [1, 3], [5, 1]);
    map.initialGhosts = [{ x: 3, y: 1 }, { x: 3, y: 5 }];
    map.hWalls[1][3] = { type: W.DOOR, keys: 0 };
    map.vWalls[1][5] = { type: W.SOLID, keys: 0 };
    map.hWalls[2][5] = { type: W.SOLID, keys: 0 };
    const safe = ['U', 'U', 'U', 'R', 'R', 'R', 'R', 'D'];
    const bad = ['R', 'R', 'R', 'U', 'U', 'U', 'R', 'D'];
    const env = createReferenceEnvironment(map);
    assert(env.replay(safe).state.isWon && env.replay(bad).state.isWon);
    let state = env.initialState();
    for (const action of safe) {
        state = env.step(state, action);
        assert.equal(new Set(state.layerStates[0].ghosts.map(g => `${g.x},${g.y}`)).size, 2);
    }
    assert.throws(() => prepareDemonstration(recording(map, safe), options), /optimal_solution_uses_overlap/);
});

test('仅非最优走法能重合时允许制备，边界验收未知时拒绝', () => {
    const map = smallMap([[3, 3], [4, 3], [2, 3], [3, 2], [3, 4]], [3, 3], [4, 3]);
    map.initialGhosts = [{ x: 3, y: 2 }, { x: 3, y: 4 }];
    const input = recording(map, ['R']);
    const result = prepareDemonstration(input, options);
    assert.equal(result.rows.length, 1);
    assert.equal(result.boundaries.status, 'safe');
    assert.deepEqual(result.boundaries.observedNonFatalOverlap.witness, ['L']);
    assert.equal(result.qualityScore, null);
    assert.equal(result.rows[0].metadata.boundaryPolicy, 'all_optimal_routes_avoid_overlap_v2');
    const reversed = structuredClone(map);
    reversed.initialGhosts.reverse();
    const swapped = prepareDemonstration(recording(reversed, ['R']), options);
    assert.deepEqual(swapped.rows[0].input.dynamic, result.rows[0].input.dynamic);
    assert.equal(result.rows[0].input.dynamic.layers[0].ghosts.length, 2);
    assert.equal(result.rows[0].metadata.ghostRepresentation, 'positions_and_counts');
    assert.throws(() => prepareDemonstration(input, { ...options, boundaryBudget: { nodeBudget: 0 } }), /unknown/);
});
