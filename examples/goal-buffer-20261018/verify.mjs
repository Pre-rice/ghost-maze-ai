import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';

const budget = { nodeBudget: 1000000, stateBudget: 1000000, budgetMs: 30000 };
const leftA = (s, a) => s.player.x === 1 && s.player.y === 2 && a === 'L';
const rightA = (s, a) => s.player.x === 6 && s.player.y === 1 && a === 'U';
const B = (s, a) => s.player.x === 1 && s.player.y === 2 && a === 'D';

/** 从方格和元件独立重建；不读取搜索原稿或参考路线。 */
export function buildMap() {
    const wall = type => ({ type, keys: 0 });
    const l = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) =>
            x >= 1 && x <= 7 && y >= 1 && y <= 3)),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        buttons: [
            { x: 1, y: 2, letter: 'A', direction: { dx: -1, dy: 0 } },
            { x: 1, y: 2, letter: 'B', direction: { dx: 0, dy: 1 } },
            { x: 6, y: 1, letter: 'A', direction: { dx: 0, dy: -1 } }
        ],
        items: [], ghosts: [{ x: 4, y: 2, id: 0 }, { x: 4, y: 1, id: 1 }],
        customStartPos: { x: 2, y: 3 }, endPos: { x: 5, y: 1 }
    };
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 7; x++) {
        if (x < 7) l.vWalls[y][x + 1] = wall(W.EMPTY);
        if (y < 3) l.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    for (const x of [2, 3, 4, 5]) l.hWalls[2][x] = wall(W.SOLID);
    for (const x of [1, 6]) l.hWalls[3][x] = wall(W.SOLID);
    l.hWalls[2][1] = wall(W.DOOR);
    for (const [axis, x, y, letter, initialState] of [
        ['v', 3, 1, 'B', 'closed'], ['v', 4, 1, 'A', 'closed'],
        ['v', 6, 1, 'A', 'open'], ['h', 6, 2, 'A', 'open'],
        ['v', 6, 2, 'A', 'open'], ['v', 7, 2, 'A', 'open']
    ]) l[axis + 'Walls'][y][x] = { type: W.LETTER_DOOR, keys: 0, letter, initialState };
    return normalizeVoidWalls(normalizeMapData({ width: 8, height: 8, editorMode: 'free',
        gameMode: 'death-loop', initialHealth: 5, multiLayerMode: false, layerCount: 1,
        layers: [l], stairs: [] }));
}

/** 原图监控包含非最优、允许合法重合的全部无伤无复活通关。 */
export function analyzeMap(map) {
    const env = createReferenceEnvironment(map);
    const specs = [
        ['never-on-goal', [], (p, b, a, n) => n.layerStates[0].ghosts.some(g => g.x === 5 && g.y === 1) ? null : p],
        ['never-stop-on-goal', [], (p, b, a, n) => n.layerStates[0].ghosts.some((g, i) =>
            g.x === 5 && g.y === 1 && b.layerStates[0].ghosts[i].x === 5 && b.layerStates[0].ghosts[i].y === 1) ? null : p],
        ['first-A-at-left', [false], (p, s, a) => p[0] ? p : rightA(s, a) ? null : leftA(s, a) ? [true] : p],
        ['no-left-A', [], (p, s, a) => leftA(s, a) ? null : p],
        ['no-right-A', [], (p, s, a) => rightA(s, a) ? null : p],
        ['at-most-one-B', [0], (p, s, a) => B(s, a) ? p[0] ? null : [1] : p],
        ['left-A-before-any-B', [false], (p, s, a) => leftA(s, a) ? [true] : B(s, a) && !p[0] ? null : p],
        ['no-A-with-upper-ghost-in-left-chamber', [], (p, s, a) =>
            leftA(s, a) && s.layerStates[0].ghosts[1].x <= 3 ? null : p],
        ['no-B-after-first-left-A', [false], (p, s, a) => leftA(s, a) ? [true] : B(s, a) && p[0] ? null : p]
    ];
    const queries = specs.map(([name, initial, advance]) => {
        const search = createBreadthFirstSearch(env, { monitor: { initial: () => initial, advance } });
        return { name, result: search.run(budget), actions: search.firstActions() };
    });
    const alternatives = [
        ['nearest-control-first', ['U', 'L']],
        ['release-A-before-moving-upper-ghost', ['U', 'D', 'R', 'U', 'R', 'R', 'R', 'U', 'U',
            'R', 'D', 'D', 'L', 'L', 'U', 'L', 'L', 'L', 'L', 'L']],
        ['finish-B-before-A', ['U', 'D', 'R', 'U', 'R', 'R', 'R', 'U', 'U',
            'R', 'D', 'D', 'L', 'L', 'U', 'L', 'L', 'L', 'L', 'D', 'U', 'D', 'D', 'L']]
    ].map(([name, prefix]) => ({ name, prefix,
        result: solveContinuation(map, prefix, { reference: true, nodeBudget: 1000000, budgetMs: 30000 }) }));
    const changes = [
        ['ordinary-to-empty', m => m.layers[0].hWalls[2][1] = { type: W.EMPTY, keys: 0 }],
        ['ordinary-to-solid', m => m.layers[0].hWalls[2][1] = { type: W.SOLID, keys: 0 }],
        ['remove-goal-side-A', m => m.layers[0].vWalls[1][4] = { type: W.EMPTY, keys: 0 }],
        ['remove-left-ghost', m => m.layers[0].ghosts.splice(0, 1)],
        ['remove-upper-ghost', m => m.layers[0].ghosts.splice(1, 1)]
    ];
    const reductions = changes.map(([name, change]) => {
        const altered = structuredClone(map); change(altered);
        const q = createBreadthFirstSearch(createReferenceEnvironment(altered), { allOptimal: true });
        const result = q.run(budget);
        const noEnd = structuredClone(altered); noEnd.layers[0].endPos = null;
        const safe = createReferenceEnvironment(noEnd);
        let rawRoutes = 0, noEndSafe = 0;
        if (result.status === 'solved') for (const actions of q.routes()) {
            rawRoutes++;
            try { safe.replay(actions); noEndSafe++; } catch { /* 保留真实不安全计数。 */ }
        }
        const noBAfterA = createBreadthFirstSearch(createReferenceEnvironment(altered), { monitor: {
            initial: () => [false],
            advance: (p, s, a) => leftA(s, a) ? [true] : B(s, a) && p[0] ? null : p
        } });
        return { name, result, actions: q.firstActions(), rawRoutes, noEndSafe,
            noBAfterA: { result: noBAfterA.run(budget), actions: noBAfterA.firstActions() } };
    });
    return { queries, alternatives, reductions };
}

