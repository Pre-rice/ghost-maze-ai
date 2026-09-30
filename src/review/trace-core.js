// 浏览器与服务端共用；仅投影影响物理行为的字段，排除会被渲染修剪的轨迹时间戳。
export function traceState(state) {
    const p = state.player;
    return { player: { x: p.x, y: p.y, layer: p.layer, hp: p.hp, stamina: p.stamina, keys: p.keys, steps: p.steps },
        isDead: state.isDead, isWon: state.isWon, loopCount: state.loopCount,
        layers: state.layerStates.map(layer => ({
            ghosts: layer.ghosts.map(g => [g.x, g.y]), items: layer.items.map(i => [i.x, i.y, i.type]),
            walls: ['h', 'v'].map(axis => layer.wallStates[axis].map(row => row.map(w =>
                [w.type, w.keys ?? 0, w.letter ?? null, w.currentState ?? null, w.direction?.dx ?? null, w.direction?.dy ?? null])))
        })) };
}

export const TRACE_TOKENS = ['U', 'R', 'D', 'L', 'STAIR', 'REVIVE'];
export function traceAction(token) {
    const index = ['U', 'R', 'D', 'L'].indexOf(token);
    if (index >= 0) return { type: 'MOVE', payload: [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }][index] };
    if (token === 'STAIR') return { type: 'USE_STAIR' };
    if (token === 'REVIVE') return { type: 'REVIVE' };
    throw new TypeError('未知录制动作');
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

export function describeStep(before, after, token, def, wallTypes) {
    const action = traceAction(token), p = before.player;
    const button = action.type === 'MOVE' && def.layers[p.layer].initialEntities.buttons.find(b =>
        b.x === p.x && b.y === p.y && b.direction.dx === action.payload.dx && b.direction.dy === action.payload.dy);
    const gates = state => state.layerStates.flatMap((layer, li) => ['h', 'v'].flatMap(axis =>
        layer.wallStates[axis].flatMap((row, y) => row.flatMap((w, x) => w.type === wallTypes.LETTER_DOOR ? [{ layer: li, axis, x, y, letter: w.letter, state: w.currentState }] : []))));
    const oldGates = gates(before), newGates = gates(after);
    return { token, label: button ? `按 ${button.letter}（原地推进一回合）` : ({ U: '上', R: '右', D: '下', L: '左', STAIR: '使用楼梯', REVIVE: '复活' })[token],
        button: button ? button.letter : null,
        playerBefore: [p.layer, p.x, p.y], playerAfter: [after.player.layer, after.player.x, after.player.y],
        ghostsBefore: before.layerStates.map(l => l.ghosts.map(g => [g.x, g.y])), ghostsAfter: after.layerStates.map(l => l.ghosts.map(g => [g.x, g.y])),
        gateChanges: newGates.filter((g, i) => g.state !== oldGates[i]?.state), isDead: after.isDead, isWon: after.isWon };
}
