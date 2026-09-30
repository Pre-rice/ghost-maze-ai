import { solveFastMap } from '../search/fast-solver.js';
import { compileRestrictions } from '../search/restrictions.js';
import { createReferenceEnvironment } from '../reference/environment.js';

/** 每个假说分别禁止；地图变体必须单独分析，不能冒充原图中的必要性证明。 */
export function analyzeMap(mapData, hypotheses = [], budget = {}) {
    if (Object.keys(budget).some(key => !['nodeBudget', 'stateBudget', 'budgetMs'].includes(key))) throw new TypeError('分析仅接受求解预算');
    const env = createReferenceEnvironment(mapData);
    compileRestrictions(env.mapDefinition, hypotheses);
    const baseline = solveFastMap(mapData, budget);
    const counterfactuals = hypotheses.map(hypothesis => {
        const result = solveFastMap(mapData, { ...budget, restrictions: [hypothesis] });
        let conclusion = 'unknown';
        if (baseline.status === 'proven_unsat') conclusion = 'base_unsat';
        else if (result.status === 'solved') conclusion = 'avoidable';
        else if (baseline.status === 'solved' && result.status === 'proven_unsat') conclusion = 'necessary_within_scope';
        return { hypothesis, conclusion, result };
    });
    return { schemaVersion: 1, evaluatorVersion: 'counterfactual-v1', ruleset: env.ruleset, mapId: env.mapId,
        baseline, counterfactuals, humanPreference: null };
}
