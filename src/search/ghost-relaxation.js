import {performance} from 'node:perf_hooks';
import {createFastEnvironment} from './fast-environment.js';
import {stateKey} from '../validate/simulator.js';

/** 完整保留门／钥匙／按钮／楼梯，只删除鬼；所有边仍调用唯一引擎。 */
export function buildGhostRelaxation(map,{nodeBudget=10000,stateBudget=10000,budgetMs=50}={}){
    for(const [name,value]of Object.entries({nodeBudget,stateBudget,budgetMs}))if(!Number.isSafeInteger(value)||value<(name==='stateBudget'?1:0))throw new TypeError('去鬼子问题预算无效');
    const started=performance.now(),env=createFastEnvironment(map,{withGhosts:false}),key=s=>stateKey(s,env.sim,{withGhosts:false}),initial=env.initialState(),nodes=[{state:initial,parents:[]}],index=new Map([[key(initial),0]]);let expanded=0,transitions=0;
    const incomplete=reason=>Object.freeze({status:'unknown',reason,states:nodes.length,expanded,transitions,elapsedMs:performance.now()-started,sourceMapId:env.sourceMapId,lowerBound:()=>null});
    for(let head=0;head<nodes.length;head++){
        if(expanded>=nodeBudget||performance.now()-started>=budgetMs)return incomplete('budget');
        const node=nodes[head];if(node.state.isWon)continue;expanded++;
        for(const action of env.reference.actions){if(performance.now()-started>=budgetMs)return incomplete('time_budget');const next=env.step(node.state,action);transitions++;if(next===node.state||next.isDead)continue;const k=key(next);let i=index.get(k);if(i===undefined){if(nodes.length>=stateBudget)return incomplete('state_budget');i=nodes.length;index.set(k,i);nodes.push({state:next,parents:[]});}nodes[i].parents.push(head);}
    }
    const distance=new Float64Array(nodes.length).fill(Infinity),queue=[];nodes.forEach((n,i)=>{if(n.state.isWon){distance[i]=0;queue.push(i);}});
    for(let head=0;head<queue.length;head++){const i=queue[head];for(const p of nodes[i].parents)if(!Number.isFinite(distance[p])){distance[p]=distance[i]+1;queue.push(p);}}
    return Object.freeze({status:'exhausted',reason:'complete_no_ghost_graph',states:nodes.length,expanded,transitions,elapsedMs:performance.now()-started,sourceMapId:env.sourceMapId,
        lowerBound(state){const i=index.get(key(state));return i===undefined?null:distance[i];}});
}
