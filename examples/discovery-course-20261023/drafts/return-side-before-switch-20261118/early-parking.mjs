import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import { build } from './final.mjs';

export function parkedBeforeKey(map) {
    const env=createReferenceEnvironment(map), bare=structuredClone(map);
    bare.layers[0].endPos=null;
    const noEnd=createReferenceEnvironment(bare);
    const search=createBreadthFirstSearch(env,{monitor:{
        initial:()=>[0],
        advance([stage],b,a,n) {
            if(n.isWon&&noEnd.step(b,a).isDead)return null;
            const g=n.layerStates[0].ghosts[0];
            const parked=g.x===4&&g.y===0&&n.layerStates[0].wallStates.h[1][4].currentState==='closed';
            const start=parked&&a==='D'&&b.player.x===4&&b.player.y===1&&!b.player.keys;
            if(stage!==2) {
                if(!parked)stage=0;
                if(start)stage=1;
                if(stage===1&&n.player.keys)stage=2;
            }
            if(n.isWon&&stage!==2)return null;
            return [stage];
        }
    }});
    const r=search.run({budgetMs:30000,nodeBudget:100000,stateBudget:100000});
    assert.ok(['solved','proven_unsat'].includes(r.status));
    return {status:r.status,T:r.totalActions,actions:search.firstActions()};
}
if(import.meta.main) {
    const map=build(), open=structuredClone(map);open.layers[0].hWalls[1][5]={type:0,keys:0};
    const results=[parkedBeforeKey(map),parkedBeforeKey(open)];
    assert.equal(results[0].status,'proven_unsat');assert.equal(results[1].status,'solved');
    fs.writeFileSync(new URL('early-parking.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
    console.log(results);
}
