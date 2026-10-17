import { freshDecode, historicalPhysical, withoutGoal } from './current-format.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALL_TYPES as W, DataSerializer } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';

const read = file => JSON.parse(readFileSync(new URL('../../examples/solid-units-20261008/' + file, import.meta.url), 'utf8'));
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000 };

test('历史两题按当前规则判定：玻璃替换恒等，旧关门停鬼题已无解，另一题仍可往返重放', () => {
    for (const id of ['01', '02']) {
        const map = read('unit-' + id + '.json'), evidence = read('unit-' + id + '-evidence.json');
        const replacement = structuredClone(map);
        for (const axis of ['h', 'v']) for (const row of replacement[axis + 'Walls']) for (const wall of row) if (wall.type === W.GLASS) wall.type = W.SOLID;
        assert.deepEqual(replacement, map);
        const env = createReferenceEnvironment(map), identical = createReferenceEnvironment(replacement), fast = createFastEnvironment(map);
        assert.equal(identical.mapId, env.mapId); assert.notEqual(env.mapId, evidence.mapId, '新规则标识不得冒充历史规则标识');
        if (id === '02') {
            // 原件和旧证书保留；修正操作前视线后，旧关门停鬼构造已穷尽无解。
            assert.equal(solveReferenceMap(map, budget).status, 'proven_unsat');
            assert.throws(() => env.replay(evidence.solution.solution.actions), /死亡/);
            assert.equal(evidence.humanQuality, null);
            continue;
        }
        const decoded = freshDecode(map); assert(decoded.success);
        const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
        const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
        let a = env.initialState(), b = fast.initialState(), c = restored.initialState();
        for (const action of evidence.solution.solution.actions) {
            a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
            assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
            assert.deepEqual(a.seenCells, c.seenCells); assert(!a.isDead);
        }
        assert(a.isWon);
        const exit = createReferenceEnvironment(withoutGoal(map)).replay(evidence.solution.solution.actions);
        assert.deepEqual(historicalPhysical(physicalState(exit.state),map), historicalPhysical(evidence.exitWithoutGoal,map));
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
