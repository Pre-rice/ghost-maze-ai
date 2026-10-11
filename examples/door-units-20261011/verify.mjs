import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { DataSerializer, ReplaySerializer, WALL_TYPES as W } from '../../src/reference/engine.js';

// 仅核验已保存的两张新题；不重跑探索、不覆盖原证据或真人录制。
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const save = (name, data) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const budget = { nodeBudget: 100000, stateBudget: 100000, budgetMs: 10000 };
const solved = result => result.status === 'solved' && result.optimality === 'proven';
const engineCommit = execFileSync('git', ['-C', '../ghost-maze', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const specs = [
    { id: '01', title: '《两面》', door: { axis: 'v', x: 2, y: 1 }, lock: null },
    { id: '02', title: '《开路》', door: { axis: 'v', x: 4, y: 1 }, lock: { axis: 'v', x: 4, y: 3 } }
];
const manifest = [];
for (const spec of specs) {
    const map = read('unit-' + spec.id + '.json'), source = read('source-' + spec.id + '.json');
    const selection = read('unit-' + spec.id + '-selection.json');
    const env = createReferenceEnvironment(map), fastEnv = createFastEnvironment(map);
    const fast = solveFastMap(map, budget), reference = solveReferenceMap(map, budget);
    assert(solved(fast) && solved(reference));
    assert.equal(fast.solution.totalActions, reference.solution.totalActions);
    const actions = fast.solution.actions;
    assert.equal(selection.localMinimality.unresolved, 0);
    assert.equal(map.buttons.length, 0);
    assert.equal(map.initialGhosts.length, 2);
    // 不含玻璃或字母门；换掉全部玻璃所得地图逐字段相同，覆盖所有策略。
    for (const row of [...map.hWalls, ...map.vWalls]) for (const wall of row) {
        assert.notEqual(wall.type, W.GLASS); assert.notEqual(wall.type, W.LETTER_DOOR);
    }
    const encoded = DataSerializer.generateShareCode(map); assert(encoded.success, encoded.error);
    const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success, decoded.error);
    const restored = createReferenceEnvironment(decoded.data.mapData);
    assert.equal(restored.mapId, env.mapId);
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
        trace.push({ index: index + 1, action, player: [a.player.x, a.player.y],
            ghosts: a.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: a.player.keys });
    }
    assert(a.isWon);
    // 删除终点后仍安全，避免把立即判胜当作最后一步躲鬼办法。
    const withoutGoal = createReferenceEnvironment({ ...map, endPos: null }).replay(actions);
    assert(!withoutGoal.state.isDead);
    const contrasts = [];
    for (const [edge, types] of [[spec.door, [W.EMPTY, W.SOLID]], [spec.lock, [W.EMPTY, W.DOOR]]]) {
        if (!edge) continue;
        for (const type of types) {
            const changed = structuredClone(map); changed[edge.axis + 'Walls'][edge.y][edge.x] = { type, keys: 0 };
            const f = solveFastMap(changed, budget), r = solveReferenceMap(changed, budget);
            assert.equal(f.status, 'proven_unsat'); assert.equal(r.status, 'proven_unsat');
            contrasts.push({ edge, type, fast: f, reference: r });
        }
    }
    const requirements = [];
    for (const restriction of selection.specs) {
        const f = solveFastMap(map, { ...budget, restrictions: [restriction] });
        const r = solveReferenceMap(map, { ...budget, restrictions: [restriction] });
        assert.equal(f.status, 'proven_unsat'); assert.equal(r.status, 'proven_unsat');
        requirements.push({ restriction, fast: f, reference: r });
    }
    const blockRestrictions = [0, 1].map(index => ({ id: 'forbid-block-' + index, sequence: [{ type: 'ghost_blocked', index }] }));
    const blocked = solveFastMap(map, { ...budget, restrictions: blockRestrictions });
    const referenceBlocked = solveReferenceMap(map, { ...budget, restrictions: blockRestrictions });
    assert.equal(blocked.status, 'proven_unsat'); assert.equal(referenceBlocked.status, 'proven_unsat');
    const reversedMap = { ...map, initialGhosts: [...map.initialGhosts].reverse() };
    const reversed = solveReferenceMap(reversedMap, budget); assert(solved(reversed));
    assert.equal(reversed.solution.totalActions, actions.length);
    assert(createReferenceEnvironment(reversedMap).replay(actions).state.isWon);
    const ghostRemoval = [0, 1].map(index => solveReferenceMap({ ...map,
        initialGhosts: map.initialGhosts.filter((_, i) => i !== index) }, budget));
    assert(ghostRemoval.every(result => solved(result) && result.solution.totalActions < actions.length));
    const record = { schemaVersion: 1, date: '2026-10-11', ...spec,
        familyId: 'door-mediated-ghost-queue-v1', splitGroup: 'door-mediated-ghost-queue-v1',
        engineCommit, ruleset: env.ruleset, mapId: env.mapId, node: process.version,
        provenance: { seed: source.seed, proposal: source.proposal, parentProposal: source.parentProposal,
            sourceCells: source.map.activeCells.flat().filter(Boolean).length, searchSummary: source.searchSummary,
            method: spec.id === '01' ? 'seeded_static_door_proposals_then_two_side_requirement_and_local_minimization' :
                'seeded_edits_of_static_door_parent_then_consumed_bridge_requirement_and_local_minimization' },
        solution: fast, reference, contrasts, requirements, blocked, referenceBlocked, reversed, ghostRemoval,
        trace, withoutGoal: physicalState(withoutGoal.state),
        sharecode: encoded.code, replayCode: replay.code, glassIndependence: { glassCount: 0, exactMapIdentity: true },
        checks: { mapCodeRoundtrip: true, replayCodeRoundtrip: true, perStepPhysicalIdentity: true,
            reversedCertificateWins: true, fogKnowledgeStrategyProven: false },
        humanQuality: null, status: 'awaiting_user_review' };
    save('unit-' + spec.id + '-evidence.json', record);
    manifest.push({ id: spec.id, title: spec.title, cells: map.activeCells.flat().filter(Boolean).length,
        ghosts: 2, buttons: 0, doors: spec.lock ? 2 : 1, keys: map.items.length,
        actions: actions.length, mapId: env.mapId, ruleset: env.ruleset,
        sharecode: encoded.code, replayCode: replay.code, familyId: record.familyId,
        humanQuality: null, status: record.status });
}
save('manifest.json', manifest);
console.log(JSON.stringify(manifest, null, 2));
