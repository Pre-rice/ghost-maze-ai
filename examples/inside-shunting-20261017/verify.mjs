import fs from 'node:fs';
import assert from 'node:assert/strict';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';

const map = JSON.parse(fs.readFileSync(new URL('map.json', import.meta.url)));
const stored = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
const qa = auditMap(map), env = createReferenceEnvironment(map);
assert.equal(qa.mapId, stored.qa.mapId);
assert.equal(qa.ruleset, stored.qa.ruleset);
assert.equal(qa.allResult.totalActions, 50);
assert.equal(qa.count, '1');
assert(qa.cold && qa.entry?.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
assert.deepEqual(qa.routes, stored.qa.routes);
assert.deepEqual(qa.physicalAudit, stored.qa.physicalAudit);
const inside = state => state.player.x >= 2 && state.player.x <= 4 && state.player.y >= 2 && state.player.y <= 4;
for (const route of qa.routes) {
    assert(route.trace.every(t => t.ghosts.flat().every(g => g[0] >= 2 && g[0] <= 4 && g[1] >= 2 && g[1] <= 4)));
    assert(route.trace.every(t => t.diagnostics.length === 0));
}
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
const queries = [
    ['atMostOneExit', [0], (p, before, action, next) => {
        const exits = p[0] + Number(inside(before) && !inside(next));
        return exits > 1 ? null : [exits];
    }, 'proven_unsat'],
    ['withoutRightGhostUpInside', [], (p, before, action, next) =>
        inside(next) && next.layerStates[0].ghosts[2].y < before.layerStates[0].ghosts[2].y ? null : p, 'proven_unsat'],
    ['withoutLeftGhostRightInside', [], (p, before, action, next) =>
        inside(next) && next.layerStates[0].ghosts[0].x > before.layerStates[0].ghosts[0].x ? null : p, 'proven_unsat'],
    ['withoutEastExit', [], (p, before, action, next) =>
        inside(before) && !inside(next) && next.player.x === 5 && next.player.y === 2 ? null : p, 'solved'],
    ['withoutSouthExit', [], (p, before, action, next) =>
        inside(before) && !inside(next) && next.player.x === 4 && next.player.y === 5 ? null : p, 'solved']
];
for (const [name, initial, advance, status] of queries) {
    const search = createBreadthFirstSearch(env, { monitor: { initial: () => initial, advance } });
    const result = search.run(budget);
    assert.equal(result.status, status, name);
    assert.equal(result.status, stored.queries[name].result.status);
    if (result.status === 'solved') assert(env.replay(search.firstActions()).state.isWon);
}
for (const prefix of [['R', 'L', 'L'], ['U', 'L', 'L', 'U', 'U', 'U', 'U']]) {
    assert.equal(solveContinuation(map, prefix, { reference: true, nodeBudget: 100000, budgetMs: 10000 }).status, 'proven_unsat');
}
for (let i = 0; i < 4; i++) {
    const changed = structuredClone(map);
    changed.layers[0].buttons.splice(i, 1);
    const result = solveReferenceMap(changed, budget);
    assert.equal(result.status, i === 3 ? 'solved' : 'proven_unsat');
    if (i === 3) assert.equal(result.solution.totalActions, 60);
}
console.log(JSON.stringify({ title: '调度', N: 50, count: qa.count, boundary: qa.boundary.status,
    cold: qa.cold, entry: qa.entry, physical: qa.physicalAudit, noEndSafe: qa.noEndSafeRoutes,
    status: 'physical_QA_not_human_quality' }));
