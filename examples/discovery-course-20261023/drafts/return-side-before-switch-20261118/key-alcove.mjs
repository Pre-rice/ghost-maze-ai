import { WALL_TYPES as W } from '../../../../src/reference/engine.js';
import { assess, readTrials, saveTrials } from './probe.mjs';

const records = readTrials('compact.json').entries;
const variants = [];
for (const base of records.filter(r=>r.design==='open-left' && ['arrow','ordinary'].includes(r.name))) {
    const map = structuredClone(base.map);
    const layer = map.layers[0];
    layer.buttons = layer.buttons.filter(b=>b.letter==='A');
    layer.hWalls[1][5] = {type:W.EMPTY,keys:0};
    layer.vWalls[1][1] = {type:W.EMPTY,keys:0};
    for (const design of ['direct','left-retrieval']) {
        if (design==='left-retrieval') {
            // 用安全返回取物检验停车；省去B组，右钥匙允许进左叶室拿第二把。
            layer.items.push({...layer.endPos,type:'key'});
            layer.endPos = {x:5,y:2};
            layer.activeCells[2][5] = true;
            layer.hWalls[2][5] = {type:W.LOCKED,keys:2};
            layer.hWalls[3][5] = layer.vWalls[2][6] = layer.vWalls[2][5] = {type:W.SOLID,keys:0};
        }
        const checks = ['native','no_right_button'].map(mode=>assess(map,mode));
        variants.push({design,name:base.name,map:structuredClone(map),checks});
    }
}
saveTrials('key-alcove.json',{humanQuality:null,variants});
for (const row of variants) console.log(row.design,row.name,...row.checks.map(c=>[c.result.status,c.result.totalActions,c.count,c.noEndSafe,c.actions?.join('')]));
