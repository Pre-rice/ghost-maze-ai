import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { minimizeDesign } from '../../src/design/minimize.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { traceState } from '../../src/review/trace-core.js';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createEvaluator, constraints, edges, proved } from './evaluate.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const referenceBudget = { nodeBudget: 200000, stateBudget: 200000, budgetMs: 50000 };
const park = { type: 'ghost_at', layer: 0, x: 1, y: 1 };
export const parkingRestrictions = [
    { id: 'park', sequence: [park] },
    ...['A', 'B'].map(letter => ({ id: 'park_then_' + letter, sequence: [park, { type: 'press', letter }] }))
];

// 从已保存的提案重建；不重跑探索，也不覆盖已有产物。
export function build() {
    const source = read('source.json'), minimized = minimizeDesign(source.map, createEvaluator());
    assert.equal(minimized.localMinimality.unresolved, 0);
    const { map, evaluation: e } = minimized, actions = e.baseline.solution.actions;
    const original = createReferenceEnvironment(map), fast = createFastEnvironment(map);
    const reference = solveReferenceMap(map, referenceBudget);
    assert(proved(reference)); assert.equal(reference.solution.totalActions, actions.length);
    console.log(JSON.stringify({ check: 'reference_baseline', actions: actions.length, states: reference.search.discovered }));

    const independent = [];
    for (const condition of [...constraints, ...parkingRestrictions]) {
        const quick = solveFastMap(map, { ...referenceBudget, restrictions: [condition] });
        const result = solveReferenceMap(map, { ...referenceBudget, restrictions: [condition] });
        assert.equal(quick.status, 'proven_unsat'); assert.equal(result.status, 'proven_unsat');
        independent.push({ condition, quick, result });
        console.log(JSON.stringify({ check: condition.id, status: result.status, states: result.search.discovered }));
    }
    const noGhostMap = structuredClone(map); noGhostMap.initialGhosts = [];
    const noGhost = solveReferenceMap(noGhostMap, referenceBudget);
    assert(proved(noGhost)); assert.equal(noGhost.solution.totalActions, e.noGhost.solution.totalActions);

    // 逐扇门改空地/实墙，区分门属性必要与组合关系被简化。
    const ablations = [];
    for (const edge of edges(map).filter(edge => [W.DOOR, W.LETTER_DOOR].includes(edge.wall.type))) {
        for (const type of [W.EMPTY, W.SOLID]) {
            const changed = structuredClone(map); changed[edge.axis + 'Walls'][edge.y][edge.x] = { type, keys: 0 };
            const quick = solveFastMap(changed, referenceBudget), result = solveReferenceMap(changed, referenceBudget);
            assert.notEqual(result.status, 'unknown'); assert.equal(result.status, quick.status);
            if (result.solution) assert.equal(result.solution.totalActions, quick.solution.totalActions);
            if (edge.wall.type === W.DOOR) assert.equal(result.status, 'proven_unsat');
            ablations.push({ edit: { ...edge, type }, quick, result });
            console.log(JSON.stringify({ check: 'wall_ablation', edge: [edge.axis, edge.x, edge.y], type, status: result.status, actions: result.solution?.totalActions ?? null }));
        }
    }

    // 没有玻璃，所以替换前后是同一地图；结论覆盖所有策略。
    const replacement = structuredClone(map);
    for (const edge of edges(replacement)) if (edge.wall.type === W.GLASS) replacement[edge.axis + 'Walls'][edge.y][edge.x] = { type: W.SOLID, keys: 0 };
    assert.deepEqual(replacement, map);
    const replacementMapId = createReferenceEnvironment(replacement).mapId; assert.equal(replacementMapId, original.mapId);
    const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
    const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina });
    let a = original.initialState(), b = fast.initialState(), c = restored.initialState();
    const browserTrace = [{ physical: traceState(c), seenCells: c.seenCells }];
    for (const action of actions) {
        const before = a; a = original.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
        assert.notEqual(a, before); assert(!a.isDead);
        assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
        assert.deepEqual(a.seenCells, c.seenCells);
        browserTrace.push({ physical: traceState(c), seenCells: c.seenCells });
    }
    assert(a.isWon);
    const exit = createReferenceEnvironment({ ...map, endPos: null }).replay(actions); assert(!exit.state.isDead);
    const initialSeen = original.initialState().seenCells[0];
    const record = { schemaVersion: 1, date: '2026-10-08', ruleset: original.ruleset, mapId: original.mapId,
        familyId: 'interlocked-parking-singlelayer-v1',
        splitGroup: 'dual-loop-relay-v1',
        provenance: { method: 'seeded_two_switch_proposals_then_relation_audit_and_local_minimization', seed: source.seed,
            proposal: source.index, proposalKind: source.kind, proposalCells: source.map.activeCells.flat().filter(Boolean).length,
            proposalActions: source.solution.solution.totalActions, requestedProposalIterations: source.search.requestedIterations,
            counts: source.search.counts, node: process.version, referenceMap: 'examples/user-refinements/user-01.json',
            learningModelUsed: false, independenceOfConceptClaimed: false },
        solution: e.baseline, reference, noGhost, coreChecks: e, independent, ablations,
        complexity: minimized.complexity, minimality: minimized.localMinimality, attempts: minimized.attempts,
        lineage: minimized.lineage, passes: minimized.passes, trace: e.trace,
        glassIndependence: { glassCount: 0, exactMapIdentity: true, replacementMapId, scope: 'all_strategies_same_map_and_rules' },
        initialVisibility: { ghosts: map.initialGhosts.map(g => initialSeen[g.y][g.x]), goal: initialSeen[map.endPos.y][map.endPos.x], knowledgeStrategyProven: false },
        exitWithoutGoal: physicalState(exit.state), sharecode: encoded.code, decodedMapId: restored.mapId,
        humanQuality: null, status: 'awaiting_user_review' };
    save('map.json', map); save('evidence.json', record); save('browser-trace.json', { actions, trace: browserTrace, mapId: restored.mapId });
    const manifest = [{ id: '01', familyId: record.familyId, splitGroup: record.splitGroup, mapId: original.mapId, ruleset: original.ruleset,
        cells: minimized.complexity[0], ghosts: map.initialGhosts.length, buttons: map.buttons.length,
        actions: actions.length, sharecode: encoded.code, status: record.status }];
    save('manifest.json', manifest);
    return { ...manifest[0], attempts: minimized.attempts, finalAudit: minimized.localMinimality.audit.length, ablations: ablations.length };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(build(), null, 2));
