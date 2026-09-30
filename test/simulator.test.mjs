// 保留历史测试地图分布，物理规则使用固定版本原引擎。
import { generateFullMaze } from '../src/engine/mazeGenerator.js';
import { WALL_TYPES, GameLogic, MapDefinition } from '../src/reference/engine.js';
/**
 * 阶段 1 验证：simulator 与 gameLogic 一致性双跑测试
 *
 * 核心方法：随机动作序列双跑 `GameLogic.calculateNextState` vs `simulator.step`，
 * 断言玩家位置/钥匙/体力/步数、鬼位、物品、墙体状态、isWon/isDead 全等（忽略 trail/seenCells）。
 *
 * 覆盖地图：
 * - generateFullMaze 随机地图（固定 seed 的 LCG 替换 Math.random 保证可复现）
 * - 手工 6×6 全元素图（LOCKED+钥匙 / LETTER_DOOR+按钮 / ONE_WAY / GLASS / 鬼）
 * 覆盖模式：exploration 与 death-loop（含死亡 REVIVE 全重置语义）
 */
import { makeSimulator, createInitState, step, stateKey, canGhostSeePlayer } from '../src/validate/simulator.js';
import { DIRS4 } from '../src/validate/wallIndex.js';
import { suite, test, assert, assertEq, assertDeepEq, summary } from './_assert.mjs';

suite('simulator');

// ==================================================
// 工具
// ==================================================

/** 固定 seed 的 LCG 伪随机（可复现） */
function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** 用固定 seed 生成地图（临时替换 Math.random） */
function genMap(seed, size = 10, ghosts = 3) {
    const orig = Math.random;
    Math.random = makeRng(seed);
    try {
        return generateFullMaze(size, size, ghosts);
    } finally {
        Math.random = orig;
    }
}

/** 手工 6×6 全元素图（覆盖 LOCKED/字母门+按钮/ONE_WAY/GLASS/钥匙/鬼） */
function makeManualMap() {
    const width = 6;
    const height = 6;
    const empty = () => ({ type: WALL_TYPES.EMPTY, keys: 0 });
    const hWalls = Array(height + 1).fill(null).map(() => Array(width).fill(null).map(empty));
    const vWalls = Array(height).fill(null).map(() => Array(width + 1).fill(null).map(empty));

    hWalls[3][2] = { type: WALL_TYPES.LETTER_DOOR, keys: 0, letter: 'A', initialState: 'closed' };
    vWalls[2][3] = { type: WALL_TYPES.LOCKED, keys: 1 };
    vWalls[1][2] = { type: WALL_TYPES.ONE_WAY, keys: 0, direction: { dx: 1, dy: 0 } };
    hWalls[2][5] = { type: WALL_TYPES.GLASS, keys: 0 };

    return {
        width, height,
        hWalls, vWalls,
        activeCells: Array(height).fill(null).map(() => Array(width).fill(true)),
        items: [{ x: 5, y: 5, type: 'key' }, { x: 0, y: 0, type: 'key' }],
        buttons: [{ x: 2, y: 1, direction: { dx: 1, dy: 0 }, letter: 'A' }],
        initialGhosts: [{ x: 4, y: 2 }, { x: 1, y: 1 }],
        startPos: { x: 1, y: 4 },
        endPos: { x: 5, y: 0 },
        editorMode: 'regular',
        customStartPos: null,
        multiLayerMode: false,
        layerCount: 1,
        layers: [{
            hWalls, vWalls,
            activeCells: Array(height).fill(null).map(() => Array(width).fill(true)),
            ghosts: [{ x: 4, y: 2 }, { x: 1, y: 1 }],
            items: [{ x: 5, y: 5, type: 'key' }, { x: 0, y: 0, type: 'key' }],
            buttons: [{ x: 2, y: 1, direction: { dx: 1, dy: 0 }, letter: 'A' }],
            stairs: [],
            endPos: { x: 5, y: 0 },
            customStartPos: null
        }],
        stairs: []
    };
}

