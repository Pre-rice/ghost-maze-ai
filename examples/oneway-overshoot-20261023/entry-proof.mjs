import assert from 'node:assert/strict';
import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';

/** 下移一格，将入口放在真正外侧；不把环内孤格默认当作可接近的外区。 */
export function auditActualEntry(map, routes) {
    const wall = () => ({ type: W.SOLID, keys: 0 }), old = map.layers[0];
    const layer = {
        activeCells: Array.from({ length: 8 }, () => Array(8).fill(false)),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, wall)),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, wall)),
        ghosts: old.ghosts.map(g => ({ ...g, y: g.y + 1 })),
        items: [], buttons: [], customStartPos: { x: 4, y: 0 },
        endPos: { ...old.endPos, y: old.endPos.y + 1 }
    };
    assert.equal(old.items.length, 0); assert.equal(old.buttons.length, 0);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
        layer.activeCells[y + 1][x] = old.activeCells[y][x];
    }
    for (let y = 0; y <= 4; y++) for (let x = 0; x < 8; x++) layer.hWalls[y + 1][x] = structuredClone(old.hWalls[y][x]);
    for (let y = 0; y < 4; y++) for (let x = 0; x <= 8; x++) layer.vWalls[y + 1][x] = structuredClone(old.vWalls[y][x]);
    layer.activeCells[0][4] = true;
    layer.hWalls[1][4] = { type: W.ONE_WAY, keys: 0, direction: { dx: 0, dy: 1 } };
    const raw = { ...structuredClone(map), layers: [layer] };
    assertExterior(raw);
    const enteredMap = normalizeVoidWalls(normalizeMapData(raw));
    const env = createReferenceEnvironment(map), entered = createReferenceEnvironment(enteredMap);
    const physical = (state, offset) => {
        const l = state.layerStates[0], walls = [];
        for (const axis of ['h', 'v']) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            if (old.activeCells[y]?.[x] && (axis === 'h' ? old.activeCells[y - 1]?.[x] : old.activeCells[y]?.[x - 1])) {
                walls.push([axis, x, y, l.wallStates[axis][y + offset][x]]);
            }
        }
        return { p: [state.player.layer, state.player.x, state.player.y - offset, state.player.keys, state.player.hp],
            dead: state.isDead, won: state.isWon, ghosts: l.ghosts.map(g => [g.x, g.y - offset]), items: l.items, walls };
    };
    const initial = entered.initialState(), arrival = entered.step(initial, 'D');
    assert.notEqual(initial, arrival); assert(!arrival.isDead && !arrival.isWon);
    assert.deepEqual(physical(env.initialState(), 0), physical(arrival, 1));
    for (const actions of routes) {
        let a = env.initialState(), b = arrival;
        for (const action of actions) {
            a = env.step(a, action); b = entered.step(b, action);
            assert.deepEqual(physical(a, 0), physical(b, 1));
        }
    }
    return { external: [0, 4, 0], unitTranslation: [0, 1], actions: ['D'],
        originalBirth: [0, 4, 0], entryOnOuterTopBoundary: true, keys: 0, externalGhosts: 0,
        initialInteriorEqual: true, wholeOptimalRoutesInteriorEqual: true, optimalRoutesCompared: routes.length,
        scope: '单元下移仅为容纳上方真实外侧格；不是环内孤格。比较内部物理量，累计步数与探索知识除外。' };
}
