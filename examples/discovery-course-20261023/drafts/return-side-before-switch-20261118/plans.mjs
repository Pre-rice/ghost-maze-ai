import fs from 'node:fs';
import { readTrials } from './probe.mjs';
import assert from 'node:assert/strict';
import { createReferenceEnvironment } from '../../../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../../../ghost-maze/src/solver/breadthFirst.js';
const budget={nodeBudget:400000,stateBudget:400000,budgetMs:30000};
const isAt=(p,x,y)=>p.x===x && p.y===y;
export function plans(map) {
    const env=createReferenceEnvironment(map), safe=structuredClone(map);
    safe.layers[0].endPos=null;
    const noEnd=createReferenceEnvironment(safe);
    const results=[];
    for(const mode of ['real_trap','without_real_trap','finish_parked_right_mouth','never_return_to_old_guard','wake_before_key','never_right_switch','first_switch_before_key','after_key_no_upper_lure']) {
        const search=createBreadthFirstSearch(env,{monitor:{
            initial:()=>[0,0,0,0],
            advance(history,b,a,n) {
                if(n.isWon && noEnd.step(b,a).isDead)return null;
                const gb=b.layerStates[0].ghosts[0], gn=n.layerStates[0].ghosts[0];
                const right=isAt(b.player,4,1)&&a==='D';
                const left=isAt(b.player,1,1)&&a==='L'&&n.player.x===b.player.x;
                const crossed=isAt(b.player,2,2)&&isAt(n.player,3,2);
                const woke=history[0]&&isAt(gb,2,2)&&!isAt(gn,2,2);
                const trapped=right&&isAt(gn,4,0)&&n.layerStates[0].wallStates.h[1][4].currentState==='closed';
                if(mode==='without_real_trap'&&trapped || mode==='never_return_to_old_guard'&&woke ||
                    mode==='never_right_switch'&&right || mode==='first_switch_before_key'&&!history[3]&&(right||left)&&b.player.keys ||
                    mode==='after_key_no_upper_lure'&&b.player.keys&&isAt(n.player,2,0))return null;
                const next=[Number(history[0]||crossed),Number(history[1]||trapped),Number(history[2]||(woke&&!n.player.keys)),Number(history[3]||left||right)];
                if(n.isWon&&(mode==='real_trap'&&!next[1] || mode==='wake_before_key'&&!next[2] ||
                    mode==='finish_parked_right_mouth'&&!isAt(gn,3,2)))return null;
                return next;
            }
        }});
        const result=search.run(budget);
        assert.ok(['proven_unsat','solved'].includes(result.status));
        results.push({mode,status:result.status,T:result.totalActions,actions:search.firstActions()});
    }
    return results;
}
if(import.meta.main) {
    const entries=readTrials('fold-goal.json').entries.filter(r=>['ordinary','arrow'].includes(r.name));
    const rows=entries.map(r=>({layout:r.layout,name:r.name,queries:plans(r.map)}));
    fs.writeFileSync(new URL('plans.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
    for(const r of rows)console.log(r.layout,r.name,r.queries.map(q=>q.mode+'='+q.T).join(' '));
}
