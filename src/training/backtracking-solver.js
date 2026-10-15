import {performance} from 'node:perf_hooks';
import {createFastEnvironment} from '../search/fast-environment.js';
import {hasGhostOverlap} from './planning-graph.js';

/** 原生规则的完整回溯找解实验：不求最优、不剪概率低的分支，仅排除非致死重合。 */
export function solveBacktracking(map,{rankCandidate=null,nodeBudget=100000,stateBudget=100000,budgetMs=60000}={}){
    if(rankCandidate!==null&&typeof rankCandidate!=='function')throw new TypeError('排序必须为函数或null');
    for(const [name,value]of Object.entries({nodeBudget,stateBudget,budgetMs}))if(!Number.isSafeInteger(value)||value<(name==='stateBudget'?1:0))throw new TypeError('无效预算');
    const started=performance.now(),env=createFastEnvironment(map),initial=env.initialState(),initialKey=env.stateKey(initial),seen=new Set([initialKey]),stack=[{state:initial,key:initialKey,action:null,children:null,head:0}];let expanded=0,transitions=0,rankCalls=0;
    if(!env.reference.mapDefinition.layers.some(l=>l.initialEntities.endPos))throw new TypeError('求解地图至少需要一个终点');
    const finish=(status,reason)=>{let solution=null;if(status==='solved'){const actions=stack.slice(1).map(f=>f.action),verified=env.reference.replay(actions);if(!verified.state.isWon)throw new Error('回溯证书原生重放失败');solution={actions,totalActions:actions.length};}return {status,reason,solution,optimality:null,scope:'first_solution_no_revive_no_nonfatal_overlap',search:{expanded,transitions,discovered:seen.size,rankCalls,elapsedMs:performance.now()-started}};};
    if(hasGhostOverlap(initial))return finish('unknown','initial_overlap_outside_scope');
    while(stack.length){
        if(performance.now()-started>=budgetMs)return finish('unknown','time_budget');
        const frame=stack.at(-1);if(frame.state.isWon)return finish('solved','first_solution');
        if(frame.children===null){
            if(expanded>=nodeBudget)return finish('unknown','node_budget');expanded++;
            const children=[],local=new Set();for(const action of env.reference.actions){if(performance.now()-started>=budgetMs)return finish('unknown','time_budget');const next=env.step(frame.state,action);transitions++;if(next===frame.state||next.isDead||hasGhostOverlap(next))continue;const key=env.stateKey(next);if(seen.has(key)||local.has(key))continue;local.add(key);children.push({state:next,key,action,children:null,head:0,rank:0});}
            if(rankCandidate&&children.length>1)for(const child of children){child.rank=rankCandidate(frame.state,child.action,child.state);rankCalls++;if(!Number.isFinite(child.rank))throw new TypeError('排序值必须有限');}
            frame.children=children.sort((a,b)=>a.rank-b.rank);
        }
        let child;while(frame.head<frame.children.length){const next=frame.children[frame.head++];if(!seen.has(next.key)){child=next;break;}}
        if(!child){stack.pop();continue;}if(seen.size>=stateBudget)return finish('unknown','state_budget');seen.add(child.key);stack.push(child);
    }
    return finish('proven_unsat','exhausted_nonoverlap_scope');
}
