import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findUnsupportedButtons, assertButtonAttachments } from '../../src/design/button-support.js';
import { applyEdit } from '../../src/design/edits.js';
import { searchDesigns } from '../../src/design/search.js';
import { minimizeDesign } from '../../src/design/minimize.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { smallMap } from './fixtures.mjs';

test('交付图的悬空 B 必须被拒绝，改到同格上方实墙后合法', () => {
    const source = JSON.parse(readFileSync(new URL('../../examples/borrowed-shelter-20261009/map.json', import.meta.url)));
    assert.deepEqual(findUnsupportedButtons(source).map(b => [b.letter, b.x, b.y]), [['B', 1, 4]]);
    assert.throws(() => assertButtonAttachments(source), /未依附|依附/);
    const fixed = structuredClone(source); fixed.buttons[1].direction = { dx: 0, dy: -1 };
    assert.deepEqual(findUnsupportedButtons(fixed), []); assertButtonAttachments(fixed);
});

test('拆除依附墙、替换为门或玻璃、扩展邻格导致悬空时拒绝编辑，原图保持原样', () => {
    const map = smallMap([[1, 1], [2, 1]], [1, 1], [2, 1]);
    map.buttons = [{ x: 1, y: 1, letter: 'A', direction: { dx: 1, dy: 0 } }];
    map.vWalls[1][2] = { type: W.SOLID, keys: 0 }; const before = structuredClone(map);
    for (const wall of [{ type: W.EMPTY }, { type: W.GLASS }, { type: W.DOOR }, { type: W.LOCKED, keys: 1 },
        { type: W.ONE_WAY, direction: { dx: 1, dy: 0 } }, { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' }]) {
        assert.throws(() => applyEdit(map, { type: 'wall', axis: 'v', x: 2, y: 1, wall }), /未依附|依附/);
    }
    assert.deepEqual(map, before);
    const boundary = smallMap([[1, 1]], [1, 1], [1, 1]);
    boundary.buttons = [{ x: 1, y: 1, letter: 'A', direction: { dx: -1, dy: 0 } }];
    assert.throws(() => applyEdit(boundary, { type: 'cell', x: 0, y: 1 }), /未依附|依附/);
});

test('四方向墙面和自动地图边界按本体规则接受，多层逐层检查', () => {
    const map = smallMap([[1, 1]], [1, 1], [1, 1]);
    map.buttons = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }].map(direction => ({ x: 1, y: 1, letter: 'A', direction }));
    map.hWalls[1][1] = { type: W.EMPTY }; assertButtonAttachments(map);
    const layer = m => ({ hWalls: m.hWalls, vWalls: m.vWalls, activeCells: m.activeCells, buttons: m.buttons });
    const upper = structuredClone(map); upper.activeCells[1][2] = true; upper.vWalls[1][2] = { type: W.EMPTY };
    const multi = { ...map, multiLayerMode: true, layerCount: 2, layers: [layer(map), layer(upper)] };
    assert.deepEqual(findUnsupportedButtons(multi).map(b => [b.layer, b.direction]), [[1, { dx: 1, dy: 0 }]]);
});

test('搜索和精简入口在求解前拒绝悬空按钮，不能把可通关当作合法', () => {
    const map = smallMap([[1, 1], [2, 1]], [1, 1], [2, 1]);
    map.buttons = [{ x: 1, y: 1, letter: 'A', direction: { dx: 1, dy: 0 } }];
    assert.throws(() => searchDesigns(map, { familyId: 'attachment-regression', iterations: 0 }), /未依附|依附/);
    let evaluated = false;
    assert.throws(() => minimizeDesign(map, () => { evaluated = true; return {}; }), /未依附|依附/);
    assert.equal(evaluated, false);
});
