import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { DataSerializer } from '../../../../src/reference/engine.js';
import { auditPuzzleBoundaries } from '../../../../src/design/rule-boundaries.js';
import { inspectGhostInfluence } from '../../../../src/design/ghost-influence.js';
import { createBreadthFirstSearch } from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import { ghostFrame } from '../../../../../ghost-maze/src/solver/trajectoryGroups.js';

const read = name => JSON.parse(fs.readFileSync(new URL(name + '.json', import.meta.url)));
const budget = { nodeBudget: 750000, stateBudget: 750000, budgetMs: 30000 };

function verify(record, queries = []) {
    const env = createReferenceEnvironment(record.map);
    assert.equal(env.mapId, record.mapId);
    assert.equal(DataSerializer.generateShareCode(record.map).code, record.mapCode);
    const withoutGoal = structuredClone(record.map);
    withoutGoal.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(withoutGoal);
    const search = createBreadthFirstSearch(env, { allOptimal: true });
    const result = search.run(budget);
    assert.equal(result.status, record.result.status);
    assert.equal(result.totalActions, record.result.totalActions);
    assert.equal(search.routeCount().toString(), record.count);
    if (result.status === 'proven_unsat') return [];
    assert.equal(result.status, 'solved');
    assert.equal(auditPuzzleBoundaries(record.map, budget).status, record.boundary.status);
    let safe = 0;
    const routes = [];
    for (const actions of search.routes()) {
        let state = noEnd.initialState();
        const frames = [ghostFrame(state)];
        for (const action of actions) {
            const next = noEnd.step(state, action);
            assert.notEqual(next, state);
            state = next;
            frames.push(ghostFrame(state));
            if (state.isDead) break;
        }
        if (!state.isDead) safe++;
        routes.push(JSON.stringify([actions, frames]));
    }
    assert.equal(safe, record.noEndSafeRoutes);
    for (const row of queries) {
        const mode = row.mode ?? row.name;
        assert.ok(['never_cross_exit', 'never_cross_arrow', 'no_actual_influence'].includes(mode));
        const query = createBreadthFirstSearch(env, { monitor: {
            initial: () => [],
            advance(history, before, action, after) {
                if (after.isWon && noEnd.step(before, action).isDead) return null;
                if (mode === 'no_actual_influence') {
                    if (inspectGhostInfluence(env, before, action, after).kind !== 'none') return null;
                } else if (before.player.x === 2 && before.player.y === 3 && action === 'D') return null;
                return history;
            }
        } });
        const checked = query.run(budget);
        assert.equal(checked.status, row.result.status);
        assert.equal(checked.totalActions, row.result.totalActions);
    }
    return routes.sort();
}

for (const name of ['prototype', 'guard-offset', 'goal-recess', 'key-return', 'separated-resource']) {
    verify(read(name), name === 'goal-recess' ? read('complete-plans').rows : []);
}
const rows = read('trimmed-resource').rows;
const routes = rows.map(row => verify(row, row.queries));
assert.equal(routes[0].length, 2);
assert.deepEqual(routes[0], routes[1]);
console.log('五张原稿及四种收边对照通过；两条34步走法及逐步鬼位完全相同。');
