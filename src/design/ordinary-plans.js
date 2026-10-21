import { createReferenceEnvironment } from '../reference/environment.js';
import { validateMapData } from '../reference/engine.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';

const defaults = { nodeBudget: 250000, stateBudget: 250000, budgetMs: 10000,
    totalBudgetMs: 60000, orderBudget: 24, avoidOverlap: true };
const overlaps = state => state.layerStates.some(layer =>
    new Set(layer.ghosts.map(g => `${g.x},${g.y}`)).size !== layer.ghosts.length);

function* permutations(values) {
    if (!values.length) { yield []; return; }
    for (const value of values) for (const tail of permutations(values.filter(x => x !== value))) yield [value, ...tail];
}

/** 找完整普通替代，不给趣味分；单层数组索引只标记角色，不参与引擎决策。 */
export function analyzeOrdinaryPlans(map, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('分析选项必须为对象');
    for (const key of Object.keys(options)) if (!Object.hasOwn(defaults, key)) throw new TypeError(`未知分析选项：${key}`);
    const budget = { ...defaults, ...options };
    for (const [key, value] of Object.entries(budget)) {
        if (key === 'avoidOverlap') {
            if (typeof value !== 'boolean') throw new TypeError('avoidOverlap 必须为布尔值');
        } else if (!Number.isSafeInteger(value) || value < (key === 'stateBudget' ? 1 : 0)) {
            throw new TypeError(`非法分析预算：${key}`);
        }
    }
    const checked = validateMapData(map, { requireEnd: false });
    if (!checked.valid) throw new TypeError(`地图无效：${checked.error}`);
    const env = createReferenceEnvironment(checked.mapData);
    if (env.mapDefinition.layerCount !== 1 || env.mapDefinition.stairs.length) throw new TypeError('普通计划核查当前只支持单层地图');
    if (!env.mapDefinition.layers[0].initialEntities.endPos) throw new TypeError('普通计划核查需要终点');
    const noEndMap = structuredClone(checked.mapData);
    noEndMap.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(noEndMap), initial = env.initialState();
    const ghosts = initial.layerStates[0].ghosts.map((g, index) => ({ index, initialPosition: [g.x, g.y] }));
    const indices = ghosts.map(g => g.index), started = performance.now();
    const remaining = () => Math.max(0, budget.totalBudgetMs - (performance.now() - started));
    function query(rank) {
        if (!remaining() || !budget.budgetMs || !budget.nodeBudget) {
            return { result: { status: 'unknown', reason: 'budget', totalActions: null }, actions: null, movementSpans: null };
        }
        const q = createBreadthFirstSearch(env, { monitor: {
            initial: () => [0],
            advance: (history, before, action, after) => {
                if (budget.avoidOverlap && overlaps(after)) return null;
                if (after.isWon && noEnd.step(before, action).isDead) return null;
                if (!rank) return history;
                const moved = before.layerStates[0].ghosts.flatMap((g, i) => {
                    const n = after.layerStates[0].ghosts[i];
                    return g.x !== n.x || g.y !== n.y ? [rank[i]] : [];
                });
                if (!moved.length) return history;
                // 同一动作可是一方最后移动、另一方首次移动；之后不能再回到前一阶段。
                return Math.min(...moved) < history[0] ? null : [Math.max(...moved)];
            }
        } });
        const result = q.run({ nodeBudget: budget.nodeBudget, stateBudget: budget.stateBudget,
            budgetMs: Math.min(budget.budgetMs, remaining()) });
        const actions = q.firstActions();
        let movementSpans = null;
        if (actions) {
            movementSpans = ghosts.map(g => ({ ghost: g.index, firstMove: null, lastMove: null }));
            let state = env.initialState();
            for (const [index, action] of actions.entries()) {
                if (state.isDead || state.isWon) throw new Error('普通计划证书含终局后动作');
                const next = env.step(state, action);
                if (next === state || next.isDead) throw new Error('普通计划证书含无效或死亡动作');
                state.layerStates[0].ghosts.forEach((g, i) => {
                    const n = next.layerStates[0].ghosts[i];
                    if (g.x !== n.x || g.y !== n.y) {
                        movementSpans[i].firstMove ??= index + 1;
                        movementSpans[i].lastMove = index + 1;
                    }
                });
                state = next;
            }
            if (!state.isWon) throw new Error('普通计划证书未通关');
            if (rank) for (const a of movementSpans) for (const b of movementSpans) {
                if (rank[a.ghost] < rank[b.ghost] && a.lastMove !== null && b.firstMove !== null &&
                    a.lastMove > b.firstMove) throw new Error('普通计划证书不符合所查移动顺序');
            }
        }
        return { result, actions, movementSpans };
    }
    const baseline = query(null), queries = [];
    const run = (kind, rank, details) => {
        const answer = query(rank);
        const row = { kind, ...details, ...answer, sameBaselineLength: answer.result.status === 'solved' &&
            baseline.result.status === 'solved' ? answer.result.totalActions === baseline.result.totalActions : null };
        queries.push(row);
        return row;
    };
    // 基线在同一明确范围穷尽无解时，不再花预算求其子集。
    if (baseline.result.status !== 'proven_unsat') {
        for (const index of indices) {
            run('independent_prefix', indices.map(i => i === index ? 0 : 1), { ghost: index });
            run('independent_suffix', indices.map(i => i === index ? 1 : 0), { ghost: index });
        }
        let count = 0;
        if (indices.length) for (const order of permutations(indices)) {
            if (count >= budget.orderBudget) break;
            run('complete_sequential', indices.map(i => order.indexOf(i)), { order });
            count++;
        }
    }
    const totalOrders = indices.length ? indices.reduce((n, _, i) => n * BigInt(i + 1), 1n) : 0n;
    const orders = queries.filter(q => q.kind === 'complete_sequential');
    const complete = BigInt(orders.length) === totalOrders && orders.every(q => q.result.status !== 'unknown');
    const conclusion = baseline.result.status === 'proven_unsat' ? 'base_unsat_within_scope' :
        !indices.length ? 'no_ghosts' :
        orders.some(q => q.result.status === 'solved') ? 'complete_sequential_witness_found' :
        complete ? 'no_complete_sequential_plan_within_scope' : 'unknown';
    return { analysisVersion: 'ordinary-plans-v1', mapId: env.mapId, ruleset: env.ruleset, ghosts, budget,
        scope: { singleLayerOnly: true, noDamageOrRevival: true, avoidOverlap: budget.avoidOverlap,
            arrivalDeathCheckedWithoutGoal: true,
            movement: '按本体实际记录计鬼移动；终局动作另查去终点死亡，不把该反事实当实际轨迹',
            handoff: '一方末次与另一方首次移动允许同一动作；不要求所有鬼必须移动',
            history: '处理阶段进入完整状态键；本体参考键保留同层鬼数组位置',
            optimality: '只比较本报告明确限制范围内的最短步数，不能替代正式全部最优验收' },
        baseline, queries, completeOrders: { possible: totalOrders.toString(), queried: orders.length,
            coverageComplete: complete }, conclusion, humanQualityScore: null,
        interpretation: '有普通替代只给出具体证书；没有普通替代也不证明新意、难度或尤里卡。',
        elapsedMs: performance.now() - started };
}
