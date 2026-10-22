import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';
import { assertButtonAttachments } from '../../src/design/button-support.js';

/** 独立构造《门庭》；不读取私人草图或参考动作。 */
export function buildMap() {
    const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });
    const gate = open => wall(W.LETTER_DOOR, { letter: 'A', initialState: open ? 'open' : 'closed' });
    const active = (x, y) => x >= 0 && x <= 6 && y >= 0 && y <= 6 && (
        x === 0 || y === 6 || x === 6 && y >= 3 || y === 0 && x <= 3 ||
        x >= 2 && x <= 4 && y >= 2 && y <= 4 ||
        x === 3 && (y === 1 || y === 5) || y === 3 && (x === 1 || x === 5) || x === 5 && y === 4
    );
    const layer = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => active(x, y))),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 3, y: 2, id: 0 }, { x: 2, y: 3, id: 1 }],
        items: [{ x: 3, y: 3, type: 'key' }],
        buttons: [
            { x: 0, y: 3, letter: 'A', direction: { dx: -1, dy: 0 } },
            { x: 5, y: 3, letter: 'A', direction: { dx: 0, dy: -1 } }
        ],
        customStartPos: { x: 2, y: 6 }, endPos: { x: 5, y: 4 }
    };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (active(x, y)) {
        if (active(x + 1, y)) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (active(x, y + 1)) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    layer.hWalls[2][3] = gate(true); layer.hWalls[5][3] = gate(true);
    layer.vWalls[3][2] = gate(false); layer.vWalls[3][5] = gate(false);
    layer.hWalls[4][5] = wall(W.LOCKED, { keys: 1 });
    layer.vWalls[4][5] = wall(W.SOLID); layer.vWalls[4][6] = wall(W.SOLID);
    const raw = { width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop',
        initialHealth: 5, multiLayerMode: false, layerCount: 1, layers: [layer], stairs: [] };
    assertExterior(raw); assertButtonAttachments(raw);
    return normalizeVoidWalls(normalizeMapData(raw));
}
