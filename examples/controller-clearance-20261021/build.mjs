import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';

/** 独立构造《接管》；不读取研究目录或已存地图。 */
export function buildMap() {
    const wall = type => ({ type, keys: 0 });
    const door = () => ({ type: W.LETTER_DOOR, keys: 0, letter: 'A', initialState: 'open' });
    const rows = ['.######.', '#######.', '...####.', '...##...', '........', '........', '........', '........'];
    const layer = {
        activeCells: rows.map(row => [...row].map(c => c === '#')),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 2, y: 0, id: 0 }, { x: 2, y: 1, id: 1 }],
        items: [{ x: 1, y: 0, type: 'key' }],
        buttons: [
            { x: 2, y: 0, letter: 'A', direction: { dx: 0, dy: -1 } },
            { x: 2, y: 1, letter: 'A', direction: { dx: 0, dy: 1 } }
        ],
        customStartPos: { x: 6, y: 2 },
        endPos: { x: 0, y: 1 }
    };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (layer.activeCells[y][x]) {
        if (layer.activeCells[y][x + 1]) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (layer.activeCells[y + 1]?.[x]) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    layer.hWalls[1][1] = wall(W.SOLID);
    layer.hWalls[1][5] = wall(W.SOLID);
    layer.vWalls[0][3] = door();
    layer.vWalls[1][3] = door();
    layer.vWalls[1][2] = door();
    layer.vWalls[1][1] = { type: W.LOCKED, keys: 1 };
    const map = {
        width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop', initialHealth: 5,
        multiLayerMode: false, layerCount: 1, layers: [layer], stairs: []
    };
    assertExterior(map);
    return normalizeVoidWalls(normalizeMapData(map));
}