export function assertExteriorWalls(map) {
    const l = map.layers[0];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (!l.activeCells[y][x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (l.activeCells[y + dy]?.[x + dx]) continue;
            assert.equal(l[dx ? 'vWalls' : 'hWalls'][y + (dy === 1 ? 1 : 0)][x + (dx === 1 ? 1 : 0)].type,
                W.SOLID, `活动区边界：${x},${y},${dx},${dy}`);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const map = JSON.parse(fs.readFileSync(new URL('map.json', import.meta.url)));
    const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
    assert.deepEqual(buildMap(), map); assertExteriorWalls(map);
    const qa = auditMap(map);
    assert.equal(qa.mapId, stored.qa.mapId); assert.equal(qa.ruleset, stored.qa.ruleset);
    assert.equal(qa.allResult.totalActions, 33); assert.equal(qa.count, '36');
    assert.deepEqual(qa.routes, stored.qa.routes); assert.deepEqual(qa.physicalAudit, stored.qa.physicalAudit);
    assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
    assert.equal(qa.noEndSafeRoutes, 36);
    const all = createBreadthFirstSearch(createReferenceEnvironment(map), { allOptimal: true, classifyState: ghostFrame });
    assert.equal(all.run(budget).status, 'solved');
    const groups = createTrajectoryGroups(all.optimalGraph()); assert.equal(groups.run(budget).count, '9');
    assert.deepEqual([...groups.routes()], stored.grouping.routes);
    const fresh = analyzeMap(map);
    for (const field of ['queries', 'alternatives', 'reductions']) for (const row of fresh[field]) {
        const old = stored.analysis[field].find(r => r.name === row.name); assert(old, row.name);
        assert.equal(row.result.status, old.result.status, row.name);
        if (field === 'reductions') {
            assert.equal(row.result.totalActions, old.result.totalActions, row.name);
            assert.equal(row.noEndSafe, old.noEndSafe, row.name);
            assert.equal(row.noBAfterA.result.status, old.noBAfterA.result.status, row.name);
        } else if (field === 'queries') assert.equal(row.result.status, 'proven_unsat', row.name);
        else assert.deepEqual(row.result.actions, old.result.actions, row.name);
    }
    console.log(JSON.stringify({ title: '寄存', N: 33, rawOptimalRoutes: 36, ghostTrajectories: 9,
        boundary: qa.boundary.status, cold: qa.cold, entry: qa.entry, noEndSafe: 36,
        physicalAudit: qa.physicalAudit, humanQuality: null, gallerySelected: false }));
}
