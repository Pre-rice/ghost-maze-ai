import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { DataSerializer, ReplaySerializer, WALL_TYPES as W } from '../../src/reference/engine.js';

// 只核验已经保存的题目，排他写证据；不重跑构造或覆盖旧产物。
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const map = read('map.json'), source = read('source.json'), selection = read('selection.json');
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
const proven = r => r.status === 'solved' && r.optimality === 'proven';
const pair = (m, restrictions = []) => {
    const fast = solveFastMap(m, { ...budget, restrictions });
    const reference = solveReferenceMap(m, { ...budget, restrictions });
    assert.equal(fast.status, reference.status); assert.notEqual(fast.status, 'unknown');
    if (proven(fast)) { assert(proven(reference)); assert.equal(fast.solution.totalActions, reference.solution.totalActions); }
    return { fast, reference };
};
assertButtonAttachments(map); assertButtonAttachments(source.map);
assert.equal(selection.localMinimality.unresolved, 0);
assert([...map.hWalls.flat(), ...map.vWalls.flat()].every(w => w.type !== W.GLASS));
const baseline = pair(map); assert(proven(baseline.fast));
const actions = baseline.fast.solution.actions;
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success, encoded.error);
const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success, decoded.error);
assertButtonAttachments(decoded.data.mapData);
const env = createReferenceEnvironment(map), fastEnv = createFastEnvironment(map), restored = createReferenceEnvironment(decoded.data.mapData);
assert.equal(env.mapId, restored.mapId);
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
    trace.push({ step: i + 1, action, player: [a.player.x, a.player.y],
        ghosts: a.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: a.player.keys,
        A: a.layerStates[0].wallStates.h[3][3].currentState, B: a.layerStates[0].wallStates.h[4][4].currentState });
}
assert(a.isWon);
const withoutGoal = createReferenceEnvironment({ ...map, endPos: null }).replay(actions); assert(!withoutGoal.state.isDead);
const specs = selection.evaluation.requirements.map(r => r.restriction);
specs.push({ id: 'four-A-actions', sequence: Array.from({ length: 4 }, () => ({ type: 'press', letter: 'A' })) });
const requirements = specs.map(restriction => {
    const result = pair(map, [restriction]); assert.equal(result.fast.status, 'proven_unsat');
    return { restriction, ...result };
});
const contrasts = [];
for (const axis of ['h', 'v']) for (let y = 0; y < map[axis + 'Walls'].length; y++) for (let x = 0; x < map[axis + 'Walls'][y].length; x++) {
    if (![W.DOOR, W.LOCKED, W.LETTER_DOOR].includes(map[axis + 'Walls'][y][x].type)) continue;
    const types = [W.EMPTY, W.SOLID];
    if (map[axis + 'Walls'][y][x].type === W.LOCKED) types.push(W.DOOR);
    for (const type of types) {
        const changed = structuredClone(map); changed[axis + 'Walls'][y][x] = { type, keys: 0 };
        contrasts.push({ edge: { axis, x, y }, type, ...pair(changed) });
    }
}
const ablations = [];
for (const field of ['buttons', 'items', 'initialGhosts']) for (let index = 0; index < map[field].length; index++) {
    const changed = structuredClone(map); changed[field].splice(index, 1);
    const result = pair(changed);
    if (field !== 'initialGhosts') assert.equal(result.fast.status, 'proven_unsat');
    else { assert(proven(result.fast)); assert(result.fast.solution.totalActions < actions.length); }
    ablations.push({ field, index, ...result });
}
const branches = [
    { id: 'leave-before-opening-A', actions: [...'U'], expected: 'proven_unsat' },
    { id: 'first-left-shelter', actions: [...'LURUR'], expected: 'proven_unsat' },
    { id: 'first-right-shelter', actions: [...'LURRULDLD'], expected: 'solved' }
].map(branch => {
    const options = { nodeBudget: 100000, budgetMs: 10000 };
    const fast = solveContinuation(map, branch.actions, options);
    const reference = solveContinuation(map, branch.actions, { ...options, reference: true });
    assert.equal(fast.status, branch.expected); assert.equal(reference.status, branch.expected);
    return { ...branch, fast, reference };
});
const walls = [...map.hWalls.flat(), ...map.vWalls.flat()];
const manifest = { title: '《换岗》', cells: map.activeCells.flat().filter(Boolean).length,
    ghosts: map.initialGhosts.length, keys: map.items.length, buttons: map.buttons.length,
    ordinaryDoors: walls.filter(w => w.type === W.DOOR).length,
    numericDoors: walls.filter(w => w.type === W.LOCKED).length,
    letterDoors: walls.filter(w => w.type === W.LETTER_DOOR).length,
    actions: actions.length, sharecode: encoded.code, replayCode: replay.code,
    mapId: env.mapId, ruleset: env.ruleset, familyId: source.familyId, splitGroup: source.splitGroup,
    motif: source.motif, humanQuality: null, status: 'awaiting_user_review' };
save('evidence.json', { schemaVersion: 1, date: '2026-10-12', ...manifest, ...baseline,
    provenance: { method: source.method, trainedModelUsed: false, attempts: selection.attempts,
        acceptedEdits: selection.lineage.length, finalAudit: selection.localMinimality.audit.length, globalMinimumProven: false },
    requirements, contrasts, ablations, branches, trace, withoutGoal: physicalState(withoutGoal.state),
    checks: { perStepPhysicalIdentity: true, mapCodeRoundtrip: true, replayCodeRoundtrip: true,
        buttonsAttached: true, glassCount: 0, glassToSolidExactIdentity: true, fogKnowledgeStrategyProven: false } });
save('manifest.json', manifest);
console.log(JSON.stringify(manifest, null, 2));
