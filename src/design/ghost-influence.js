import assert from 'node:assert/strict';
import { GameLogic, actionFromName } from '../reference/engine.js';

const positions = state => state.layerStates.map(layer => layer.ghosts.map(g => [g.x, g.y])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]));
const physical = state => ({ player: { layer: state.player.layer, x: state.player.x, y: state.player.y,
    steps: state.player.steps, keys: state.player.keys, hp: state.player.hp }, ghosts: positions(state),
    layers: state.layerStates.map(l => ({ items: l.items, walls: l.wallStates })), dead: state.isDead, won: state.isWon });

/** 只查当前真实一步：逐鬼移除其它鬼后位置是否改变，另列重合；不判断整体计划或趣味。 */
export function inspectGhostInfluence(env, before, action, after = env.step(before, action)) {
    if (after === before) return { kind: 'no_action', changes: [] };
    if (after.isDead) return { kind: 'fatal', changes: [] };
    for (const [layer, ghosts] of after.layerStates.map(l => l.ghosts).entries()) {
        const seen = new Set();
        for (const g of ghosts) {
            const key = `${g.x},${g.y}`;
            if (seen.has(key)) return { kind: 'overlap', layer, at: [g.x, g.y], changes: [] };
            seen.add(key);
        }
    }
    // 终点当步没有实际鬼移动；去终点的到达死亡检查属于调用者的独立范围。
    if (after.isWon) return { kind: 'none', changes: [] };
    // 地图中的编号可在不同层重复；只在当前克隆上临时唯一标记，不跟踪历史角色。
    const tagged = before.clone(), sources = [];
    for (const [layer, state] of tagged.layerStates.entries()) for (const ghost of state.ghosts) {
        ghost.id = sources.length;
        sources.push({ id: ghost.id, layer, at: [ghost.x, ghost.y] });
    }
    const nativeAction = actionFromName(action), options = { trails: false, visibility: false };
    const actual = GameLogic.calculateNextState(tagged, nativeAction, env.mapDefinition, options);
    assert.deepEqual(physical(actual), physical(after), '临时标记或传入局面不应改变真实物理后继');
    const where = (state, id) => state.layerStates.flatMap((l, layer) => l.ghosts
        .filter(g => g.id === id).map(g => [layer, g.x, g.y]));
    const changes = [];
    for (const source of sources) {
        const alone = tagged.clone();
        for (const layer of alone.layerStates) layer.ghosts = layer.ghosts.filter(g => g.id === source.id);
        const next = GameLogic.calculateNextState(alone, nativeAction, env.mapDefinition, options);
        const real = where(actual, source.id), isolated = where(next, source.id);
        assert.equal(real.length, 1, '临时标记在真实一步后须唯一保留');
        assert.equal(isolated.length, 1, '临时标记在单鬼一步后须唯一保留');
        if (JSON.stringify(real) !== JSON.stringify(isolated)) changes.push({ from: [source.layer, ...source.at],
            actual: real[0], alone: isolated[0] });
    }
    return { kind: changes.length ? 'motion' : 'none', changes };
}
