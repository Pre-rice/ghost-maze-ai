import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {core} from '../seat-exchange-20261016/verify.mjs';
import {solveContinuation} from '../../src/design/continuation.js';
import {enumeratePlanningGraph} from '../../src/training/planning-graph.js';
import {applyEdit} from '../../src/design/edits.js';

export function verify() {
    const root=new URL('.',import.meta.url);
    const map=JSON.parse(fs.readFileSync(new URL('map.json',root)));
    const share=JSON.parse(fs.readFileSync(new URL('share.json',root)));
    const parent=JSON.parse(fs.readFileSync(new URL('../seat-exchange-20261016/map.json',root)));
    const qa=auditMap(map,share.mapCode);
    assert.equal(qa.allResult.totalActions,44);assert.equal(qa.count,'3');
    assert(qa.cold&&qa.entry?.wholeOptimalRoutesInteriorEqual);
    for(const route of qa.routes)assert.deepEqual(route.controls,[{step:7,letter:'A',at:[4,5]}]);
    const unenhanced=applyEdit(applyEdit(map,{type:'remove_entity',field:'items',index:0}),
        {type:'wall',axis:'h',x:3,y:7,wall:{type:0,keys:0}});
    assert.deepEqual(unenhanced,parent,'用户原码仅增加一钥匙和一钥匙门');
    const relationships=core(map);
    for(const proof of relationships.proofs)assert.equal(proof.status,'proven_unsat',proof.name);
    const prefix=qa.actions.slice(0,27);
    const closeNow=solveContinuation(map,[...prefix,'R'],{reference:true,nodeBudget:100000,budgetMs:10000});
    const continueAround=solveContinuation(map,[...prefix,'L'],{reference:true,nodeBudget:100000,budgetMs:10000});
    assert.equal(closeNow.status,'proven_unsat');assert.equal(continueAround.status,'solved');
    // 这一局面按A当步安全；穷尽其后所有无伤无复活续解，仍不能完成。
    const graph=enumeratePlanningGraph(map);assert.equal(graph.status,'exhausted');
    const upperRightParking=state=>state.layerStates[0].ghosts.some(g=>g.x===4&&g.y===3)
        &&state.layerStates[0].wallStates.v[3][4].currentState==='closed';
    const queue=[0],seen=new Set(queue);
    for(let head=0;head<queue.length;head++){
        const index=queue[head];assert(!graph.nodes[index].state.isWon,'存在避开新停位的通关解');
        for(const edge of graph.nodes[index].edges)if(!upperRightParking(graph.nodes[edge.to].state)&&!seen.has(edge.to)){
            seen.add(edge.to);queue.push(edge.to);
        }
    }
    return {qa,relationships,parentExactlyRecovered:true,closeNow,continueAround,
        upperRightParkingNecessary:{status:'proven_unsat',states:seen.size,
            scope:'禁止任一鬼停在关闭的上A门右侧；原图全部无伤无复活续解，允许非最优重合'},
        role:'physical_QA_not_human_quality'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
    const r=verify();console.log(JSON.stringify({mapId:r.qa.mapId,N:r.qa.allResult.totalActions,
        count:r.qa.count,boundary:r.qa.boundary.status,cold:r.qa.cold,entry:r.qa.entry,
        physicalAudit:r.qa.physicalAudit,closeNow:r.closeNow.status,
        upperRightParkingNecessary:r.upperRightParkingNecessary}));
}
