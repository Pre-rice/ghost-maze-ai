import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { createFastEnvironment, physicalState } from './fast-environment.js';
import { relaxedDistField } from './relaxed-distance.js';
import { buildGhostRelaxation } from './ghost-relaxation.js';
import { compileRestrictions, replayRestricted } from './restrictions.js';

// 堆节点保留自己的 g、父节点和动作，不能用可被覆盖的状态键回溯旧分支。
class Queue {
    nodes = [];
    before(a, b) { return a.f < b.f || (a.f === b.f && (a.rank < b.rank || (a.rank === b.rank && (a.g > b.g || (a.g === b.g && a.order < b.order))))); }
    push(node) {
        const a = this.nodes; a.push(node);
        for (let i = a.length - 1; i > 0;) {
            const parent = (i - 1) >> 1;
            if (!this.before(a[i], a[parent])) break;
            [a[i], a[parent]] = [a[parent], a[i]]; i = parent;
        }
    }
    pop() {
        const a = this.nodes, result = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            for (let i = 0;;) {
                let best = i;
                for (const child of [i * 2 + 1, i * 2 + 2]) if (child < a.length && this.before(a[child], a[best])) best = child;
                if (best === i) break;
                [a[i], a[best]] = [a[best], a[i]]; i = best;
            }
        }
        return result;
    }
}

const DEFAULT_BUDGET = { nodeBudget: 10000, stateBudget: 2500, budgetMs: 2000 };

/** A* 快求解：动态资源完整去重，全层乐观下界，预算中断保留已发现证书但不冒称最优。 */
export function solveFastMap(mapData, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('预算参数必须为对象');
    const { withGhosts = true, restrictions = [], rankCandidate = null, ghostRelaxation = false, ...givenBudget } = options;
    if (typeof withGhosts !== 'boolean') throw new TypeError('withGhosts 必须为布尔值');
    if(rankCandidate!==null&&typeof rankCandidate!=='function')throw new TypeError('rankCandidate 必须为函数或null');
    if(ghostRelaxation!==false&&ghostRelaxation!==true&&(!ghostRelaxation||typeof ghostRelaxation!=='object'||Array.isArray(ghostRelaxation)||Object.keys(ghostRelaxation).some(k=>!['nodeBudget','stateBudget','budgetMs'].includes(k))))throw new TypeError('ghostRelaxation 必须为布尔值或子问题预算');
    for (const key of Object.keys(givenBudget)) if (!Object.hasOwn(DEFAULT_BUDGET, key)) throw new TypeError(`未知预算参数：${key}`);
    const budget = { ...DEFAULT_BUDGET, ...givenBudget };
    for (const [name, value] of Object.entries(budget)) if (!Number.isSafeInteger(value) || value < (name === 'stateBudget' ? 1 : 0)) throw new TypeError(`非法预算：${name}`);
    const env = createFastEnvironment(mapData, { withGhosts }), reference = env.reference;
    if (!reference.mapDefinition.layers.some(layer => layer.initialEntities.endPos)) throw new TypeError('求解地图至少需要一个终点');
    const monitor = compileRestrictions(reference.mapDefinition, restrictions);
    const started = performance.now(), initial = env.initialState(), firstProgress = monitor.initial();
    const keyOf = (state, progress) => `${env.stateKey(state)}|monitor:${progress.join(',')}`;
    const firstKey = keyOf(initial, firstProgress);
    const bestG = new Map([[firstKey, 0]]), queue = new Queue();
    let expanded = 0, transitions = 0, incumbent = null, order = 0, relaxation = null;
    const finish = (status, reason, optimality = null) => {
        const elapsedMs = performance.now() - started;
        let solution = null;
        if (status === 'solved') {
            const actions = [];
            for (let node = incumbent; node.parent; node = node.parent) actions.push(node.action);
            actions.reverse();
            const verified = reference.replay(actions);
            if (monitor.specs.length) replayRestricted(reference, actions, monitor.specs);
            assert(verified.state.isWon, '快求解证书未在原引擎中胜利');
            assert.deepEqual(physicalState(verified.state), physicalState(incumbent.state), '快模拟器的终局物理状态与原引擎不一致');
            solution = { actions, totalActions: verified.totalActions, movementCost: verified.movementCost };
        }
        return {
            schemaVersion: 1, status, reason, ruleset: reference.ruleset, mapId: env.sourceMapId,
            scope: { gameMode: reference.mapDefinition.gameMode, objective: 'zero_hit_no_revive', metric: 'successful_actions', actions: reference.actions, withGhosts, restrictions: monitor.specs },
            optimality, solution,
            search: { algorithm: 'astar', expanded, transitions, discovered: bestG.size, exhausted: reason === 'frontier_exhausted', elapsedMs, budget,
                ...(relaxation?{ghostRelaxation:{status:relaxation.status,states:relaxation.states,expanded:relaxation.expanded,elapsedMs:relaxation.elapsedMs}}:{}) }
        };
    };
    const interrupted = reason => finish(incumbent ? 'solved' : 'unknown', reason, incumbent ? 'not_proven' : null);
    if (budget.nodeBudget === 0) return interrupted('node_budget');
    if (budget.budgetMs === 0) return interrupted('time_budget');
    const fields = relaxedDistField(env.sim);
    if(ghostRelaxation){const options=ghostRelaxation===true?{}:ghostRelaxation;relaxation=buildGhostRelaxation(mapData,{...options,budgetMs:Math.min(options.budgetMs??50,budget.budgetMs)});}
    const h = state => Math.max(fields[state.player.layer][state.player.y][state.player.x],relaxation?.lowerBound(state)??0);
    if (performance.now() - started >= budget.budgetMs) return interrupted('time_budget');
    if (!Number.isFinite(h(initial))) return finish('proven_unsat', 'relaxed_unreachable');
    queue.push({ key: firstKey, progress: firstProgress, state: initial, g: 0, f: h(initial), rank:0, parent: null, action: null, order: order++ });
    while (queue.nodes.length) {
        if (expanded >= budget.nodeBudget) return interrupted('node_budget');
        if (performance.now() - started >= budget.budgetMs) return interrupted('time_budget');
        const node = queue.pop();
        if (node.g !== bestG.get(node.key)) continue;
        if (node.state.isWon) { incumbent = node; return finish('solved', 'goal_reached', 'proven'); }
        expanded++;
        for (const action of reference.actions) {
            if (performance.now() - started >= budget.budgetMs) return interrupted('time_budget');
            const next = env.step(node.state, action); transitions++;
            if (next === node.state || next.isDead) continue;
            const progress = monitor.advance(node.progress, node.state, action, next);
            if (progress === null) continue;
            const key = keyOf(next, progress), g = node.g + 1, lower = h(next);
            if (g >= (bestG.get(key) ?? Infinity) || !Number.isFinite(lower)) continue;
            // 研究模型只在相同f内排序；不修改g／下界／访问键，不剪枝。
            const rank=rankCandidate?rankCandidate(node.state,action,next):0;
            if(!Number.isFinite(rank))throw new TypeError('候选排序值必须有限');
            const child = { key, progress, state: next, g, f: g + lower, rank, parent: node, action, order: order++ };
            if (next.isWon && (!incumbent || g < incumbent.g)) incumbent = child;
            if (!bestG.has(key) && bestG.size >= budget.stateBudget) return interrupted('state_budget');
            bestG.set(key, g);
            queue.push(child);
        }
        // 父链只保留回溯信息；不能修改 g、key、parent 或 action。
        node.state = null;
    }
    return incumbent ? finish('solved', 'frontier_exhausted', 'proven') : finish('proven_unsat', 'frontier_exhausted');
}
