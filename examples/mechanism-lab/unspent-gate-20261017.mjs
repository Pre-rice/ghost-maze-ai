// 机制反例：最优解不穿过的0门，也可能排除一个更短的计划；不是挑战关卡。
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';

export function buildMap() {
    const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });
    const layer = {
        activeCells: Array.from({ length: 8 }, () => Array(8).fill(false)),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 0, y: 3, id: 0 }], items: [],
        buttons: [{ x: 3, y: 2, letter: 'A', direction: { dx: -1, dy: 0 } }],
        customStartPos: { x: 2, y: 2 }, endPos: { x: 4, y: 1 }
    };
    for (const [x, y] of [[2, 0], [3, 0], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]]) layer.activeCells[y][x] = true;
    for (const [x, y] of [[2, 1], [2, 2], [3, 1], [3, 2], [3, 3]]) layer.hWalls[y][x] = wall(W.EMPTY);
    for (const [x, y] of [[1, 3], [2, 3]]) layer.vWalls[y][x] = wall(W.EMPTY);
    layer.hWalls[3][2] = wall(W.DOOR);
    layer.vWalls[3][3] = wall(W.LOCKED);
    layer.vWalls[0][3] = wall(W.ONE_WAY, { direction: { dx: 1, dy: 0 } });
    layer.vWalls[1][4] = wall(W.LETTER_DOOR, { letter: 'A', initialState: 'closed' });
    return normalizeVoidWalls(normalizeMapData({ width: 8, height: 8, editorMode: 'free',
        gameMode: 'death-loop', initialHealth: 5, multiLayerMode: false,
        layerCount: 1, layers: [layer], stairs: [] }));
}

export function verify() {
    const map = buildMap(), qa = auditMap(map), env = createReferenceEnvironment(map);
    assert.equal(qa.allResult.totalActions, 8);
    assert.equal(qa.count, '1');
    assert(qa.cold);
    assert(qa.entry?.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
    for (const { actions } of qa.routes) {
        let state = env.initialState();
        for (const action of actions) {
            state = env.step(state, action);
            assert.equal(state.layerStates[0].wallStates.v[3][3].type, W.LOCKED);
        }
        assert(state.isWon);
    }
    const ordinary = structuredClone(map);
    ordinary.layers[0].vWalls[3][3] = { type: W.DOOR, keys: 0 };
    const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
    const changed = solveReferenceMap(ordinary, budget), fastChanged = solveFastMap(ordinary, budget);
    assert.equal(changed.status, 'solved');
    assert.equal(fastChanged.status, 'solved');
    assert.equal(changed.solution.totalActions, 6);
    assert.equal(fastChanged.solution.totalActions, 6);
    const wrong = solveContinuation(map, ['D', 'R'], { ...budget, reference: true });
    assert.equal(wrong.status, 'proven_unsat');
    return { scope: 'mechanism_counterexample_not_challenge_or_human_playtest',
        humanQuality: null, qualityScore: null, map, qa,
        zeroConsumedOnAnyOptimal: false, ordinary: { reference: changed, fast: fastChanged },
        safeConsumedPrefix: wrong };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verify(), null, 2));
