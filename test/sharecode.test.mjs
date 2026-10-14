/** 地图分享与游戏端共同格式互验，不保留旧码读取分支。 */
import { readFileSync } from 'node:fs';
import { test, suite, summary, assert, assertEq } from './_assert.mjs';
import { generateShareCode, loadFromShareCode } from '../src/tools/sharecode.js';
import { normalizeMapData, WALL_TYPES as W } from '../src/reference/engine.js';
import { stairMap, smallMap } from './reference/fixtures.mjs';

const golden = JSON.parse(readFileSync(new URL('../../ghost-maze/test/golden/maps.json', import.meta.url)));
suite('sharecode');
for (const [id, fixture] of Object.entries(golden)) test(id + ' 编码与本体一致，解码完整往返', () => {
    const encoded = generateShareCode(fixture.canonical);
    assert(encoded.success, encoded.error);
    assertEq(encoded.code, fixture.code, '游戏与 AI 分享码必须一致');
    const decoded = loadFromShareCode(encoded.code);
    assert(decoded.success, decoded.error);
    assertEq(JSON.stringify(decoded.data.mapData), JSON.stringify(normalizeMapData(fixture.canonical)), '完整地图一致');
    assertEq(generateShareCode(decoded.data.mapData).code, encoded.code, '幂等');
});

test('旧码、乱码、空码与截断均干净拒绝', () => {
    for (const code of ['', '!!!not-a-code!!!', 'Y-biYmZlSGFhZOT4jwT4GRnZGZk5GFatWsAAAaGrRGMDGFatWsHowMUQwNQgwrCAlQ3EYmQEAA', golden['G1-demo'].code.slice(0, -3)]) {
        const result = loadFromShareCode(code);
        assert(!result.success, '非法码不得载入'); assert(result.error.includes('无效'), '说明失败原因');
    }
});

test('稀疏自由地图与非默认生命完整往返', () => {
    const map = smallMap([[1,1], [2,1], [2,2]], [1,1], [2,2]);
    map.gameMode = 'exploration'; map.initialHealth = 256;
    const encoded = generateShareCode(map); assert(encoded.success, encoded.error);
    const decoded = loadFromShareCode(encoded.code); assert(decoded.success, decoded.error);
    assertEq(decoded.data.initialHealth, 256, '生命不截断');
    assertEq(JSON.stringify(decoded.data.mapData), JSON.stringify(normalizeMapData(map)), '活动格与起点保留');
});

test('多层配对楼梯与所有机关参数完整往返', () => {
    const map = stairMap(true), layer = map.layers[1];
    for (const y of [1, 2, 3]) for (const x of [2, 3]) layer.activeCells[y][x] = true;
    layer.hWalls[2][2] = {type: W.LOCKED, keys: 256};
    layer.hWalls[3][2] = {type: W.ONE_WAY, direction:{dx:0,dy:1}};
    layer.hWalls[2][3] = {type: W.GLASS};
    layer.hWalls[3][3] = {type: W.DOOR};
    const encoded = generateShareCode(map); assert(encoded.success, encoded.error);
    const decoded = loadFromShareCode(encoded.code); assert(decoded.success, decoded.error);
    assertEq(JSON.stringify(decoded.data.mapData), JSON.stringify(normalizeMapData(map)), '楼梯和机关参数保留');
    assertEq(generateShareCode(decoded.data.mapData).code, encoded.code, '多层幂等');
});

summary('sharecode');
