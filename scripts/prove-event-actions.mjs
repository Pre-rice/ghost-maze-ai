import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {enumeratePlanningGraph,hasGhostOverlap} from '../src/training/planning-graph.js';
import {createEventSuccessors} from '../src/training/event-actions.js';
import {createDecisionSuccessors} from '../src/training/decision-actions.js';
import {createFastEnvironment} from '../src/search/fast-environment.js';

const[library,output,mode='events']=process.argv.slice(2);if(!output||!['events','decisions'].includes(mode))throw new Error('用法：node scripts/prove-event-actions.mjs <verified-library> <新输出> [events|decisions]');
assert(!existsSync(output));const read=path=>JSON.parse(readFileSync(path)),sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
mkdirSync(output,{recursive:true});mkdirSync(output+'/graphs');
const weightedDistances=nodes=>{
    const reverse=nodes.map(()=>[]),distance=new Float64Array(nodes.length).fill(Infinity),heap=[];
    const push=(id,d)=>{let i=heap.length;heap.push([id,d]);while(i){const p=(i-1)>>1;if(heap[p][1]<=d)break;heap[i]=heap[p];i=p;}heap[i]=[id,d];};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(last[1]<=heap[c][1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
    nodes.forEach((n,i)=>{for(const e of n.edges)reverse[e.to].push({from:i,cost:e.cost});if(n.goal){distance[i]=0;push(i,0);}});
    while(heap.length){const[id,d]=pop();if(d!==distance[id])continue;for(const e of reverse[id])if(d+e.cost<distance[e.from]){distance[e.from]=d+e.cost;push(e.from,d+e.cost);}}
    return distance;
};
const source=read(library+'/summary.json'),records=[];
for(const record of source.records){
    const map=read(library+'/'+record.mapId+'/manifest.json').map,primitive=enumeratePlanningGraph(map),env=createFastEnvironment(map,{canonicalGhosts:true});
    assert.equal(primitive.status,'exhausted');assert.equal(primitive.distance[0],record.shortest);
    const goal=s=>s.isWon,macro=(mode==='events'?createEventSuccessors:createDecisionSuccessors)({stateKey:env.stateKey,step:env.step,actions:env.reference.actions,isGoal:goal,isAllowed:s=>!s.isDead&&!hasGhostOverlap(s)});
    // 对照相同范围：先去掉重合路线与编号别名，不能把这些减少算成行动段的收益。
    const safeCanonical=new Set([env.stateKey(primitive.nodes[0].state)]),safeQueue=[0];
    for(let head=0;head<safeQueue.length;head++)for(const edge of primitive.nodes[safeQueue[head]].edges){
        const next=primitive.nodes[edge.to];if(next.overlap)continue;const key=env.stateKey(next.state);
        if(!safeCanonical.has(key)){safeCanonical.add(key);safeQueue.push(edge.to);}
    }
    const initial=env.initialState(),nodes=[{state:initial,edges:[],goal:goal(initial),primitive:0}],index=new Map([[env.stateKey(initial),0]]),started=performance.now();
    let boundaryActions=0;
    for(let head=0;head<nodes.length;head++){
        assert(nodes.length<=20000&&performance.now()-started<60000,'行动段图未穷尽，不能提供等价结论');
        const current=nodes[head];if(current.goal)continue;
        for(const edge of macro.generate(current.state)){
            let cursor=current.primitive;
            for(const action of edge.actions){const original=primitive.nodes[cursor].edges.find(e=>e.action===action);assert(original,'行动段出现非原生动作');cursor=original.to;assert(!primitive.nodes[cursor].overlap);boundaryActions++;}
            assert.equal(primitive.env.stateKey(primitive.nodes[cursor].state),primitive.env.stateKey(edge.state));assert.equal(edge.cost,edge.actions.length);
            const key=env.stateKey(edge.state);let to=index.get(key);
            if(to===undefined){to=nodes.length;index.set(key,to);nodes.push({state:edge.state,edges:[],goal:goal(edge.state),primitive:cursor});}
            else assert.equal(primitive.safeDistance[cursor],primitive.safeDistance[nodes[to].primitive]);
            current.edges.push({to,cost:edge.cost,actions:edge.actions});
        }
    }
    const distances=weightedDistances(nodes);let checked=0;
    for(let i=0;i<nodes.length;i++){assert.equal(distances[i],primitive.safeDistance[nodes[i].primitive]);checked++;}
    assert.equal(distances[0],record.shortest);
    let cursor=0;const reference=[],segmentCosts=[];
    while(!nodes[cursor].goal){const edge=nodes[cursor].edges.find(e=>distances[e.to]+e.cost===distances[cursor]);assert(edge);reference.push(...edge.actions);segmentCosts.push(edge.cost);cursor=edge.to;}
    assert.equal(reference.length,record.shortest);assert(env.reference.replay(reference).state.isWon);
    const serialized=nodes.map((n,i)=>({goal:n.goal,primitive:n.primitive,distance:Number.isFinite(distances[i])?distances[i]:null,edges:n.edges}));
    writeFileSync(output+'/graphs/'+record.mapId+'.json',JSON.stringify({mapId:record.mapId,nodes:serialized})+'\n');
    const result={title:record.title,mapId:record.mapId,primitiveStates:primitive.nodes.length,safeCanonicalStates:safeCanonical.size,macroStates:nodes.length,macroEdges:nodes.reduce((n,s)=>n+s.edges.length,0),distanceChecks:checked,boundaryActions,shortest:distances[0],referenceSegments:segmentCosts.length,segmentCosts,reference,stats:{...macro.stats,...(macro.eventStats?{events:{...macro.eventStats}}:{})},elapsedMs:performance.now()-started};
    records.push(result);console.log(JSON.stringify(result));
}
const result={role:'native_event_action_equivalence_not_quality',mode,librarySha256:sha(library+'/summary.json'),sourceSha256:sha(new URL(import.meta.url)),helperSha256:sha(new URL('../src/training/event-actions.js',import.meta.url)),decisionHelperSha256:sha(new URL('../src/training/decision-actions.js',import.meta.url)),allPassed:true,records};
writeFileSync(output+'/summary.json',JSON.stringify(result,null,2)+'\n');
