import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls, GameLogic, actionFromName } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';

const budget = { nodeBudget: 1000000, stateBudget: 1000000, budgetMs: 30000 };
const at = (ghost, x, y) => ghost.x === x && ghost.y === y;

/** 从方格与元件表重建，不以分享码或参考解代替原图。 */
export function buildMap() {
    const wall = (type, keys = 0) => ({ type, keys });
    const activeCells = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) =>
        x >= 1 && x <= 4 && y >= 1 && y <= 5 && !(x === 1 && y === 1)));
    const layer = {
        activeCells,
        hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
        vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
        ghosts: [{ x: 2, y: 2, id: 0 }, { x: 3, y: 2, id: 1 }],
        items: [{ x: 2, y: 1, type: 'key' }],
        buttons: [{ x: 2, y: 3, letter: 'A', direction: { dx: 1, dy: 0 } }],
        customStartPos: { x: 1, y: 4 }, endPos: { x: 4, y: 1 }
    };
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 4; x++) {
        if (!activeCells[y][x]) continue;
        if (activeCells[y]?.[x + 1]) layer.vWalls[y][x + 1] = wall(W.EMPTY);
        if (activeCells[y + 1]?.[x]) layer.hWalls[y + 1][x] = wall(W.EMPTY);
    }
    layer.vWalls[3][3] = wall(W.SOLID);
    layer.hWalls[2][4] = wall(W.SOLID);
    layer.hWalls[3][1] = wall(W.DOOR);
    layer.hWalls[2][3] = wall(W.LOCKED, 1);
    for (const [x, y] of [[2, 3], [4, 1]]) layer.vWalls[y][x] = {
        type: W.LETTER_DOOR, keys: 0, letter: 'A', initialState: 'closed'
    };
    return normalizeVoidWalls(normalizeMapData({ width: 8, height: 8, editorMode: 'free',
        gameMode: 'death-loop', initialHealth: 5, multiLayerMode: false, layerCount: 1,
        layers: [layer], stairs: [] }));
}

