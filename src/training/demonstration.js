import assert from 'node:assert/strict';
import { DataSerializer } from '../reference/engine.js';
import { createReferenceEnvironment } from '../reference/environment.js';
import { solveFastMap } from '../search/fast-solver.js';
import { traceState } from '../review/trace-core.js';
import { verifyRecording } from '../review/recordings.js';
import { extractTemporalFeatures } from '../design/temporal-features.js';
import { analyzeMap } from '../design/analyze.js';

export function mapFromSharecode(sharecode) {
    const decoded = DataSerializer.loadFromShareCode(sharecode);
    if (!decoded.success) throw new TypeError('示范地图分享码无效');
    const { mapData, gameMode, initialHealth, initialStamina } = decoded.data;
    return { ...mapData, gameMode, initialHealth, initialStamina };
}

/** 无鬼规划只作直觉路线诊断，不能标成实际人类想法或人类质量分。 */
export function diagnoseRelaxedPlan(map, budget) {
    const plan = solveFastMap(map, { ...budget, withGhosts: false });
    if (plan.status !== 'solved') return { source: 'ghost_relaxed_solver', plan, replayOnOriginal: null };
    const env = createReferenceEnvironment(map);
    let state = env.initialState(), outcome = 'prefix_only', attempted = 0;
    for (const token of plan.solution.actions) {
        attempted++;
        const next = env.step(state, token);
        if (next === state) { outcome = 'invalid_action'; break; }
        state = next;
        if (state.isDead || state.isWon) { outcome = state.isDead ? 'death' : 'win'; break; }
    }
    return { source: 'ghost_relaxed_solver', plan,
        replayOnOriginal: { outcome, attempted, player: [state.player.layer, state.player.x, state.player.y] } };
}

/** 制备求解器监督数据；只标示一条已证最优延续，不把未选择动作当成已证错误。 */
export function prepareDemonstration(input, { familyId, source, budget = {}, feedbackReferences = [] } = {}) {
    if (typeof familyId !== 'string' || !familyId || !['human_recording', 'solver_certificate'].includes(source)) throw new TypeError('必须声明家族与示范来源');
    const verified = verifyRecording(input);
    if (!verified.cleanWin || input.ambiguities?.length) throw new TypeError('首版求解器示范要求无伤、无复活、无按键歧义的通关轨迹');
    const map = mapFromSharecode(input.sharecode), env = createReferenceEnvironment(map);
    const solved = solveFastMap(map, budget);
    if (solved.status !== 'solved' || solved.optimality !== 'proven') throw new Error('示范最优性未完成验证');
    if (solved.solution.totalActions !== input.actions.length) throw new Error('示范不是最短成功动作解');
    const rows = [];
    let state = env.initialState();
    for (const [index, chosenAction] of input.actions.entries()) {
        const acceptedActions = [], safeActions = [];
        for (const action of env.actions) {
            const next = env.step(state, action);
            if (next === state) continue;
            acceptedActions.push(action);
            if (!next.isDead) safeActions.push(action);
        }
        const dynamic = traceState(state);
        delete dynamic.player.steps;
        rows.push({ schemaVersion: 1, input: { mapId: env.mapId, dynamic, acceptedActions, safeActions },
            expectedOutput: { chosenAction, optimalRemainingActions: input.actions.length - index },
            metadata: { demonstrationId: input.id, familyId, source, ruleset: env.ruleset, index,
                observationScope: 'full_information', policyTarget: 'one_optimal_continuation', splitGroup: familyId } });
        assert(safeActions.includes(chosenAction));
        state = env.step(state, chosenAction);
    }
    const temporal = extractTemporalFeatures(map, input.actions);
    const causal = analyzeMap(map, temporal.hypotheses, budget);
    const relaxedDiagnostic = diagnoseRelaxedPlan(map, budget);
    return { schemaVersion: 1, datasetVersion: 'demonstration-v1', source, demonstrationId: input.id,
        familyId, splitGroup: familyId, ruleset: env.ruleset, mapId: env.mapId, map, rows,
        verified, optimality: solved, temporal, causal, relaxedDiagnostic, feedbackReferences,
        qualityScore: null, trainStarted: false };
}
