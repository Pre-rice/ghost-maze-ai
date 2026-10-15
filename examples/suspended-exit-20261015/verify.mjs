import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {enumeratePlanningGraph} from '../../src/training/planning-graph.js';
import {solveContinuation} from '../../src/design/continuation.js';
import {normalizeVoidWalls,validateMapData,WALL_TYPES as W} from '../../src/reference/engine.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const at=(s,i,x,y)=>s.layerStates[0].ghosts[i].x===x&&s.layerStates[0].ghosts[i].y===y;
const player=(s,x,y)=>s.player.x===x&&s.player.y===y;
const events={
    firstPriority:(b,a,n)=>player(b,5,3)&&a==='R'&&at(b,0,5,4)&&at(b,1,4,3)&&at(n,0,5,4)&&at(n,1,5,3),
    partialParkingAtButton:(b,a)=>player(b,4,1)&&a==='L'&&at(b,0,5,2),
    closeBehindPursuer:(b,a,n)=>player(b,4,1)&&a==='L'&&b.layerStates[0].wallStates.h[2][4].currentState==='open'&&at(b,1,4,2)&&at(n,1,4,2),
    delayedNorthLoop:(b,a,n)=>at(b,0,5,1)&&at(n,0,5,0)
};

export function verify(){
    const map=JSON.parse(fs.readFileSync(root+'map.json')),qa=auditMap(map),graph=enumeratePlanningGraph(map);
    assert.equal(qa.allResult.totalActions,22);assert.equal(qa.count,'1');assert(qa.cold&&qa.entry?.wholeOptimalRoutesInteriorEqual);
    assert.equal(graph.status,'exhausted');assert.equal(graph.distance[0],22);assert.equal(graph.safeDistance[0],22);
    const necessity=Object.entries(events).map(([name,event])=>{
        const queue=[0],seen=new Set(queue);let won=false;
        for(let head=0;head<queue.length;head++){
            const node=graph.nodes[queue[head]];if(node.state.isWon){won=true;break;}
            for(const edge of node.edges){if(event(node.state,edge.action,graph.nodes[edge.to].state)||seen.has(edge.to))continue;seen.add(edge.to);queue.push(edge.to);}
        }
        assert(!won,name);return{name,status:'proven_unsat',states:seen.size,scope:'原图全部无伤无复活续解，允许非致死重合；角色按初始位置追踪，不参与物理优先级'};
    });
    const continuations=[['fullyPullNorthEarly',['D','D','R','U','U','L','U','L']],['turnUpAtFirstCross',['D','D','U','U','L']]].map(([name,prefix])=>{
        const options={nodeBudget:100000,budgetMs:10000},fast=solveContinuation(map,prefix,options),reference=solveContinuation(map,prefix,{...options,reference:true});
        assert.equal(fast.status,'proven_unsat');assert.equal(reference.status,fast.status);return{name,fast,reference};
    });
    const contrast=[];
    const compare=(edit,description)=>{
        const checked=validateMapData(normalizeVoidWalls(edit));assert(checked.valid,checked.error);
        const g=enumeratePlanningGraph(checked.mapData);assert.equal(g.status,'exhausted');
        contrast.push({edit:description,shortest:Number.isFinite(g.distance[0])?g.distance[0]:null,safeShortest:Number.isFinite(g.safeDistance[0])?g.safeDistance[0]:null,states:g.nodes.length});
    };
    const layer=map.layers[0];
    for(const field of ['hWalls','vWalls'])layer[field].forEach((row,y)=>row.forEach((w,x)=>{
        if([W.EMPTY,W.SOLID].includes(w.type))return;
        for(const type of [W.EMPTY,W.SOLID]){const edit=structuredClone(map);edit.layers[0][field][y][x]={type,keys:0};compare(edit,{wall:field,x,y,replaceWith:type});}
    }));
    for(let i=0;i<layer.ghosts.length;i++){const edit=structuredClone(map);edit.layers[0].ghosts.splice(i,1);compare(edit,{removeGhost:i});}
    const noButton=structuredClone(map);noButton.layers[0].buttons=[];compare(noButton,{removeButton:'A'});
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
        if(!layer.activeCells[y][x]||[layer.customStartPos,layer.endPos,...layer.ghosts,...layer.buttons].some(p=>p?.x===x&&p.y===y))continue;
        const edit=structuredClone(map),l=edit.layers[0];l.activeCells[y][x]=false;
        // 删除地面后，旧功能边必须显式封墙，不能靠规范化掩盖非法边界。
        for(const [f,ex,ey]of [['hWalls',x,y],['hWalls',x,y+1],['vWalls',x,y],['vWalls',x+1,y]])l[f][ey][ex]={type:W.SOLID,keys:0};
        compare(edit,{removeCell:[x,y]});
    }
    return{qa,necessity,continuations,contrast,humanQuality:null};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
    const fresh=verify(),stored=JSON.parse(fs.readFileSync(root+'evidence.json'));
    assert.equal(fresh.qa.mapId,stored.qa.mapId);assert.equal(fresh.qa.ruleset,stored.qa.ruleset);assert.deepEqual(fresh.qa.routes,stored.qa.routes);
    assert.deepEqual(fresh.necessity,stored.necessity);assert.deepEqual(fresh.contrast,stored.contrast);
    console.log(JSON.stringify({shortest:fresh.qa.allResult.totalActions,optimalCount:fresh.qa.count,necessity:fresh.necessity,continuations:fresh.continuations.map(c=>({name:c.name,status:c.reference.status})),contrast:fresh.contrast,entry:fresh.qa.entry}));
}
