import { actionFromName } from '../reference/engine.js';
import { traceState } from './trace-core.js';
// 仅导入历史局面证据时使用，不参与当前游玩录制或回放。
export const TRACE_TOKENS = ['U', 'R', 'D', 'L', 'STAIR', 'REVIVE'];
export function traceAction(token) {
    return token === 'REVIVE' ? { type: 'REVIVE' } : actionFromName(token);
}

/** 从控制器仍保留的历史分支恢复可重放动作；不假装知道已被撤回后丢弃的尝试。 */
export function recoverBranch(history, mapDefinition, logic, cache = new WeakMap()) {
    if (!history.length || history.length > 2001) throw new Error('历史为空或超过 2000 次动作，请及时分段保存');
    if (JSON.stringify(traceState(history[0])) !== JSON.stringify(traceState(logic.createInitialState(mapDefinition)))) throw new Error('历史不是从本图初始状态开始');
    const actions = [], ambiguities = [];
    for (let i = 1; i < history.length; i++) {
        const before = history[i - 1], after = history[i];
        let matches = cache.get(after)?.before === before ? cache.get(after).matches : null;
        if (!matches) {
            const target = JSON.stringify(traceState(after));
            matches = TRACE_TOKENS.filter(token => {
                const next = logic.calculateNextState(before, traceAction(token), mapDefinition);
                return next !== before && JSON.stringify(traceState(next)) === target;
            });
            cache.set(after, { before, matches });
        }
        if (!matches.length) throw new Error(`第 ${i} 次状态变化不能由真实玩家动作重现`);
        actions.push(matches[0]);
        if (matches.length > 1) ambiguities.push({ index: i, alternatives: matches });
    }
    return { actions, ambiguities, final: traceState(history.at(-1)) };
}

