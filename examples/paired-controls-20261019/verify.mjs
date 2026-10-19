import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';

const budget = { nodeBudget: 1000000, stateBudget: 1000000, budgetMs: 30000 };
const insideB = (s, a) => s.player.x === 3 && s.player.y === 4 && a === 'R';
const outsideB = (s, a) => s.player.x === 2 && s.player.y === 5 && a === 'D';
const pressA = (s, a) => s.player.x === 0 && s.player.y === 4 && a === 'L';
const onOutsideB = s => s.layerStates[0].ghosts.some(g => g.x === 2 && g.y === 5);
export const letterEdges = [['v', 2, 4], ['h', 3, 3], ['v', 3, 4], ['h', 3, 4], ['v', 4, 3], ['h', 3, 5]];
export const ordinaryEdges = [['h', 2, 5], ['v', 3, 0], ['v', 4, 0]];

/** 从声明的方格与边独立重建，不读取私人原型或参考动作。 */
export function buildMap() {
    const wall = (type, keys = 0) => ({ type, keys });
    const l = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) =>
            x <= 5 && y <= 5 && (x === 0 || x === 5 || y === 0 || y === 5 || x === 3 ||
                y === 4 && x <= 3 || x === 4 && y === 3))),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        buttons: [
            { x: 0, y: 4, letter: 'A', direction: { dx: -1, dy: 0 } },
            { x: 3, y: 4, letter: 'B', direction: { dx: 1, dy: 0 } },
            { x: 2, y: 5, letter: 'B', direction: { dx: 0, dy: 1 } }
        ],
        ghosts: [{ x: 1, y: 4, id: 0 }, { x: 3, y: 0, id: 1 }], items: [],
        customStartPos: { x: 2, y: 5 }, endPos: { x: 4, y: 3 }
    };
    for (let x = 1; x <= 5; x++) for (const y of [0, 5]) l.vWalls[y][x] = wall(W.EMPTY);
    for (let y = 1; y <= 5; y++) for (const x of [0, 3, 5]) l.hWalls[y][x] = wall(W.EMPTY);
    for (let x = 1; x <= 3; x++) l.vWalls[4][x] = wall(W.EMPTY);
    for (const [axis, x, y, letter, initialState] of [
        ['v', 2, 4, 'A', 'closed'], ['h', 3, 3, 'A', 'closed'],
        ['v', 3, 4, 'B', 'open'], ['h', 3, 4, 'B', 'open'],
        ['v', 4, 3, 'B', 'closed'], ['h', 3, 5, 'B', 'closed']
    ]) l[axis + 'Walls'][y][x] = { type: W.LETTER_DOOR, keys: 0, letter, initialState };
    l.vWalls[4][1] = wall(W.LOCKED);
    for (const [axis, x, y] of ordinaryEdges) l[axis + 'Walls'][y][x] = wall(W.DOOR);
    return normalizeVoidWalls(normalizeMapData({ width: 8, height: 8, editorMode: 'free',
        gameMode: 'death-loop', initialHealth: 5, multiLayerMode: false, layerCount: 1,
        layers: [l], stairs: [] }));
}

export function assertExterior(map) {
    const l = map.layers[0];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (!l.activeCells[y][x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (l.activeCells[y + dy]?.[x + dx]) continue;
            assert.equal(l[dx ? 'vWalls' : 'hWalls'][y + (dy === 1 ? 1 : 0)][x + (dx === 1 ? 1 : 0)].type,
                W.SOLID, `活动区边界${x},${y},${dx},${dy}`);
        }
    }
}

