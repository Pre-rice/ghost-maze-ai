import { performance } from 'node:perf_hooks';
import { createReferenceEnvironment } from '../reference/environment.js';
import { compileRestrictions, replayRestricted } from './restrictions.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';

const DEFAULT_BUDGET = Object.freeze({ nodeBudget: 10000, stateBudget: 2500, budgetMs: 2000 });

/**
 * 完整状态 BFS 参考基线：优化成功动作数 T，体力保留在状态中，故不会误合并零移动成本的按钮路线。
 * 只在队列穷尽时证明无伤无复活范围内无解；任一计算预算中断均为 unknown。
 */
export function solveReferenceMap(mapData, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('预算参数必须为对象');
    const { restrictions = [], ...givenBudget } = options;
    for (const key of Object.keys(givenBudget)) if (!Object.hasOwn(DEFAULT_BUDGET, key)) throw new TypeError(`未知预算参数：${key}`);
    const budget = { ...DEFAULT_BUDGET, ...givenBudget };
    for (const [name, value] of Object.entries(budget)) {
        if (!Number.isSafeInteger(value) || value < (name === 'stateBudget' ? 1 : 0)) throw new TypeError(`${name} 必须为有效非负整数，stateBudget 至少为 1`);
    }
    const env = createReferenceEnvironment(mapData);
    if (!env.mapDefinition.layers.some(layer => layer.initialEntities.endPos)) throw new TypeError('求解地图至少需要一个终点');
    const monitor = compileRestrictions(env.mapDefinition, restrictions);
    const started = performance.now();
    const search = createBreadthFirstSearch(env, { monitor });
    const result = search.run(budget);
    let solution = null;
    if (result.status === 'solved') {
        const actions = search.firstActions();
        const verified = replayRestricted(env, actions, monitor.specs);
        if (!verified.state.isWon) throw new Error('内部错误：搜索证书重放未胜利');
        solution = { actions, totalActions: verified.totalActions, movementCost: verified.movementCost };
    }
    return {
        schemaVersion: 1, status: result.status, reason: result.reason, ruleset: env.ruleset, mapId: env.mapId,
        scope: { gameMode: env.mapDefinition.gameMode, objective: 'zero_hit_no_revive', metric: 'successful_actions', actions: env.actions, restrictions: monitor.specs },
        optimality: result.status === 'solved' ? 'proven' : null, solution,
        search: { expanded: result.expanded, transitions: result.transitions, discovered: result.discovered,
            exhausted: result.status === 'proven_unsat', elapsedMs: performance.now() - started, budget }
    };
}