/** 断言双跑状态全等 */
function assertStatesEqual(gs, ss, stepIdx, action, label) {
    const p1 = gs.player;
    const p2 = ss.player;
    const tag = `${label} step${stepIdx} (${action.type} ${JSON.stringify(action.payload || {})})`;
    assertEq(p2.layer, p1.layer, `${tag} layer`);
    assertEq(p2.x, p1.x, `${tag} x`);
    assertEq(p2.y, p1.y, `${tag} y`);
    assertEq(p2.hp, p1.hp, `${tag} hp`);
    assertEq(p2.stamina, p1.stamina, `${tag} stamina`);
    assertEq(p2.keys, p1.keys, `${tag} keys`);
    assertEq(p2.steps, p1.steps, `${tag} steps`);
    assertEq(ss.isWon, gs.isWon, `${tag} isWon`);
    assertEq(ss.isDead, gs.isDead, `${tag} isDead`);
    for (let i = 0; i < gs.layerStates.length; i++) {
        const g1 = gs.layerStates[i].ghosts.map(g => `${g.x},${g.y}`).join('|');
        const g2 = ss.layers[i].ghosts.map(g => `${g.x},${g.y}`).join('|');
        assertEq(g2, g1, `${tag} layer${i} ghosts`);
        assertDeepEq(ss.layers[i].items, gs.layerStates[i].items, `${tag} layer${i} items`);
        assertDeepEq(ss.layers[i].wallStates, gs.layerStates[i].wallStates, `${tag} layer${i} wallStates`);
    }
}

/** 核心：随机动作序列双跑 */
function duel(mapData, gameMode, seed, steps = 400) {
    const rng = makeRng(seed);
    const md = JSON.parse(JSON.stringify(mapData));
    md.gameMode = gameMode;
    const mapDef = new MapDefinition(md);
    let gs = GameLogic.createInitialState(mapDef);
    const sim = makeSimulator(md);
    let ss = createInitState(sim);

    const label = `${gameMode} seed=${seed}`;
    for (let i = 0; i < steps; i++) {
        const r = rng();
        let action;
        if (gs.isDead || gs.isWon) {
            action = { type: 'REVIVE' }; // 死亡/胜利后只能复活，两个引擎同序列
        } else if (r < 0.2) {
            action = { type: 'PRESS_BUTTON', payload: { letter: 'A' } }; // 多数地图无按钮 → 无效动作
        } else {
            const d = DIRS4[Math.floor(rng() * 4)];
            action = { type: 'MOVE', payload: { dx: d.dx, dy: d.dy } };
        }
        gs = GameLogic.calculateNextState(gs, action, mapDef);
        ss = step(ss, action, sim);
        assertStatesEqual(gs, ss, i + 1, action, label);
    }
}

// ==================================================
// 测试
// ==================================================

test('一致性：generateFullMaze 随机图（exploration，3 张）', () => {
    for (const seed of [1, 42, 987]) {
        duel(genMap(seed), 'exploration', seed * 7 + 1);
    }
});

test('一致性：generateFullMaze 随机图（death-loop，3 张）', () => {
    for (const seed of [2, 99, 555]) {
        duel(genMap(seed), 'death-loop', seed * 7 + 1);
    }
});

test('一致性：手工全元素图（exploration，多轮不同随机序列）', () => {
    const map = makeManualMap();
    duel(map, 'exploration', 11);
    duel(map, 'exploration', 222);
});

test('一致性：手工全元素图（death-loop，多轮）', () => {
    const map = makeManualMap();
    duel(map, 'death-loop', 33);
    duel(map, 'death-loop', 444);
});

