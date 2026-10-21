import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';
import { assertButtonAttachments } from '../../src/design/button-support.js';

/** 独立构造《丈量》，不读取私人原型或参考路线。 */
export function buildMap() {
    const wall = (type, keys = 0) => ({ type, keys });
    const letter = (value, open) => ({ type: W.LETTER_DOOR, keys: 0, letter: value,
        initialState: open ? 'open' : 'closed' });
    const active = (x, y) => y === 0 ? x >= 1 && x <= 5 :
        y >= 1 && y <= 4 ? x >= 0 && x <= 4 : y === 5 && x >= 0 && x <= 1;
    const layer = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => active(x, y))),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 1, y: 2, id: 0 }, { x: 4, y: 0, id: 1 }, { x: 4, y: 4, id: 2 }],
        items: [{ x: 4, y: 1, type: 'key' }],
        buttons: [
            { x: 1, y: 0, letter: 'A', direction: { dx: 0, dy: -1 } },
            { x: 1, y: 0, letter: 'B', direction: { dx: -1, dy: 0 } },
            { x: 1, y: 5, letter: 'A', direction: { dx: 0, dy: 1 } }
        ],
        customStartPos: { x: 0, y: 5 }, endPos: { x: 5, y: 0 }
    };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (active(x, y)) {
        if (active(x + 1, y)) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (active(x, y + 1)) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    for (const [axis, x, y] of [['h', 2, 1], ['h', 4, 1], ['h', 2, 2],
        ['v', 4, 1], ['v', 1, 2], ['v', 2, 2], ['v', 1, 4]]) {
        layer[axis + 'Walls'][y][x] = wall(W.SOLID);
    }
    for (const y of [2, 3, 5]) layer.hWalls[y][1] = letter('A', true);
    layer.vWalls[1][1] = letter('A', false);
    for (const x of [2, 3]) layer.vWalls[0][x] = letter('B', true);
    layer.vWalls[0][5] = wall(W.LOCKED, 1);
    const raw = { width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop',
        initialHealth: 5, multiLayerMode: false, layerCount: 1, layers: [layer], stairs: [] };
    assertExterior(raw); assertButtonAttachments(raw);
    return normalizeVoidWalls(normalizeMapData(raw));
}
