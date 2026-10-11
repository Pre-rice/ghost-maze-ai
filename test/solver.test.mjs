// 保留历史测试地图分布，物理规则使用固定版本原引擎。
import { generateFullMaze } from '../src/reference/engine.js';
import { WALL_TYPES, GameLogic, MapDefinition } from '../src/reference/engine.js';
/**
 * 阶段 2 验证：求解器 + 验证器
 *
 * 1. relaxedDistField：小图人工可算距离断言（曼哈顿 + 墙阻挡）
 * 2. isStructurallySolvable 与 solveMap(无鬼) 双实现一致
 * 3. 端到端回放（最强闸门）：solver moves 驱动真实 GameLogic.calculateNextState，
 *    断言全程无伤（isDead 恒 false）且最终 isWon
 * 4. 手工"看似不可解但有巧妙解法"关卡：钥匙必须绕路先拿 → 解法特征齐全
 * 5. 旧体力字段不影响当前规则下的可解性和计步
 * 6. 超预算降级：高鬼数图不崩溃
 */
import { solveMap } from '../src/validate/solver.js';
import { isStructurallySolvable, relaxedDistField } from '../src/validate/solvabilityVerifier.js';
import { makeSimulator } from '../src/validate/simulator.js';
import { suite, test, assert, assertEq, summary } from './_assert.mjs';

suite('solver');

// ==================================================
// 工具
// ==================================================

function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function genMap(seed, size = 10, ghosts = 3) {
    const orig = Math.random;
    Math.random = makeRng(seed);
    try {
        return generateFullMaze(size, size, ghosts);
    } finally {
        Math.random = orig;
    }
}

const emptyWall = () => ({ type: WALL_TYPES.EMPTY, keys: 0 });
const solidWall = () => ({ type: WALL_TYPES.SOLID, keys: 0 });

function makeGrid(width, height) {
    const w = Math.max(8, width), h = Math.max(8, height);
    return {
        hWalls: Array.from({ length: h + 1 }, (_, y) => Array.from({ length: w }, (_, x) => y <= height && x < width ? emptyWall() : solidWall())),
        vWalls: Array.from({ length: h }, (_, y) => Array.from({ length: w + 1 }, (_, x) => y < height && x <= width ? emptyWall() : solidWall())),
        activeCells: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => x < width && y < height))
    };
}

function wrapMapData(grid, extra) {
    const { hWalls, vWalls, activeCells } = grid;
    return {
        width: grid.hWalls[0].length,
        height: grid.hWalls.length - 1,
        hWalls, vWalls, activeCells,
        items: extra.items || [],
        buttons: [],
        initialGhosts: extra.initialGhosts || [],
        startPos: extra.startPos,
        endPos: extra.endPos,
        editorMode: 'regular',
        customStartPos: null,
        multiLayerMode: false,
        layerCount: 1,
        layers: [{
            hWalls, vWalls, activeCells,
            ghosts: extra.initialGhosts || [],
            items: extra.items || [],
            buttons: [],
            stairs: [],
            endPos: extra.endPos,
            customStartPos: null
        }],
        stairs: [],
        gameMode: extra.gameMode || 'death-loop',
        initialStamina: extra.initialStamina || 100
    };
}

/**
 * 手工"钥匙必须绕路先拿"关卡（6×5）：
 * - y=0 与 y=1 之间除 x=0 外全封（SOLID）→ 终点区唯一入口
 * - vWalls[0][2] 为 LOCKED(keys:1)（(1,0)↔(2,0)）→ 通往终点必经
 * - 钥匙在右下角 (5,4)：松弛直走下界 9 步，最优解 19 步（先远离终点再回来）
 */
function makeKeyLockMap() {
    const g = makeGrid(6, 5);
    for (let x = 1; x < 6; x++) g.hWalls[1][x] = solidWall();
    g.vWalls[0][2] = { type: WALL_TYPES.LOCKED, keys: 1 };
    return wrapMapData(g, {
        items: [{ x: 5, y: 4, type: 'key' }],
        startPos: { x: 1, y: 3 },
        endPos: { x: 5, y: 0 }
    });
}

