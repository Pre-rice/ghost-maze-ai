import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';

/** 独立构造《换庭》，不读取私人稿或参考路线。 */
export function buildMap() {
    const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });
    const active = (x, y) => x >= 0 && x <= 3 && y >= 0 && y <= 2 ||
        x >= 1 && x <= 4 && y >= 3 && y <= 5;
    const layer = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => active(x, y))),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 2, y: 0, id: 0 }, { x: 2, y: 5, id: 1 }],
        items: [{ x: 4, y: 5, type: 'key' }], buttons: [],
        customStartPos: { x: 0, y: 2 }, endPos: { x: 0, y: 0 }
    };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (active(x, y)) {
        if (active(x + 1, y)) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (active(x, y + 1)) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    layer.hWalls[1][0] = wall(W.LOCKED, { keys: 1 });
    layer.vWalls[0][1] = wall(W.SOLID);
    layer.hWalls[3][1] = wall(W.ONE_WAY, { direction: { dx: 0, dy: 1 } });
    layer.hWalls[3][3] = wall(W.DOOR);
    const raw = { width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop',
        initialHealth: 5, multiLayerMode: false, layerCount: 1, layers: [layer], stairs: [] };
    assertExterior(raw);
    return normalizeVoidWalls(normalizeMapData(raw));
}
