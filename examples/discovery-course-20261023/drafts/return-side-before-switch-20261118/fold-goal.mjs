import { WALL_TYPES as W, normalizeVoidWalls } from '../../../../src/reference/engine.js';
import { assess, readTrials, saveTrials } from './probe.mjs';

const original=readTrials('shared-switch.json').entries.find(r=>r.design==='opposed' && r.name==='arrow').map;
const map=structuredClone(original), l=map.layers[0];
l.activeCells[1][0]=false;
for(const [axis,x,y] of [['h',0,1],['h',0,2],['v',0,1],['v',1,1],['v',2,0]]) l[axis+'Walls'][y][x]={type:W.SOLID,keys:0};
l.vWalls[0][1]={type:W.LOCKED,keys:1};
l.hWalls[1][1]={type:W.LETTER_DOOR,letter:'A',initialState:'closed',keys:0};
l.buttons[0].direction={dx:-1,dy:0};
const entries=[];
for (const layout of ['two-controls','single-control']) {
    if(layout==='single-control') l.buttons=l.buttons.filter(b=>b.x===4);
    for (const [name,type] of [['arrow',W.ONE_WAY],['ordinary',W.DOOR],['wall',W.SOLID],['empty',W.EMPTY]]) {
        const variant=normalizeVoidWalls(structuredClone(map));
        if(name!=='arrow') variant.layers[0].vWalls[2][3]={type,keys:0};
        const checks=['native','no_right_button','no_forward_crossing'].map(mode=>assess(variant,mode));
        entries.push({layout,name,map:variant,checks});
    }
}
saveTrials('fold-goal.json',{humanQuality:null,entries});
for (const r of entries) console.log(r.layout,r.name,...r.checks.map(c=>[c.result.totalActions,c.count,c.noEndSafe,c.actions?.join('')]));
