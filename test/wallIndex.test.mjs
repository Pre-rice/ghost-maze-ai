import { WALL_TYPES } from '../src/engine/constants.js';
import {
    DIRS4,
    wallBetween,
    wallStateBetween,
    isGhostPassable,
    isGhostVisionBlocked,
    isPlayerTraversable
} from '../src/validate/wallIndex.js';
import { suite, test, assert, assertEq, summary } from './_assert.mjs';

suite('wallIndex');

// ---------- 取墙索引 ----------
test('wallBetween 索引约定：hWalls[y][x]=上方墙、vWalls[y][x]=左侧墙', () => {
    const hWalls = [[{ type: 0 }], [{ type: 3 }]]; // height+1=2 行
    const vWalls = [[{ type: 1 }, { type: 2 }]]; // width+1=2 列
    // 格子 (0,0) 朝上 → hWalls[0][0]
    assertEq(wallBetween(0, 0, 0, -1, hWalls, vWalls), hWalls[0][0]);
    // 格子 (0,0) 朝下 → hWalls[1][0]
    assertEq(wallBetween(0, 0, 0, 1, hWalls, vWalls), hWalls[1][0]);
    // 格子 (0,0) 朝左 → vWalls[0][0]
    assertEq(wallBetween(0, 0, -1, 0, hWalls, vWalls), vWalls[0][0]);
    // 格子 (0,0) 朝右 → vWalls[0][1]
    assertEq(wallBetween(0, 0, 1, 0, hWalls, vWalls), vWalls[0][1]);
});

test('wallStateBetween 走 wallStates.h/v', () => {
    const wallStates = { h: [[{ type: 9 }]], v: [[{ type: 8 }, { type: 7 }]] };
    assertEq(wallStateBetween(0, 0, 0, -1, wallStates), wallStates.h[0][0]);
    assertEq(wallStateBetween(0, 0, 1, 0, wallStates), wallStates.v[0][1]);
});

test('DIRS4 为四方向且无斜向', () => {
    assertEq(DIRS4.length, 4);
    assert(DIRS4.every(d => Math.abs(d.dx) + Math.abs(d.dy) === 1), 'DIRS4 必须都是四方向');
});

// ---------- 玩家通行判定 ----------
const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });

test('玩家：EMPTY/DOOR 可通行', () => {
    assert(isPlayerTraversable(wall(WALL_TYPES.EMPTY), null, 0, { dx: 1, dy: 0 }), 'EMPTY 应可通行');
    assert(isPlayerTraversable(wall(WALL_TYPES.DOOR), null, 0, { dx: 1, dy: 0 }), 'DOOR 应可通行（装饰门自由通行）');
});

test('玩家：SOLID/GLASS 不可通行', () => {
    assert(!isPlayerTraversable(wall(WALL_TYPES.SOLID), null, 0, { dx: 1, dy: 0 }), 'SOLID 应阻挡');
    assert(!isPlayerTraversable(wall(WALL_TYPES.GLASS), null, 0, { dx: 1, dy: 0 }), 'GLASS 应阻挡');
});

test('玩家：ONE_WAY 方向匹配才可通行', () => {
    const oneWay = wall(WALL_TYPES.ONE_WAY, { direction: { dx: 1, dy: 0 } });
    assert(isPlayerTraversable(oneWay, null, 0, { dx: 1, dy: 0 }), '方向匹配应可通行');
    assert(!isPlayerTraversable(oneWay, null, 0, { dx: -1, dy: 0 }), '方向不匹配应阻挡');
    assert(!isPlayerTraversable(wall(WALL_TYPES.ONE_WAY, { direction: null }), null, 0, { dx: 1, dy: 0 }), '缺 direction 应阻挡');
});

test('玩家：LOCKED 钥匙数足够才可通行', () => {
    const locked = wall(WALL_TYPES.LOCKED, { keys: 3 });
    assert(!isPlayerTraversable(locked, null, 2, { dx: 1, dy: 0 }), '钥匙不足应阻挡');
    assert(isPlayerTraversable(locked, null, 3, { dx: 1, dy: 0 }), '钥匙足够应可通行');
});

test('玩家：LETTER_DOOR 关闭阻挡、打开放行、无状态按关闭处理', () => {
    const closedDef = wall(WALL_TYPES.LETTER_DOOR, { letter: 'A' });
    const closedState = { type: WALL_TYPES.LETTER_DOOR, currentState: 'closed' };
    const openState = { type: WALL_TYPES.LETTER_DOOR, currentState: 'open' };
    assert(!isPlayerTraversable(closedDef, closedState, 0, { dx: 1, dy: 0 }), '关闭应阻挡');
    assert(isPlayerTraversable(closedDef, openState, 0, { dx: 1, dy: 0 }), '打开应放行');
});

// ---------- 鬼判定 ----------
test('鬼：只能穿 EMPTY 与已开 LETTER_DOOR', () => {
    assert(isGhostPassable(wall(WALL_TYPES.EMPTY)), 'EMPTY 可穿');
    assert(!isGhostPassable(wall(WALL_TYPES.SOLID)), 'SOLID 阻挡');
    assert(!isGhostPassable(wall(WALL_TYPES.DOOR)), 'DOOR 阻挡（设计意图：初始房间安全）');
    assert(!isGhostPassable(wall(WALL_TYPES.LOCKED)), 'LOCKED 阻挡');
    assert(!isGhostPassable(wall(WALL_TYPES.ONE_WAY)), 'ONE_WAY 阻挡');
    assert(!isGhostPassable(wall(WALL_TYPES.GLASS)), 'GLASS 阻挡');
    assert(!isGhostPassable(wall(WALL_TYPES.LETTER_DOOR, { currentState: 'closed' })), '关着的字母门阻挡');
    assert(isGhostPassable(wall(WALL_TYPES.LETTER_DOOR, { currentState: 'open' })), '已开字母门可穿');
});

test('鬼：视野能被除 GLASS/开字母门外的墙阻挡', () => {
    assert(!isGhostVisionBlocked(wall(WALL_TYPES.EMPTY)), 'EMPTY 不挡视野');
    assert(!isGhostVisionBlocked(wall(WALL_TYPES.GLASS)), 'GLASS 不挡视野（可看穿）');
    assert(isGhostVisionBlocked(wall(WALL_TYPES.SOLID)), 'SOLID 挡视野');
    assert(isGhostVisionBlocked(wall(WALL_TYPES.LOCKED)), 'LOCKED 挡视野');
    assert(!isGhostVisionBlocked(wall(WALL_TYPES.LETTER_DOOR, { currentState: 'open' })), '已开字母门不挡视野');
    assert(isGhostVisionBlocked(wall(WALL_TYPES.LETTER_DOOR, { currentState: 'closed' })), '关闭字母门挡视野');
});

summary();