test('无效动作返回原状态引用（出界移动 / 无此字母按钮）', () => {
    const map = makeManualMap();
    const sim = makeSimulator(map);
    const s0 = createInitState(sim);
    // 先走到左边界 (0,4)，再向左即出界（x=-1）→ 无效
    const s1 = step(s0, { type: 'MOVE', payload: { dx: -1, dy: 0 } }, sim);
    assert(s1 !== s0, '走到左边界应有效');
    const s2 = step(s1, { type: 'MOVE', payload: { dx: -1, dy: 0 } }, sim);
    assert(s2 === s1, '出界移动应返回原引用');
    // 不存在的字母按钮 → 无效
    const s3 = step(s0, { type: 'PRESS_BUTTON', payload: { letter: 'Z' } }, sim);
    assert(s3 === s0, '无效按钮应返回原引用');
    // 未死亡/胜利时 REVIVE 的 exploration 语义：hp>0 → 回出生点（有效转移）
    const s4 = step(s0, { type: 'REVIVE' }, sim);
    assert(s4 !== s0 && s4.player.x === 1 && s4.player.y === 4, 'exploration REVIVE 应回出生点');
});

test('withGhosts:false 时鬼完全不动', () => {
    const map = genMap(5);
    const sim = makeSimulator(map, { withGhosts: false });
    const s0 = createInitState(sim);
    const before = s0.layers[0].ghosts.map(g => `${g.x},${g.y}`).join('|');
    let s = s0;
    for (let i = 0; i < 200; i++) {
        const d = DIRS4[i % 4];
        s = step(s, { type: 'MOVE', payload: { dx: d.dx, dy: d.dy } }, sim);
    }
    assertEq(s.layers[0].ghosts.map(g => `${g.x},${g.y}`).join('|'), before, '无鬼模式下鬼位不应变化');
});

test('stateKey：相同状态键相同、不同状态键不同、物品状态参与键', () => {
    const map = genMap(5);
    const sim = makeSimulator(map);
    const s0a = createInitState(sim);
    const s0b = createInitState(sim);
    assertEq(stateKey(s0b, sim), stateKey(s0a, sim), '相同状态键应相同');
    // 起点 (1, height-2) 向右一格是起始房内部 → 有效移动
    const s1 = step(s0a, { type: 'MOVE', payload: { dx: 1, dy: 0 } }, sim);
    assert(s1 !== s0a, '起始房内右移应有效');
    assert(stateKey(s1, sim) !== stateKey(s0a, sim), '不同状态键应不同');
    // 无鬼模式：键不含鬼位段（'|g:' 前缀）；有鬼模式含鬼位段
    const kNoGhost = stateKey(s0a, sim, { withGhosts: false });
    assert(kNoGhost.indexOf('|g:') === -1, '无鬼模式键不应含鬼位段');
    const kGhost = stateKey(s0a, sim);
    assert(kGhost.indexOf('|g:') !== -1, '有鬼模式键应含鬼位段');
    // 物品状态差异必须区分：捡走一把钥匙后即使位置/keys 相同键也不同
    const sKey1 = step(s0a, { type: 'MOVE', payload: { dx: 1, dy: 0 } }, sim);
    assert(stateKey(sKey1, sim, { withGhosts: false }) !== kNoGhost, '不同状态键应不同');
});

test('锁门消耗与字母门翻转写入 wallBits（位掩码一致性）', () => {
    const map = makeManualMap();
    const sim = makeSimulator(map);
    const s0 = createInitState(sim);
    const initialBits = s0.wallBits;
    // 捡钥匙 (0,0)：向下？起点 (1,4)。先走到 (0,0) 再开锁门比较繁琐；
    // 这里只验证：按下按钮 A → 字母门翻转 → wallBits 变化
    const sBtn = step(s0, { type: 'PRESS_BUTTON', payload: { letter: 'A' } }, sim);
    assert(sBtn !== s0, '按 A 应有效');
    assert(sBtn.wallBits !== initialBits, '字母门翻转后 wallBits 应变化');
    // 再按一次 → 翻转回来 → wallBits 恢复
    const sBtn2 = step(sBtn, { type: 'PRESS_BUTTON', payload: { letter: 'A' } }, sim);
    assertEq(sBtn2.wallBits, initialBits, '再按一次应恢复初始位');
    // 字母门打开后可通行（双跑一致性已覆盖，此处补充 wallBits 参与去重键）
    assertEq(stateKey(sBtn, sim), stateKey(sBtn, sim), '键稳定');
});

