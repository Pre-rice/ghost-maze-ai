import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectPuzzle, formatInspection } from '../../src/design/inspection.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { traceState } from '../../src/review/trace-core.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { smallMap, stairMap, keyDetourMap } from './fixtures.mjs';

test('现行分层地图完整37步重放，逐步位置取自本体而非旧扁平字段', () => {
    const stored = JSON.parse(readFileSync(new URL('../../examples/temporary-entry-20261020/evidence.json', import.meta.url)));
    const before = JSON.stringify(stored.map), actions = stored.qa.actions;
    const report = inspectPuzzle(stored.map, { actions });
    assert.equal(report.execution.status, 'won');
    assert.equal(report.execution.performedActions, 37);
    assert.equal(report.initialBoards.length, 1);
    assert.deepEqual(report.final, traceState(createReferenceEnvironment(stored.map).replay(actions).state));
    assert.equal(JSON.stringify(stored.map), before);
    assert.equal(report.frames.length, actions.length);
    assert(report.frames.every(frame => frame.valid && Array.isArray(frame.ghostsBefore) && Array.isArray(frame.ghostsAfter)));
});

test('关门仍追旧位置一格与原地按钮都如实显示', () => {
    const map = smallMap([[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]], [5, 3], null);
    map.initialGhosts = [{ x: 1, y: 3, id: 49 }];
    map.buttons = [{ x: 5, y: 3, letter: 'A', direction: { dx: 0, dy: -1 } }];
    map.vWalls[3][3] = { type: W.LETTER_DOOR, keys: 0, letter: 'A', initialState: 'open' };
    const frame = inspectPuzzle(map, { actions: ['U'] }).frames[0];
    assert.equal(frame.button, 'A');
    assert.deepEqual(frame.playerBefore, frame.playerAfter);
    assert.deepEqual(frame.ghostsBefore, [[[1, 3]]]);
    assert.deepEqual(frame.ghostsAfter, [[[2, 3]]]);
    assert.equal(frame.gateChanges[0].state, 'closed');
    assert.equal(frame.wallChanges[0].before.state, 'open');
    assert.equal(frame.wallChanges[0].after.state, 'closed');
});

test('遇死亡、无效动作或不允许的动作就停，不复活或静默继续', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2]);
    map.initialGhosts = [{ x: 2, y: 2, id: 0 }];
    const dead = inspectPuzzle(map, { actions: ['R', 'REVIVE', 'L'] });
    assert.equal(dead.execution.status, 'dead');
    assert.equal(dead.execution.performedActions, 1);
    assert.deepEqual(dead.execution.remainingActions, ['REVIVE', 'L']);
    assert.equal(dead.final.isDead, true);
    assert.deepEqual([dead.final.player.x, dead.final.player.y], [2, 2]);
    for (const actions of [['U', 'R'], ['REVIVE', 'R'], ['mystery', 'R']]) {
        const invalid = inspectPuzzle(map, { actions });
        assert.equal(invalid.execution.status, 'invalid_action');
        assert.equal(invalid.execution.performedActions, 0);
        assert.equal(invalid.frames.length, 1);
        assert.deepEqual(invalid.execution.remainingActions, ['R']);
    }
});

test('楼梯跨层、终点及终局后的未执行尾段清楚区分', () => {
    const report = inspectPuzzle(stairMap(), { actions: ['R', 'STAIR', 'R', 'L'] });
    assert.equal(report.initialBoards.length, 2);
    assert(report.initialBoards.every(layer => layer.entities.stairs.length === 1));
    assert.equal(report.frames[1].label, '使用楼梯');
    assert.deepEqual(report.frames[1].playerBefore, [0, 2, 2]);
    assert.deepEqual(report.frames[1].playerAfter, [1, 2, 2]);
    assert.equal(report.execution.status, 'won');
    assert.equal(report.execution.performedActions, 3);
    assert.deepEqual(report.execution.remainingActions, ['L']);
    assert.equal(report.finalBoards[0].entities.player, null);
    assert.deepEqual(report.finalBoards[1].entities.player, [1, 3, 2]);
});

test('实际拾钥匙和数字门消失不依赖外部lock提示', () => {
    const report = inspectPuzzle(keyDetourMap(), { actions: ['U', 'U', 'D', 'D', 'R', 'R'] });
    assert.equal(report.execution.status, 'won');
    assert.equal(report.frames[1].keysBefore, 0);
    assert.equal(report.frames[1].keysAfter, 1);
    const unlocked = report.frames.flatMap(frame => frame.wallChanges).find(change =>
        change.before.type === W.LOCKED && change.after.type === W.EMPTY);
    assert.deepEqual([unlocked.layer, unlocked.axis, unlocked.x, unlocked.y], [0, 'v', 4, 3]);
});

test('文字图不掩盖鬼与钥匙叠放，单向门方向与多位门槛可查', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2], [4, 2]], [1, 2], [4, 2]);
    map.initialGhosts = [{ x: 2, y: 2 }];
    map.items = [{ x: 2, y: 2, type: 'key' }];
    map.vWalls[2][3] = { type: W.ONE_WAY, keys: 0, direction: { dx: -1, dy: 0 } };
    map.vWalls[2][4] = { type: W.LOCKED, keys: 12 };
    const report = inspectPuzzle({ map, prefix: ['R'], actions: ['R'] });
    assert.equal(report.execution.performedActions, 0, '不猜prefix或不明actions字段');
    const layer = report.initialBoards[0];
    assert(layer.lines.join('\n').includes('GK'));
    assert(layer.lines.join('\n').includes('<'));
    assert(layer.walls.some(wall => wall.type === W.LOCKED && wall.keys === 12));
    assert(formatInspection(report).includes('层 0'));
    assert.throws(() => inspectPuzzle(map, { actions: { actions: ['R'] } }), /动作名称数组/);
});

test('CLI支持现行地图和旧录制；显式数组优先且无效路线退出非零', t => {
    const directory = mkdtempSync(join(tmpdir(), 'ghost-inspection-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const file = join(directory, 'map.json'), actionFile = join(directory, 'actions.json');
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2]);
    writeFileSync(file, JSON.stringify({ map, solution: { solution: { actions: ['R', 'R'] } }, prefix: ['U'] }));
    writeFileSync(actionFile, JSON.stringify(['U']));
    const cli = fileURLToPath(new URL('../../scripts/inspect-puzzle.mjs', import.meta.url));
    const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    const legacy = run([file, '--json']);
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.equal(JSON.parse(legacy.stdout).execution.status, 'won');
    const explicit = run([file, actionFile, '--json']);
    assert.equal(explicit.status, 2);
    assert.equal(JSON.parse(explicit.stdout).execution.performedActions, 0);
    const layered = run([fileURLToPath(new URL('../../examples/temporary-entry-20261020/map.json', import.meta.url)), '--json']);
    assert.equal(layered.status, 0, layered.stderr);
    assert.equal(JSON.parse(layered.stdout).initialBoards.length, 1);
    const bad = run([file, '--solve']);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /用法/);
});
