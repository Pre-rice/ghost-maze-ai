import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { minimizeDesign } from '../../src/design/minimize.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';
import { createEvaluator, proved, walls } from './explore.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000 };

export function buildUnits() {
    const summaries = [];
    for (const spec of [
        { id: '01', kind: 'arrow', familyId: 'one-way-consumed-lock-loop-v1' },
        { id: '02', kind: 'switch', familyId: 'single-switch-stop-go-v1' }
    ]) {
        const source = read('source-' + spec.id + '.json'), minimized = minimizeDesign(source.map, createEvaluator(spec.kind));
        const map = minimized.map, e = minimized.evaluation, actions = e.baseline.solution.actions;
        assert.equal(minimized.localMinimality.unresolved, 0);
        const original = createReferenceEnvironment(map), fast = createFastEnvironment(map);
        const reference = solveReferenceMap(map, budget);
        assert(proved(reference)); assert.equal(reference.solution.totalActions, actions.length);
        // 完全不含玻璃；将全部玻璃换墙得到逐字段相同的地图，覆盖所有策略而非只检查一条解。
        const replacement = structuredClone(map);
        for (const edge of walls(replacement)) if (edge.wall.type === W.GLASS) replacement[edge.axis + 'Walls'][edge.y][edge.x] = { type: W.SOLID, keys: 0 };
        assert.deepEqual(replacement, map);
        const replaced = createReferenceEnvironment(replacement); assert.equal(replaced.mapId, original.mapId);
        const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
        const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
        const { mapData, gameMode, initialHealth } = decoded.data;
        const restored = createReferenceEnvironment({ ...mapData, gameMode, initialHealth });
        let a = original.initialState(), b = fast.initialState(), c = restored.initialState();
        const trace = [];
        for (const [index, action] of actions.entries()) {
            const before = a; a = original.step(a, action); b = fast.step(b, action); c = restored.step(c, action);
            assert.notEqual(a, before); assert(!a.isDead);
            assert.deepEqual(physicalState(a), physicalState(b)); assert.deepEqual(physicalState(a), physicalState(c));
            trace.push({ index: index + 1, action, player: [a.player.x, a.player.y], ghosts: a.layerStates[0].ghosts.map(g => [g.x, g.y]),
                keys: a.player.keys, stationary: a.player.x === before.player.x && a.player.y === before.player.y,
                gates: walls(map).filter(edge => edge.wall.type === W.LETTER_DOOR).map(edge => a.layerStates[0].wallStates[edge.axis][edge.y][edge.x].currentState) });
        }
        assert(a.isWon);
        const exit = createReferenceEnvironment({ ...map, endPos: null }).replay(actions);
        assert(!exit.state.isDead);
        const independent = [];
        for (const constraint of e.constraints) {
            const result = solveReferenceMap(map, { ...budget, restrictions: constraint.restrictions });
            assert.equal(result.status, 'proven_unsat'); independent.push({ restrictions: constraint.restrictions, result });
        }
        for (const contrast of e.contrasts) {
            const changed = structuredClone(map), edge = contrast.edit;
            changed[edge.axis + 'Walls'][edge.y][edge.x] = { type: edge.type, keys: 0 };
            const result = solveReferenceMap(changed, budget); assert.equal(result.status, contrast.result.status);
            if (result.solution) assert.equal(result.solution.totalActions, contrast.result.solution.totalActions);
            independent.push({ edit: edge, result });
        }
        const seen = original.initialState().seenCells[0];
        const record = { schemaVersion: 1, date: '2026-10-08', ...spec, ruleset: original.ruleset, mapId: original.mapId,
            provenance: { method: 'seeded_small_grid_search_then_mechanism_filter_and_local_minimization', seed: source.seed, proposal: source.index, node: process.version,
                proposalCells: source.map.activeCells.flat().filter(Boolean).length, proposalActions: source.evaluation.baseline.solution.totalActions },
            solution: e.baseline, reference, coreChecks: e, independent, complexity: minimized.complexity,
            minimality: minimized.localMinimality, lineage: minimized.lineage, attempts: minimized.attempts, trace,
            glassIndependence: { glassCount: 0, exactMapIdentity: true, replacementMapId: replaced.mapId, scope: 'all_strategies_same_map_and_rules' },
            initialVisibility: { ghosts: map.initialGhosts.map(g => seen[g.y][g.x]), goal: seen[map.endPos.y][map.endPos.x], knowledgeStrategyProven: false },
            exitWithoutGoal: physicalState(exit.state), sharecode: encoded.code, humanQuality: null, status: 'awaiting_user_review' };
        save('unit-' + spec.id + '.json', map); save('unit-' + spec.id + '-evidence.json', record);
        summaries.push({ id: spec.id, familyId: spec.familyId, mapId: original.mapId, ruleset: original.ruleset,
            cells: minimized.complexity[0], ghosts: map.initialGhosts.length, items: map.items.length, buttons: map.buttons.length,
            actions: actions.length, sharecode: encoded.code, status: record.status });
    }
    save('manifest.json', summaries); return summaries;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(buildUnits(), null, 2));
