import fs from 'node:fs';
import assert from 'node:assert/strict';
import { room } from '../../build.mjs';
import { WALL_TYPES as W, DataSerializer } from '../../../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../../../ghost-maze/src/solver/breadthFirst.js';

const budget={budgetMs:15000,stateBudget:100000,nodeBudget:100000};
const dirs='URDL';
const point=p=>[p.x,p.y];
const eq=(p,q)=>p.x===q.x&&p.y===q.y;
export function assessOpening(map) {
    const env=createReferenceEnvironment(map),goal=map.layers[0].endPos;
    const bare=structuredClone(map);bare.layers[0].endPos=null;
    const noEnd=createReferenceEnvironment(bare);
    const native=createBreadthFirstSearch(env,{allOptimal:true}),n=native.run(budget);
    assert.equal(n.status,'solved');
    const best=[...native.routes()].map(actions=>{
        let state=noEnd.initialState(),safe=true;const frames=[];
        for(const a of actions){
            state=noEnd.step(state,a);frames.push({p:point(state.player),g:point(state.layerStates[0].ghosts[0])});
            if(state.isDead){safe=false;break;}
        }
        return {actions,safe,frames};
    });
    const queries=[];
    for(const mode of ['no_immediate_reverse','right_then_ghost_on_goal','left_never_ghost_on_goal','ever_pause_then_restart','never_pause_once_moving']) {
        const search=createBreadthFirstSearch(env,{monitor:{initial:()=>[-1,0,0,0],advance([prev,phase,restarted,blocked],b,a,n){
            const f=n.isWon?noEnd.step(b,a):n;
            if(f.isDead)return null;
            const index=dirs.indexOf(a);
            if(mode==='no_immediate_reverse' && prev>=0 && (prev+2)%4===index)return null;
            if(prev===-1 && (mode==='right_then_ghost_on_goal'&&a!=='R'||mode==='left_never_ghost_on_goal'&&a!=='L'))return null;
            const before=b.layerStates[0].ghosts[0],after=f.layerStates[0].ghosts[0],moved=!eq(before,after);
            const saw=Boolean(blocked||!n.isWon&&eq(after,goal));
            const again=Boolean(restarted||phase===2&&moved);
            if(mode==='left_never_ghost_on_goal'&&saw||mode==='never_pause_once_moving'&&phase===1&&!moved)return null;
            if(n.isWon&&(mode==='right_then_ghost_on_goal'&&!saw||mode==='ever_pause_then_restart'&&!again))return null;
            return [index,moved?1:(phase?2:0),Number(again),Number(saw)];
        }}});
        const r=search.run(budget);assert.ok(['solved','proven_unsat'].includes(r.status));
        queries.push({mode,status:r.status,T:r.totalActions,actions:search.firstActions()});
    }
    return {mapId:env.mapId,mapCode:DataSerializer.generateShareCode(map).code,cells:map.layers[0].activeCells.flat().filter(Boolean).length,T:n.totalActions,best,queries};
}
const all=Array.from({length:9},(_,i)=>[i%3,Math.floor(i/3)]);
export const ring=()=>room(3,3,{start:[1,2],end:[2,1],ghosts:[[2,0]],cells:all.filter(([x,y])=>x!==1||y!==1)});
if(import.meta.main) {
    const original=DataSerializer.loadFromShareCode(JSON.parse(fs.readFileSync(new URL('inputs.json',import.meta.url))).first).data.mapData;
    const near=structuredClone(original);near.layers[0].customStartPos={x:3,y:2};
    const layouts={original,near,ring:ring(),filled:room(3,3,{start:[1,2],end:[2,1],ghosts:[[2,0]]}),
        recess:room(3,3,{start:[1,2],end:[2,1],ghosts:[[2,0]],edges:[['h',1,1,W.SOLID],['h',1,2,W.SOLID],['v',2,1,W.SOLID]]})};
    const results=Object.fromEntries(Object.entries(layouts).map(([id,map])=>[id,assessOpening(map)]));
    fs.writeFileSync(new URL('shapes.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
    for(const [id,r]of Object.entries(results))console.log(id,r.T,r.best.length,r.best.filter(b=>b.safe).length,r.queries.map(q=>q.mode+'='+q.T).join(' '));
}
