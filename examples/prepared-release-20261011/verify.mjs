import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveContinuation } from '../../src/design/continuation.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { DataSerializer, ReplaySerializer, WALL_TYPES as W } from '../../src/reference/engine.js';

// 核验已保存的新题，不重跑构造或覆盖旧证据，不写真人录制。
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
const solved = r => r.status === 'solved' && r.optimality === 'proven';
const map = read('map.json'), source = read('source.json'), selection = read('selection.json');
assertButtonAttachments(map); assertButtonAttachments(source.map);
assert.equal(selection.localMinimality.unresolved, 0);
assert.equal(map.initialGhosts.length, 2);
assert.equal(map.items.length, 1);
assert.equal(map.buttons.length, 2);
assert(map.buttons.every(b => b.letter === 'A'));
assert([...map.hWalls.flat(), ...map.vWalls.flat()].every(w => w.type !== W.GLASS));
const env = createReferenceEnvironment(map), fastEnv = createFastEnvironment(map);
const fast = solveFastMap(map, budget), reference = solveReferenceMap(map, budget);
assert(solved(fast) && solved(reference));
assert.equal(fast.solution.totalActions, reference.solution.totalActions);
const actions = fast.solution.actions;
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success, encoded.error);
const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success, decoded.error);
assertButtonAttachments(decoded.data.mapData);
const restored = createReferenceEnvironment(decoded.data.mapData); assert.equal(restored.mapId, env.mapId);
const replay = ReplaySerializer.generateShareCode(decoded.data.mapData, actions); assert(replay.success, replay.error);
const loadedReplay = ReplaySerializer.loadFromShareCode(decoded.data.mapData, replay.code);
assert(loadedReplay.success, loadedReplay.error); assert.deepEqual(loadedReplay.actions, actions);
let a = env.initialState(), b = fastEnv.initialState(), c = restored.initialState();
const trace = [];
for (const [index, action] of actions.entries()) {
    const before = a;
    a = env.step(a, action); b = fastEnv.step(b, action); c = restored.step(c, action);
    assert.notEqual(a, before); assert(!a.isDead);
    assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
    trace.push({ step: index + 1, action, player: [a.player.x, a.player.y], keys: a.player.keys,
        ghosts: a.layerStates[0].ghosts.map(g => [g.x, g.y]),
        pocket: a.layerStates[0].wallStates.h[3][4].currentState,
        vault: a.layerStates[0].wallStates.v[4][2].currentState,
        numeric: a.layerStates[0].wallStates.v[4][4].type });
}
assert(a.isWon);
const withoutGoal = createReferenceEnvironment({ ...map, endPos: null }).replay(actions); assert(!withoutGoal.state.isDead);
const requirements = [];
for (const restriction of [...selection.evaluation.specs, ...selection.additionalRequirements]) {
    const f = solveFastMap(map, { ...budget, restrictions: [restriction] });
    const r = solveReferenceMap(map, { ...budget, restrictions: [restriction] });
    assert.equal(f.status, 'proven_unsat'); assert.equal(r.status, 'proven_unsat');
    requirements.push({ restriction, fast: f, reference: r });
}
const contrasts = [];
for (const [edge, types] of [
    [{ axis: 'h', x: 4, y: 2 }, [W.EMPTY, W.SOLID]],
    [{ axis: 'v', x: 4, y: 4 }, [W.EMPTY, W.DOOR, W.SOLID]],
    [{ axis: 'h', x: 6, y: 2 }, [W.EMPTY, W.DOOR, W.SOLID]]
]) for (const type of types) {
    const changed = structuredClone(map); changed[edge.axis + 'Walls'][edge.y][edge.x] = { type, keys: 0 };
    const f = solveFastMap(changed, budget), r = solveReferenceMap(changed, budget);
    assert.equal(f.status, r.status);
    if (edge.axis === 'h' && edge.x === 4 || type === W.SOLID) {
        assert.equal(f.status, 'proven_unsat');
    } else {
        assert(solved(f) && solved(r)); assert.equal(f.solution.totalActions, r.solution.totalActions);
        assert(f.solution.totalActions < actions.length);
        assert.equal(createReferenceEnvironment(changed).replay(f.solution.actions).state.player.keys, 0);
    }
    contrasts.push({ edge, type, fast: f, reference: r });
}
const prefixes = [
    { id: 'key-before-preparation', actions: [...'UDDDULLD'], expected: 'proven_unsat' },
    { id: 'left-button-after-prepared-key', actions: [...'RDULUDDDULLDRRUUU'], expected: 'proven_unsat' },
    { id: 'early-button-still-recoverable', actions: [...'UDD'], expected: 'solved' }
];
const branches = prefixes.map(p => {
    const options = { nodeBudget: 100000, budgetMs: 10000 };
    const fast = solveContinuation(map, p.actions, options);
    const reference = solveContinuation(map, p.actions, { ...options, reference: true });
    assert.equal(fast.status, p.expected); assert.equal(reference.status, p.expected);
    return { ...p, fast, reference };
});
const ghostRemoval = [0, 1].map(index => {
    const changed = { ...map, initialGhosts: map.initialGhosts.filter((_, i) => i !== index) };
    const f = solveFastMap(changed, budget), r = solveReferenceMap(changed, budget);
    assert(solved(f) && solved(r)); assert.equal(f.solution.totalActions, r.solution.totalActions);
    assert(f.solution.totalActions < actions.length);
    return { removedIndex: index, fast: f, reference: r };
});
const reversedMap = { ...map, initialGhosts: [...map.initialGhosts].reverse() };
const reversed = solveReferenceMap(reversedMap, budget); assert(solved(reversed));
assert.equal(reversed.solution.totalActions, actions.length);
assert(createReferenceEnvironment(reversedMap).replay(actions).state.isWon);
const familyId = 'prepared-release-and-consumed-return-v1';
const record = { schemaVersion: 1, date: '2026-10-11', title: '《先手》', mapId: env.mapId, ruleset: env.ruleset,
    engineCommit: execFileSync('git', ['-C', '../ghost-maze', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version, familyId, splitGroup: familyId,
    provenance: { method: source.method, originalCells: source.map.activeCells.flat().filter(Boolean).length,
        attempts: selection.attempts, acceptedEdits: selection.lineage.length,
        globalMinimumProven: false, trainedModelUsed: false },
    fast, reference, requirements, contrasts, branches, ghostRemoval, reversed, trace,
    withoutGoal: physicalState(withoutGoal.state),
    sharecode: encoded.code, replayCode: replay.code,
    checks: { mapCodeRoundtrip: true, replayCodeRoundtrip: true, perStepPhysicalIdentity: true,
        buttonsAttached: true, glassCount: 0, glassToSolidExactIdentity: true,
        reversedCertificateWins: true, fogKnowledgeStrategyProven: false },
    humanQuality: null, status: 'awaiting_user_review' };
save('evidence.json', record);
const manifest = { title: record.title, cells: map.activeCells.flat().filter(Boolean).length,
    ghosts: 2, keys: 1, buttons: 2, letterGroups: 1, ordinaryDoors: 1,
    numericDoors: 1, oneWayDoors: 1, letterDoors: 3, actions: actions.length,
    sharecode: encoded.code, replayCode: replay.code, mapId: env.mapId, ruleset: env.ruleset,
    familyId, splitGroup: familyId, humanQuality: null, status: record.status };
save('manifest.json', manifest);
console.log(JSON.stringify(manifest, null, 2));
