/**
 * sharecode - 分享码 v3 协议互验测试
 *
 * 核心目标：锁死「AI 端（src/tools/sharecode.js）与游戏端（ghost-maze
 * src/core/dataSerializer.js）字节级一致」——用游戏端 golden 码做黄金基准：
 *   1. 同一 canonical 输入，AI 端编码结果 === 游戏端 golden 码（逐字符）
 *   2. golden 码能被 AI 端解码，关键字段与 canonical 一致
 *   3. 解码→再编码幂等（闭环）
 *   4. 旧版（无版本头）码与乱码被确定性拒绝
 *   5. 自由模式 / 多层（覆盖 GLASS/ONE_WAY/LETTER_DOOR 参数队列）闭环
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deflateRaw } from 'pako';
import { test, suite, summary, assert, assertEq } from './_assert.mjs';
import { generateShareCode, loadFromShareCode } from '../src/tools/sharecode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// G1-demo 游戏端 v3 编码产物（来自 ghost-maze test/golden/maps.json；demo 图为自由模式）
const G1_GOLDEN_CODE = 'Y-biYmZlSGFhZOT4jwT4GRnZGZk5GFatWsAAAaGrRGMDGFatWsHowMUQwNQgwrCAlQ3EYmQEAA';

const demo = JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'demo-map.json'), 'utf-8'));
const mapData = demo.mapData;
// 与游戏端 golden 生成输入一致：canonical + gameMode（death-loop）+ initialHealth=5
const sourceData = { ...mapData, gameMode: 'death-loop', initialHealth: 5, initialStamina: 100 };

suite('sharecode');

// ---------- 墙/实体宽松比较（decode 产物与 canonical 结构存在合法差异：EMPTY 带 keys:0、无 startPos） ----------

const sameWall = (a, b) => {
    if (!b) b = { type: 0 };
    if (a.type !== b.type) return false;
    if (a.type === 3 && (a.keys || 0) !== (b.keys || 0)) return false;
    if (a.type === 4 && JSON.stringify(a.direction || null) !== JSON.stringify(b.direction || null)) return false;
    if (a.type === 6) {
        if ((a.letter || null) !== (b.letter || null)) return false;
        if ((a.initialState || 'closed') !== (b.initialState || 'closed')) return false;
    }
    return true;
};

const sameEntities = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i];
        if (x.x !== y.x || x.y !== y.y) return false;
        if (JSON.stringify(x.direction || null) !== JSON.stringify(y.direction || null)) return false;
        if ((x.letter || null) !== (y.letter || null)) return false;
    }
    return true;
};

// ---------- G1 黄金基准 ----------

test('G1 canonical 编码结果 === 游戏端 golden 码（字节级一致）', () => {
    const r = generateShareCode(sourceData);
    assert(r.success, r.error || '生成失败');
    assertEq(r.code, G1_GOLDEN_CODE, '必须与游戏端 golden 逐字符一致');
});

test('golden 码可解码，关键字段与 canonical 一致', () => {
    const r = loadFromShareCode(G1_GOLDEN_CODE);
    assert(r.success, r.error || '解码失败');
    const d = r.data;
    assertEq(d.gameMode, 'death-loop', 'gameMode');
    assertEq(d.initialHealth, 5, 'initialHealth');
    assertEq(d.initialStamina, 100, 'initialStamina');
    const m = d.mapData;
    assertEq(m.width, 10, '宽度');
    assertEq(m.height, 10, '高度');
    assertEq(m.editorMode, 'free', 'editorMode');
    assertEq(JSON.stringify(m.customStartPos), JSON.stringify({ x: 1, y: 8 }), '自由模式出生点');
    assertEq(m.multiLayerMode, false, 'multiLayerMode');
    assertEq(JSON.stringify(m.endPos), JSON.stringify(mapData.endPos), '终点');
    for (let y = 0; y <= 10; y++)
        for (let x = 0; x < 10; x++)
            assert(sameWall(m.hWalls[y][x], mapData.hWalls[y][x]), `hWalls[${y}][${x}] 不一致`);
    for (let y = 0; y < 10; y++)
        for (let x = 0; x <= 10; x++)
            assert(sameWall(m.vWalls[y][x], mapData.vWalls[y][x]), `vWalls[${y}][${x}] 不一致`);
    assert(sameEntities(m.initialGhosts, mapData.initialGhosts), '鬼实体不一致');
    assert(sameEntities(m.items, mapData.items), '钥匙实体不一致');
    assert(sameEntities(m.buttons, mapData.buttons), '按钮实体不一致');
});

test('解码→再编码幂等（闭环）', () => {
    const r1 = generateShareCode(sourceData);
    assert(r1.success, '编码失败');
    const r2 = loadFromShareCode(r1.code);
    assert(r2.success, '解码失败');
    const re = generateShareCode({
        ...r2.data.mapData,
        gameMode: r2.data.gameMode,
        initialHealth: r2.data.initialHealth,
        initialStamina: r2.data.initialStamina,
    });
    assert(re.success, '重编码失败');
    assertEq(re.code, r1.code, '重编码必须与原码一致');
});

// ---------- 确定性失败路径 ----------

test('旧版（无版本头）码被版本校验拒绝', () => {
    // 构造能成功 inflate、但首字节是 0x0A（旧码的 width 起点）而非 0x03 的字节流
    const v1like = Buffer.from(deflateRaw(new Uint8Array([0x0A, 0x0A, 0x0A]))).toString('base64url');
    const r = loadFromShareCode(v1like);
    assert(!r.success, '旧码应被拒绝');
    assertEq(r.error, '分享码版本不支持。', '应报版本不支持');
});

test('乱码被干净拒绝（确定性失败路径）', () => {
    const r = loadFromShareCode('!!!not-a-code!!!');
    assert(!r.success, '乱码应失败');
    assertEq(r.error, '分享码无效或已损坏。', '应报无效/损坏');
});

test('空码被拒绝', () => {
    const r = loadFromShareCode('');
    assert(!r.success, '空码应失败');
});

// ---------- 自由模式 / 多层分支闭环 ----------

const fullCells = (w, h) => Array.from({ length: h }, () => Array(w).fill(true));
const wallGrid = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(null).map(() => ({ type: 1 })));

test('自由模式（customStartPos + activeCells 位图）闭环', () => {
    const free = {
        width: 8, height: 8, gameMode: 'exploration', editorMode: 'free',
        initialHealth: 5, initialStamina: 100,
        hWalls: wallGrid(9, 8), vWalls: wallGrid(8, 9),
        activeCells: fullCells(8, 8), // 位图编码
        initialGhosts: [], items: [], buttons: [],
        endPos: { x: 7, y: 7 }, customStartPos: { x: 0, y: 0 },
        multiLayerMode: false, layerCount: 1, layers: [], stairs: [],
    };
    // 位图造一点形状：左上 3×3 可活动，其余不可
    for (let y = 3; y < 8; y++) for (let x = 0; x < 8; x++) free.activeCells[y][x] = false;
    const r1 = generateShareCode(free);
    assert(r1.success, r1.error || '编码失败');
    const r2 = loadFromShareCode(r1.code);
    assert(r2.success, r2.error || '解码失败');
    const m = r2.data.mapData;
    assertEq(m.editorMode, 'free', 'editorMode 应为 free');
    assertEq(JSON.stringify(m.customStartPos), JSON.stringify({ x: 0, y: 0 }), 'customStartPos');
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
            assertEq(m.activeCells[y][x], free.activeCells[y][x], `activeCells[${y}][${x}]`);
});

test('多层（楼梯 + GLASS/ONE_WAY/LETTER_DOOR 参数队列 + 层边界）闭环', () => {
    const layer1H = wallGrid(9, 8);
    const layer1V = wallGrid(8, 9);
    layer1H[1][2] = { type: 3, keys: 2 };                                 // LOCKED(keys=2)
    layer1V[1][1] = { type: 6, letter: 'A', initialState: 'open' };        // LETTER_DOOR 已开
    layer1H[3][1] = { type: 4, direction: { dx: 1, dy: 0 } };              // ONE_WAY 向右
    layer1V[3][2] = { type: 5 };                                           // GLASS

    // 顶层第 0 层放一个 DOOR + LETTER_DOOR(closed)，覆盖第 0 层参数队列
    const topH = wallGrid(9, 8);
    const topV = wallGrid(8, 9);
    topH[0][0] = { type: 2 };                                              // DOOR
    topV[0][0] = { type: 6, letter: 'B', initialState: 'closed' };         // LETTER_DOOR 未开

    const multi = {
        width: 8, height: 8, gameMode: 'exploration', editorMode: 'regular',
        initialHealth: 5, initialStamina: 100,
        hWalls: topH, vWalls: topV,
        activeCells: fullCells(8, 8),
        initialGhosts: [{ x: 1, y: 1 }], items: [{ x: 2, y: 2 }],
        buttons: [{ x: 3, y: 3, direction: { dx: 1, dy: 0 }, letter: 'A' }],
        endPos: { x: 7, y: 7 }, customStartPos: null,
        multiLayerMode: true, layerCount: 2,
        stairs: [
            { x: 4, y: 4, layer: 0, direction: 'up' },
            { x: 4, y: 4, layer: 1, direction: 'down' },
        ],
        layers: [null, {
            activeCells: fullCells(8, 8),
            hWalls: layer1H, vWalls: layer1V,
            customStartPos: null, endPos: { x: 1, y: 1 },
            buttons: [], ghosts: [{ x: 5, y: 5 }], items: [{ x: 6, y: 6 }],
        }],
    };
    const r1 = generateShareCode(multi);
    assert(r1.success, r1.error || '编码失败');
    const r2 = loadFromShareCode(r1.code);
    assert(r2.success, r2.error || '解码失败');
    const m = r2.data.mapData;
    assertEq(m.multiLayerMode, true, 'multiLayerMode');
    assertEq(m.layerCount, 2, 'layerCount');
    assertEq(m.stairs.length, 2, '楼梯数量');
    assertEq(JSON.stringify(m.stairs[0].direction), JSON.stringify('up'), '楼梯方向');
    // 第 0 层：顶层墙 + 第 0 层实体
    assert(sameWall(m.hWalls[0][0], { type: 2 }), '第 0 层 DOOR');
    assert(sameWall(m.vWalls[0][0], { type: 6, letter: 'B', initialState: 'closed' }), '第 0 层 LETTER_DOOR(closed)');
    assertEq(m.items.length, 1, '第 0 层钥匙');
    assertEq(m.endPos.x, 7, '第 0 层终点');
    // 第 1 层：独立墙 + 参数队列（LOCKED keys / ONE_WAY 方向 / LETTER_DOOR open）
    const l1 = m.layers[1];
    assert(l1, '存在第 1 层');
    assert(sameWall(l1.hWalls[1][2], { type: 3, keys: 2 }), '第 1 层 LOCKED(keys=2)');
    assert(sameWall(l1.vWalls[1][1], { type: 6, letter: 'A', initialState: 'open' }), '第 1 层 LETTER_DOOR(open)');
    assert(sameWall(l1.hWalls[3][1], { type: 4, direction: { dx: 1, dy: 0 } }), '第 1 层 ONE_WAY 向右');
    assert(sameWall(l1.vWalls[3][2], { type: 5 }), '第 1 层 GLASS');
    assertEq(l1.ghosts.length, 1, '第 1 层鬼');
    assertEq(JSON.stringify(l1.endPos), JSON.stringify({ x: 1, y: 1 }), '第 1 层终点');
    // 闭环幂等
    const re = generateShareCode({ ...m, gameMode: r2.data.gameMode, initialHealth: r2.data.initialHealth, initialStamina: r2.data.initialStamina });
    assert(re.success, '重编码失败');
    assertEq(re.code, r1.code, '多层重编码必须与原码一致');
});

summary('sharecode');
