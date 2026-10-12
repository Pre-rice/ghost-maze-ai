import { performance } from 'node:perf_hooks';
import { createReferenceEnvironment } from '../reference/environment.js';
import { compileRestrictions, replayRestricted } from './restrictions.js';

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
    const initial = env.initialState();
    const monitor = compileRestrictions(env.mapDefinition, restrictions), firstProgress = monitor.initial();
    const keyOf = (state, progress) => `${env.stateKey(state)}|monitor:${progress.join(',')}`;
    const started = performance.now();
    const entries = [{ state: initial, progress: firstProgress, parent: -1, action: null }];
    const visited = new Set([keyOf(initial, firstProgress)]);
    let expanded = 0, transitions = 0;
    const finish = (status, reason, solution = null) => ({
        schemaVersion: 1, status, reason, ruleset: env.ruleset, mapId: env.mapId,
        scope: { gameMode: env.mapDefinition.gameMode, objective: 'zero_hit_no_revive', metric: 'successful_actions', actions: env.actions, restrictions: monitor.specs },
        optimality: status === 'solved' ? 'proven' : null,
        solution,
        search: { expanded, transitions, discovered: visited.size, exhausted: status === 'proven_unsat', elapsedMs: performance.now() - started, budget }
    });
    if (initial.isWon) return finish('solved', 'goal_reached', { actions: [], totalActions: 0, movementCost: 0 });
    for (let head = 0; head < entries.length; head++) {
        if (expanded >= budget.nodeBudget) return finish('unknown', 'node_budget');
        if (performance.now() - started >= budget.budgetMs) return finish('unknown', 'time_budget');
        const current = entries[head];
        expanded++;
        for (const action of env.actions) {
            if (performance.now() - started >= budget.budgetMs) return finish('unknown', 'time_budget');
            const next = env.step(current.state, action);
            transitions++;
            if (next === current.state || next.isDead) continue;
            const progress = monitor.advance(current.progress, current.state, action, next);
            if (progress === null) continue;
            if (next.isWon) {
                const actions = [action];
                for (let index = head; entries[index].parent !== -1; index = entries[index].parent) actions.push(entries[index].action);
                actions.reverse();
                // 成功前独立重放，不能把搜索节点直接当作可信证书。
                const verified = replayRestricted(env, actions, monitor.specs);
                if (!verified.state.isWon) throw new Error('内部错误：搜索证书重放未胜利');
                return finish('solved', 'goal_reached', { actions, totalActions: verified.totalActions, movementCost: verified.movementCost });
            }
            const key = keyOf(next, progress);
            if (visited.has(key)) continue;
            if (entries.length >= budget.stateBudget) return finish('unknown', 'state_budget');
            visited.add(key);
            entries.push({ state: next, progress, parent: head, action });
        }
        // 回溯只需父节点和动作，释放已展开的重型快照。
        current.state = null;
    }
    return finish('proven_unsat', 'frontier_exhausted');
}
