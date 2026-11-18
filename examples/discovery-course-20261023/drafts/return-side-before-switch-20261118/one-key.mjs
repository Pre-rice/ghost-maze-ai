import { WALL_TYPES as W, normalizeVoidWalls } from '../../../../src/reference/engine.js';
import { assess, readTrials, saveTrials } from './probe.mjs';

const bases = readTrials('compact.json').entries;
const entries = [];
for (const layout of ['compact','open-left']) {
    const map = structuredClone(bases.find(r=>r.name==='arrow' && r.design===layout).map);
    const l = map.layers[0];
    l.buttons = l.buttons.filter(b=>b.letter==='A');
    l.ghosts[0].x=1; l.ghosts[0].y=1;
    l.items=[{x:0,y:1,type:'key'}]; l.endPos={x:5,y:0};
    l.hWalls[1][5]={type:W.LOCKED,keys:1};
    l.vWalls[1][1]={type:W.EMPTY,keys:0};
    l.activeCells[0][0]=false;
    l.hWalls[1][0]={type:W.SOLID,keys:0};
    for (const [name,type] of [['arrow',W.ONE_WAY],['ordinary',W.DOOR],['wall',W.SOLID]]) {
        const variant=normalizeVoidWalls(structuredClone(map));
        if(name!=='arrow') variant.layers[0].vWalls[2][3]={type,keys:0};
        const checks=['native','no_right_button','no_forward_crossing'].map(mode=>assess(variant,mode));
        entries.push({layout,name,map:variant,checks});
    }
}
saveTrials('one-key.json',{humanQuality:null,entries});
for (const row of entries) console.log(row.layout,row.name,...row.checks.map(c=>[c.result.status,c.result.totalActions,c.count,c.noEndSafe,c.actions?.join('')]));
