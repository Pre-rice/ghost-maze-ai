import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { minimizeDesign } from '../../src/design/minimize.js';
import { solveFastMap } from '../../src/search/fast-solver.js';
import { solveReferenceMap } from '../../src/search/reference-solver.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createFastEnvironment, physicalState } from '../../src/search/fast-environment.js';
import { compileRestrictions } from '../../src/search/restrictions.js';
import { DataSerializer, WALL_TYPES as W } from '../../src/reference/engine.js';

const BUDGET = { nodeBudget: 20000, stateBudget: 20000, budgetMs: 5000 };
const READ = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const proved = result => result.status === 'solved' && result.optimality === 'proven';
const BLOCKS = [0, 1].map(index => ({ id: `blocked_${index}`, sequence: [{ type: 'ghost_blocked', index }] }));

export function createUnitEvaluator(kind) {
    if (!['window_route', 'junction_interference'].includes(kind)) throw new TypeError('未知单元类型');
    const cache = new Map();
    return map => {
        const env = createReferenceEnvironment(map), id = env.mapId;
        if (cache.has(id)) return cache.get(id);
        const finish = value => { cache.set(id, value); return value; };
        const baseline = solveFastMap(map, BUDGET);
        if (!proved(baseline)) return finish({ accepted: false, reason: baseline.status === 'proven_unsat' ? 'unsat' : 'unknown', baseline });
        const constraints = [], contrasts = [];
        if (kind === 'window_route') {
            if (map.initialGhosts.length !== 1 || map.vWalls[2][2].type !== W.LOCKED || map.vWalls[1][4].type !== W.GLASS) return finish({ accepted: false, reason: 'changed_mechanism', baseline });
            for (const edit of [
                { axis: 'v', x: 2, y: 2, type: W.DOOR, id: 'lock_as_decorative_door' },
                { axis: 'v', x: 4, y: 1, type: W.SOLID, id: 'glass_as_opaque_wall' }
            ]) {
                const changed = structuredClone(map);
                changed[edit.axis + 'Walls'][edit.y][edit.x] = { type: edit.type, keys: 0 };
                const result = solveFastMap(changed, BUDGET); contrasts.push({ edit, result });
                if (result.status !== 'proven_unsat') return finish({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'changed_mechanism', baseline });
            }
        } else {
            if (map.initialGhosts.length !== 2) return finish({ accepted: false, reason: 'changed_mechanism', baseline });
            const fast = createFastEnvironment(map), moves = [0, 0]; let state = fast.initialState();
            for (const action of baseline.solution.actions) {
                const next = fast.step(state, action);
                for (let i = 0; i < 2; i++) if (state.layers[0].ghosts[i].x !== next.layers[0].ghosts[i].x || state.layers[0].ghosts[i].y !== next.layers[0].ghosts[i].y) moves[i]++;
                state = next;
            }
            if (moves.some(n => n === 0)) return finish({ accepted: false, reason: 'changed_mechanism', baseline });
            const result = solveFastMap(map, { ...BUDGET, restrictions: BLOCKS });
            constraints.push({ restrictions: BLOCKS, result });
            if (result.status !== 'proven_unsat') return finish({ accepted: false, reason: result.status === 'unknown' ? 'unknown' : 'changed_mechanism', baseline });
            const reversed = structuredClone(map); reversed.initialGhosts.reverse();
            const reverse = solveFastMap(reversed, BUDGET);
            if (!proved(reverse) || reverse.solution.totalActions !== baseline.solution.totalActions) return finish({ accepted: false, reason: reverse.status === 'unknown' ? 'unknown' : 'changed_mechanism', baseline });
            try { assert(createReferenceEnvironment(reversed).replay(baseline.solution.actions).state.isWon); }
            catch { return finish({ accepted: false, reason: 'changed_mechanism', baseline }); }
            const reverseConstraint = solveFastMap(reversed, { ...BUDGET, restrictions: BLOCKS });
            if (reverseConstraint.status !== 'proven_unsat') return finish({ accepted: false, reason: reverseConstraint.status === 'unknown' ? 'unknown' : 'changed_mechanism', baseline });
            contrasts.push({ edit: { id: 'reverse_ghost_order' }, result: reverse, constrained: reverseConstraint });
        }
        return finish({ accepted: true, baseline, constraints, contrasts });
    };
}

function trace(env, actions) {
    let state = env.initialState();
    const rows = [];
    for (const [index, action] of actions.entries()) {
        const before = state; state = env.step(state, action);
        assert.notEqual(state, before); assert(!state.isDead);
        rows.push({ index: index + 1, action, player: [state.player.x, state.player.y], keys: state.player.keys,
            ghosts: state.layerStates[0].ghosts.map(g => [g.x, g.y]),
            openedLocks: ['h', 'v'].flatMap(axis => env.mapDefinition.layers[0].initialWalls[axis].flatMap((row, y) => row.flatMap((wall, x) =>
                wall.type === W.LOCKED && state.layerStates[0].wallStates[axis][y][x].type === W.EMPTY ? [{ axis, x, y }] : []))),
            won: state.isWon });
    }
    return { state, rows };
}

