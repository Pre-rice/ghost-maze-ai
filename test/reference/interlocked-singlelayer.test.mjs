import { freshDecode, historicalPhysical, withoutGoal } from './current-format.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { constraints, edges } from '../../examples/interlocked-singlelayer-20261008/evaluate.mjs';
import { parkingRestrictions, referenceBudget } from '../../examples/interlocked-singlelayer-20261008/build.mjs';

const read = file => JSON.parse(readFileSync(new URL('../../examples/interlocked-singlelayer-20261008/' + file, import.meta.url), 'utf8'));
const map = read('map.json'), evidence = read('evidence.json');

test('双开关新题无玻璃，原引擎、快实现、分享码逐步一致且不借终点避鬼', () => {
    const replacement = structuredClone(map);
    for (const edge of edges(replacement)) if (edge.wall.type === W.GLASS) replacement[edge.axis + 'Walls'][edge.y][edge.x] = { type: W.SOLID, keys: 0 };
    assert.deepEqual(replacement, map);
    const original = createReferenceEnvironment(map), fast = createFastEnvironment(map);
    assert.notEqual(original.mapId, evidence.mapId, '新规则标识不得冒充历史规则标识');
    assert.equal(createReferenceEnvironment(replacement).mapId, original.mapId);
    const decoded = freshDecode(map); assert(decoded.success);
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
    assert.equal(restored.mapId, createReferenceEnvironment(map).mapId);
    let a = original.initialState(), b = fast.initialState(), c = restored.initialState();
    for (const action of evidence.solution.solution.actions) {
        a = original.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
        assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
        assert.deepEqual(a.seenCells, c.seenCells); assert(!a.isDead);
    }
    assert(a.isWon); assert.equal(a.player.steps, 46);
    const exit = createReferenceEnvironment(withoutGoal(map)).replay(evidence.solution.solution.actions);
    assert.deepEqual(historicalPhysical(physicalState(exit.state),map), historicalPhysical(evidence.exitWithoutGoal,map));
    assert.equal(evidence.humanQuality, null);
});

test('独立 BFS 复核新题最短解与双向开关准备、停车后重新配置的必要性', () => {
    const baseline = solveReferenceMap(map, referenceBudget);
    assert.equal(baseline.status, 'solved'); assert.equal(baseline.optimality, 'proven');
    assert.equal(baseline.solution.totalActions, 46);
    for (const condition of [...constraints, ...parkingRestrictions]) {
        const result = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
        const quick = solveFastMap(map, { ...referenceBudget, restrictions: [condition] });
        assert.equal(result.status, 'proven_unsat', condition.id); assert(result.search.exhausted);
        assert.equal(quick.status, result.status);
    }
});

test('普通门隔离必要，四扇字母门改空地均降低解法成本，局部精简无未决项', () => {
    for (const contrast of evidence.ablations) {
        const changed = structuredClone(map), edge = contrast.edit;
        changed[edge.axis + 'Walls'][edge.y][edge.x] = { type: edge.type, keys: 0 };
        const result = solveFastMap(changed, referenceBudget);
        assert.equal(result.status, contrast.result.status);
        if (edge.wall.type === W.DOOR || edge.type === W.SOLID) assert.equal(result.status, 'proven_unsat');
        else {
            assert.equal(result.status, 'solved');
            assert.equal(result.solution.totalActions, contrast.result.solution.totalActions);
            assert(result.solution.totalActions < 46);
        }
    }
    assert.equal(evidence.minimality.unresolved, 0);
    assert.equal(evidence.minimality.globalMinimumProven, false);
});
