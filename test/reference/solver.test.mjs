import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { seedMap, smallMap, keyDetourMap, stairMap } from './fixtures.mjs';

const BUDGET = { nodeBudget: 20000, stateBudget: 20000, budgetMs: 60000 };

test('两个单元重新求得最短动作证书，并区分按钮与体力成本', () => {
    for (const [id, actions, movement] of [['unit-01', 10, 10], ['unit-02', 13, 12]]) {
        const map = seedMap(id);
        map.initialStamina = movement;
        const result = solveReferenceMap(map, BUDGET);
        assert.equal(result.status, 'solved');
        assert.equal(result.optimality, 'proven');
        assert.equal(result.solution.totalActions, actions);
        assert.equal(result.solution.movementCost, movement);
        assert.equal(result.search.exhausted, false);
        const encoded = DataSerializer.generateShareCode(map);
        const decoded = DataSerializer.loadFromShareCode(encoded.code).data;
        const env = createReferenceEnvironment({ ...decoded.mapData, gameMode: decoded.gameMode, initialStamina: decoded.initialStamina, initialHealth: decoded.initialHealth });
        const replay = env.replay(result.solution.actions);
        assert(replay.state.isWon);
        assert.equal(replay.state.player.stamina, undefined);
        assert.throws(() => env.replay([...result.solution.actions, 'U']), /终止状态/);
    }
});

test('已知六步可解图在零节点预算下返回 unknown，增加预算后成功', () => {
    const map = keyDetourMap(), limited = solveReferenceMap(map, { ...BUDGET, nodeBudget: 0 });
    assert.equal(limited.status, 'unknown');
    assert.equal(limited.reason, 'node_budget');
    assert.equal(limited.optimality, null);
    assert.equal(limited.solution, null);
    assert.equal(limited.search.exhausted, false);
    const solved = solveReferenceMap(map, BUDGET);
    assert.equal(solved.status, 'solved');
    assert.equal(solved.solution.totalActions, 6);
    const replay = createReferenceEnvironment(map).replay(solved.solution.actions);
    assert.equal(replay.state.player.keys, 1);
    assert.equal(replay.state.layerStates[0].wallStates.v[3][4].type, W.EMPTY);
});

test('同格两把钥匙必须按真实拾取规则绕回，不沿用旧模拟器的一次全捡', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2], [4, 2]], [1, 2], [4, 2], 5);
    map.items = [{ x: 2, y: 2, type: 'key' }, { x: 2, y: 2, type: 'key' }];
    map.vWalls[2][3] = { type: W.LOCKED, keys: 2 };
    assert.throws(() => solveReferenceMap(map, BUDGET), /重复实体/);
});

test('时间和状态预算耗尽均为未知；穷尽才报告无解', () => {
    assert.equal(solveReferenceMap(keyDetourMap(), { ...BUDGET, budgetMs: 0 }).reason, 'time_budget');
    const memory = solveReferenceMap(keyDetourMap(), { ...BUDGET, stateBudget: 1 });
    assert.equal(memory.status, 'unknown');
    assert.equal(memory.reason, 'state_budget');
    const isolated = smallMap([[1, 2], [3, 2]], [1, 2], [3, 2]);
    const result = solveReferenceMap(isolated, BUDGET);
    assert.equal(result.status, 'proven_unsat');
    assert.equal(result.reason, 'frontier_exhausted');
    assert.equal(result.search.exhausted, true);
    assert.equal(result.solution, null);
});

test('无解地图上的零体力消耗按钮循环能被完整去重', () => {
    const map = smallMap([[1, 2], [3, 2]], [1, 2], [3, 2]);
    map.buttons = [{ x: 1, y: 2, direction: { dx: 0, dy: -1 }, letter: 'A' }];
    map.vWalls[2][3] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    const result = solveReferenceMap(map, BUDGET);
    assert.equal(result.status, 'proven_unsat');
    assert.equal(result.search.discovered, 2);
});

test('跨层终点不被单层启发式误剪，楼梯与全局字母门均可求解', () => {
    for (const withButtons of [false, true]) {
        const map = stairMap(withButtons), result = solveReferenceMap(map, BUDGET);
        assert.equal(result.status, 'solved');
        assert.equal(result.solution.totalActions, withButtons ? 4 : 3);
        assert.equal(result.solution.movementCost, 3);
        assert(result.solution.actions.includes('STAIR'));
        const state = createReferenceEnvironment(map).replay(result.solution.actions).state;
        assert.equal(state.player.layer, 1);
        assert(state.isWon);
    }
});

