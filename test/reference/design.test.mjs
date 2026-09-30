import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { replayRestricted, compileRestrictions } from '../../src/search/restrictions.js';
import { analyzeMap } from '../../src/design/analyze.js';
import { applyEdit } from '../../src/design/edits.js';
import { searchDesigns } from '../../src/design/search.js';
import { complementaryMap, hypotheses } from '../../examples/mechanism-lab/build.mjs';
import { smallMap, seedMap, stairMap } from './fixtures.mjs';
import { WALL_TYPES as W, DataSerializer } from '../../src/reference/engine.js';

const budget = { nodeBudget: 30000, stateBudget: 30000, budgetMs: 60000 };
const forbid = (id, ...sequence) => ({ id, sequence });
const visit = (x, y, layer = 0) => ({ type: 'visit', x, y, layer });
const press = { type: 'press', letter: 'A' };

test('互补开关的必要性与旁路负例：分别禁止事件，BFS 与 A* 一致', () => {
    const original = complementaryMap();
    const bypass = applyEdit(original, { type: 'wall', axis: 'h', x: 5, y: 3, wall: { type: W.EMPTY, keys: 0 } });
    for (const [map, cost, expected] of [[original, 14, 'necessary_within_scope'], [bypass, 4, 'avoidable']]) {
        const report = analyzeMap(map, hypotheses, budget);
        assert.equal(report.baseline.solution.totalActions, cost);
        assert.equal(report.humanPreference, null);
        for (const entry of report.counterfactuals) {
            assert.equal(entry.conclusion, expected);
            const reference = solveReferenceMap(map, { ...budget, restrictions: [entry.hypothesis] });
            assert.equal(entry.result.status, reference.status);
            assert.equal(entry.result.solution?.totalActions, reference.solution?.totalActions);
        }
    }
});

test('历史监控进度参与等价键和资源支配：相同物理态可以有不同合法后续', () => {
    const map = smallMap([[2, 3], [2, 2], [3, 3], [3, 2], [4, 2]], [2, 3], [4, 2]);
    const restrictions = [forbid('upper_then_end', visit(2, 2), visit(4, 2))];
    const env = createReferenceEnvironment(map);
    assert.equal(env.stateKey(env.replay(['U', 'R']).state), env.stateKey(env.replay(['R', 'U']).state));
    for (const solver of [solveFastMap, solveReferenceMap]) {
        const result = solver(map, { ...budget, restrictions });
        assert.equal(result.status, 'solved');
        assert.deepEqual(result.solution.actions, ['R', 'U', 'R']);
        assert.throws(() => replayRestricted(env, ['U', 'R', 'R'], restrictions), /违反/);
    }
});

test('诱鬼与关门条件可复现旧证据，单步合取不会偷算两个历史事件', () => {
    const map = seedMap('unit-02');
    const constraints = [
        forbid('peek', visit(1, 2)), forbid('press', press), forbid('peek_then_press', visit(1, 2), press),
        forbid('capture', { type: 'all', events: [
            { type: 'gate', layer: 0, axis: 'v', x: 3, y: 2, state: 'closed' },
            { type: 'ghost_at', layer: 0, x: 2, y: 2 }
        ] })
    ];
    for (const restriction of constraints) {
        const fast = solveFastMap(map, { ...budget, restrictions: [restriction] });
        const reference = solveReferenceMap(map, { ...budget, restrictions: [restriction] });
        assert.equal(fast.status, 'proven_unsat');
        assert.equal(reference.status, fast.status);
    }
    const single = smallMap([[1, 1], [2, 1]], [1, 1], [2, 1]);
    assert.equal(solveFastMap(single, { restrictions: [forbid('repeat', visit(2, 1), visit(2, 1))] }).status, 'solved');
});

test('跨层全局开关仍受事件条件约束；条件字段与位置必须有效', () => {
    const map = stairMap(true), env = createReferenceEnvironment(map);
    assert.equal(solveFastMap(map, { ...budget, restrictions: [forbid('press', press)] }).status, 'proven_unsat');
    for (const invalid of [[{ id: 'typo', sequence: [press], typo: 1 }], [forbid('bad', visit(0, 0))], [forbid('bad', { type: 'stamina', value: 10 })], [forbid('x', press), forbid('x', press)]]) {
        assert.throws(() => compileRestrictions(env.mapDefinition, invalid), TypeError);
    }
});

