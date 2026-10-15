import { createReferenceEnvironment } from '../reference/environment.js';

export const hasGhostOverlap = state => state.layerStates.some(layer => new Set(layer.ghosts.map(g=>`${g.x},${g.y}`)).size!==layer.ghosts.length);

/** 反向BFS给出整个已穷尽状态图的精确剩余成本；禁止用局部探索的值冒充精确标签。 */
export function reverseDistances(nodes, { avoidOverlap=false }={}) {
    const reverse=nodes.map(()=>[]),distance=new Float64Array(nodes.length).fill(Infinity),queue=[];
    nodes.forEach((node,i)=>{if(avoidOverlap&&node.overlap)return;for(const edge of node.edges)if(!avoidOverlap||!nodes[edge.to].overlap)reverse[edge.to].push(i);if(node.state.isWon){distance[i]=0;queue.push(i);}});
    for(let head=0;head<queue.length;head++){const i=queue[head];for(const previous of reverse[i])if(!Number.isFinite(distance[previous])){distance[previous]=distance[i]+1;queue.push(previous);}}
    return distance;
}

/** 只枚举唯一共同引擎；编号、步数、观察和录制来源不进入训练状态键。 */
export function enumeratePlanningGraph(map,{stateBudget=100000,nodeBudget=100000,budgetMs=60000}={}) {
    const env=createReferenceEnvironment(map),started=Date.now(),initial=env.initialState(),nodes=[{state:initial,edges:[],overlap:hasGhostOverlap(initial)}],index=new Map([[env.stateKey(initial),0]]);
    let transitions=0,dead=0;
    for(let head=0;head<nodes.length;head++){
        if(head>=nodeBudget||Date.now()-started>budgetMs)return {status:'unknown',reason:'budget',env,nodes,transitions};
        const node=nodes[head];if(node.state.isWon)continue;
        for(const action of env.actions){
            const next=env.step(node.state,action);transitions++;if(next===node.state)continue;if(next.isDead){dead++;continue;}
            const key=env.stateKey(next);let to=index.get(key);
            if(to===undefined){if(nodes.length>=stateBudget)return {status:'unknown',reason:'state_budget',env,nodes,transitions};to=nodes.length;index.set(key,to);nodes.push({state:next,edges:[],overlap:hasGhostOverlap(next)});}
            node.edges.push({action,to});
        }
    }
    return {status:'exhausted',env,nodes,index,distance:reverseDistances(nodes),safeDistance:reverseDistances(nodes,{avoidOverlap:true}),transitions,dead,elapsedMs:Date.now()-started};
}