/** 端到端回放：solver moves 驱动真实 gameLogic，断言无伤胜利 */
function replayAndAssert(md, result, label) {
    const mapDef = new MapDefinition(JSON.parse(JSON.stringify(md)));
    let gs = GameLogic.createInitialState(mapDef);
    for (const m of result.moves) {
        gs = GameLogic.calculateNextState(gs, m, mapDef);
        assert(!gs.isDead, `${label} 回放中出现死亡（规则不一致或路径不安全）`);
    }
    assert(gs.isWon, `${label} 回放应最终胜利`);
    assertEq(gs.player.steps, result.minSteps, `${label} 回放步数应一致`);
}

// ==================================================
// 测试
// ==================================================

test('relaxedDistField：无墙图距离 = 曼哈顿距离', () => {
    const g = makeGrid(3, 3);
    const md = wrapMapData(g, { startPos: { x: 0, y: 0 }, endPos: { x: 2, y: 0 } });
    const sim = makeSimulator(md);
    const fields = relaxedDistField(sim);
    const f = fields[0];
    assertEq(f[0][0], 2, '起点 (0,0) → 终点 (2,0)');
    assertEq(f[0][2], 0, '终点自身距离 0');
    assertEq(f[2][2], 2, '(2,2) 距离');
    assertEq(f[2][0], 4, '(0,2) 距离（绕过）');
    // 封住 (0,0) 的右方与下方 → 起点不可达
    // （注意：同行直走无需跨 hWalls，须封 vWalls 才能隔断 y=0 行）
    g.vWalls[0][1] = solidWall(); // (0,0) 与 (1,0) 之间
    g.vWalls[0][2] = solidWall(); // (1,0) 与 (2,0) 之间（封死 y=0 整行）
    g.hWalls[1][0] = solidWall(); // (0,0) 与 (0,1) 之间
    const sim2 = makeSimulator(md);
    const fields2 = relaxedDistField(sim2);
    assert(!Number.isFinite(fields2[0][0][0]), '被 SOLID 隔断后起点应不可达');
});

test('钥匙绕路关卡：找到巧妙解法且特征齐全', () => {
    const md = makeKeyLockMap();
    const result = solveMap(md, { withGhosts: false });
    assert(result.solvable, '应可解');
    assertEq(result.confidence, 'optimal', '小图应为最优解');
    assertEq(result.minSteps, 19, '最优解应为 19 步（5 捡钥匙 + 14 返回）');
    const fe = result.solutionFeatures;
    assertEq(fe.greedySteps, 9, '松弛直走下界 9');
    assertEq(fe.detourSteps, 10, '绕路量 19-9=10');
    assert(fe.nonGreedyRatio > 0.5, '非贪心占比高');
    assertEq(fe.mechanismUses, 1, '开锁 1 次');
    assertEq(fe.keyDepth, 1, '钥匙序深度 1');
    assert(fe.backtrackCount > 0, '路径应先远离终点再回来（反直觉性）');
    assert(fe.explorationRate > 0.3 && fe.explorationRate < 1, '探索率合理');
    assertEq(fe.ghostSeenSteps, 0, '无鬼图被盯 0 步');
    assertEq(fe.minGhostDist, Infinity, '无鬼图最近鬼距离 Infinity');
});

/**
 * 守护鬼微型图（复刻 placeGuardGhosts 竖枝几何）：5×4 水平必经走廊 y=2，
 * 走廊中段 (2,2) 上方 2 格竖枝 (2,1)→(2,0) 末端放鬼。玩家走走廊被盯 →
 * 鬼从竖枝末端 1:1 追（2 步才到走廊）→ 玩家继续走到终点 (4,2) 胜利。
 * 断言：零伤可解 + 解法被鬼直线看到 + 最近鬼距 2。
 */
test('鬼交互统计：守护鬼走廊被盯但不被咬（ghostSeenSteps/minGhostDist）', () => {
    const g = makeGrid(5, 4);
    for (let x = 0; x < 5; x++) {
        g.hWalls[1][x] = x === 2 ? emptyWall() : solidWall(); // (2,0)↔(2,1) 竖枝上段
        g.hWalls[2][x] = x === 2 ? emptyWall() : solidWall(); // (2,1)↔(2,2) 竖枝下段
        g.hWalls[3][x] = solidWall(); // 封 y=3 行（玩家只走 y=2 走廊）
    }
    const md = wrapMapData(g, {
        startPos: { x: 0, y: 2 },
        endPos: { x: 4, y: 2 },
        initialGhosts: [{ x: 2, y: 0, id: 0 }]
    });
    const r = solveMap(md);
    assert(r.solvable, '守护鬼走廊应零伤可解');
    assertEq(r.minSteps, 4, '最短 4 步');
    assertEq(r.difficulty.minHits, 0, '零伤硬门');
    assert(r.solutionFeatures.ghostSeenSteps >= 1, `解法路径应被鬼直线看到（实际 ${r.solutionFeatures.ghostSeenSteps}）`);
    assert(r.solutionFeatures.minGhostDist >= 1 && r.solutionFeatures.minGhostDist <= 2, `最近鬼距离贴脸但不咬（实际 ${r.solutionFeatures.minGhostDist}）`);
    assert(Number.isInteger(r.solutionFeatures.ghostSeenSteps), 'ghostSeenSteps 为整数');
});

