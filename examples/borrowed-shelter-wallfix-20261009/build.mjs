import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { assertButtonAttachments, findUnsupportedButtons } from '../../src/design/button-support.js';
import { traceState } from '../../src/review/trace-core.js';
import { describeStep } from '../../src/review/step-description.js';
import { budget, referenceBudget, constraints } from '../borrowed-shelter-20261009/evaluate.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const parent = read('../borrowed-shelter-20261009/map.json'), previous = read('../borrowed-shelter-20261009/evidence.json');
const invalid = findUnsupportedButtons(parent); assert.equal(invalid.length, 1); assert.equal(invalid[0].letter, 'B');
const map = structuredClone(parent); map.buttons[invalid[0].index].direction = { dx: 0, dy: -1 };
assertButtonAttachments(map); assert.equal(map.hWalls[4][1].type, W.SOLID);
const env = createReferenceEnvironment(map), fast = createFastEnvironment(map), old = createReferenceEnvironment(parent);
const baseline = solveFastMap(map, budget), reference = solveReferenceMap(map, referenceBudget);
assert.equal(baseline.status, 'solved'); assert.equal(reference.status, 'solved');
assert.equal(reference.optimality, 'proven'); assert.equal(reference.solution.totalActions, baseline.solution.totalActions);
console.log(JSON.stringify({ check: 'supported_baseline', T: reference.solution.totalActions }));
const actions = baseline.solution.actions;
const mapped = previous.solution.solution.actions.map((action, index) => previous.trace[index].button === 'B' ? 'U' : action);
assert.deepEqual(actions, mapped);
const proofs = [];
for (const condition of constraints) {
    const quick = solveFastMap(map, { ...budget, restrictions: [condition] });
    const result = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
    assert.equal(quick.status, 'proven_unsat'); assert.equal(result.status, 'proven_unsat'); assert(result.search.exhausted);
    proofs.push({ condition, quick, reference: result });
    console.log(JSON.stringify({ check: condition.id, states: result.search.discovered }));
}
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
const { mapData, gameMode, initialHealth } = decoded.data;
assertButtonAttachments(mapData);
const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth });
let a = env.initialState(), b = fast.initialState(), c = restored.initialState(), d = old.initialState();
const trace = [], browserTrace = [{ physical: traceState(c), seenCells: c.seenCells }];
for (const [index, action] of actions.entries()) {
    const before = a; a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
    d = old.step(d, previous.solution.solution.actions[index]);
    assert(!a.isDead); assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
    assert.deepEqual(physicalState(a), physicalState(d)); assert.deepEqual(a.seenCells, c.seenCells); assert.deepEqual(a.seenCells, d.seenCells);
    trace.push(describeStep(before, a, action, env.mapDefinition, W)); browserTrace.push({ physical: traceState(c), seenCells: c.seenCells });
}
assert(a.isWon);
const reversed = structuredClone(map); reversed.initialGhosts.reverse(); assert(createReferenceEnvironment(reversed).replay(actions).state.isWon);
assert(!createReferenceEnvironment({ ...map, endPos: null }).replay(actions).state.isDead);
assert(![...map.hWalls.flat(), ...map.vWalls.flat()].some(w => w.type === W.GLASS));
const evidence = { schemaVersion: 1, date: '2026-10-09', mapId: env.mapId, decodedMapId: restored.mapId, ruleset: env.ruleset,
    correction: { parentMapId: old.mapId, invalidButton: invalid[0], change: 'B 站由左侧空通路改为上方实墙',
        wall: { axis: 'h', x: 1, y: 4, type: W.SOLID }, changedActionSteps: [17, 46],
        selectedCertificatePhysicsIdentical: true, allStrategiesIdenticalClaimed: false },
    attachmentCheck: { unsupportedButtons: 0, source: 'reference_editor_getButtonHotspotAtPos' },
    baseline, reference, proofs, trace, sharecode: encoded.code, familyId: previous.familyId, splitGroup: previous.splitGroup,
    minimalityRecomputed: false, oldAblationsTransferred: false, humanQuality: null, status: 'awaiting_user_review' };
save('map.json', map); save('evidence.json', evidence); save('browser-trace.json', { mapId: restored.mapId, actions, trace: browserTrace });
console.log(JSON.stringify({ check: 'finished', T: actions.length, L: env.replay(actions).movementCost, unsupportedButtons: 0 }));
