import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, GameLogic, actionFromName, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';

const budget = { nodeBudget: 1000000, stateBudget: 1000000, budgetMs: 30000 };
export const outerWalls = [['h', 1, 1], ['h', 3, 4], ['v', 4, 1], ['v', 1, 3], ['h', 2, 1]];
const goalWalls = [['h', 2, 2], ['h', 2, 3], ['v', 2, 2]];

/** 直接从方格、实墙和数字门重建，不读取原型、开场配置或参考路线。 */
export function buildMap() {
    const wall = (type, keys = 0) => ({ type, keys });
    const l = {
        activeCells: Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => x < 5 && y < 5)),
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        buttons: [], items: [{ x: 2, y: 1, type: 'key' }],
        ghosts: [{ x: 1, y: 1, id: 0 }, { x: 3, y: 1, id: 1 }, { x: 1, y: 3, id: 2 }],
        customStartPos: { x: 3, y: 2 }, endPos: { x: 2, y: 2 }
    };
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        if (x < 4) l.vWalls[y][x + 1] = wall(W.EMPTY);
        if (y < 4) l.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    for (const [axis, x, y] of [...outerWalls, ...goalWalls]) l[axis + 'Walls'][y][x] = wall(W.SOLID);
    l.hWalls[2][3] = wall(W.LOCKED);
    l.vWalls[2][3] = wall(W.LOCKED, 1);
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
            assert.equal(l[dx ? 'vWalls' : 'hWalls'][y + (dy === 1 ? 1 : 0)][x + (dx === 1 ? 1 : 0)].type, W.SOLID);
        }
    }
}

const hasPriority = (env, s, a) => {
    const diagnostics = [];
    GameLogic.calculateNextState(s, actionFromName(a), env.mapDefinition,
        { trails: false, visibility: false, ghostDiagnostics: diagnostics });
    return diagnostics.some(d => d.decision === 'visible_target_priority');
};
const orders = a => !a.length ? [[]] : a.flatMap((v, i) => orders(a.filter((_, j) => i !== j)).map(tail => [v, ...tail]));

/** 全解查询含非最优合法重合；不以参考中的顺序作为游戏限制。 */
export function analyzeMap(map) {
    const env = createReferenceEnvironment(map);
    const specs = [
        ['never-priority', (h, s, a) => hasPriority(env, s, a) ? null : h],
        ['no-priority-after-key', (h, s, a) => s.player.keys && hasPriority(env, s, a) ? null : h],
        ['never-open-zero', (h, s, a, n) => n.layerStates[0].wallStates.h[2][3].type !== W.LOCKED ? null : h]
    ];
    for (let i = 0; i < 3; i++) specs.push(['never-move-ghost-' + i, (h, s, a, n) =>
        s.layerStates[0].ghosts[i].x !== n.layerStates[0].ghosts[i].x ||
        s.layerStates[0].ghosts[i].y !== n.layerStates[0].ghosts[i].y ? null : h]);
    const queries = specs.map(([name, advance]) => {
        const q = createBreadthFirstSearch(env, { monitor: { initial: () => [], advance } });
        return { name, result: q.run(budget), actions: q.firstActions() };
    });
    const sequential = orders([0, 1, 2]).map(order => {
        const rank = new Map(order.map((g, i) => [g, i]));
        const q = createBreadthFirstSearch(env, { monitor: { initial: () => [0], advance: (h, s, a, n) => {
            const moved = s.layerStates[0].ghosts.map((g, i) =>
                g.x !== n.layerStates[0].ghosts[i].x || g.y !== n.layerStates[0].ghosts[i].y ? rank.get(i) : null).filter(i => i !== null);
            if (!moved.length) return h;
            return Math.min(...moved) < h[0] ? null : [Math.max(...moved)];
        } } });
        return { order, result: q.run(budget), actions: q.firstActions(),
            scope: '先完成一鬼再启动下一鬼，允许交接同一步；不包含长时间共同移动的队列，不作趣味标签' };
    });
    const changes = [
        ['zero-empty', m => m.layers[0].hWalls[2][3] = { type: W.EMPTY, keys: 0 }],
        ['zero-solid', m => m.layers[0].hWalls[2][3] = { type: W.SOLID, keys: 0 }],
        ['zero-ordinary', m => m.layers[0].hWalls[2][3] = { type: W.DOOR, keys: 0 }],
        ['remove-key-task', m => { m.layers[0].items = []; m.layers[0].vWalls[2][3] = { type: W.EMPTY, keys: 0 }; }]
    ];
    for (let i = 0; i < 3; i++) changes.push(['remove-ghost-' + i, m => m.layers[0].ghosts.splice(i, 1)]);
    for (const [axis, x, y] of goalWalls) changes.push(['open-goal-wall-' + [axis, x, y].join('-'),
        m => m.layers[0][axis + 'Walls'][y][x] = { type: W.EMPTY, keys: 0 }]);
    for (let mask = 0; mask < 32; mask++) changes.push(['outer-wall-mask-' + mask, m => {
        outerWalls.forEach(([axis, x, y], i) => { if (mask & 1 << i) m.layers[0][axis + 'Walls'][y][x] = { type: W.EMPTY, keys: 0 }; });
    }]);
    const l = map.layers[0];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        if (l.ghosts.some(g => g.x === x && g.y === y) || l.customStartPos.x === x && l.customStartPos.y === y ||
            l.endPos.x === x && l.endPos.y === y) continue;
        changes.push(['key-at-' + x + '-' + y, m => m.layers[0].items = [{ x, y, type: 'key' }]]);
    }
    const reductions = changes.map(([name, change]) => {
        const changed = structuredClone(map); change(changed); assertExterior(changed);
        const q = createBreadthFirstSearch(createReferenceEnvironment(changed)), result = q.run(budget);
        const record = { name, result, actions: q.firstActions() };
        if (result.status === 'solved') record.boundary = auditPuzzleBoundaries(changed, budget);
        return record;
    });
    const empty = structuredClone(map); empty.layers[0].hWalls[2][3] = { type: W.EMPTY, keys: 0 };
    const emptyColdStarts = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        if (l.ghosts.some(g => g.x === x && g.y === y) || l.items.some(k => k.x === x && k.y === y) || l.endPos.x === x && l.endPos.y === y) continue;
        const changed = structuredClone(empty); changed.layers[0].customStartPos = { x, y };
        const e = createReferenceEnvironment(changed), s = e.initialState();
        const cold = l.ghosts.every(g => !GameLogic._canGhostSeePlayer(g, s.player, e.mapDefinition.layers[0], s.layerStates[0]));
        const row = { start: [x, y], cold };
        if (cold) { const q = createBreadthFirstSearch(e); row.result = q.run(budget); row.actions = q.firstActions(); }
        emptyColdStarts.push(row);
    }
    // 一条实际安全却无后路的提前取物计划；不声称是玩家实际尝试。
    const wrongPrefix = ['D', 'U', 'R', 'D', 'L', 'L', 'L', 'D', 'L', 'U', 'U', 'R', 'U', 'L', 'U', 'R', 'R', 'R', 'D', 'L'];
    let state = env.initialState();
    for (const a of wrongPrefix) {
        const n = env.step(state, a); assert.notEqual(n, state); assert(!n.isDead);
        assert.equal(new Set(n.layerStates[0].ghosts.map(g => `${g.x},${g.y}`)).size, 3); state = n;
    }
    const plans = [
        { name: 'before-early-key', prefix: wrongPrefix.slice(0, -1) },
        { name: 'early-key', prefix: wrongPrefix },
        { name: 'leave-instead-of-early-key', prefix: [...wrongPrefix.slice(0, -1), 'D'] }
    ].map(row => ({ ...row, result: solveContinuation(map, row.prefix, { reference: true, nodeBudget: 1000000, budgetMs: 30000 }) }));
    return { queries, sequential, reductions, emptyColdStarts, plans };
}

