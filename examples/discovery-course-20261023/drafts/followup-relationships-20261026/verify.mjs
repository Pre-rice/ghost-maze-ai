import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {GameLogic} from '../../../../src/reference/engine.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import {auditPuzzleBoundaries} from '../../../../src/design/rule-boundaries.js';

const pack=JSON.parse(fs.readFileSync(new URL('./comparisons.json',import.meta.url))),budget={nodeBudget:500000,stateBudget:500000,budgetMs:20000};
let searched=0,notCold=0,boundaries=0;
for(const group of pack.groups)for(const row of group.rows){
    let map=structuredClone(group.baseMap);
    for(const edit of row.edits){
        if(!edit.path.length){map=structuredClone(edit.value);continue;}
        let target=map;for(const key of edit.path.slice(0,-1))target=target[key];target[edit.path.at(-1)]=structuredClone(edit.value);
    }
    const env=createReferenceEnvironment(map);assert.equal(env.mapId,row.mapId,group.name);
    if(Object.hasOwn(row,'cold')){const state=env.initialState(),cold=map.layers[0].ghosts.every(g=>!GameLogic._canGhostSeePlayer(g,state.player,env.mapDefinition.layers[0],state.layerStates[0]));assert.equal(cold,row.cold);}
    if(!row.result){assert.equal(row.cold,false);notCold++;continue;}
    const q=createBreadthFirstSearch(env,{allOptimal:true}),result=q.run(budget);assert.equal(result.status,row.result.status,group.name);assert.notEqual(result.status,'unknown');assert.equal(result.totalActions,row.result.totalActions);assert.equal(q.routeCount().toString(),row.count);searched++;
    if(row.boundary){assert.equal(auditPuzzleBoundaries(map,budget).status,row.boundary.status);boundaries++;}
    if(result.status==='solved'){assert(env.replay(row.actions).state.isWon);if(row.allNoEnd!==null&&Object.hasOwn(row,'allNoEnd')){const m=structuredClone(map);m.layers.forEach(l=>l.endPos=null);const noEnd=createReferenceEnvironment(m);assert.equal([...q.routes()].every(actions=>{try{return!noEnd.replay(actions).state.isDead;}catch{return false;}}),row.allNoEnd);}}
}
console.log(JSON.stringify({groups:pack.groups.length,searched,notCold,boundaries,scope:'未采用原型只读复验，不作质量分或人类学习结论'}));
