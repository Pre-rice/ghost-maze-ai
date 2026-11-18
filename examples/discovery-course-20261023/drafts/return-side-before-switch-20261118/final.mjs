import assert from 'node:assert/strict';
import { room } from '../../build.mjs';
import { WALL_TYPES as W, DataSerializer } from '../../../../src/reference/engine.js';
import { auditMap } from '../../../gallery-adjustments-20261014/verify.mjs';
import { auditEntryPath } from '../../entry-path.mjs';
import { plans } from './plans.mjs';

export const entryPath = { external:[0,1,3], externalCells:[[1,3]], actions:['U'] };
export function build() {
    const cells = [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],
                         [1,1],[2,1],[3,1],[4,1],[5,1],
                         [1,2],[2,2],[3,2]];
    return room(6,3,{
        cells, start:[1,2], end:[0,0], ghosts:[[2,0]], items:[[5,0]], buttons:[[4,1,0,1,'A']],
        edges:[
            ['v',1,0,W.LOCKED,{keys:1}], ['v',2,0,W.SOLID], ['v',5,0,W.SOLID],
            ['h',1,1,W.LETTER_DOOR,{letter:'A',initialState:'closed'}],
            ['h',4,1,W.LETTER_DOOR,{letter:'A',initialState:'open'}],
            ['h',5,1,W.LETTER_DOOR,{letter:'A',initialState:'open'}],
            ['v',3,2,W.ONE_WAY,{direction:{dx:1,dy:0}}]
        ]
    });
}
export function audit() {
    const map=build(), code=DataSerializer.generateShareCode(map).code;
    const qa=auditMap(map,code);
    assert.equal(qa.cold,true);
    assert.equal(qa.count,'1');
    assert.equal(qa.allResult.totalActions,18);
    qa.entry=auditEntryPath(map,qa.routes,entryPath);
    return { map, mapCode:code, qa, plans:plans(map) };
}
