import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { DataSerializer, ReplaySerializer, normalizeVoidWalls, validateMapData } from '../../src/reference/engine.js';
import { createSearchEnvironment } from '../../../ghost-maze/src/solver/searchEnvironment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';

const map = JSON.parse(readFileSync(new URL('./map.json', import.meta.url)));
const evidence = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url)));
const budget = { nodeBudget: 150000, stateBudget: 150000, budgetMs: 30000 };
const env = createSearchEnvironment(map), fast = solveFastMap(map, budget), reference = solveReferenceMap(map, budget);
assert.equal(fast.optimality, 'proven'); assert.equal(reference.optimality, 'proven');
assert.equal(fast.solution.totalActions, 26); assert.equal(reference.solution.totalActions, 26);
assert.equal(evidence.fast.solution.totalActions, 26);
const search = createBreadthFirstSearch(env, { allOptimal: true });
assert.equal(search.run(budget).status, 'solved'); assert.equal(search.routeCount(), 1n);
const routes = [...search.routes()];
const withoutEnd = structuredClone(map); withoutEnd.layers[1].endPos = null;
const noEndEnv = createReferenceEnvironment(withoutEnd);
for (const actions of routes) {
    assert(!noEndEnv.replay(actions).state.isDead);
    let state = env.initialState(), up = 0, down = 0;
    for (const action of actions) {
        const next = env.step(state, action), diff = next.layerStates[1].ghosts.length - state.layerStates[1].ghosts.length;
        up += Math.max(0, diff); down += Math.max(0, -diff);
        if (action === 'STAIR') for (const g of next.layerStates[next.player.layer].ghosts)
            assert(Math.abs(g.x - next.player.x) + Math.abs(g.y - next.player.y) >= 2, '不利用新层相邻鬼的延迟移动');
        state = next;
    }
    assert.equal(up, 1); assert.equal(down, 2);
}
// 监控事件次数进入历史键：证明任何通关都不能只搬运一次或两次。
for (let max = 0; max <= 2; max++) {
    const monitor = { initial: () => [0], advance(progress, before, _action, after) {
        const count = progress[0] + Math.abs(after.layerStates[1].ghosts.length - before.layerStates[1].ghosts.length);
        return count > max ? null : [count];
    } };
    assert.equal(createBreadthFirstSearch(env, { monitor }).run(budget).status, 'proven_unsat');
}
assert.equal(auditPuzzleBoundaries(map, { nodeBudget: 150000, budgetMs: 30000 }).status, 'safe');
const checked = validateMapData(map); assert(checked.valid);
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
assert.deepEqual(DataSerializer.loadFromShareCode(encoded.code).data.mapData, map);
const route = ReplaySerializer.generateShareCode(map, fast.solution.actions); assert(route.success);
assert.deepEqual(ReplaySerializer.loadFromShareCode(map, route.code).actions, fast.solution.actions);
const first = env.initialState();
for (const action of env.actions) {
    const next = env.step(first, action); if (next === first) continue;
    assert(!next.isDead); assert.deepEqual(next.layerStates.map(l => l.ghosts), first.layerStates.map(l => l.ghosts));
}
// 指定从下层左侧普通入口实际进入，不改变单元物理状态。
const entry = structuredClone(map); entry.layers[0].activeCells[4][1] = true;
entry.layers[0].vWalls[4][2] = { type: 4, keys: 0, direction: { dx: 1, dy: 0 } };
entry.layers[0].customStartPos = { x: 1, y: 4 };
const entryEnv = createSearchEnvironment(entry), entered = entryEnv.step(entryEnv.initialState(), 'R');
const unitProjection = state => JSON.stringify({ player: [state.player.layer, state.player.x, state.player.y, state.player.hp, state.player.keys],
    ghosts: state.layerStates.map(l => l.ghosts), items: state.layerStates.map(l => l.items), dead: state.isDead, won: state.isWon,
    walls: state.layerStates.map((l, li) => Object.fromEntries(['h', 'v'].map(axis => [axis,
        l.wallStates[axis].flatMap((row, y) => row.flatMap((w, x) => {
            const active = map.layers[li].activeCells;
            return active[y]?.[x] && (axis === 'h' ? active[y - 1]?.[x] : active[y]?.[x - 1]) ? [[x, y, w]] : [];
        }))]))) });
assert.equal(unitProjection(entered), unitProjection(first));
let actual = entered, unit = first;
for (const action of fast.solution.actions) { actual = entryEnv.step(actual, action); unit = env.step(unit, action); assert.equal(unitProjection(actual), unitProjection(unit)); }
const contrasts = [];
for (const [li, layer] of map.layers.entries()) {
    for (const axis of ['h', 'v']) layer[axis + 'Walls'].forEach((row, y) => row.forEach((wall, x) => {
        if (wall.type <= 1) return;
        for (const type of [0, 1]) {
            const edited = structuredClone(map); edited.layers[li][axis + 'Walls'][y][x] = { type, keys: 0 };
            contrasts.push({ edit: { layer: li, axis, x, y, type }, result: solveFastMap(edited, budget) });
        }
    }));
}
assert(contrasts.filter(c => c.edit.layer === 0).every(c => c.result.status === 'proven_unsat'));
const noButton = structuredClone(map); noButton.layers[1].buttons = [];
assert.equal(solveFastMap(noButton, budget).status, 'proven_unsat');
const economy = [];
map.layers.forEach((layer, li) => layer.activeCells.forEach((row, y) => row.forEach((on, x) => {
    if (!on || layer.customStartPos?.x === x && layer.customStartPos.y === y || layer.endPos?.x === x && layer.endPos.y === y ||
        layer.ghosts.some(g => g.x === x && g.y === y) || layer.buttons.some(b => b.x === x && b.y === y) ||
        map.stairs.some(s => s.layer === li && s.x === x && s.y === y)) return;
    const edit = structuredClone(map); edit.layers[li].activeCells[y][x] = false;
    const valid = validateMapData(normalizeVoidWalls(edit));
    const result = valid.valid ? solveFastMap(valid.mapData, budget) : { status: 'invalid' };
    assert.equal(result.status, 'proven_unsat'); economy.push({ layer: li, x, y });
})));
console.log(JSON.stringify({ title: '楼间', cells: 11, ghosts: 1, T: 26, optimalCount: '1',
    requiredTransfers: 'at_least_three_all_wins', coldEntry: true, allOptimalSafe: true,
    removedNonEntityCellsUnsat: economy, contrastResults: contrasts.map(c => ({ edit: c.edit, status: c.result.status, T: c.result.solution?.totalActions })),
    mapId: createReferenceEnvironment(map).mapId, mapCode: encoded.code, replayCode: route.code }));
