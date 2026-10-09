import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareDemonstration, mapFromSharecode } from '../../src/training/demonstration.js';
import { extractTemporalFeatures, clockHypothesis } from '../../src/design/temporal-features.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { compileRestrictions } from '../../src/search/restrictions.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { smallMap } from './fixtures.mjs';

const source = JSON.parse(readFileSync(new URL('../../examples/user-refinements/user-01-demonstration.json', import.meta.url), 'utf8'));
const input = source.input, map = mapFromSharecode(input.sharecode);
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000 };

test('真实最优示范生成 40 个状态监督样本，原地按键计入剩余动作且家族统一', () => {
    const result = prepareDemonstration(input, { familyId: source.familyId, source: 'human_recording', budget });
    assert.equal(result.rows.length, 40);
    assert.equal(result.rows[27].expectedOutput.chosenAction, 'U');
    assert.equal(result.rows[27].expectedOutput.optimalRemainingActions, 13);
    assert.equal(result.rows.at(-1).expectedOutput.optimalRemainingActions, 1);
    assert(result.rows.every(r => r.input.safeActions.includes(r.expectedOutput.chosenAction)));
    assert(result.rows.every(r => !Object.hasOwn(r.input.dynamic.player, 'steps')));
    assert(result.rows.every(r => r.metadata.splitGroup === source.familyId));
    assert.equal(result.temporal.stationaryActions, 6);
    assert.equal(result.temporal.clockEvents, 1);
    assert.equal(result.temporal.events.at(-1).step, 28);
    assert.equal(result.qualityScore, null);
    assert.equal(result.relaxedDiagnostic.replayOnOriginal.outcome, 'death');
});

test('无歧义的最优示范才可生成精确价值标签；较长绕路不会伪造最优值', () => {
    assert.throws(() => prepareDemonstration({ ...input, ambiguities: [{ index: 1, alternatives: ['L', 'R'] }] }, { familyId: source.familyId, source: 'human_recording', budget }), /歧义/);
    assert.throws(() => prepareDemonstration(input, { familyId: source.familyId, source: 'human_recording', budget: { nodeBudget: 0 } }), /未完成/);
    const env = createReferenceEnvironment(map), actions = ['L', 'R', ...input.actions];
    const longer = { ...input, actions, final: input.final };
    longer.final = structuredClone(input.final); longer.final.player.steps += 2; longer.final.player.stamina -= 2;
    assert(env.replay(actions).state.isWon);
    assert.throws(() => prepareDemonstration(longer, { familyId: source.familyId, source: 'human_recording', budget }), /不是最短/);
});

test('距离条件是状态事实：无鬼不匹配，站位和前后相位都参与判断', () => {
    const empty = smallMap([[1, 1], [2, 1]], [1, 1], [2, 1]);
    const env = createReferenceEnvironment(empty), state = env.initialState(), next = env.step(state, 'R');
    const monitor = compileRestrictions(env.mapDefinition, [{ id: 'ghost', sequence: [{ type: 'nearest_ghost_distance', phase: 'before', distance: 1 }] }]);
    assert.deepEqual(monitor.advance([0], state, 'R', next), [0]);
    assert.throws(() => compileRestrictions(env.mapDefinition, [{ id: 'bad', sequence: [{ type: 'nearest_ghost_distance', phase: 'future', distance: 1 }] }]), TypeError);
    assert.throws(() => compileRestrictions(env.mapDefinition, [{ id: 'bad', sequence: [{ type: 'nearest_ghost_distance', phase: 'after', distance: -1 }] }]), TypeError);
    assert.throws(() => compileRestrictions(env.mapDefinition, [{ id: 'bad', sequence: [{ type: 'player_stationary', extra: 1 }] }]), TypeError);
});

test('关键按钮节奏与按键顺序的受限搜索，独立 BFS / A* 均穷尽无解', () => {
    const features = extractTemporalFeatures(map, input.actions);
    for (const hypothesis of features.hypotheses) {
        assert.equal(solveFastMap(map, { ...budget, restrictions: [hypothesis] }).status, 'proven_unsat');
        assert.equal(solveReferenceMap(map, { ...budget, restrictions: [hypothesis] }).status, 'proven_unsat');
    }
});

test('字母重命名不改变节奏机制：提取与必要性跟随按钮关系而非固定 B', () => {
    const renamed = structuredClone(map);
    const letter = s => s === 'A' ? 'X' : s === 'B' ? 'Y' : s;
    renamed.buttons.forEach(b => { b.letter = letter(b.letter); });
    for (const wall of [...renamed.hWalls.flat(), ...renamed.vWalls.flat()]) if (wall.letter) wall.letter = letter(wall.letter);
    const features = extractTemporalFeatures(renamed, input.actions);
    assert.equal(features.events.at(-1).letter, 'Y');
    assert.equal(features.clockEvents, 1);
    assert.equal(solveFastMap(renamed, { ...budget, restrictions: [clockHypothesis('Y')] }).status, 'proven_unsat');
});
