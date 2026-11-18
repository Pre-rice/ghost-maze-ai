import { WALL_TYPES as W, normalizeVoidWalls } from '../../../../src/reference/engine.js';
import { origin, assess, saveTrials } from './probe.mjs';

function trim(map, cells) {
    const layer = map.layers[0];
    for (const [x,y] of cells) {
        layer.activeCells[y][x] = false;
        for (const [axis,xx,yy] of [['h',x,y],['h',x,y+1],['v',x,y],['v',x+1,y]]) {
            layer[axis+'Walls'][yy][xx] = {type:W.SOLID,keys:0};
        }
    }
    return normalizeVoidWalls(map);
}

// 下沿内收；左室恢复绕行，出生能先探 B，也能先取物。
const compact = trim(structuredClone(origin),[[0,2],[4,2],[5,2]]);
const openLeft = structuredClone(compact);
openLeft.layers[0].hWalls[2][1] = {type:W.EMPTY,keys:0};
openLeft.layers[0].buttons[0].direction = {dx:0,dy:-1};
openLeft.layers[0].hWalls[1][1] = {type:W.SOLID,keys:0};

const entries = [];
for (const [design, base] of [['compact',compact],['open-left',openLeft]]) {
    for (const [name,edge] of [['arrow',null],['ordinary',W.DOOR],['empty',W.EMPTY],['wall',W.SOLID]]) {
        const map = structuredClone(base);
        if (edge !== null) map.layers[0].vWalls[2][3] = {type:edge,keys:0};
        const checks = ['native','no_right_button'].map(mode=>assess(map,mode));
        entries.push({design,name,map,checks});
    }
}
saveTrials('compact.json',{humanQuality:null,entries});
for (const row of entries) console.log(row.design,row.name,...row.checks.map(c=>[c.result.status,c.result.totalActions,c.count,c.noEndSafe,c.actions?.join('')]));
