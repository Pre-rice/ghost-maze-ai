import { readFileSync } from 'node:fs';
import { WALL_TYPES as W } from '../../src/reference/engine.js';

export const seedMap = id => JSON.parse(readFileSync(new URL(`../../examples/puzzle-units/${id}.json`, import.meta.url), 'utf8'));

export { smallMap } from '../../src/design/grid.js';
import { smallMap } from '../../src/design/grid.js';

export function keyDetourMap() {
    const map = smallMap([[2, 3], [3, 3], [4, 3], [2, 2], [2, 1]], [2, 3], [4, 3]);
    map.items = [{ x: 2, y: 1, type: 'key' }];
    map.vWalls[3][4] = { type: W.LOCKED, keys: 1 };
    return map;
}

export function stairMap(withButtons = false) {
    const lower = smallMap([[1, 2], [2, 2]], [1, 2], null);
    const upper = smallMap([[2, 2], [3, 2]], [2, 2], [3, 2]);
    if (withButtons) {
        lower.buttons = [{ x: 1, y: 2, direction: { dx: 0, dy: -1 }, letter: 'A' }];
        lower.vWalls[2][2] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
        upper.vWalls[2][3] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    }
    const layers = [lower, upper].map((map, li) => ({
        hWalls: map.hWalls, vWalls: map.vWalls, activeCells: map.activeCells,
        items: map.items, ghosts: map.initialGhosts, buttons: map.buttons,
        endPos: map.endPos, customStartPos: li === 0 ? map.customStartPos : null
    }));
    return { width: lower.width, height: lower.height, editorMode: lower.editorMode, gameMode: lower.gameMode, initialHealth: lower.initialHealth, multiLayerMode: true, layerCount: 2, layers,
        stairs: [{ x: 2, y: 2, layer: 0, direction: 'up' }, { x: 2, y: 2, layer: 1, direction: 'down' }]
    };
}
