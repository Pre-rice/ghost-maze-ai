import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { DataSerializer, ReplaySerializer, WALL_TYPES as W } from '../../src/reference/engine.js';

// 只核验已保存新题；输出排他写入，不重跑构造或覆盖历史。
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const map = read('map.json'), source = read('source.json'), selection = read('selection.json');
const budget = { nodeBudget: 500000, stateBudget: 500000, budgetMs: 15000 };
const pair = (m, restrictions = []) => {
    const fast = solveFastMap(m, { ...budget, restrictions }), reference = solveReferenceMap(m, { ...budget, restrictions });
    assert.equal(fast.status, reference.status); assert.notEqual(fast.status, 'unknown');
    if (fast.status === 'solved') {
        assert.equal(fast.optimality, 'proven'); assert.equal(reference.optimality, 'proven');
        assert.equal(fast.solution.totalActions, reference.solution.totalActions);
    }
    return { fast, reference };
};
assertButtonAttachments(map); assertButtonAttachments(source.map);
assert.equal(selection.localMinimality.unresolved, 0);
const baseline = pair(map); assert.equal(baseline.fast.status, 'solved');
const env = createReferenceEnvironment(map), fastEnv = createFastEnvironment(map), actions = baseline.fast.solution.actions;
const initial = env.initialState();
const initialMoves = env.actions.flatMap(action => {
    const next = env.step(initial, action);
    return next === initial ? [] : [{ action, safe: !next.isDead, ghostsUnchanged: JSON.stringify(next.layerStates[0].ghosts) === JSON.stringify(initial.layerStates[0].ghosts) }];
});
assert(initialMoves.length && initialMoves.every(r => r.safe && r.ghostsUnchanged));
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success, encoded.error);
const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success, decoded.error);
const restored = createReferenceEnvironment(decoded.data.mapData); assert.equal(restored.mapId, env.mapId);
assertButtonAttachments(decoded.data.mapData);
const replay = ReplaySerializer.generateShareCode(decoded.data.mapData, actions); assert(replay.success, replay.error);
const loaded = ReplaySerializer.loadFromShareCode(decoded.data.mapData, replay.code);
assert(loaded.success, loaded.error); assert.deepEqual(loaded.actions, actions);
let a = env.initialState(), b = fastEnv.initialState(), c = restored.initialState();
const trace = [];
for (const [i, action] of actions.entries()) {
    const before = a;
    a = env.step(a, action); b = fastEnv.step(b, action); c = restored.step(c, action);
    assert.notEqual(a, before); assert(!a.isDead);
    assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
    trace.push({ step: i + 1, action, player: [a.player.x, a.player.y], ghosts: a.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: a.player.keys });
}
assert(a.isWon);
const withoutGoal = createReferenceEnvironment({ ...map, endPos: null }).replay(actions); assert(!withoutGoal.state.isDead);
const requirements = selection.conditions.specs.map(restriction => {
    const result = pair(map, [restriction]); assert.equal(result.fast.status, 'proven_unsat');
    return { restriction, ...result };
});
const reverseMap = structuredClone(map); reverseMap.initialGhosts.reverse();
const reversed = pair(reverseMap); assert.equal(reversed.fast.status, 'solved');
const contrasts = [];
for (const axis of ['h', 'v']) for (let y = 0; y < map[axis + 'Walls'].length; y++) for (let x = 0; x < map[axis + 'Walls'][y].length; x++) {
    if (![W.DOOR, W.LOCKED].includes(map[axis + 'Walls'][y][x].type)) continue;
    const types = [W.EMPTY, W.SOLID]; if (map[axis + 'Walls'][y][x].type === W.LOCKED) types.push(W.DOOR);
    for (const type of types) {
        const changed = structuredClone(map); changed[axis + 'Walls'][y][x] = { type, keys: 0 };
        contrasts.push({ edge: { axis, x, y }, type, ...pair(changed) });
    }
}
const ablations = [];
for (const field of ['items', 'initialGhosts']) for (let index = 0; index < map[field].length; index++) {
    const changed = structuredClone(map); changed[field].splice(index, 1);
    const result = pair(changed);
    if (field === 'items') assert.equal(result.fast.status, 'proven_unsat');
    else { assert.equal(result.fast.status, 'solved'); assert(result.fast.solution.totalActions < actions.length); }
    ablations.push({ field, index, ...result });
}
const branches = [
    { id: 'left-key-first', actions: selection.conditions.wrongPrefix, expected: 'proven_unsat' },
    { id: 'return-through-upper-loop', actions: actions.slice(0, 32), expected: 'solved' }
].map(branch => {
    const state = physicalState(env.replay(branch.actions).state);
    const fast = solveContinuation(map, branch.actions, budget), reference = solveContinuation(map, branch.actions, { ...budget, reference: true });
    assert.equal(fast.status, branch.expected); assert.equal(reference.status, branch.expected);
    return { ...branch, state, fast, reference };
});