test('端到端回放：钥匙绕路关卡驱动真实 gameLogic 胜利', () => {
    const md = makeKeyLockMap();
    const result = solveMap(md, { withGhosts: false });
    replayAndAssert(md, result, '钥匙绕路');
});

test('旧体力字段不限制当前规则的路线与计步', () => {
    const g = makeGrid(6, 5);
    // 直线 9 步：起点 (0,4) → 终点 (5,0)
    const base = wrapMapData(g, { startPos: { x: 0, y: 4 }, endPos: { x: 5, y: 0 } });
    const mdOk = { ...base, initialStamina: 10 };
    const rOk = solveMap(mdOk, { withGhosts: false });
    assert(rOk.solvable, '路线应可解');
    assertEq(rOk.minSteps, 9, '最短 9 步');
    const mdFail = { ...base, initialStamina: 8 };
    const rFail = solveMap(mdFail, { withGhosts: false });
    assert(rFail.solvable, '旧体力字段不再限制路线');
    assertEq(rFail.minSteps, 9);
});

test('随机图：无鬼兼容接口一致 + 有解图端到端回放无伤胜利', () => {
    let solved = 0, unknown = 0, unsat = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
        const md = genMap(seed);
        md.gameMode = 'death-loop';
        const vs = isStructurallySolvable(md);
        const rNoGhost = solveMap(md, { withGhosts: false });
        assertEq(rNoGhost.solvable, vs, `seed${seed} 无鬼接口状态应一致`);
        const r = solveMap(md);
        if (r.status === 'unknown') unknown++;
        if (r.status === 'proven_unsat') unsat++;
        if (r.solvable) {
            solved++;
            assert(r.solution.movementCost <= r.solution.totalActions, `seed${seed} 位移数不超过总步数`);
            replayAndAssert(md, r, `随机图 seed${seed}`);
            assert(r.difficulty.minHits === 0, '无伤硬门');
        }
    }
    // 信息性：生成器历史缺陷下可解率（不断言，只输出）
    console.log(`  历史随机图：取得证书 ${solved}/5，已证无解 ${unsat}，未知 ${unknown}`);
});

test('难度与特征输出结构完整', () => {
    const md = genMap(1);
    md.gameMode = 'death-loop';
    const r = solveMap(md);
    if (!r.solvable) {
        console.log('  seed1 未取得可行证书，跳过特征检查（不代表已证明无解）');
        return;
    }
    assertEq(r.difficulty.minSteps, r.minSteps, 'difficulty.minSteps 与 minSteps 一致');
    assert(r.difficulty.explorationRate > 0 && r.difficulty.explorationRate <= 1, '探索率区间');
    assert(Number.isInteger(r.solutionFeatures.mechanismUses), '机制利用数为整数');
    assert(Number.isInteger(r.solutionFeatures.keyDepth), '钥匙序深度为整数');
    assert(Number.isInteger(r.solutionFeatures.backtrackCount), '反直觉计数为整数');
    assert(Number.isInteger(r.solutionFeatures.ghostSeenSteps), 'ghostSeenSteps 为整数');
});

test('预算中断：保留三态与已发现的证书', () => {
    const md = genMap(7, 10, 8);
    md.gameMode = 'death-loop';
    const r = solveMap(md, { nodeBudget: 2000, entryBudget: 1000, budgetMs: 500 });
    assert(['optimal', 'approx', 'none'].includes(r.confidence), 'confidence 合法');
    if (!r.solvable) {
        assertEq(r.moves.length, 0, '未取得证书时 moves 应为空');
    } else {
        assert(r.minSteps > 0, '可解步数为正');
    }
});

summary();
