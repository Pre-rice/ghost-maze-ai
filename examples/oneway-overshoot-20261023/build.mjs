import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';

/** 独立构造《进退》：门封住鬼的横廊，单向支路改变接触长度。 */
export function buildMap() {
    const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });
    const active = (x, y) => (y === 0 || y === 2) && x >= 1 && x <= 7 ||
        y === 1 && [0, 1, 5, 7].includes(x) || y === 3 && [0, 1, 2].includes(x) || x === 0 && y === 2;
    const layer = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => active(x, y))),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 4, y: 2, id: 0 }], items: [], buttons: [],
        customStartPos: { x: 4, y: 0 }, endPos: { x: 5, y: 1 }
    };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (active(x, y)) {
        if (active(x + 1, y)) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (active(x, y + 1)) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    layer.vWalls[2][1] = wall(W.SOLID);
    layer.hWalls[1][5] = wall(W.SOLID);
    layer.hWalls[2][1] = wall(W.DOOR);
    layer.hWalls[2][7] = wall(W.DOOR);
    layer.hWalls[3][1] = wall(W.DOOR);
    layer.hWalls[3][2] = wall(W.ONE_WAY, { direction: { dx: 0, dy: 1 } });
    const raw = { width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop',
        initialHealth: 5, multiLayerMode: false, layerCount: 1, layers: [layer], stairs: [] };
    assertExterior(raw);
    return normalizeVoidWalls(normalizeMapData(raw));
}