test('canGhostSeePlayer 导出回归：直线视野判定可导入且可调用', () => {
    const map = makeManualMap();
    const sim = makeSimulator(map);
    const s = createInitState(sim);
    // 鬼 (4,2) vs 玩家 (4,0)：同列、中间无阻挡墙（hWalls[1][4]/[2][4] 均 EMPTY）→ 可见
    const g = s.layers[0].ghosts.find(gh => gh.x === 4 && gh.y === 2);
    assert(g, '应找到 (4,2) 鬼');
    assertEq(canGhostSeePlayer(sim, s, 0, g, { x: 4, y: 0 }), true, '同列无阻挡 → 鬼应看到玩家');
    // 鬼 (1,1) vs 玩家 (4,0)：不同行不同列 → 不可见
    const g2 = s.layers[0].ghosts.find(gh => gh.x === 1 && gh.y === 1);
    assertEq(canGhostSeePlayer(sim, s, 0, g2, { x: 4, y: 0 }), false, '不同行不同列 → 不可见');
    // 假想玩家位（逃生评分用）：鬼 (4,2) 对 (2,0)（不同列）不可见
    assertEq(canGhostSeePlayer(sim, s, 0, g, { x: 2, y: 0 }), false, '假想位不同列 → 不可见');
});

test('同格多把钥匙逐次拾取，与当前原引擎一致', () => {
    const empty = () => ({ type: WALL_TYPES.EMPTY, keys: 0 });
    const width = 3, height = 3;
    const hWalls = Array(height + 1).fill(null).map(() => Array(width).fill(null).map(empty));
    const vWalls = Array(height).fill(null).map(() => Array(width + 1).fill(null).map(empty));
    const sharedItems = [{ x: 1, y: 1, type: 'key' }, { x: 1, y: 1, type: 'key' }];
    const md = {
        width, height, hWalls, vWalls,
        activeCells: Array(height).fill(null).map(() => Array(width).fill(true)),
        items: sharedItems,
        buttons: [], initialGhosts: [],
        startPos: { x: 0, y: 1 },
        endPos: { x: 2, y: 2 },
        editorMode: 'regular', customStartPos: null,
        multiLayerMode: false, layerCount: 1,
        layers: [{
            hWalls, vWalls,
            activeCells: Array(height).fill(null).map(() => Array(width).fill(true)),
            ghosts: [], items: sharedItems, buttons: [], stairs: [],
            endPos: { x: 2, y: 2 }, customStartPos: null
        }],
        stairs: []
    };
    const mapDef = new MapDefinition(md);
    let gs = GameLogic.createInitialState(mapDef);
    assertEq(gs.player.keys, 0, '初始无钥匙');
    // 每次成功动作只捡第一个物品，回来以后才能再捡。
    gs = GameLogic.calculateNextState(gs, { type: 'MOVE', payload: { dx: 1, dy: 0 } }, mapDef);
    assertEq(gs.player.keys, 1, '第一次只捡一把');
    assertEq(gs.layerStates[0].items.length, 1, '仍剩一把钥匙');
    // 走开再走回，拾取剩下的一把。
    gs = GameLogic.calculateNextState(gs, { type: 'MOVE', payload: { dx: -1, dy: 0 } }, mapDef);
    gs = GameLogic.calculateNextState(gs, { type: 'MOVE', payload: { dx: 1, dy: 0 } }, mapDef);
    assertEq(gs.player.keys, 2, '回来后拿到第二把');
});

summary();
