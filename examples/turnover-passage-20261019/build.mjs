import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';

/** 从完整方室和六段内墙独立重建；不读取研究原型或求解动作。 */
export function buildMap() {
    const wall = type => ({ type, keys: 0 });
    const l = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => x >= 1 && x <= 5 && y >= 1 && y <= 5)),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 2, y: 3, id: 0 }, { x: 3, y: 3, id: 1 }, { x: 3, y: 5, id: 2 }],
        items: [], buttons: [], customStartPos: { x: 1, y: 1 }, endPos: { x: 4, y: 2 }
    };
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
        if (x < 5) l.vWalls[y][x + 1] = wall(W.EMPTY);
        if (y < 5) l.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    for (const [axis, x, y] of [['h', 1, 2], ['h', 4, 2], ['h', 4, 4], ['h', 4, 5], ['v', 4, 2], ['v', 5, 2]]) {
        l[axis + 'Walls'][y][x] = wall(W.SOLID);
    }
    return normalizeVoidWalls(normalizeMapData({ width: 8, height: 8, editorMode: 'free',
        gameMode: 'death-loop', initialHealth: 5, multiLayerMode: false, layerCount: 1, layers: [l], stairs: [] }));
}
