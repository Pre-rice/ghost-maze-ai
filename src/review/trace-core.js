// 浏览器与服务端共用；仅投影影响物理行为的字段，排除会被渲染修剪的轨迹时间戳。
export function traceState(state) {
    const p = state.player;
    return { player: { x: p.x, y: p.y, layer: p.layer, hp: p.hp, keys: p.keys, steps: p.steps },
        isDead: state.isDead, isWon: state.isWon,
        layers: state.layerStates.map(layer => ({
            ghosts: layer.ghosts.map(g => [g.x, g.y]), items: layer.items.map(i => [i.x, i.y, i.type]),
            walls: ['h', 'v'].map(axis => layer.wallStates[axis].map(row => row.map(w =>
                [w.type, w.keys ?? 0, w.letter ?? null, w.currentState ?? null, w.direction?.dx ?? null, w.direction?.dy ?? null])))
        })) };
}
