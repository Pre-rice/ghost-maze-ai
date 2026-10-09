import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALL_TYPES as W, DataSerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';

const read = file => JSON.parse(readFileSync(new URL('../../examples/solid-units-20261008/' + file, import.meta.url), 'utf8'));
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000 };

test('新两题的玻璃替换是完整地图恒等；分享码与快实现逐动作一致，移除终点仍安全', () => {
    for (const id of ['01', '02']) {
        const map = read('unit-' + id + '.json'), evidence = read('unit-' + id + '-evidence.json');
        const replacement = structuredClone(map);
        for (const axis of ['h', 'v']) for (const row of replacement[axis + 'Walls']) for (const wall of row) if (wall.type === W.GLASS) wall.type = W.SOLID;
        assert.deepEqual(replacement, map);
        const env = createReferenceEnvironment(map), identical = createReferenceEnvironment(replacement), fast = createFastEnvironment(map);
        assert.equal(identical.mapId, env.mapId); assert.equal(env.mapId, evidence.mapId);
        const decoded = DataSerializer.loadFromShareCode(evidence.sharecode); assert(decoded.success);
        const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
        const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
        let a = env.initialState(), b = fast.initialState(), c = restored.initialState();
        for (const action of evidence.solution.solution.actions) {
            a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
            assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
            assert.deepEqual(a.seenCells, c.seenCells); assert(!a.isDead);
        }
        assert(a.isWon);
        const exit = createReferenceEnvironment({ ...map, endPos: null }).replay(evidence.solution.solution.actions);
        assert.deepEqual(physicalState(exit.state), evidence.exitWithoutGoal);
        assert.equal(evidence.humanQuality, null);
    }
});

test('独立 BFS 证实数字门消耗的作用、单向方向的路线约束与开关至少三次的要求', () => {
    const arrow = read('unit-01.json'), first = read('unit-01-evidence.json');
    for (const contrast of first.coreChecks.contrasts) {
        const map = structuredClone(arrow), edge = contrast.edit;
        map[edge.axis + 'Walls'][edge.y][edge.x] = { type: edge.type, keys: 0 };
        const result = solveReferenceMap(map, budget);
        if (edge.wall.type === W.LOCKED) assert.equal(result.status, 'proven_unsat');
        else { assert.equal(result.status, 'solved'); assert(result.solution.totalActions < first.reference.solution.totalActions); }
    }
    const toggle = read('unit-02.json'), second = read('unit-02-evidence.json');
    const result = solveReferenceMap(toggle, { ...budget, restrictions: second.coreChecks.constraints[0].restrictions });
    assert.equal(result.status, 'proven_unsat');
    assert.equal(second.trace.filter(row => row.stationary).length, 3);
    assert.equal(first.minimality.unresolved, 0); assert.equal(second.minimality.unresolved, 0);
});