test('预算不足与原图无解均不产生必要性正标签', () => {
    const unknown = analyzeMap(complementaryMap(), hypotheses, { nodeBudget: 0 });
    assert(unknown.counterfactuals.every(c => c.conclusion === 'unknown'));
    const unsat = complementaryMap(); unsat.items = [];
    const report = analyzeMap(unsat, hypotheses, budget);
    assert.equal(report.baseline.status, 'proven_unsat');
    assert(report.counterfactuals.every(c => c.conclusion === 'base_unsat'));
});

test('同位置同方向的按钮按原引擎顺序选第一个，不能误记为按了第二个', () => {
    const map = smallMap([[1, 1], [2, 1]], [1, 1], [2, 1]);
    map.buttons = ['A', 'B'].map(letter => ({ x: 1, y: 1, direction: { dx: 0, dy: -1 }, letter }));
    map.vWalls[1][2] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    const env = createReferenceEnvironment(map);
    assert(replayRestricted(env, ['U', 'R'], [forbid('B', { type: 'press', letter: 'B' })]).state.isWon);
    assert.throws(() => replayRestricted(env, ['U', 'R'], [forbid('A', press)]), /违反/);
});

test('钥匙事件检查实际拾取，不把到达旧钥匙坐标当成拿钥匙', () => {
    const map = complementaryMap();
    map.items[0] = { x: 2, y: 3, type: 'key' };
    const report = analyzeMap(map, [hypotheses[2]], budget);
    assert.equal(report.counterfactuals[0].conclusion, 'necessary_within_scope');
    assert(replayRestricted(createReferenceEnvironment(map), report.baseline.solution.actions, [forbid('old_key_cell', visit(1, 2))]).state.isWon);
});

test('自由编辑搜索保留来源、未知与修改链，同种子重复可重建所有候选', () => {
    const map = seedMap('unit-01'), before = structuredClone(map);
    const options = { familyId: 'lure-loop-v1', seed: 29, iterations: 30, maxDepth: 3, budget: { nodeBudget: 0 } };
    const first = searchDesigns(map, options), second = searchDesigns(map, options);
    assert.deepEqual(map, before);
    assert(first.nodes.length > 1);
    assert.equal(first.archive.length, 0);
    assert.deepEqual(first.attempts, second.attempts);
    for (const node of first.nodes) {
        assert.equal(node.analysis.baseline.status, 'unknown');
        assert.equal(node.analysis.humanPreference, null);
        if (node.parentId === null) continue;
        const parent = first.nodes[node.parentId];
        assert.equal(node.parentMapId, parent.mapId);
        assert.deepEqual(applyEdit(parent.map, node.edit), node.map);
        assert.equal(createReferenceEnvironment(node.map).mapId, node.mapId);
    }
});

test('编辑关闭有实体的活动格会被拒绝；有效提案不污染原图', () => {
    const map = complementaryMap(), before = structuredClone(map);
    assert.throws(() => applyEdit(map, { type: 'cell', x: 3, y: 4 }), /出生点|位置|非法/);
    assert.throws(() => applyEdit(map, { type: 'wall', axis: 'h', x: -1, y: 2, wall: { type: 0 } }), TypeError);
    applyEdit(map, { type: 'cell', x: 2, y: 2 });
    assert.deepEqual(map, before);
});

test('已导出的新单元及旁路对照证书在原引擎和分享码往返后均胜利', () => {
    const records = JSON.parse(readFileSync(new URL('../../examples/mechanism-lab/evidence.json', import.meta.url), 'utf8'));
    for (const record of records) {
        const map = JSON.parse(readFileSync(new URL(`../../examples/mechanism-lab/${record.id}.json`, import.meta.url), 'utf8'));
        const env = createReferenceEnvironment(map);
        assert.equal(env.mapId, record.mapId);
        const decoded = DataSerializer.loadFromShareCode(record.sharecode);
        assert(decoded.success);
        const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
        const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
        assert(restored.replay(record.analysis.baseline.solution.actions).state.isWon);
        assert(env.replay(record.analysis.baseline.solution.actions).state.isWon);
    }
});

test('分析 CLI 输出完整三态证据，错误参数不冒充无解', () => {
    const cwd = fileURLToPath(new URL('../../', import.meta.url));
    const args = ['src/design/cli.mjs', 'analyze', 'examples/mechanism-lab/complementary-switch.json', 'examples/mechanism-lab/analyze-config.json'];
    const solved = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
    assert.equal(solved.status, 0, solved.stderr);
    assert.equal(JSON.parse(solved.stdout).baseline.solution.totalActions, 14);
    const invalid = spawnSync(process.execPath, [...args, 'unused', 'extra'], { cwd, encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, '');
});
