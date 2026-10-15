import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createReferenceEnvironment } from '../src/reference/environment.js';
import { hasGhostOverlap } from '../src/training/planning-graph.js';

const [input, output] = process.argv.slice(2);
if (!output) throw new Error('用法：node scripts/verify-parked-routes.mjs <路线jsonl> <新报告>');
assert(!existsSync(output), '不覆盖旧报告');
const bytes = readFileSync(input), sha = content => createHash('sha256').update(content).digest('hex');
const read = path => JSON.parse(readFileSync(path));
const point = ghost => `${ghost.x},${ghost.y}`;
const routes = bytes.toString('utf8').trim().split('\n').map(JSON.parse);
const datasets = new Map(), maps = new Map(), uniqueRoutes = new Set();
let reached = 0, optimal = 0, actions = 0;

for (const route of routes) {
    if (!datasets.has(route.dataset)) {
        const manifest = read(route.dataset + '/manifest.json');
        for (const [file, expected] of Object.entries(manifest.files)) {
            assert.equal(sha(readFileSync(route.dataset + '/' + file)), expected);
        }
        datasets.set(route.dataset, new Map(manifest.tasks.map(task => [task.taskId, task])));
    }
    const task = datasets.get(route.dataset).get(route.taskId);
    assert(task);
    assert.equal(task.mapId, route.mapId);
    if (!maps.has(task.mapId)) {
        const env = createReferenceEnvironment(read(route.dataset + '/maps/' + task.mapId + '.json'));
        assert.equal(env.mapId, task.mapId);
        assert.equal(env.mapDefinition.layerCount, 1);
        maps.set(task.mapId, env);
    }
    const env = maps.get(task.mapId);
    const target = task.goal.map(point).sort().join(';');
    const isGoal = state => state.layerStates[0].ghosts.map(point).sort().join(';') === target;
    let state = env.initialState(), vacated = false, moved = false;
    const anchorIndex = state.layerStates[0].ghosts.findIndex(ghost => point(ghost) === task.anchor);
    assert(anchorIndex >= 0);
    for (const action of route.actions) {
        assert(!state.isDead && !state.isWon && !isGoal(state), '任务结束后不能继续动作');
        const next = env.step(state, action);
        assert.notEqual(next, state);
        assert(!next.isDead);
        assert(!hasGhostOverlap(next));
        assert(!next.isWon || isGoal(next), '原游戏提前结束不算任务可用动作');
        state = next;
        vacated ||= !state.layerStates[0].ghosts.some(ghost => point(ghost) === task.anchor);
        moved ||= point(state.layerStates[0].ghosts[anchorIndex]) !== task.anchor;
        actions++;
    }
    const goalReached = isGoal(state);
    const optimalToGoal = goalReached && route.actions.length === task.shortest;
    assert.equal(goalReached, route.goalReached);
    assert.equal(optimalToGoal, route.optimalToGoal);
    assert.equal(vacated, route.vacatedAnchor);
    assert.equal(moved, route.movedOriginal);
    if (optimalToGoal) assert(task.kind === 'must_vacate' ? vacated : !moved);
    reached += Number(goalReached);
    optimal += Number(optimalToGoal);
    uniqueRoutes.add(JSON.stringify([route.taskId, route.actions]));
}

const result = {
    role: 'native_given_goal_route_QA_not_game_victory_or_quality',
    inputSha256: sha(bytes), routes: routes.length, uniqueRoutes: uniqueRoutes.size,
    maps: maps.size, actions, goalReached: reached, optimalToGivenGoal: optimal,
    includesFailedPrefixes: true, allPassed: true,
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
