import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { seedMap, smallMap, keyDetourMap, stairMap } from './fixtures.mjs';

test('动作入口禁止远程按钮、复活、任意位移和伪装成字符串的对象', () => {
    const env = createReferenceEnvironment(seedMap('unit-02'));
    const state = env.initialState();
    for (const action of ['PRESS_BUTTON', 'REVIVE', 'UNDO', { type: 'MOVE', payload: { dx: 2, dy: 0 } }, ['U']]) {
        assert.throws(() => env.step(state, action), TypeError);
    }
    const pressed = env.step(state, 'L');
    assert.equal(pressed.layerStates[0].wallStates.v[2][3].currentState, 'closed');
    assert.equal(pressed.player.steps, 0);
    assert.equal(pressed.player.stamina, state.player.stamina);
    assert.equal(env.step(state, 'STAIR'), state);
    assert.throws(() => env.replay(['STAIR']), /无效动作/);
});

test('无效移动保持原状态；危险但合法的移动仍产生死亡状态', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2]);
    map.initialGhosts = [{ x: 2, y: 2, id: 0 }];
    const env = createReferenceEnvironment(map), state = env.initialState();
    assert.equal(env.step(state, 'U'), state);
    assert(env.step(state, 'R').isDead);
    assert.throws(() => env.replay(['R']), /死亡/);
});

test('状态键保留鬼的顺序，同键不再吞并不同冲突后继', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2], [4, 2], [2, 1]], [2, 2], [4, 2]);
    map.initialGhosts = [{ x: 1, y: 2, id: 0 }, { x: 2, y: 1, id: 1 }];
    const env = createReferenceEnvironment(map), first = env.initialState(), reversed = first.clone();
    reversed.layerStates[0].ghosts.reverse();
    assert.notEqual(env.stateKey(first), env.stateKey(reversed));
    assert.notEqual(env.stateKey(env.step(first, 'R')), env.stateKey(env.step(reversed, 'R')));
});

test('状态键区分相同位置的体力、钥匙、物品集合及动态门', () => {
    const env = createReferenceEnvironment(keyDetourMap()), state = env.initialState();
    for (const change of [
        s => s.player.stamina--,
        s => s.player.keys++,
        s => s.layerStates[0].items.pop(),
        s => { s.layerStates[0].wallStates.v[3][4].type = W.EMPTY; }
    ]) {
        const altered = state.clone(); change(altered);
        assert.notEqual(env.stateKey(state), env.stateKey(altered));
    }
    const gates = createReferenceEnvironment(seedMap('unit-02')), initial = gates.initialState();
    assert.notEqual(gates.stateKey(initial), gates.stateKey(gates.step(initial, 'L')));
});

test('体力相差一格会导致不同胜负，状态键必须区分', () => {
    const env = createReferenceEnvironment(smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2], 2));
    const full = env.initialState(), low = full.clone();
    low.player.stamina = 1;
    assert.notEqual(env.stateKey(full), env.stateKey(low));
    assert.equal(env.step(full, 'R').isDead, false);
    assert.equal(env.step(low, 'R').isDead, true);
});

test('物理状态键忽略轨迹、探索记录、计步与复活标记，区分终止状态', () => {
    const env = createReferenceEnvironment(seedMap('unit-01')), state = env.initialState(), visual = state.clone();
    visual.player.steps = 99;
    visual.player.trail = [{ x: 1, y: 3, timestamp: 123 }];
    visual.layerStates[0].ghosts[0].trail = [{ x: 1, y: 2, timestamp: 456 }];
    visual.seenCells = visual.seenCells.map(layer => layer.map(row => row.map(() => true)));
    visual.loopCount = 7;
    visual.isRevivalPoint = false;
    assert.equal(env.stateKey(state), env.stateKey(visual));
    assert.equal(env.stateKey(env.step(state, 'U')), env.stateKey(env.step(visual, 'U')));
    visual.isDead = true;
    assert.notEqual(env.stateKey(state), env.stateKey(visual));
});

test('物品顺序和非当前层的鬼及墙状态都进入键', () => {
    const map = stairMap(true);
    map.layers[0].items = [{ x: 1, y: 2, type: 'key' }, { x: 2, y: 2, type: 'key' }];
    map.layers[1].ghosts = [{ x: 3, y: 2, id: 0 }];
    const env = createReferenceEnvironment(map), state = env.initialState();
    for (const change of [
        s => s.layerStates[0].items.reverse(),
        s => s.layerStates[1].ghosts.pop(),
        s => { s.layerStates[1].wallStates.v[2][3].currentState = 'open'; }
    ]) {
        const altered = state.clone(); change(altered);
        assert.notEqual(env.stateKey(state), env.stateKey(altered));
    }
});

test('环境隔离输入并冻结静态地图，不修改调用方数据', () => {
    const map = seedMap('unit-01'), before = JSON.stringify(map), env = createReferenceEnvironment(map);
    env.step(env.initialState(), 'U');
    assert.equal(JSON.stringify(map), before);
    map.endPos.x = 0;
    assert.equal(env.mapDefinition.layers[0].initialEntities.endPos.x, 6);
    assert.throws(() => { env.mapDefinition.width = 10; }, TypeError);
    assert.notEqual(env.mapId, createReferenceEnvironment(seedMap('unit-02')).mapId);
});

test('坏地图抛输入错误，不进入无解标签；缺配对或非活动楼梯被拒绝', () => {
    assert.throws(() => createReferenceEnvironment(null), TypeError);
    for (const change of [
        m => { m.width = 0; }, m => { m.hWalls.pop(); },
        m => { m.initialStamina = 0; }, m => { m.initialGhosts[0].x = 99; },
        m => { m.activeCells[3][1] = false; }, m => { m.vWalls[2][2].type = 99; }
    ]) {
        const map = seedMap('unit-01'); change(map);
        assert.throws(() => createReferenceEnvironment(map), TypeError);
    }
    const unpaired = stairMap(); unpaired.stairs.pop();
    assert.throws(() => createReferenceEnvironment(unpaired), /配对/);
    const inactive = stairMap(); inactive.layers[1].activeCells[2][2] = false;
    assert.throws(() => createReferenceEnvironment(inactive), /楼梯/);
});
