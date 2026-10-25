import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGhostInfluence } from '../../src/design/ghost-influence.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { smallMap } from './fixtures.mjs';

const env = (cells, player, goal, ghosts) => {
    const map = smallMap(cells, player, goal);
    map.initialGhosts = ghosts.map(([x, y]) => ({ x, y }));
    return createReferenceEnvironment(map);
};
const stack = (lower, upper) => ({ width: lower.width, height: lower.height, editorMode: 'free',
    gameMode: 'death-loop', initialHealth: 5, multiLayerMode: true, layerCount: 2,
    layers: [lower, upper].map(m => ({ activeCells: m.activeCells, hWalls: m.hWalls, vWalls: m.vWalls,
        ghosts: m.initialGhosts, items: m.items, buttons: m.buttons, endPos: m.endPos, customStartPos: m.customStartPos })),
    stairs: [{ layer: 0, x: 2, y: 2, direction: 'up' }, { layer: 1, x: 2, y: 2, direction: 'down' }] });

test('逐鬼各自可走到同一格，不等于没有重合机制', () => {
    const e = env([[2, 1], [2, 2], [2, 3], [3, 2], [4, 2]], [2, 2], [4, 2], [[2, 1], [2, 3]]);
    const s = e.initialState(), next = e.step(s, 'R');
    assert(!next.isDead && !next.isWon);
    assert.deepEqual(next.layerStates[0].ghosts.map(g => [g.x, g.y]), [[2, 2], [2, 2]]);
    for (const g of s.layerStates[0].ghosts) {
        const alone = s.clone(); alone.layerStates[0].ghosts = alone.layerStates[0].ghosts.filter(x => x.id === g.id);
        assert.deepEqual(e.step(alone, 'R').layerStates[0].ghosts.map(g => [g.x, g.y]), [[2, 2]]);
    }
    assert.equal(inspectGhostInfluence(e, s, 'R', next).kind, 'overlap');
});

test('可见优先争位和正常队列移动分别查真实位移', () => {
    const e = env([[1, 2], [1, 3], [2, 1], [2, 2], [2, 3]], [2, 2], [1, 3], [[1, 2], [2, 1]]);
    const s = e.initialState(), original = JSON.stringify(s), answer = inspectGhostInfluence(e, s, 'D');
    assert.equal(answer.kind, 'motion');
    assert.deepEqual(answer.changes, [{ from: [0, 1, 2], actual: [0, 1, 2], alone: [0, 2, 2] }]);
    assert.equal(JSON.stringify(s), original);
    const queue = env([[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]], [3, 3], [5, 3], [[1, 3], [2, 3]]);
    assert.equal(inspectGhostInfluence(queue, queue.initialState(), 'R').kind, 'none');
});

test('跨层重复编号与真实转层阻路都能识别，且不改原局面', () => {
    const lower = smallMap([[2, 2], [2, 3]], [2, 2], null);
    lower.customStartPos = null; lower.initialGhosts = [{ x: 2, y: 2 }];
    const upper = smallMap([[2, 0], [2, 1], [2, 2], [2, 3]], [2, 2], [2, 0]);
    upper.initialGhosts = [{ x: 2, y: 3 }];
    const e = createReferenceEnvironment(stack(lower, upper)), s = e.initialState();
    assert.equal(s.layerStates[0].ghosts[0].id, s.layerStates[1].ghosts[0].id);
    const original = JSON.stringify(s), answer = inspectGhostInfluence(e, s, 'U');
    assert.equal(answer.kind, 'motion');
    assert.deepEqual(answer.changes, [{ from: [0, 2, 2], actual: [0, 2, 2], alone: [1, 2, 2] }]);
    assert.equal(JSON.stringify(s), original);
    const changed = s.clone(); changed.layerStates.forEach(l => l.ghosts.forEach(g => { g.id = 731; }));
    assert.deepEqual(inspectGhostInfluence(e, changed, 'U'), answer);
});

test('终点反事实只查到达安全，不能冒充实际已经发生的争位', () => {
    const cells = [[1, 2], [2, 1], [2, 2], [2, 3]];
    const e = env(cells, [2, 2], [2, 3], [[1, 2], [2, 1]]), s = e.initialState(), n = e.step(s, 'D');
    assert(n.isWon); assert.equal(inspectGhostInfluence(e, s, 'D', n).kind, 'none');
    const withoutGoal = env(cells, [2, 2], null, [[1, 2], [2, 1]]), next = withoutGoal.step(withoutGoal.initialState(), 'D');
    assert(!next.isDead);
    assert.equal(inspectGhostInfluence(withoutGoal, withoutGoal.initialState(), 'D', next).kind, 'motion');
});

test('无效输入和死亡不混入非致死相互影响', () => {
    const e = env([[1, 2], [2, 2], [3, 2]], [2, 2], [3, 2], [[1, 2]]), s = e.initialState();
    assert.equal(inspectGhostInfluence(e, s, 'U').kind, 'no_action');
    assert.equal(inspectGhostInfluence(e, s, 'L').kind, 'fatal');
});

test('不同层编号与坐标重复的无交会起步不能误报互动', () => {
    const lower = smallMap([[1, 1], [1, 2], [2, 1], [2, 2], [3, 2]], [1, 1], null);
    lower.initialGhosts = [{ x: 3, y: 2 }];
    const upper = smallMap([[2, 2], [3, 2], [3, 3]], [2, 2], [3, 3]);
    upper.customStartPos = null; upper.initialGhosts = [{ x: 3, y: 2 }];
    const e = createReferenceEnvironment(stack(lower, upper)), s = e.initialState();
    assert.equal(s.layerStates[0].ghosts[0].id, s.layerStates[1].ghosts[0].id);
    assert.equal(inspectGhostInfluence(e, s, 'R').kind, 'none');
    assert.equal(inspectGhostInfluence(e, s, 'D').kind, 'none');
});
