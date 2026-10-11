import { WALL_TYPES as W, MAP_SIZE_MIN } from '../reference/engine.js';

export function smallMap(cells, start, end) {
    const size = MAP_SIZE_MIN;
    const solid = () => ({ type: W.SOLID, keys: 0 });
    const map = {
        width: size, height: size, editorMode: 'free', gameMode: 'death-loop',
        initialHealth: 5,
        startPos: { x: start[0], y: start[1] }, customStartPos: { x: start[0], y: start[1] },
        endPos: end ? { x: end[0], y: end[1] } : null,
        multiLayerMode: false, layerCount: 1, layers: [], stairs: [], buttons: [], items: [], initialGhosts: [],
        activeCells: Array.from({ length: size }, () => Array(size).fill(false)),
        hWalls: Array.from({ length: size + 1 }, () => Array.from({ length: size }, solid)),
        vWalls: Array.from({ length: size }, () => Array.from({ length: size + 1 }, solid))
    };
    for (const [x, y] of cells) map.activeCells[y][x] = true;
    for (const [x, y] of cells) {
        if (map.activeCells[y]?.[x + 1]) map.vWalls[y][x + 1] = { type: W.EMPTY, keys: 0 };
        if (map.activeCells[y + 1]?.[x]) map.hWalls[y + 1][x] = { type: W.EMPTY, keys: 0 };
    }
    return map;
}

