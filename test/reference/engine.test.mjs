import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameLogic, MapDefinition, WALL_TYPES as W } from '../../src/reference/engine.js';
import { checkEnvironment } from '../../scripts/check-environment.mjs';
import { verifySeeds } from '../../scripts/verify-seeds.mjs';

const seed = () => JSON.parse(readFileSync(new URL('../../examples/puzzle-units/unit-01.json', import.meta.url), 'utf8'));

test('规则子模块与种子清单版本固定', () => {
    assert.equal(checkEnvironment().seeds, 2);
});

test('两个单元在真实引擎中无伤重放，编解码及移除终点后的出口一致', () => {
    const results = verifySeeds();
    assert.deepEqual(results.map(({ actions, movementCost }) => [actions, movementCost]), [[10, 10], [13, 12]]);
});

test('参考规则保持当前游戏每次动作只拾取同格一个物品的行为', () => {
    const map = seed();
    map.initialGhosts = [];
    map.items = [{ x: 1, y: 2, type: 'key' }, { x: 1, y: 2, type: 'key' }];
    const def = new MapDefinition(map);
    const state = GameLogic.calculateNextState(GameLogic.createInitialState(def), { type: 'MOVE', payload: { dx: 0, dy: -1 } }, def);
    assert.equal(state.player.keys, 1);
    assert.equal(state.layerStates[0].items.length, 1);
});

test('鬼编号与排列不决定追击：同一可见局面产生同一后继', () => {
    const map = seed();
    map.activeCells = map.activeCells.map(row => row.map(() => true));
    map.hWalls = map.hWalls.map((row, y) => row.map(() => ({ type: y === 0 || y === map.height ? W.SOLID : W.EMPTY })));
    map.vWalls = map.vWalls.map(row => row.map((_, x) => ({ type: x === 0 || x === map.width ? W.SOLID : W.EMPTY })));
    map.startPos = map.customStartPos = { x: 2, y: 2 };
    map.initialGhosts = [{ x: 1, y: 2, id: 0 }, { x: 2, y: 1, id: 1 }];
    const positions = ghosts => {
        const def = new MapDefinition({ ...map, initialGhosts: ghosts });
        return GameLogic.calculateNextState(GameLogic.createInitialState(def), { type: 'MOVE', payload: { dx: 1, dy: 0 } }, def)
            .layerStates[0].ghosts.map(g => [g.x, g.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    };
    assert.deepEqual(positions(map.initialGhosts), [[2, 1], [2, 2]]);
    assert.deepEqual(positions([...map.initialGhosts].reverse()), [[2, 1], [2, 2]]);
});
