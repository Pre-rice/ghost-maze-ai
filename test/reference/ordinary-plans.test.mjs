import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeOrdinaryPlans } from '../../src/design/ordinary-plans.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { smallMap, stairMap } from './fixtures.mjs';

function train(goalX) {
    const map = smallMap(Array.from({ length: goalX }, (_, i) => [i + 1, 3]), [3, 3], [goalX, 3]);
    map.initialGhosts = [{ x: 1, y: 3, id: 70 }, { x: 2, y: 3, id: 91 }];
    return map;
}

test('同回合交接允许两鬼共同移动，不能误报所有完整顺序无解', () => {
    const map = train(5), original = JSON.stringify(map), report = analyzeOrdinaryPlans(map);
    assert.equal(report.baseline.result.totalActions, 2);
    const orders = report.queries.filter(q => q.kind === 'complete_sequential');
    assert.equal(orders.length, 2);
    assert(orders.every(q => q.result.status === 'solved' && q.sameBaselineLength));
    assert.deepEqual(orders[0].movementSpans.map(g => [g.firstMove, g.lastMove]), [[1, 1], [1, 1]]);
    for (const q of report.queries) if (q.actions) assert(createReferenceEnvironment(map).replay(q.actions).state.isWon);
    assert.equal(report.conclusion, 'complete_sequential_witness_found');
    assert.equal(JSON.stringify(map), original);
});

test('连续共同跟随不能伪装成分段，但没有分段解也不等于题难', () => {
    const report = analyzeOrdinaryPlans(train(6));
    assert.equal(report.baseline.result.totalActions, 3);
    assert(report.queries.every(q => q.result.status === 'proven_unsat'));
    assert.equal(report.conclusion, 'no_complete_sequential_plan_within_scope');
    assert.equal(report.humanQualityScore, null);
    assert.match(report.interpretation, /不证明新意/);
});

test('到终点当步去判胜会死亡的捷径不算普通替代', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [2, 2]);
    map.initialGhosts = [{ x: 3, y: 2 }];
    assert.equal(createReferenceEnvironment(map).replay(['R']).state.isWon, true);
    const report = analyzeOrdinaryPlans(map);
    assert.equal(report.baseline.result.status, 'proven_unsat');
    assert.equal(report.conclusion, 'base_unsat_within_scope');
    assert.deepEqual(report.queries, []);
});

test('明确区分含重合替代与默认不经过重合的范围', () => {
    const map = smallMap([[2, 1], [2, 2], [2, 3], [3, 2], [4, 2]], [2, 2], [4, 2]);
    map.initialGhosts = [{ x: 2, y: 1 }, { x: 2, y: 3 }];
    const strict = analyzeOrdinaryPlans(map), permissive = analyzeOrdinaryPlans(map, { avoidOverlap: false });
    assert.equal(strict.baseline.result.status, 'proven_unsat');
    assert.equal(permissive.baseline.result.status, 'solved');
    assert.equal(permissive.scope.avoidOverlap, false);
    assert.equal(permissive.humanQualityScore, null);
    map.initialGhosts = [{ x: 2, y: 1 }, { x: 2, y: 1 }];
    assert.throws(() => analyzeOrdinaryPlans(map), /同一位置有重复实体/);
});

test('无鬼地图不冒充需要交错的谜题', () => {
    const map = smallMap([[1, 2], [2, 2]], [1, 2], [2, 2]);
    const report = analyzeOrdinaryPlans(map);
    assert.equal(report.conclusion, 'no_ghosts');
    assert.deepEqual(report.queries, []);
    assert.equal(report.baseline.result.totalActions, 1);
});

test('预算不足和只查部分顺序保留未知，不输出伪无解', () => {
    const none = analyzeOrdinaryPlans(train(6), { totalBudgetMs: 0 });
    assert.equal(none.baseline.result.status, 'unknown');
    assert.equal(none.conclusion, 'unknown');
    assert.equal(none.completeOrders.coverageComplete, false);
    const partial = analyzeOrdinaryPlans(train(6), { orderBudget: 1 });
    assert.equal(partial.completeOrders.queried, 1);
    assert.equal(partial.completeOrders.coverageComplete, false);
    assert.equal(partial.conclusion, 'unknown');
    assert.throws(() => analyzeOrdinaryPlans(stairMap()), /只支持单层/);
    assert.throws(() => analyzeOrdinaryPlans(train(5), { totalBudgetMs: -1 }), /非法分析预算/);
    assert.throws(() => analyzeOrdinaryPlans(train(5), { budgetMS: 4 }), /未知分析选项/);
});

test('真实已交付原件直接核查，输入和原反馈不改写', () => {
    const map = JSON.parse(readFileSync(new URL('../../examples/controller-clearance-20261021/map.json', import.meta.url)));
    const before = JSON.stringify(map), report = analyzeOrdinaryPlans(map);
    assert.equal(report.baseline.result.status, 'solved');
    assert.equal(report.baseline.result.totalActions, 19);
    assert.equal(report.completeOrders.coverageComplete, true);
    assert.equal(JSON.stringify(map), before);
    assert.equal(report.humanQualityScore, null);
    for (const q of report.queries) if (q.actions) assert(createReferenceEnvironment(map).replay(q.actions).state.isWon);
});

test('CLI只写新结果文件，不能覆盖已有证据', t => {
    const directory = mkdtempSync(join(tmpdir(), 'ordinary-plans-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const source = join(directory, 'map.json'), output = join(directory, 'report.json');
    writeFileSync(source, JSON.stringify(train(5)));
    const cli = fileURLToPath(new URL('../../scripts/analyze-ordinary-plans.mjs', import.meta.url));
    const run = () => spawnSync(process.execPath, [cli, source, output], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    const original = readFileSync(output, 'utf8');
    assert.equal(run().status, 1);
    assert.equal(readFileSync(output, 'utf8'), original);
    const config = join(directory, 'budget.json'), unknown = join(directory, 'unknown.json');
    writeFileSync(config, JSON.stringify({ totalBudgetMs: 0 }));
    const exhausted = spawnSync(process.execPath, [cli, source, unknown, config], { encoding: 'utf8' });
    assert.equal(exhausted.status, 2);
    assert.equal(JSON.parse(readFileSync(unknown, 'utf8')).baseline.result.status, 'unknown');
});
