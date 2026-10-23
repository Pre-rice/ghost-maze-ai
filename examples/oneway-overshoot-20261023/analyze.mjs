import { WALL_TYPES as W } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';

const budget = { nodeBudget: 800000, stateBudget: 800000, budgetMs: 15000 };

export function analyzeMap(map) {
    const env = createReferenceEnvironment(map), n = structuredClone(map);
    n.layers[0].endPos = null;
    const noEnd = createReferenceEnvironment(n);
    const checks = ['never-six', 'never-one', 'never-arrow-forward', 'first-ghost-move-left'].map(name => {
        const search = createBreadthFirstSearch(env, { monitor: {
            initial: () => [0],
            advance: (history, before, action, after) => {
                if (after.isWon && noEnd.step(before, action).isDead) return null;
                const x = before.layerStates[0].ghosts[0].x, nx = after.layerStates[0].ghosts[0].x;
                if (name === 'never-six' && nx === 6 || name === 'never-one' && nx === 1 ||
                    name === 'never-arrow-forward' && before.player.x === 2 && before.player.y === 2 &&
                        after.player.x === 2 && after.player.y === 3 ||
                    name === 'first-ghost-move-left' && !history[0] && nx > x) return null;
                return [history[0] || Number(nx !== x)];
            }
        } });
        return { name, result: search.run(budget), actions: search.firstActions() };
    });
    const variants = ['ordinary', 'empty', 'solid', 'reverse'].map(mode => {
        const changed = structuredClone(map);
        changed.layers[0].hWalls[3][2] = mode === 'reverse' ?
            { type: W.ONE_WAY, keys: 0, direction: { dx: 0, dy: -1 } } :
            { type: mode === 'ordinary' ? W.DOOR : mode === 'empty' ? W.EMPTY : W.SOLID, keys: 0 };
        const e = createReferenceEnvironment(changed), search = createBreadthFirstSearch(e, { allOptimal: true });
        const result = search.run(budget), actions = search.firstActions(), noEndMap = structuredClone(changed);
        noEndMap.layers[0].endPos = null;
        let noEndReference = false, state = e.initialState(), trace = [];
        if (actions) {
            try { createReferenceEnvironment(noEndMap).replay(actions); noEndReference = true; } catch {}
            trace = actions.map(action => {
                state = e.step(state, action);
                return { action, p: [state.player.x, state.player.y], g: [state.layerStates[0].ghosts[0].x, state.layerStates[0].ghosts[0].y] };
            });
        }
        return { mode, result, raw: search.routeCount().toString(), actions, noEndReference, trace };
    });
    return { checks, variants, humanQuality: null,
        scope: '完整无伤通关的原图指定事件查询，历史进入完整键；改门另作反事实，不以必要性或独解评趣味。先左引仍44步可恢复，未称是死局。' };
}
