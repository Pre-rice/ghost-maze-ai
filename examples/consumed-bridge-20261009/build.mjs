// 基于既有逐状态验收流程，新增地图独立保存，不覆盖历史产物。
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { minimizeDesign } from '../../src/design/minimize.js';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { traceState, describeStep } from '../../src/review/trace-core.js';
import { budget, referenceBudget, createEvaluator, constraints, edges, proved } from './evaluate.mjs';

const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const source = JSON.parse(readFileSync(new URL('source.json', import.meta.url), 'utf8'));
const minimized = minimizeDesign(source.map, createEvaluator()), { map, evaluation } = minimized;
assert.equal(minimized.localMinimality.unresolved, 0);
console.log(JSON.stringify({ check: 'minimized', complexity: minimized.complexity, attempts: minimized.attempts }));
const env = createReferenceEnvironment(map), fast = createFastEnvironment(map), actions = evaluation.baseline.solution.actions;
const reference = solveReferenceMap(map, referenceBudget); assert(proved(reference)); assert.equal(reference.solution.totalActions, actions.length);
console.log(JSON.stringify({ check: 'reference_baseline', actions: actions.length, states: reference.search.discovered }));
const proofs = [];
for (const condition of constraints) {
    const result = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
    assert.equal(result.status, 'proven_unsat', condition.id); assert(result.search.exhausted);
    proofs.push({ condition, quick: evaluation.proofs.find(p => p.condition.id === condition.id).result, reference: result });
    console.log(JSON.stringify({ check: condition.id, states: result.search.discovered }));
}
const ablations = [];
for (const edge of edges(map).filter(e => ![W.SOLID, W.EMPTY].includes(e.wall.type))) for (const type of [W.EMPTY, W.SOLID]) {
    const changed = structuredClone(map); changed[edge.axis + 'Walls'][edge.y][edge.x] = { type, keys: 0 };
    const quick = solveFastMap(changed, budget), result = solveReferenceMap(changed, referenceBudget);
    assert.equal(result.status, quick.status); assert.notEqual(result.status, 'unknown');
    if (result.solution) assert.equal(result.solution.totalActions, quick.solution.totalActions);
    ablations.push({ edit: { ...edge, type }, quick, reference: result });
}
const singleGhost = [];
for (let index = 0; index < 2; index++) {
    const changed = structuredClone(map); changed.initialGhosts.splice(index, 1);
    singleGhost.push({ removed: index, result: solveReferenceMap(changed, referenceBudget) });
}
const noGhost = solveFastMap(map, { ...budget, withGhosts: false }); assert(proved(noGhost));
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
let a = env.initialState(), b = fast.initialState(), c = restored.initialState();
const browserTrace = [{ physical: traceState(c), seenCells: c.seenCells }], trace = [];
for (const action of actions) {
    const before = a; a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
    assert(!a.isDead); assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
    assert.deepEqual(a.seenCells, c.seenCells);
    trace.push(describeStep(before, a, action, env.mapDefinition, W));
    browserTrace.push({ physical: traceState(c), seenCells: c.seenCells });
}
assert(a.isWon);
const reversed = structuredClone(map); reversed.initialGhosts.reverse();
const reverseReplay = createReferenceEnvironment(reversed).replay(actions); assert(reverseReplay.state.isWon);
const exit = createReferenceEnvironment({ ...map, endPos: null }).replay(actions); assert(!exit.state.isDead);
const swapped = structuredClone(map);
for (const e of edges(swapped)) if (e.wall.type === W.GLASS) swapped[e.axis + 'Walls'][e.y][e.x] = { type: W.SOLID, keys: 0 };
assert.deepEqual(swapped, map);
const evidence = { schemaVersion: 1, date: '2026-10-09', ruleset: env.ruleset, mapId: env.mapId, decodedMapId: restored.mapId,
    familyId: 'permanent-bridge-double-relay-v1', splitGroup: 'dual-loop-relay-v1', provenance: source.provenance,
    solution: evaluation.baseline, reference, noGhost, singleGhost, proofs, ablations,
    minimality: minimized.localMinimality, lineage: minimized.lineage, attempts: minimized.attempts, complexity: minimized.complexity,
    trace, sharecode: encoded.code, exitWithoutGoal: physicalState(exit.state),
    ghostOrder: { originalCertificateWinsAfterReversal: true, final: physicalState(reverseReplay.state) },
    glassIndependence: { glassCount: 0, exactMapIdentity: true, replacementMapId: createReferenceEnvironment(swapped).mapId, scope: 'all_strategies_same_map_and_rules' },
    initialVisibility: { knowledgeStrategyProven: false }, humanQuality: null, status: 'awaiting_user_review' };
save('map.json', map); save('evidence.json', evidence); save('browser-trace.json', { mapId: restored.mapId, actions, trace: browserTrace });
save('manifest.json', [{ mapId: env.mapId, ruleset: env.ruleset, cells: minimized.complexity[0], ghosts: 2, buttons: map.buttons.length,
    actions: actions.length, sharecode: encoded.code, familyId: evidence.familyId, splitGroup: evidence.splitGroup, status: evidence.status }]);
console.log(JSON.stringify({ check: 'finished', cells: minimized.complexity[0], actions: actions.length, moves: a.player.steps,
    noGhost: noGhost.solution.totalActions, audit: minimized.localMinimality.audit.length, sharecode: encoded.code }));
