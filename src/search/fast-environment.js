import { createReferenceEnvironment, actionFromName } from '../reference/environment.js';
import { makeSimulator, createInitState, step, stateKey } from '../validate/simulator.js';

/** 快环境仅接受真实玩家动作；规则校验和证书重放仍交给原引擎。 */
export function createFastEnvironment(mapData, { withGhosts = true } = {}) {
    const source = createReferenceEnvironment(mapData);
    let reference = source;
    if (!withGhosts) {
        const relaxed = structuredClone(mapData);
        relaxed.initialGhosts = [];
        if (relaxed.layers) for (const layer of relaxed.layers) if (layer) layer.ghosts = [];
        reference = createReferenceEnvironment(relaxed);
    }
    const sim = makeSimulator(reference.mapDefinition);
    return Object.freeze({
        sim, reference, sourceMapId: source.mapId,
        initialState: () => createInitState(sim),
        step: (state, action) => step(state, actionFromName(action), sim),
        stateKey: state => `${reference.mapId}:${stateKey(state, sim)}`
    });
}

/** 物理差分投影：明确保留鬼和物品的顺序，排除视觉字段和内部位图。 */
export function physicalState(state) {
    const p = state.player;
    return {
        player: { layer: p.layer, x: p.x, y: p.y, hp: p.hp, stamina: p.stamina, keys: p.keys, steps: p.steps },
        isDead: state.isDead, isWon: state.isWon, loopCount: state.loopCount,
        layers: (state.layerStates || state.layers).map(layer => ({
            ghosts: layer.ghosts.map(g => [g.x, g.y]), items: layer.items, wallStates: layer.wallStates
        }))
    };
}
