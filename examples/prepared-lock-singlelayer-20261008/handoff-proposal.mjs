import { smallMap } from '../../src/design/grid.js';
import { WALL_TYPES as W } from '../../src/reference/engine.js';

// 关系提案：两条互补通路、可撤离后再用的数字门，以及不同站位上的同组开关。
export function handoffProposal() {
    const map = smallMap([[4, 2], [5, 2], [4, 3], [3, 4], [4, 4], [3, 5], [4, 5]], [4, 5], [5, 2]);
    map.initialGhosts = [{ x: 4, y: 2, id: 0 }];
    map.items = [{ x: 3, y: 5, type: 'key' }];
    map.vWalls[4][4] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'closed' };
    map.hWalls[5][4] = { type: W.LETTER_DOOR, letter: 'A', initialState: 'open' };
    map.hWalls[3][4] = { type: W.LETTER_DOOR, letter: 'B', initialState: 'closed' };
    map.vWalls[5][4] = { type: W.LETTER_DOOR, letter: 'B', initialState: 'open' };
    map.hWalls[4][4] = { type: W.LOCKED, keys: 1 };
    map.buttons = [
        { x: 3, y: 4, direction: { dx: -1, dy: 0 }, letter: 'A' },
        { x: 4, y: 5, direction: { dx: 1, dy: 0 }, letter: 'A' },
        { x: 3, y: 5, direction: { dx: 0, dy: 1 }, letter: 'B' },
        { x: 4, y: 5, direction: { dx: 0, dy: 1 }, letter: 'B' },
        { x: 4, y: 4, direction: { dx: 1, dy: 0 }, letter: 'B' }
    ];
    return map;
}