/** 查询含非最优及规则允许的重合；不是只限制所选参考。 */
export function analyzeMap(map) {
    const env = createReferenceEnvironment(map);
    const specs = [
        ['no-inside-B', [], (h, s, a) => insideB(s, a) ? null : h],
        ['no-outside-B', [], (h, s, a) => outsideB(s, a) ? null : h],
        ['at-most-one-inside-B', [0], (h, s, a) => insideB(s, a) ? h[0] ? null : [1] : h],
        ['no-outside-B-after-inside', [false], (h, s, a) => insideB(s, a) ? [true] : h[0] && outsideB(s, a) ? null : h],
        ['first-B-inside', [false], (h, s, a) => h[0] ? h : outsideB(s, a) ? null : insideB(s, a) ? [true] : h],
        ['never-occupy-outside-B', [], (h, s, a, n) => onOutsideB(n) ? null : h],
        ['no-B-with-outside-B-occupied', [], (h, s, a) => onOutsideB(s) && (insideB(s, a) || outsideB(s, a)) ? null : h],
        ['never-open-zero', [], (h, s, a, n) => n.layerStates[0].wallStates.v[4][1].type !== W.LOCKED ? null : h],
        ['A-at-most-one', [0], (h, s, a) => pressA(s, a) ? h[0] ? null : [1] : h],
        ['A-at-most-two', [0], (h, s, a) => pressA(s, a) ? h[0] === 2 ? null : [h[0] + 1] : h]
    ];
    const queries = specs.map(([name, initial, advance]) => {
        const q = createBreadthFirstSearch(env, { monitor: { initial: () => initial, advance } });
        return { name, result: q.run(budget), actions: q.firstActions() };
    });
    const changes = [
        ['zero-to-empty', m => m.layers[0].vWalls[4][1] = { type: W.EMPTY, keys: 0 }],
        ['zero-to-ordinary', m => m.layers[0].vWalls[4][1] = { type: W.DOOR, keys: 0 }],
        ['remove-left-ghost', m => m.layers[0].ghosts.splice(0, 1)],
        ['remove-upper-ghost', m => m.layers[0].ghosts.splice(1, 1)],
        ['remove-inside-B', m => m.layers[0].buttons.splice(1, 1)],
        ['remove-outside-B', m => m.layers[0].buttons.splice(2, 1)]
    ];
    for (let mask = 0; mask < 8; mask++) changes.push(['ordinary-mask-' + mask, m => {
        ordinaryEdges.forEach(([axis, x, y], i) => { if (mask & 1 << i) m.layers[0][axis + 'Walls'][y][x] = { type: W.EMPTY, keys: 0 }; });
    }]);
    for (const [axis, x, y] of ordinaryEdges) changes.push(['door-to-solid-' + [axis, x, y].join('-'),
        m => m.layers[0][axis + 'Walls'][y][x] = { type: W.SOLID, keys: 0 }]);
    for (let mask = 0; mask < 64; mask++) changes.push(['letter-mask-' + mask, m => {
        const l = m.layers[0];
        letterEdges.forEach(([axis, x, y], i) => { if (mask & 1 << i) l[axis + 'Walls'][y][x] = { type: W.EMPTY, keys: 0 }; });
        const pool = new Set(['h', 'v'].flatMap(axis => l[axis + 'Walls'].flat().filter(w => w.type === W.LETTER_DOOR).map(w => w.letter)));
        l.buttons = l.buttons.filter(b => pool.has(b.letter));
    }]);
    const reductions = changes.map(([name, change]) => {
        const changed = structuredClone(map); change(changed); assertExterior(changed);
        const q = createBreadthFirstSearch(createReferenceEnvironment(changed));
        const result = q.run(budget), record = { name, result, actions: q.firstActions() };
        if (result.status === 'solved') {
            record.boundary = auditPuzzleBoundaries(changed, budget);
            if (record.boundary.status === 'safe') record.queries = analyzeRoles(changed);
        }
        return record;
    });
    return { queries, reductions };
}

function analyzeRoles(map) {
    const env = createReferenceEnvironment(map);
    return [
        ['no-inside-B', [], (h, s, a) => insideB(s, a) ? null : h],
        ['A-at-most-two', [0], (h, s, a) => pressA(s, a) ? h[0] === 2 ? null : [h[0] + 1] : h],
        ['never-open-zero', [], (h, s, a, n) => n.layerStates[0].wallStates.v[4][1].type !== W.LOCKED ? null : h]
    ].map(([name, initial, advance]) => {
        const q = createBreadthFirstSearch(env, { monitor: { initial: () => initial, advance } });
        return { name, result: q.run(budget), actions: q.firstActions() };
    });
}

export function groupMap(map) {
    const q = createBreadthFirstSearch(createReferenceEnvironment(map), { allOptimal: true, classifyState: ghostFrame });
    assert.equal(q.run(budget).status, 'solved');
    const groups = createTrajectoryGroups(q.optimalGraph()), result = groups.run(budget);
    assert.equal(result.status, 'solved');
    return { ...result, routes: [...groups.routes()] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const map = JSON.parse(fs.readFileSync(new URL('map.json', import.meta.url)));
    const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
    assert.deepEqual(buildMap(), map); assertExterior(map);
    const qa = auditMap(map), grouping = groupMap(map), analysis = analyzeMap(map);
    assert.equal(qa.mapId, stored.qa.mapId); assert.equal(qa.ruleset, stored.qa.ruleset);
    assert.equal(qa.allResult.totalActions, 58); assert.equal(qa.count, '6');
    assert.equal(grouping.count, '1'); assert.deepEqual(grouping.routes, stored.grouping.routes);
    assert.deepEqual(qa.routes, stored.qa.routes); assert.deepEqual(qa.physicalAudit, stored.qa.physicalAudit);
    assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
    assert.equal(qa.noEndSafeRoutes, 6);
    for (const field of ['queries', 'reductions']) for (const fresh of analysis[field]) {
        const old = stored.analysis[field].find(r => r.name === fresh.name); assert(old, fresh.name);
        assert.notEqual(fresh.result.status, 'unknown', fresh.name);
        assert.equal(fresh.result.status, old.result.status, fresh.name);
        assert.equal(fresh.result.totalActions, old.result.totalActions, fresh.name);
        assert.deepEqual(fresh.actions, old.actions, fresh.name);
        assert.equal(fresh.boundary?.status, old.boundary?.status, fresh.name);
        if (fresh.queries) for (let i = 0; i < fresh.queries.length; i++) {
            assert.equal(fresh.queries[i].result.status, old.queries[i].result.status, fresh.name);
            assert.equal(fresh.queries[i].result.totalActions, old.queries[i].result.totalActions, fresh.name);
        }
    }
    console.log(JSON.stringify({ title: '同调', N: 58, rawOptimalRoutes: 6, ghostTrajectories: 1,
        cold: qa.cold, entry: qa.entry, noEndSafeRoutes: qa.noEndSafeRoutes, physicalAudit: qa.physicalAudit,
        humanQuality: null, gallerySelected: false }));
}
