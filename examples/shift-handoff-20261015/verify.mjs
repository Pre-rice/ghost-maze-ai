import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {enumeratePlanningGraph} from '../../src/training/planning-graph.js';
import {normalizeVoidWalls,validateMapData,WALL_TYPES as W} from '../../src/reference/engine.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const at=(s,i,x,y)=>s.layerStates[0].ghosts[i].x===x&&s.layerStates[0].ghosts[i].y===y;
const shade=s=>s.layerStates[0].wallStates.h[5][4].currentState;
const required={
    closeWithGuardAbove:(b,a,n)=>b.player.x===4&&b.player.y===5&&a==='R'&&shade(b)==='open'&&shade(n)==='closed'&&at(b,1,4,4)&&at(n,1,4,4),
    repositionWhileClosed:(b,a,n)=>shade(b)==='closed'&&shade(n)==='closed'&&n.layerStates[0].ghosts[1].y<b.layerStates[0].ghosts[1].y,
    releaseNewGuard:(b,a,n)=>b.player.x===3&&b.player.y===5&&a==='U'&&b.layerStates[0].wallStates.h[6][4].currentState==='closed'&&n.layerStates[0].wallStates.h[6][4].currentState==='open'&&at(b,1,4,4),
    finalHandoff:(b,a,n)=>b.player.x===4&&b.player.y===5&&a==='D'&&at(b,0,4,4)&&at(b,1,3,5)&&at(n,0,4,5)&&at(n,1,3,5)
};

export function verify(){
    const map=JSON.parse(fs.readFileSync(root+'map.json')),qa=auditMap(map),graph=enumeratePlanningGraph(map);
    assert.equal(qa.allResult.totalActions,38);assert.equal(qa.count,'2');assert(qa.cold&&qa.entry?.wholeOptimalRoutesInteriorEqual);
    assert.equal(graph.status,'exhausted');assert.equal(graph.distance[0],38);assert.equal(graph.safeDistance[0],38);
    const necessity=Object.entries(required).map(([name,forbidden])=>{
        const queue=[0],seen=new Set(queue);let solved=false;
        for(let head=0;head<queue.length;head++){
            const i=queue[head],state=graph.nodes[i].state;if(state.isWon){solved=true;break;}
            for(const edge of graph.nodes[i].edges){if(forbidden(state,edge.action,graph.nodes[edge.to].state)||seen.has(edge.to))continue;seen.add(edge.to);queue.push(edge.to);}
        }
        assert(!solved,name);return{name,status:'proven_unsat',states:seen.size,scope:'原图全部无伤无复活路线，允许非致死重合；不是改图消融或最短路线过滤'};
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
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
        if(!layer.activeCells[y][x]||[layer.customStartPos,layer.endPos,...layer.ghosts,...layer.buttons].some(p=>p?.x===x&&p.y===y))continue;
        const edit=structuredClone(map),l=edit.layers[0];l.activeCells[y][x]=false;
        for(const [f,ex,ey]of [['hWalls',x,y],['hWalls',x,y+1],['vWalls',x,y],['vWalls',x+1,y]])l[f][ey][ex]={type:W.SOLID,keys:0};
        compare(edit,{removeCell:[x,y]});
    }
    for(const route of qa.routes)assert.deepEqual(route.controls.map(c=>c.letter),['A','A','B']);
    return{qa,necessity,contrast,humanQuality:null};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
    const fresh=verify(),stored=JSON.parse(fs.readFileSync(root+'evidence.json'));
    assert.equal(fresh.qa.mapId,stored.qa.mapId);assert.equal(fresh.qa.ruleset,stored.qa.ruleset);assert.deepEqual(fresh.qa.routes,stored.qa.routes);
    assert.deepEqual(fresh.necessity,stored.necessity);assert.deepEqual(fresh.contrast,stored.contrast);
    assert.equal(JSON.parse(fs.readFileSync(root+'source.json')).humanQuality,null);
    console.log(JSON.stringify({shortest:38,optimalCount:fresh.qa.count,necessity:fresh.necessity,entry:fresh.qa.entry,physical:fresh.qa.physicalAudit}));
}
