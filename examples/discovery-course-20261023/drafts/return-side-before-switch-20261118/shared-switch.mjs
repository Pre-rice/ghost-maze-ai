import { WALL_TYPES as W } from '../../../../src/reference/engine.js';
import { assess, readTrials, saveTrials } from './probe.mjs';

const bases = readTrials('compact.json').entries;
const entries=[];
for (const base of bases.filter(r=>r.design==='open-left' && r.name!=='empty')) {
    const map=structuredClone(base.map);
    const l=map.layers[0];
    l.buttons[0].letter='A';
    l.vWalls[1][1].letter='A';
    l.hWalls[1][5].letter='A';
    for(const design of ['opposed','open-key']) {
        if(design==='open-key') l.hWalls[1][5]={type:W.EMPTY,keys:0};
        const checks=['native','no_right_button','no_forward_crossing'].map(mode=>assess(map,mode));
        entries.push({design,name:base.name,map:structuredClone(map),checks});
    }
}
saveTrials('shared-switch.json',{humanQuality:null,entries});
for (const row of entries) console.log(row.design,row.name,...row.checks.map(c=>[c.result.status,c.result.totalActions,c.count,c.noEndSafe,c.actions?.join('')]));
