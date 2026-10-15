import {reverseDistances} from './planning-graph.js';
const point=g=>`${g.x},${g.y}`;
const pair=state=>state.layerStates[0].ghosts.map(point).sort().join(';');
const contains=(state,cell)=>state.layerStates[0].ghosts.some(g=>point(g)===cell);

/** 训练目标是给定的可见双鬼停位，不修改游戏胜负；只在穷尽原生状态图上标子任务。 */
export function censusParkedGoals(graph,{minSteps=8}={}){
    if(graph.status!=='exhausted')throw new TypeError('子任务标签必须来自穷尽图');
    if(graph.env.mapDefinition.layerCount!==1||graph.nodes[0].state.layerStates[0].ghosts.length!==2)return [];
    const initial=graph.nodes[0].state.layerStates[0].ghosts.map(point),targets=[...new Set(graph.nodes.filter(n=>!n.overlap).map(n=>pair(n.state)))].filter(p=>p.split(';').filter(c=>initial.includes(c)).length===1).sort();
    const fromStart=new Float64Array(graph.nodes.length).fill(Infinity),queue=[0];fromStart[0]=0;for(let head=0;head<queue.length;head++){const i=queue[head];for(const e of graph.nodes[i].edges)if(!Number.isFinite(fromStart[e.to])){fromStart[e.to]=fromStart[i]+1;queue.push(e.to);}}
    const results=[];
    for(const target of targets){const anchor=target.split(';').find(c=>initial.includes(c)),goal=s=>pair(s)===target,labeled=graph.nodes.map(n=>({...n,state:{isWon:goal(n.state)}})),full=reverseDistances(labeled),safe=reverseDistances(labeled,{avoidOverlap:true});if(!Number.isFinite(safe[0])||safe[0]<minSteps||safe[0]!==full[0])continue;
        if(graph.nodes.some((n,i)=>n.overlap&&fromStart[i]+full[i]===full[0]))continue;
        const keep=new Float64Array(graph.nodes.length).fill(Infinity),reach=[0];keep[0]=0;let keepCost=Infinity;
        for(let head=0;head<reach.length;head++){const i=reach[head];if(goal(graph.nodes[i].state)){keepCost=keep[i];break;}for(const e of graph.nodes[i].edges)if(!graph.nodes[e.to].overlap&&contains(graph.nodes[e.to].state,anchor)&&!Number.isFinite(keep[e.to])){keep[e.to]=keep[i]+1;reach.push(e.to);}}
        let i=0;const actions=[];while(!goal(graph.nodes[i].state)){const e=graph.nodes[i].edges.find(e=>!graph.nodes[e.to].overlap&&safe[e.to]===safe[i]-1);if(!e)throw new Error('子任务距离没有原生最优后继');actions.push(e.action);i=e.to;}
        const verified=graph.env.replay(actions);if(!goal(verified.state))throw new Error('子任务原生证书不满足停位');
        const canVacateForOptimal=graph.nodes.some((n,j)=>!contains(n.state,anchor)&&fromStart[j]+full[j]===full[0]);
        // 角色按初态可见位置追踪，仅用于对照证据；绝不进入动作物理或模型输入。
        const anchorIndex=initial.indexOf(anchor),canMoveOriginalForOptimal=graph.nodes.some((n,j)=>point(n.state.layerStates[0].ghosts[anchorIndex])!==anchor&&fromStart[j]+full[j]===full[0]);
        results.push({target:target.split(';').map(c=>{const[x,y]=c.split(',').map(Number);return {x,y,layer:0};}),anchor,anchorIndex,shortest:safe[0],keepCost:Number.isFinite(keepCost)?keepCost:null,mustVacateForOptimal:keepCost>safe[0],mustKeepForOptimal:!canVacateForOptimal,mustKeepOriginalForOptimal:!canMoveOriginalForOptimal,canVacateForOptimal,mustVacateForAnySafeSolution:!Number.isFinite(keepCost),allOptimalAvoidOverlap:true,witness:actions,distance:safe});
    }
    return results;
}