export function buildUnits() {
    const records = [];
    for (const spec of [
        { id: '01', kind: 'window_route', familyId: 'opened-route-window-v1', source: 'source-01.json', seed: 7100702, proposal: 5894 },
        { id: '02', kind: 'junction_interference', familyId: 'two-ghost-junction-v1', source: 'source-02.json', seed: 7100707, proposal: 27319 }
    ]) {
        const minimized = minimizeDesign(READ(spec.source), createUnitEvaluator(spec.kind)), map = minimized.map;
        const env = createReferenceEnvironment(map), actions = minimized.evaluation.baseline.solution.actions;
        const reference = solveReferenceMap(map, { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000 });
        assert.equal(reference.status, 'solved'); assert.equal(reference.solution.totalActions, actions.length);
        const original = trace(env, actions);
        const encoded = DataSerializer.generateShareCode(map); assert(encoded.success);
        const decoded = DataSerializer.loadFromShareCode(encoded.code); assert(decoded.success);
        const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
        const restored = trace(createReferenceEnvironment({ ...mapData, gameMode, initialHealth, initialStamina }), actions);
        assert.deepEqual(physicalState(restored.state), physicalState(original.state));
        assert.deepEqual(restored.rows, original.rows);
        const exit = createReferenceEnvironment({ ...map, endPos: null }).replay(actions);
        const referenceConstraints = [];
        for (const constraint of minimized.evaluation.constraints) {
            const result = solveReferenceMap(map, { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000, restrictions: constraint.restrictions });
            assert.equal(result.status, 'proven_unsat'); referenceConstraints.push(result);
        }
        const referenceContrasts = [];
        for (const contrast of minimized.evaluation.contrasts) {
            if (contrast.edit.id === 'reverse_ghost_order') continue;
            const changed = structuredClone(map), { axis, x, y, type } = contrast.edit;
            changed[axis + 'Walls'][y][x] = { type, keys: 0 };
            const result = solveReferenceMap(changed, { nodeBudget: 100000, stateBudget: 100000, budgetMs: 60000 });
            assert.equal(result.status, 'proven_unsat'); referenceContrasts.push(result);
        }
        const noGhost = solveFastMap(map, { ...BUDGET, withGhosts: false });
        let state = env.initialState(), relaxedFailure;
        for (const [i, action] of noGhost.solution.actions.entries()) {
            const next = env.step(state, action);
            if (next === state || next.isDead || next.isWon) { relaxedFailure = { step: i + 1, reason: next.isDead ? 'death' : next.isWon ? 'win' : 'invalid', action }; break; }
            state = next;
        }
        const blockedSteps = [];
        if (spec.kind === 'junction_interference') {
            const monitor = compileRestrictions(env.mapDefinition, BLOCKS); state = env.initialState();
            for (const [i, action] of actions.entries()) {
                const next = env.step(state, action);
                if (monitor.advance([0, 0], state, action, next) === null) blockedSteps.push(i + 1);
                state = next;
            }
        }
        const record = { schemaVersion: 1, date: '2026-10-07', ...spec, ruleset: env.ruleset, mapId: env.mapId,
            complexity: minimized.complexity, ghostCount: map.initialGhosts.length, itemCount: map.items.length,
            solution: minimized.evaluation.baseline, reference,
            coreChecks: minimized.evaluation, referenceConstraints, referenceContrasts,
            minimality: minimized.localMinimality, lineage: minimized.lineage, attempts: minimized.attempts,
            trace: original.rows, blockedSteps, exitWithoutGoal: physicalState(exit.state), noGhost, relaxedFailure,
            sharecode: encoded.code, humanQuality: null, status: 'awaiting_user_review' };
        writeFileSync(new URL(`unit-${spec.id}.json`, import.meta.url), JSON.stringify(map, null, 2) + '\n');
        writeFileSync(new URL(`unit-${spec.id}-evidence.json`, import.meta.url), JSON.stringify(record, null, 2) + '\n');
        records.push(record);
    }
    writeFileSync(new URL('manifest.json', import.meta.url), JSON.stringify(records.map(r => ({ id: r.id, familyId: r.familyId,
        mapId: r.mapId, ruleset: r.ruleset, cells: r.complexity[0], ghosts: r.ghostCount,
        actions: r.solution.solution.totalActions, sharecode: r.sharecode, status: r.status })), null, 2) + '\n');
    return records;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(buildUnits().map(r => ({ id: r.id, complexity: r.complexity, blockedSteps: r.blockedSteps, sharecode: r.sharecode })), null, 2));