// 指定单向外部入口；当步实际推进两鬼，再逐步对照单元内的局面。
const exterior = structuredClone(map); exterior.activeCells[7][3] = true;
exterior.hWalls[7][3] = { type: W.ONE_WAY, keys: 0, direction: { dx: 0, dy: -1 } };
exterior.startPos = exterior.customStartPos = { x: 3, y: 7 };
const outer = createReferenceEnvironment(exterior);
const excludedEdges = [['h', 3, 7], ['h', 3, 8], ['v', 3, 7], ['v', 4, 7]];
const unitInitial = physicalState(initial);
const project = state => {
    const p = physicalState(state); p.player.steps--;
    for (const [axis, x, y] of excludedEdges) p.layers[0].wallStates[axis][y][x] = structuredClone(unitInitial.layers[0].wallStates[axis][y][x]);
    return p;
};
let unitState = env.initialState(), entered = outer.step(outer.initialState(), 'U');
assert.deepEqual(project(entered), physicalState(unitState));
for (const action of actions) {
    unitState = env.step(unitState, action); entered = outer.step(entered, action);
    assert.deepEqual(project(entered), physicalState(unitState));
}
assert(unitState.isWon && entered.isWon);
assert(!createReferenceEnvironment({ ...exterior, endPos: null }).replay(['U', ...actions]).state.isDead);
const privateFolder = new URL('../../runs/queued-ghost-exchange-20261012/', import.meta.url); mkdirSync(privateFolder, { recursive: true });
writeFileSync(new URL('entry-map.json', privateFolder), JSON.stringify({ purpose: '指定外部入口诊断，不是新作品', map: exterior,
    result: { solution: { actions: ['U', ...actions] } }, humanQuality: null }, null, 2) + '\n', { flag: 'wx' });
const walls = [...map.hWalls.flat(), ...map.vWalls.flat()]; assert(walls.every(w => w.type !== W.GLASS));
const manifest = { title: '《易位》', cells: map.activeCells.flat().filter(Boolean).length, ghosts: map.initialGhosts.length,
    keys: map.items.length, buttons: map.buttons.length, ordinaryDoors: walls.filter(w => w.type === W.DOOR).length,
    numericDoors: walls.filter(w => w.type === W.LOCKED).length, zeroKeyDoors: walls.filter(w => w.type === W.LOCKED && w.keys === 0).length,
    letterDoors: walls.filter(w => w.type === W.LETTER_DOOR).length, neutralEntry: true, actions: actions.length,
    sharecode: encoded.code, replayCode: replay.code, mapId: env.mapId, ruleset: env.ruleset,
    familyId: source.familyId, splitGroup: source.splitGroup, motif: source.motif, humanQuality: null, status: 'awaiting_user_review' };
save('evidence.json', { schemaVersion: 1, date: '2026-10-12', ...manifest, ...baseline, initialMoves, requirements, reversed,
    contrasts, ablations, branches, trace, withoutGoal: physicalState(withoutGoal.state),
    provenance: { method: source.method, trainedModelUsed: false, firstReductionAttempts: selection.firstReduction.attempts,
        pairedEdit: selection.pairedEdit, finalReductionAttempts: selection.finalReduction.attempts,
        finalAudit: selection.localMinimality.audit.length, globalMinimumProven: false },
    entry: { exteriorMapId: outer.mapId, from: [3, 7], to: [3, 6], action: 'U', excludedEdges,
        scope: '原始墙态、零入场钥匙、区外无其他鬼的指定入口；不声称任意整图兼容或迷雾知识策略' },
    checks: { perStepPhysicalIdentity: true, mapCodeRoundtrip: true, replayCodeRoundtrip: true, buttonsAttached: true,
        firstActionsDoNotMoveGhosts: true, entryDoesNotMoveGhosts: true, entryInitialPhysicalParity: true, entryPerStepParity: true,
        glassCount: 0, glassToSolidExactIdentity: true, fogKnowledgeStrategyProven: false } });
save('manifest.json', manifest); console.log(JSON.stringify(manifest, null, 2));