test('配对楼梯上的鬼转层后不会在同一动作中再走一步', () => {
    const map = stairMap();
    map.startPos = map.customStartPos = map.layers[0].customStartPos = { x: 2, y: 2 };
    map.endPos = map.layers[0].endPos = { x: 4, y: 2 };
    map.layers[1].endPos = null;
    map.layers[1].ghosts = [{ x: 2, y: 2, id: 0 }];
    for (const x of [3, 4]) {
        map.layers[0].activeCells[2][x] = true;
        map.layers[0].vWalls[2][x] = { type: W.EMPTY };
    }
    const env = createReferenceEnvironment(map), next = env.step(env.initialState(), 'R');
    assert.equal(next.isDead, false);
    assert.deepEqual(next.layerStates[0].ghosts.map(g => [g.x, g.y]), [[2, 2]]);
    assert.equal(next.layerStates[1].ghosts.length, 0);
    assert.equal(env.step(env.initialState(), 'STAIR').isDead, true);
    assert.equal(solveReferenceMap(map, BUDGET).solution.totalActions, 2);
});

test('单向门按方向通行；玻璃阻挡玩家；普通门允许玩家通过', () => {
    const make = () => smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2], 3);
    const glass = make(); glass.vWalls[2][2] = { type: W.GLASS };
    assert.equal(solveReferenceMap(glass, BUDGET).status, 'proven_unsat');
    const door = make(); door.vWalls[2][2] = { type: W.DOOR };
    assert.equal(solveReferenceMap(door, BUDGET).status, 'solved');
    const oneWay = make(); oneWay.vWalls[2][2] = { type: W.ONE_WAY, direction: { dx: 1, dy: 0 } };
    const env = createReferenceEnvironment(oneWay), passed = env.step(env.initialState(), 'R');
    assert.equal(env.step(passed, 'L'), passed);
    assert.equal(solveReferenceMap(oneWay, BUDGET).status, 'solved');
    oneWay.vWalls[2][2].direction.dx = -1;
    assert.equal(solveReferenceMap(oneWay, BUDGET).status, 'proven_unsat');
});

test('资源与终点先判胜语义由原引擎决定，不靠自己重写判定', () => {
    const short = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2], 1);
    assert.equal(solveReferenceMap(short, BUDGET).status, 'solved');
    short.initialStamina = 2;
    assert.equal(solveReferenceMap(short, BUDGET).status, 'solved');
    const lastStep = smallMap([[1, 2], [2, 2], [2, 3]], [1, 2], [2, 2], 1);
    lastStep.initialGhosts = [{ x: 2, y: 3, id: 0 }];
    assert.equal(solveReferenceMap(lastStep, BUDGET).status, 'solved');
});

test('探索模式也只搜索无伤无复活解，不会利用复活推进', () => {
    const map = smallMap([[1, 2], [2, 2], [3, 2]], [1, 2], [3, 2]);
    map.gameMode = 'exploration';
    map.initialGhosts = [{ x: 2, y: 2, id: 0 }];
    const result = solveReferenceMap(map, BUDGET);
    assert.equal(result.status, 'proven_unsat');
    assert.equal(result.scope.objective, 'zero_hit_no_revive');
    assert.equal(result.scope.gameMode, 'exploration');
});

test('输入错误与搜索结论分开：缺目标、非法预算均抛错', () => {
    const noEnd = keyDetourMap(); noEnd.endPos = null;
    assert.throws(() => solveReferenceMap(noEnd), /终点/);
    for (const options of [{ nodeBudget: -1 }, { stateBudget: 0 }, { budgetMs: NaN }, { budgetMs: Infinity }, { nodeBudget: 0.5 }, { entryBudget: 100 }]) {
        assert.throws(() => solveReferenceMap(keyDetourMap(), options), TypeError);
    }
});

test('CLI 输出机器可读三态并区分未知和输入错误的退出码', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const args = ['src/reference/solve-map.mjs', 'examples/puzzle-units/unit-01.json'];
    const solved = JSON.parse(execFileSync(process.execPath, [...args, '--ms', '60000'], { cwd: root, encoding: 'utf8' }));
    assert.equal(solved.status, 'solved');
    const unknown = spawnSync(process.execPath, [...args, '--nodes', '0'], { cwd: root, encoding: 'utf8' });
    assert.equal(unknown.status, 3);
    assert.equal(JSON.parse(unknown.stdout).status, 'unknown');
    const invalid = spawnSync(process.execPath, [...args, '--typo', '2'], { cwd: root, encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, '');
});
