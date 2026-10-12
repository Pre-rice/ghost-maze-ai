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

// 核验已保存的手工构造，不重跑探索，不覆盖旧图或生成时证据。
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
const solved = r => r.status === 'solved' && r.optimality === 'proven';
const map = read('map.json'), source = read('source.json'), selection = read('selection.json');
assertButtonAttachments(map); assertButtonAttachments(source.map);
assert.equal(selection.localMinimality.unresolved, 0);
assert.equal(map.initialGhosts.length, 1); assert.equal(map.buttons.length, 1);
assert.equal(map.items.length, 1);
assert([...map.hWalls.flat(), ...map.vWalls.flat()].every(w => w.type !== W.GLASS));
const env = createReferenceEnvironment(map), fastEnv = createFastEnvironment(map);
const fast = solveFastMap(map, budget), reference = solveReferenceMap(map, budget);
assert(solved(fast) && solved(reference)); assert.equal(fast.solution.totalActions, reference.solution.totalActions);
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
for (const [i, action] of actions.entries()) {
    const before = a;
    a = env.step(a, action); b = fastEnv.step(b, action); c = restored.step(c, action);
    assert.notEqual(a, before); assert(!a.isDead);
    assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
    trace.push({ step: i + 1, action, player: [a.player.x, a.player.y],
        ghost: [a.layerStates[0].ghosts[0].x, a.layerStates[0].ghosts[0].y], keys: a.player.keys,
        front: a.layerStates[0].wallStates.v[3][3].currentState,
        back: a.layerStates[0].wallStates.h[3][3].currentState });
}
assert(a.isWon);
const withoutGoal = createReferenceEnvironment({ ...map, endPos: null }).replay(actions); assert(!withoutGoal.state.isDead);
const requirements = [];
for (const restriction of selection.evaluation.specs) {
    const f = solveFastMap(map, { ...budget, restrictions: [restriction] });
    const r = solveReferenceMap(map, { ...budget, restrictions: [restriction] });
    assert.equal(f.status, 'proven_unsat'); assert.equal(r.status, 'proven_unsat');
    requirements.push({ restriction, fast: f, reference: r });
}
const contrasts = [];
for (const [edge, types] of [
    [{ axis: 'v', x: 3, y: 1 }, [W.EMPTY, W.SOLID]],
    [{ axis: 'v', x: 4, y: 2 }, [W.EMPTY, W.DOOR, W.SOLID]],
    [{ axis: 'v', x: 3, y: 3 }, [W.EMPTY, W.SOLID]],
    [{ axis: 'h', x: 3, y: 3 }, [W.EMPTY, W.SOLID]]
]) for (const type of types) {
    const changed = structuredClone(map); changed[edge.axis + 'Walls'][edge.y][edge.x] = { type, keys: 0 };
    const f = solveFastMap(changed, budget), r = solveReferenceMap(changed, budget);
    assert.equal(f.status, r.status); assert.notEqual(f.status, 'unknown');
    if (solved(f)) assert.equal(f.solution.totalActions, r.solution.totalActions);
    if (edge.axis === 'v' && edge.y === 1) {
        if (type === W.SOLID) assert.equal(f.status, 'proven_unsat');
        else { assert(solved(f)); assert(f.solution.totalActions < actions.length); }
    }
    if (edge.axis === 'v' && edge.x === 4 && type !== W.SOLID) {
        assert(solved(f)); assert.equal(createReferenceEnvironment(changed).replay(f.solution.actions).state.player.keys, 0);
    }
    contrasts.push({ edge, type, fast: f, reference: r });
}
const ablations = [];
for (const field of ['buttons', 'items', 'initialGhosts']) {
    const changed = { ...map, [field]: [] };
    const f = solveFastMap(changed, budget), r = solveReferenceMap(changed, budget);
    assert.equal(f.status, r.status); assert.notEqual(f.status, 'unknown');
    if (field === 'initialGhosts') { assert(solved(f)); assert.equal(f.solution.totalActions, r.solution.totalActions); assert(f.solution.totalActions < actions.length); }
    else assert.equal(f.status, 'proven_unsat');
    ablations.push({ field, fast: f, reference: r });
}
const branches = [
    { id: 'early-left-shelter', actions: [...'LLURUR'], expected: 'proven_unsat' },
    { id: 'first-right-shelter', actions: [...'LURURLDLD'], expected: 'solved' }
].map(p => {
    const options = { nodeBudget: 100000, budgetMs: 10000 };
    const f = solveContinuation(map, p.actions, options), r = solveContinuation(map, p.actions, { ...options, reference: true });
    assert.equal(f.status, p.expected); assert.equal(r.status, p.expected);
    return { ...p, fast: f, reference: r };
});
const evidence = { schemaVersion: 1, title: '《换边》', date: '2026-10-12', ruleset: env.ruleset, mapId: env.mapId,
    engineCommit: execFileSync('git', ['-C', '../ghost-maze', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version, familyId: 'dual-loop-relay-v1', splitGroup: 'dual-loop-relay-v1',
    motif: 'room-mediated-door-side-transfer-v1', provenance: { method: source.method, trainedModelUsed: false,
        parentConstructions: 3, removedCell: [1, 1], removedNumericDoor: { axis: 'h', x: 2, y: 4 },
        attempts: selection.attempts, finalAudit: selection.localMinimality.audit.length, globalMinimumProven: false },
    fast, reference, requirements, contrasts, ablations, branches, trace,
    sharecode: encoded.code, replayCode: replay.code, withoutGoal: physicalState(withoutGoal.state),
    checks: { perStepPhysicalIdentity: true, mapCodeRoundtrip: true, replayCodeRoundtrip: true,
        buttonsAttached: true, glassCount: 0, glassToSolidExactIdentity: true, fogKnowledgeStrategyProven: false },
    humanQuality: null, status: 'awaiting_user_review' };
save('evidence.json', evidence);
const manifest = { title: evidence.title, cells: map.activeCells.flat().filter(Boolean).length,
    ghosts: 1, keys: 1, buttons: 1, ordinaryDoors: 1, numericDoors: 1, letterDoors: 2,
    actions: actions.length, sharecode: encoded.code, replayCode: replay.code, mapId: env.mapId, ruleset: env.ruleset,
    familyId: evidence.familyId, splitGroup: evidence.splitGroup, motif: evidence.motif, humanQuality: null, status: evidence.status };
save('manifest.json', manifest);
console.log(JSON.stringify(manifest, null, 2));
