import { DataSerializer, GameLogic, MapDefinition, ActionHistory, normalizeVoidWalls } from '../reference/engine.js';
import { traceState } from './trace-core.js';
import { traceAction } from './historical-trace.js';

/** 旧证据只从明确提供的原图导入；不解旧码、不覆盖原始录制。 */
export function importHistoricalRecording(input, sourceMap) {
    const encoded = DataSerializer.generateShareCode(sourceMap);
    if (!encoded.success) throw new TypeError(encoded.error);
    const map = DataSerializer.loadFromShareCode(encoded.code).data.mapData;
    const def = new MapDefinition(map);
    const offset = def.gameMode === 'death-loop' ? input.actions.lastIndexOf('REVIVE') + 1 : 0;
    let state = GameLogic.createInitialState(def), actions = [];
    for (const token of input.actions.slice(offset)) {
        const next = GameLogic.calculateNextState(state, traceAction(token), def, { trails: false });
        if (next === state) throw new TypeError('历史录制包含无效操作');
        if (token !== 'REVIVE') actions.push(token);
        state = next;
    }
    const physical = value => {
        const next = structuredClone(value);
        delete next.player.stamina; delete next.player.steps; delete next.loopCount;
        next.layers.forEach((layer,li)=>{
            const decode=rows=>rows.map(row=>row.map(w=>({type:w[0],keys:w[1],letter:w[2],currentState:w[3],direction:w[4]===null?null:{dx:w[4],dy:w[5]}})));
            const clean=normalizeVoidWalls({width:map.width,height:map.height,activeCells:map.layers[li].activeCells,hWalls:decode(layer.walls[0]),vWalls:decode(layer.walls[1])});
            const encode=rows=>rows.map(row=>row.map(w=>[w.type,w.type===3?w.keys:0,w.letter??null,w.type===6?w.currentState:null,w.direction?.dx??null,w.direction?.dy??null]));
            layer.walls=[encode(clean.hWalls),encode(clean.vWalls)];
        });
        return next;
    };
    if (JSON.stringify(physical(traceState(state))) !== JSON.stringify(physical(input.final))) throw new TypeError('历史录制与原图的物理结果不一致');
    const history = new ActionHistory(def, actions);
    return { ...input, sharecode: encoded.code, actions, final: traceState(history.stateAt(actions.length)),
        importedFrom: { sharecode: input.sharecode, totalActions: input.actions.length, discardedPrefix: offset },
        ambiguities: (input.ambiguities ?? []).filter(row => row.index > offset).map(row => ({ ...row, index: row.index - offset })) };
}