/** 历史条件进入监控状态键；全部通关检验包含非最优与规则允许的重合。 */
export function analyzeMap(map) {
    const env = createReferenceEnvironment(map);
    const press = (before, action) => before.player.x === 2 && before.player.y === 3 && action === 'R';
    const specifications = [
        ['A-before-key', [0], (progress, before, action, next) => {
            const seen = progress[0] || Number(press(before, action));
            return next.player.keys && !seen ? null : [seen];
        }],
        ['never-left-in-right-room', [], (p, b, a, n) => n.layerStates[0].ghosts[0].x >= 3 ? null : p],
        ['never-right-in-corner', [], (p, b, a, n) => at(n.layerStates[0].ghosts[1], 1, 3) ? null : p],
        ['never-right-above-ordinary', [], (p, b, a, n) => at(n.layerStates[0].ghosts[1], 1, 2) ? null : p],
        ['upper-parking-before-key', [0], (p, b, a, n) => {
            const seen = p[0] || Number(!n.player.keys && at(n.layerStates[0].ghosts[1], 1, 2));
            return n.player.keys && !seen ? null : [seen];
        }],
        ['no-priority-conflict', [], (p, before, action) => {
            const diagnostics = [];
            GameLogic.calculateNextState(before, actionFromName(action), env.mapDefinition,
                { trails: false, visibility: false, ghostDiagnostics: diagnostics });
            return diagnostics.some(c => c.decision === 'visible_target_priority') ? null : p;
        }]
    ];
    const queries = specifications.map(([name, initial, advance]) => {
        const search = createBreadthFirstSearch(env, { monitor: { initial: () => initial, advance } });
        return { name, initial, result: search.run(budget), actions: search.firstActions() };
    });
    const counterexamples = [
        ['trap-nearest-first', ['R', 'L', 'U', 'U']],
        ['turn-into-east-room-first', ['R', 'R', 'R']]
    ].map(([name, prefix]) => ({ name, prefix,
        result: solveContinuation(map, prefix, { reference: true, nodeBudget: 1000000, budgetMs: 30000 }) }));
    const changes = [
        ['remove-key-and-threshold', m => { m.layers[0].items = []; m.layers[0].hWalls[2][3] = { type: W.EMPTY, keys: 0 }; }],
        ['ordinary-to-empty', m => m.layers[0].hWalls[3][1] = { type: W.EMPTY, keys: 0 }],
        ['ordinary-to-solid', m => m.layers[0].hWalls[3][1] = { type: W.SOLID, keys: 0 }],
        ['open-left-A', m => m.layers[0].vWalls[3][2] = { type: W.EMPTY, keys: 0 }],
        ['open-goal-A', m => m.layers[0].vWalls[1][4] = { type: W.EMPTY, keys: 0 }],
        ['remove-left-ghost', m => m.layers[0].ghosts.splice(0, 1)],
        ['remove-right-ghost', m => m.layers[0].ghosts.splice(1, 1)],
        ['middle-spine-to-empty', m => { m.layers[0].vWalls[3][3] = { type: W.EMPTY, keys: 0 }; m.layers[0].buttons = []; }]
    ];
    const reductions = changes.map(([name, change]) => {
        const altered = structuredClone(map); change(altered);
        const search = createBreadthFirstSearch(createReferenceEnvironment(altered));
        return { name, result: search.run(budget), actions: search.firstActions() };
    });
    return { queries, counterexamples, reductions };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const map = JSON.parse(fs.readFileSync(new URL('map.json', import.meta.url)));
    const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
    assert.deepEqual(buildMap(), map);
    // 入口接受活动格旁的空边，不代表作品允许把它当外墙；直接核对原图。
    const layer = map.layers[0];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (!layer.activeCells[y][x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (layer.activeCells[y + dy]?.[x + dx]) continue;
            const wall = layer[dx ? 'vWalls' : 'hWalls'][y + (dy === 1 ? 1 : 0)][x + (dx === 1 ? 1 : 0)];
            assert.equal(wall.type, W.SOLID, `活动区边界必须是墙：${x},${y},${dx},${dy}`);
        }
    }
    const qa = auditMap(map);
    assert.equal(qa.mapId, stored.qa.mapId);
    assert.equal(qa.ruleset, stored.qa.ruleset);
    assert.equal(qa.allResult.totalActions, 41);
    assert.equal(qa.count, '3');
    assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
    assert.deepEqual(qa.routes, stored.qa.routes);
    assert.deepEqual(qa.physicalAudit, stored.qa.physicalAudit);
    assert.equal(qa.noEndSafeRoutes, 3);
    const all = createBreadthFirstSearch(createReferenceEnvironment(map), { allOptimal: true, classifyState: ghostFrame });
    assert.equal(all.run(budget).status, 'solved');
    const groups = createTrajectoryGroups(all.optimalGraph());
    assert.equal(groups.run(budget).count, '3');
    assert.deepEqual([...groups.routes()], stored.grouping.routes);
    const analysis = analyzeMap(map);
    for (const field of ['queries', 'counterexamples', 'reductions']) for (const record of analysis[field]) {
        const old = stored.analysis[field].find(r => r.name === record.name);
        assert(old, record.name);
        assert.equal(record.result.status, old.result.status, record.name);
        if (field === 'reductions') assert.equal(record.result.totalActions, old.result.totalActions, record.name);
        if (field !== 'reductions') assert.equal(record.result.status, 'proven_unsat', record.name);
    }
    console.log(JSON.stringify({ title: '腾挪', N: 41, ghostTrajectories: 3, cold: qa.cold,
        boundary: qa.boundary.status, entry: qa.entry, physical: qa.physicalAudit,
        noEndSafe: qa.noEndSafeRoutes, humanQuality: null, gallerySelected: false }));
}
