import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';
import { assertButtonAttachments } from '../../src/design/button-support.js';

/** 独立构造《回流》；不读取私人草图或参考动作。 */
export function buildMap() {
    const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });
    const active = (x, y) => x >= 0 && x < 5 && y >= 0 && y < 6 && !(x === 4 && y === 0);
    const layer = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => active(x, y))),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 0, y: 1, id: 0 }, { x: 0, y: 5, id: 1 }],
        items: [{ x: 1, y: 5, type: 'key' }], buttons: [],
        customStartPos: { x: 3, y: 2 }, endPos: { x: 0, y: 2 }
    };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (active(x, y)) {
        if (active(x + 1, y)) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (active(x, y + 1)) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    for (let y = 0; y < 4; y++) layer.vWalls[y][4] = wall(W.SOLID);
    for (let x = 0; x < 4; x++) layer.hWalls[4][x] = wall(W.SOLID);
    layer.vWalls[1][4] = wall(W.LOCKED, { keys: 1 });
    layer.vWalls[2][4] = wall(W.ONE_WAY, { direction: { dx: 1, dy: 0 } });
    layer.hWalls[4][0] = wall(W.ONE_WAY, { direction: { dx: 0, dy: 1 } });
    layer.vWalls[2][1] = wall(W.LOCKED, { keys: 1 });
    layer.hWalls[2][0] = wall(W.SOLID); layer.hWalls[3][0] = wall(W.SOLID);
    const raw = { width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop',
        initialHealth: 5, multiLayerMode: false, layerCount: 1, layers: [layer], stairs: [] };
    assertExterior(raw); assertButtonAttachments(raw);
    return normalizeVoidWalls(normalizeMapData(raw));
}
