import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { GameLogic } from '../../src/reference/engine.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { analyzeOrdinaryPlans } from '../../src/design/ordinary-plans.js';

const budget = { nodeBudget: 800000, stateBudget: 800000, budgetMs: 15000 };

export function analyzeMap(map) {
    const env = createReferenceEnvironment(map), withoutGoal = structuredClone(map);
    withoutGoal.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(withoutGoal);
    const straddles = (p, q, axis, x, y) => axis === 'h' ?
        p.x === x && q.x === x && Math.min(p.y, q.y) < y && y <= Math.max(p.y, q.y) :
        p.y === y && q.y === y && Math.min(p.x, q.x) < x && x <= Math.max(p.x, q.x);
    const splitsQueue = (before, after) => {
        if (before.player.x !== after.player.x || before.player.y !== after.player.y) return false;
        const old = before.layerStates[0], now = after.layerStates[0];
        const [a, b] = old.ghosts, [c, d] = now.ghosts;
        return [['h', 3, 2], ['h', 3, 5], ['v', 2, 3], ['v', 5, 3]].some(([axis, x, y]) =>
            old.wallStates[axis][y][x].currentState === 'open' &&
            now.wallStates[axis][y][x].currentState === 'closed' &&
            straddles(a, b, axis, x, y) && straddles(c, d, axis, x, y) &&
            GameLogic._canGhostSeePlayer(a, b, env.mapDefinition.layers[0], old));
    };
    const checks = [false, true].map(avoidOverlap => {
        const search = createBreadthFirstSearch(env, { monitor: {
            initial: () => [],
            advance: (history, before, action, after) => {
                if (after.isWon && noEnd.step(before, action).isDead || splitsQueue(before, after)) return null;
                if (avoidOverlap && new Set(after.layerStates[0].ghosts.map(g => `${g.x},${g.y}`)).size !== 2) return null;
                return history;
            }
        } });
        return { name: 'forbid-closing-between-collinear-ghosts', avoidOverlap,
            result: search.run(budget), actions: search.firstActions() };
    });
    const wrongPlans = [
        ['first-west', ['L', 'L', 'U', 'U', 'U', 'L']],
        ['north-direct', ['L', 'L', 'U', 'U', 'U', 'U', 'U', 'U', 'R', 'R', 'R', 'L']],
        ['close-east-early', ['R', 'R', 'R', 'R', 'U', 'U', 'U', 'L', 'U', 'U']]
    ].map(([name, prefix]) => {
        let state = env.initialState();
        for (const action of prefix) {
            const next = env.step(state, action);
            if (next === state || next.isDead || state.isWon) throw new Error(`错误计划前缀无效：${name}`);
            state = next;
        }
        const start = state, search = createBreadthFirstSearch({ ...env, initialState: () => start }, { monitor: {
            initial: () => [], advance: (history, before, action, after) =>
                after.isWon && noEnd.step(before, action).isDead ? null : history
        } });
        return { name, prefix, state: { p: [state.player.x, state.player.y],
            g: state.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: state.player.keys },
            result: search.run(budget), actions: search.firstActions(),
            scope: '设计者实际安全前缀，含非最优合法重合，去终点过滤；不是真人路线' };
    });
    return { scope: '原图全部无伤通关的指定空间事件查询；含非最优重合与禁止分别留证，不用事件必要证明新意。',
        checks, wrongPlans, ordinary: analyzeOrdinaryPlans(map, { ...budget, totalBudgetMs: 60000, orderBudget: 2 }),
        humanQuality: null };
}