export function groupMap(map) {
    const q = createBreadthFirstSearch(createReferenceEnvironment(map), { allOptimal: true, classifyState: ghostFrame });
    assert.equal(q.run(budget).status, 'solved');
    const g = createTrajectoryGroups(q.optimalGraph()), result = g.run(budget); assert.equal(result.status, 'solved');
    return { ...result, routes: [...g.routes()] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const map = JSON.parse(fs.readFileSync(new URL('map.json', import.meta.url)));
    const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
    assert.deepEqual(buildMap(), map); assertExterior(map);
    const qa = auditMap(map), grouping = groupMap(map), analysis = analyzeMap(map);
    assert.equal(qa.mapId, stored.qa.mapId); assert.equal(qa.ruleset, stored.qa.ruleset);
    assert.equal(qa.allResult.totalActions, 39); assert.equal(qa.count, stored.qa.count);
    assert.deepEqual(qa.routes, stored.qa.routes); assert.deepEqual(qa.physicalAudit, stored.qa.physicalAudit);
    assert.deepEqual(grouping.routes, stored.grouping.routes); assert.equal(grouping.count, stored.grouping.count);
    assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
    assert.equal(qa.noEndSafeRoutes, Number(qa.count));
    for (const field of ['queries', 'sequential', 'reductions', 'emptyColdStarts', 'plans']) {
        assert.equal(analysis[field].length, stored.analysis[field].length, field);
        analysis[field].forEach((fresh, i) => {
            const old = stored.analysis[field][i]; assert.equal(fresh.name, old.name);
            assert.deepEqual(fresh.order, old.order);
            assert.deepEqual(fresh.start, old.start); assert.equal(fresh.cold, old.cold);
            assert.deepEqual(fresh.prefix, old.prefix);
            assert.equal(fresh.result?.status, old.result?.status, fresh.name ?? field);
            assert.notEqual(fresh.result?.status, 'unknown');
            assert.equal(fresh.result?.totalActions, old.result?.totalActions, fresh.name ?? field);
            assert.deepEqual(fresh.actions, old.actions, fresh.name ?? field);
            assert.equal(fresh.boundary?.status, old.boundary?.status, fresh.name ?? field);
        });
    }
    console.log(JSON.stringify({ title: '留隙', N: 39, rawOptimalRoutes: qa.count, ghostTrajectories: grouping.count,
        cold: qa.cold, entry: qa.entry, noEndSafeRoutes: qa.noEndSafeRoutes, physicalAudit: qa.physicalAudit,
        humanQuality: null, gallerySelected: false }));
}
