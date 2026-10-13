import { createHash } from 'node:crypto';
import { GameLogic, MapDefinition, validateMapData, actionFromName } from './engine.js';
import { physicalStateKey } from '../../../ghost-maze/src/solver/searchEnvironment.js';
import { checkEnvironment } from '../../scripts/check-environment.mjs';

export { actionFromName } from './engine.js';
export const ACTION_NAMES = Object.freeze(['U', 'R', 'D', 'L', 'STAIR']);
let verifiedRevision;

function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

/** 全信息、无复活的搜索环境；探索记录不参与物理去重。 */
export function createReferenceEnvironment(mapData) {
    verifiedRevision ??= checkEnvironment().revision;
    const checked = validateMapData(mapData, { requireEnd: false });
    if (!checked.valid) throw new TypeError(`地图无效：${checked.error}`);
    const mapDefinition = freeze(new MapDefinition(checked.mapData));
    const mapId = createHash('sha256').update(JSON.stringify(checked.mapData)).digest('hex');
    const initialState = () => GameLogic.createInitialState(mapDefinition);
    const step = (state, action) => GameLogic.calculateNextState(state, actionFromName(action), mapDefinition, { trails: false, visibility: false });
    const stateKey = state => physicalStateKey(state, mapId);
    const replay = actions => {
        if (!Array.isArray(actions)) throw new TypeError('证书 actions 必须为动作名称数组');
        let state = initialState(), movementCost = 0;
        for (const action of actions) {
            if (state.isDead || state.isWon) throw new Error('证书包含终止状态后的动作');
            const next = step(state, action);
            if (next === state) throw new Error('证书包含无效动作');
            if (next.isDead) throw new Error('证书重放时死亡');
            if (next.player.layer !== state.player.layer || next.player.x !== state.player.x || next.player.y !== state.player.y) movementCost++;
            state = next;
        }
        return { state, totalActions: actions.length, movementCost };
    };
    return Object.freeze({ mapDefinition, mapId, ruleset: verifiedRevision, actions: ACTION_NAMES, initialState, step, stateKey, replay });
}
