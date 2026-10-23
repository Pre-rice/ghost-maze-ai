import { WALL_TYPES as W, GameLogic, actionFromName } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { analyzeOrdinaryPlans } from '../../src/design/ordinary-plans.js';

const budget = { nodeBudget: 800000, stateBudget: 800000, budgetMs: 15000 };
const crosses = (before, after, x1, y1, x2, y2) => before.player.x === x1 &&
    before.player.y === y1 && after.player.x === x2 && after.player.y === y2;

export function analyzeMap(map) {
    const env = createReferenceEnvironment(map), withoutGoal = structuredClone(map);
    withoutGoal.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(withoutGoal), checks = [];
    for (const avoidOverlap of [false, true]) for (const name of ['at-most-one-return',
        'never-bring-lower-ghost-in', 'never-use-bottom-exit', 'never-use-right-exit',
        'never-priority-conflict', 'require-upper-move-before-key']) {
        const search = createBreadthFirstSearch(env, { monitor: {
            initial: () => [0, 0],
            advance: (history, before, action, after) => {
                if (after.isWon && noEnd.step(before, action).isDead || avoidOverlap &&
                    new Set(after.layerStates[0].ghosts.map(g => `${g.x},${g.y}`)).size !== 2) return null;
                let [returns, preKeyMove] = history;
                if (crosses(before, after, 4, 1, 3, 1)) returns = Math.min(2, returns + 1);
                const old = before.layerStates[0].ghosts[0], now = after.layerStates[0].ghosts[0];
                if (before.player.keys === 0 && (old.x !== now.x || old.y !== now.y)) preKeyMove = 1;
                if (name === 'at-most-one-return' && returns >= 2 ||
                    name === 'never-bring-lower-ghost-in' && after.layerStates[0].ghosts[1].x < 4 &&
                        after.layerStates[0].ghosts[1].y < 4 ||
                    name === 'never-use-bottom-exit' && crosses(before, after, 0, 3, 0, 4) ||
                    name === 'never-use-right-exit' && crosses(before, after, 3, 2, 4, 2) ||
                    name === 'require-upper-move-before-key' && after.isWon && !preKeyMove) return null;
                if (name === 'never-priority-conflict') {
                    const diagnostics = [];
                    GameLogic.calculateNextState(before, actionFromName(action), env.mapDefinition,
                        { trails: false, visibility: false, ghostDiagnostics: diagnostics });
                    if (diagnostics.some(d => d.decision === 'visible_target_priority')) return null;
                }
                return [returns, preKeyMove];
            }
        } });
        checks.push({ name, avoidOverlap, result: search.run(budget), actions: search.firstActions() });
    }
    const variants = ['right-ordinary', 'bottom-ordinary', 'both-ordinary'].map(mode => {
        const changed = structuredClone(map);
        if (mode !== 'bottom-ordinary') changed.layers[0].vWalls[2][4] = { type: W.DOOR, keys: 0 };
        if (mode !== 'right-ordinary') changed.layers[0].hWalls[4][0] = { type: W.DOOR, keys: 0 };
        const search = createBreadthFirstSearch(createReferenceEnvironment(changed), { allOptimal: true });
        const result = search.run(budget), actions = search.firstActions(), n = structuredClone(changed);
        n.layers[0].endPos = null;
        let noEndReference = false;
        if (actions) {
            try { createReferenceEnvironment(n).replay(actions); noEndReference = true; } catch {}
        }
        return { mode, map: changed, result, actions, raw: search.routeCount().toString(), noEndReference };
    });
    // 设计者实际操作的固定前缀；不限制后续搜索为参考路线。
    const firstReturn = ['R', 'D', 'D', 'D', 'L', 'U', 'L', 'D', 'L', 'U', 'R', 'R', 'R', 'U', 'U', 'U', 'L'];
    const wrongPlans = [['nearest-right-exit', ['D', 'R']], ['return-up', ['U']]].map(([name, suffix]) => {
        const prefix = [...firstReturn, ...suffix];
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
            scope: '设计者实际安全前缀；允许非最优合法重合并去终点过滤，不是真人试玩' };
    });
    return { map, checks, variants, wrongPlans,
        ordinary: analyzeOrdinaryPlans(map, { ...budget, totalBudgetMs: 60000, orderBudget: 2 }),
        humanQuality: null,
        scope: '全部无伤通关的原图指定事件查询，与实际改门反事实分开；必要性不作质量评价。' };
}
