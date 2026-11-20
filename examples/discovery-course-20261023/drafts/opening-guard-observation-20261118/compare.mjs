import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { DataSerializer } from '../../../../src/reference/engine.js';
import { createBreadthFirstSearch } from '../../../../../ghost-maze/src/solver/breadthFirst.js';
import { solveContinuation } from '../../../../src/design/continuation.js';

const read=(p)=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const budget={budgetMs:12000,nodeBudget:100000,stateBudget:100000};
const pos=p=>[p.x,p.y];
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const ghost=s=>s.layerStates[0].ghosts[0];
const records=[];
const parent=DataSerializer.loadFromShareCode(read('inputs.json').first).data.mapData;
const second=DataSerializer.loadFromShareCode(read('inputs.json').second).data.mapData;
for(const [name,start,base] of [['first-original',[0,1],parent],['first-near',[3,2],parent],['first-middle',[2,1],parent],['second-original',[0,3],second]]) {
    const map=structuredClone(base);
    map.layers[0].customStartPos={x:start[0],y:start[1]};
    const env=createReferenceEnvironment(map),home=env.initialState(),goal=map.layers[0].endPos;
    const plain=structuredClone(map);plain.layers[0].endPos=null;
    const noEnd=createReferenceEnvironment(plain);
    const solver=createBreadthFirstSearch(env,{allOptimal:true}),r=solver.run(budget);
    assert.equal(r.status,'solved');
    const routes=[...solver.routes()];
    const safe=routes.filter(as=>{let s=noEnd.initialState();for(const a of as){s=noEnd.step(s,a);if(s.isDead)return false;}return true;});
    const queries=[];
    for(const mode of ['see_blocked_goal','no_ghost_restart','no_pause_after_motion','enter_above','enter_below']){
        const s=createBreadthFirstSearch(env,{monitor:{initial:()=>[0,0],advance([phase,blocked],b,a,n){
            const physical=n.isWon?noEnd.step(b,a):n;
            if(physical.isDead)return null;
            const moved=!same(ghost(b),ghost(physical));
            if(mode==='no_ghost_restart'&&phase===2&&moved)return null;
            if(mode==='no_pause_after_motion'&&phase===1&&!moved)return null;
            const nextPhase=moved?1:(phase?2:0);
            const seen=Boolean(blocked||!n.isWon&&same(ghost(n),goal));
            if(n.isWon&&(mode==='see_blocked_goal'&&!seen||mode==='enter_above'&&a!=='D'||mode==='enter_below'&&a!=='U'))return null;
            return [nextPhase,Number(seen)];
        }}});
        const result=s.run(budget);assert.ok(['solved','proven_unsat'].includes(result.status));
        queries.push({mode,status:result.status,T:result.totalActions,actions:s.firstActions()});
    }
    const openings=[];
    for(const a of ['U','R','D','L']){
        const n=env.step(home,a);
        if(n===home||n.isDead){openings.push({a,status:n===home?'invalid':'dead'});continue;}
        const con=solveContinuation(map,[a],{...budget,reference:true});
        openings.push({a,status:con.status,ghost:pos(ghost(n)),total:con.actions&&1+con.actions.length});
    }
    const observation=queries.find(q=>q.mode==='see_blocked_goal').actions;
    let blockedAt=null;
    if(observation){let n=home;for(const [i,a] of observation.entries()){n=env.step(n,a);if(!n.isWon&&same(ghost(n),goal)){blockedAt=i+1;break;}}}
    records.push({name,start,mapCode:DataSerializer.generateShareCode(map).code,mapId:env.mapId,T:r.totalActions,allBest:routes,allSafeWithoutGoal:safe.length,openings,queries,blockedAtOnWitness:blockedAt});
}
fs.writeFileSync(new URL('comparison.json',import.meta.url),JSON.stringify({humanQuality:null,records},null,2)+'\n');
for(const r of records)console.log(r.name,r.T,r.allBest.length,r.allSafeWithoutGoal,r.openings.map(a=>a.a+':'+(a.total??a.status)).join(' '),r.queries.map(q=>q.mode+'='+q.T).join(' '),'blocked at',r.blockedAtOnWitness);
