import { DataSerializer, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
export function freshDecode(map) {
    return DataSerializer.loadFromShareCode(DataSerializer.generateShareCode(normalizeMapData(map)).code);
}
export const withoutGoal = map => {
    const data = normalizeMapData(map); data.layers.forEach(layer => { layer.endPos = null; }); return data;
};
/** 旧记录的虚空墙先按共同规则规范化，计步另由有效动作断言。 */
export function historicalPhysical(value, map) {
    const data = structuredClone(value);
    delete data.player.stamina; delete data.player.steps; delete data.loopCount;
    if (data.layers && map) {
        const source = normalizeMapData(map);
        data.layers = data.layers.map((layer, li) => {
            const clean = normalizeVoidWalls({ width:source.width,height:source.height,
                activeCells:source.layers[li].activeCells, hWalls:layer.wallStates.h,vWalls:layer.wallStates.v });
            const rows = axis => clean[axis+'Walls'].map(row=>row.map(w=>[w.type,w.type===3?w.keys:0,w.letter??null,
                w.type===6?w.currentState:null,w.direction?.dx??null,w.direction?.dy??null]));
            return {...layer,wallStates:{h:rows('h'),v:rows('v')}};
        });
    }
    return data;
}
