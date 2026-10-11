import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { traceState } from '../../src/review/trace-core.js';
import { describeStep } from '../../src/review/step-description.js';
import { createEvaluator, constraints, referenceBudget } from './evaluate.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const source = read('source.json'), minimized = read('minimized.json'), map = minimized.map;
assertButtonAttachments(source.map); assertButtonAttachments(map);
const evaluated = createEvaluator()(map); assert(evaluated.accepted);
const baseline = evaluated.baseline, reference = solveReferenceMap(map, referenceBudget);
assert.equal(reference.status, 'solved'); assert.equal(reference.solution.totalActions, baseline.solution.totalActions);
console.log(JSON.stringify({ check: 'baseline', T: baseline.solution.totalActions, L: baseline.solution.movementCost }));
const proofs = [];
for (const [i, condition] of constraints.entries()) {
    const result = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
    assert.equal(result.status, 'proven_unsat'); assert(result.search.exhausted);
    proofs.push({ condition, quick: evaluated.proofs[i].result, reference: result });
    console.log(JSON.stringify({ check: condition.id, states: result.search.discovered }));
}
const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
const { mapData, gameMode, initialHealth } = decoded.data; assertButtonAttachments(mapData);
const env = createReferenceEnvironment(map), fast = createFastEnvironment(map);
const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth });
const actions = baseline.solution.actions, trace = [], browserTrace = [];
let a = env.initialState(), b = fast.initialState(), c = restored.initialState();
browserTrace.push({ physical: traceState(c), seenCells: c.seenCells });
for (const action of actions) {
    const before = a; a = env.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
    assert(!a.isDead); assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c)); assert.deepEqual(a.seenCells, c.seenCells);
    trace.push(describeStep(before, a, action, env.mapDefinition, W)); browserTrace.push({ physical: traceState(c), seenCells: c.seenCells });
}
assert(a.isWon);
const reversed = structuredClone(map); reversed.initialGhosts.reverse(); assert(createReferenceEnvironment(reversed).replay(actions).state.isWon);
assert(!createReferenceEnvironment({ ...map, endPos: null }).replay(actions).state.isDead);
assert(![...map.hWalls.flat(), ...map.vWalls.flat()].some(w => [W.GLASS, W.ONE_WAY, W.LOCKED].includes(w.type)));
const naturalPlans = [];
for (const [name, plan] of [
    ['开A后立即按B', ['R', 'D']],
    ['只绕上方通路后直接按B', ['R', 'U', 'U', 'U', 'D', 'D', 'D', 'D']],
    ['引出上鬼后直接关A撤离', [...actions.slice(0, 16), 'R', 'L', 'L', 'U', 'U', 'U', 'L']]
]) {
    let state = env.initialState(); const steps = [];
    for (const action of plan) { const next = env.step(state, action); steps.push(describeStep(state, next, action, env.mapDefinition, W)); state = next; if (state.isDead) break; }
    assert(state.isDead); naturalPlans.push({ name, attemptedActions: plan, executedActions: steps.length, steps });
}
const ablations = [];
for (const axis of ['h', 'v']) map[axis + 'Walls'].forEach((row, y) => row.forEach((w, x) => {
    if (w.type !== W.LETTER_DOOR) return;
    for (const type of [W.EMPTY, W.SOLID]) {
        const changed = structuredClone(map); changed[axis + 'Walls'][y][x] = { type, keys: 0 };
        const result = createEvaluator()(changed);
        ablations.push({ axis, x, y, type, accepted: result.accepted, reason: result.reason, baseline: result.baseline, failedCondition: result.condition, counterexample: result.result });
    }
}));
const evidence = { schemaVersion: 1, date: '2026-10-10', ruleset: env.ruleset, mapId: env.mapId, decodedMapId: restored.mapId,
    familyId: 'single-station-relay-v1', splitGroup: 'dual-loop-relay-v1', baseline, reference, proofs, trace, naturalPlans, ablations,
    source: source.search, lineage: minimized.lineage, attempts: minimized.attempts, minimality: minimized.localMinimality,
    attachmentCheck: { source: true, final: true, decoded: true }, sharecode: encoded.code, humanQuality: null,
    status: 'awaiting_user_review', limits: ['无伤无复活的全信息物理范围', '必要性不证明人类质量', '不证明唯一完整顺序', '未证明迷雾知识策略'] };
save('map.json', map); save('evidence.json', evidence);
save('browser-trace.json', { mapId: restored.mapId, actions, trace: browserTrace });
save('manifest.json', { schemaVersion: 1, date: '2026-10-10', title: '借位', mapId: env.mapId, decodedMapId: restored.mapId,
    ruleset: env.ruleset, familyId: evidence.familyId, splitGroup: evidence.splitGroup, source: source.search,
    activeCells: map.activeCells.flat().filter(Boolean).length, ghostCount: map.initialGhosts.length, buttonCount: map.buttons.length,
    gateCount: [...map.hWalls.flat(), ...map.vWalls.flat()].filter(w => w.type === W.LETTER_DOOR).length,
    itemCount: map.items.length,  totalActions: actions.length, movementCost: baseline.solution.movementCost,
    sharecode: encoded.code, humanQuality: null });
console.log(JSON.stringify({ check: 'finished', T: actions.length, word: trace.map(t => t.button ?? '').join(''), shareLength: encoded.code.length }));
