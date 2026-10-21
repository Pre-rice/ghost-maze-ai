import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { analyzeOrdinaryPlans } from '../../src/design/ordinary-plans.js';

const budget = { nodeBudget: 700000, stateBudget: 700000, budgetMs: 15000 };
const overlaps = state => new Set(state.layerStates[0].ghosts.map(g => `${g.x},${g.y}`)).size !== 3;

export function analyzeMap(map) {
    const env = createReferenceEnvironment(map), withoutGoal = structuredClone(map);
    withoutGoal.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(withoutGoal), checks = [];
    for (const avoidOverlap of [false, true]) for (const name of ['never-return-initial',
        'never-reuse-first-park', 'never-move-0', 'never-move-1', 'never-move-2']) {
        const search = createBreadthFirstSearch(env, { monitor: {
            initial: () => [0],
            advance: (history, before, action, after) => {
                if (after.isWon && noEnd.step(before, action).isDead || avoidOverlap && overlaps(after)) return null;
                const old = before.layerStates[0].ghosts[0], ghost = after.layerStates[0].ghosts[0];
                if (name === 'never-return-initial') {
                    if (history[0] && ghost.x === 1 && ghost.y === 2) return null;
                    return [history[0] || ghost.x !== 1 || ghost.y !== 2 ? 1 : 0];
                }
                if (name === 'never-reuse-first-park') {
                    if (history[0] && (ghost.x !== old.x || ghost.y !== old.y)) return null;
                    return [history[0] || ghost.x === 1 && ghost.y === 4 ? 1 : 0];
                }
                const index = Number(name.at(-1)), a = before.layerStates[0].ghosts[index], b = after.layerStates[0].ghosts[index];
                return a.x !== b.x || a.y !== b.y ? null : history;
            }
        } });
        checks.push({ name, avoidOverlap, result: search.run(budget), actions: search.firstActions() });
    }
    const ordinary = analyzeOrdinaryPlans(map, { ...budget, totalBudgetMs: 60000, orderBudget: 6 });
    const wrongPlans = [
        ['early-B', ['R', 'D', 'L', 'U', 'U', 'U', 'U', 'R', 'U', 'L']],
        ['early-key', ['R', 'D', 'L', 'U', 'U', 'U', 'U', 'R', 'R', 'R', 'D', 'R', 'U']]
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
            g: state.layerStates[0].ghosts.map(g => [g.x, g.y]), keys: state.player.keys, dead: state.isDead },
            result: search.run(budget), actions: search.firstActions(),
            scope: '设计者的真实安全前缀；含非最优合法重合，去终点过滤；不是玩家实际尝试' };
    });
    return { scope: '原图含非最优重合与排除重合分别查询；不复活，终点当步去判胜过滤；必要性不是趣味分',
        checks, ordinary, wrongPlans, humanQuality: null };
}
