import { performance } from 'node:perf_hooks';
import { createFastEnvironment } from '../search/fast-environment.js';
import { stateKey } from '../validate/simulator.js';

/** 从实际动作前缀继续做可达性诊断；资源支配只用于解性，不声明后缀最短。 */
export function solveContinuation(map, prefix, { nodeBudget = 30000, budgetMs = 1000, reference = false } = {}) {
    const fast = createFastEnvironment(map), env = reference ? fast.reference : fast;
    let state = env.initialState();
    for (const action of prefix) {
        const next = env.step(state, action);
        if (next === state || next.isDead || state.isWon) throw new Error('前缀需要全部有效、安全且未提前终止');
        state = next;
    }
    const key = reference ? s => env.stateKey(s) : s => stateKey({ ...s, player: { ...s.player, stamina: null } }, fast.sim);
    const queue = [{ state, parent: -1, action: null }], seen = new Map([[key(state), state.player.stamina]]), started = performance.now();
    let expanded = 0;
    const result = (status, reason, actions = null) => ({ status, reason, prefix, actions, optimality: null,
        search: { algorithm: reference ? 'reference_bfs' : 'fast_resource_reachability', expanded, discovered: seen.size,
            exhausted: reason === 'frontier_exhausted', elapsedMs: performance.now() - started, nodeBudget, budgetMs } });
    for (let head = 0; head < queue.length; head++) {
        if (expanded >= nodeBudget || performance.now() - started >= budgetMs) return result('unknown', 'budget');
        const node = queue[head]; expanded++;
        if (node.state.isWon) {
            const actions = [];
            for (let i = head; queue[i].parent >= 0; i = queue[i].parent) actions.push(queue[i].action);
            actions.reverse(); fast.reference.replay([...prefix, ...actions]);
            return result('solved', 'goal_reached', actions);
        }
        for (const action of ['U', 'R', 'D', 'L']) {
            const next = env.step(node.state, action);
            if (next === node.state || next.isDead) continue;
            const k = key(next);
            if ((seen.get(k) ?? -1) >= next.player.stamina) continue;
            seen.set(k, next.player.stamina); queue.push({ state: next, parent: head, action });
        }
        node.state = null;
    }
    return result('proven_unsat', 'frontier_exhausted');
}
