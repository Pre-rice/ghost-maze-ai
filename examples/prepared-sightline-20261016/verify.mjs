import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditMap} from '../gallery-adjustments-20261014/verify.mjs';
import {enumeratePlanningGraph} from '../../src/training/planning-graph.js';
import {applyEdit} from '../../src/design/edits.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {solveContinuation} from '../../src/design/continuation.js';
import {WALL_TYPES as W} from '../../src/reference/engine.js';

const at=(state,index,x,y)=>state.layerStates[0].ghosts[index].x===x&&state.layerStates[0].ghosts[index].y===y;
const shade=state=>state.layerStates[0].wallStates.h[5][4].currentState;
const required={
    closeWithGuardAbove:(b,a,n)=>b.player.x===4&&b.player.y===5&&a==='R'&&shade(b)==='open'&&shade(n)==='closed'&&at(b,1,4,4)&&at(n,1,4,4),
    repositionWhileClosed:(b,a,n)=>shade(b)==='closed'&&shade(n)==='closed'&&n.layerStates[0].ghosts[1].y<b.layerStates[0].ghosts[1].y,
    releaseNewGuard:(b,a,n)=>b.player.x===3&&b.player.y===5&&a==='U'&&b.layerStates[0].wallStates.h[6][4].currentState==='closed'&&n.layerStates[0].wallStates.h[6][4].currentState==='open'&&at(b,1,4,4),
    finalHandoff:(b,a,n)=>b.player.x===4&&b.player.y===5&&a==='D'&&at(b,0,4,4)&&at(b,1,3,5)&&at(n,0,4,5)&&at(n,1,3,5)
};

export function verify(){
    const root=new URL('.',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('map.json',root)));
    const qa=auditMap(map);assert.equal(qa.allResult.totalActions,50);assert.equal(qa.count,'4');
    assert(qa.cold&&qa.entry?.wholeOptimalRoutesInteriorEqual);
    const graph=enumeratePlanningGraph(map);assert.equal(graph.status,'exhausted');
    const necessity=Object.entries(required).map(([name,forbidden])=>{
        const queue=[0],seen=new Set(queue);let win=false;
        for(let head=0;head<queue.length;head++){
            const i=queue[head],before=graph.nodes[i].state;if(before.isWon){win=true;break;}
            for(const edge of graph.nodes[i].edges)if(!forbidden(before,edge.action,graph.nodes[edge.to].state)&&!seen.has(edge.to)){
                seen.add(edge.to);queue.push(edge.to);
            }
        }
        assert(!win,name);return{name,status:'proven_unsat',states:seen.size};
    });
    // 顺序是实际历史；即使物理局面重复，也不能丢掉“首次关闭A时0是否仍在”的标记。
    const queue=[{i:0,seenA:false,badFirst:false}],seen=new Set(['0,false,false']);
    for(let head=0;head<queue.length;head++){
        const node=queue[head],before=graph.nodes[node.i].state;
        assert(!(before.isWon&&node.badFirst),'存在首次关闭A早于开启0的通关解');
        for(const edge of graph.nodes[node.i].edges){
            const after=graph.nodes[edge.to].state;
            const closes=before.player.x===4&&before.player.y===5&&edge.action==='R'&&shade(before)==='open'&&shade(after)==='closed';
            const seenA=node.seenA||closes;
            const badFirst=node.badFirst||(!node.seenA&&closes&&before.layerStates[0].wallStates.h[2][4].type===W.LOCKED);
            const key=edge.to+','+seenA+','+badFirst;
            if(!seen.has(key)){seen.add(key);queue.push({i:edge.to,seenA,badFirst});}
        }
    }
    const zeroBeforeFirstClose={status:'proven_unsat',states:seen.size,scope:'原图全部无伤无复活通关，允许非最优非致死重合'};
    const early=solveContinuation(map,['R','R'],{reference:true,nodeBudget:100000,budgetMs:10000});
    const latePrefix=['R','R','L','L','U','U','U','U','R','R','D'];
    const late=solveContinuation(map,latePrefix,{reference:true,nodeBudget:100000,budgetMs:10000});
    assert.equal(early.status,'proven_unsat');assert.equal(late.status,'proven_unsat');
    const solid=solveFastMap(applyEdit(map,{type:'wall',axis:'h',x:4,y:2,wall:{type:W.SOLID,keys:0}}),
        {nodeBudget:100000,stateBudget:100000,budgetMs:10000});assert.equal(solid.status,'proven_unsat');

    const parent=JSON.parse(fs.readFileSync(new URL('../shift-handoff-20261015/map.json',root)));
    const prototype=applyEdit(parent,{type:'wall',axis:'h',x:4,y:2,wall:{type:W.LOCKED,keys:0}});
    const expected=structuredClone(prototype),layer=expected.layers[0];
    layer.activeCells[6][2]=true;layer.hWalls[6][2]={type:W.EMPTY,keys:0};layer.hWalls[7][2]={type:W.SOLID,keys:0};
    layer.vWalls[6][2]={type:W.SOLID,keys:0};layer.vWalls[6][3]={type:W.SOLID,keys:0};
    assert.deepEqual(expected,map,'仅增加0门和外轮廓死路，不修改母图其他内容');
    const prototypeQa=auditMap(prototype);
    // 码绑定地图，不能比较不同地图的回放码；比较全部实际动作、鬼轨迹与按钮。
    const routes=q=>q.routes.map(({replayCode,...route})=>route);
    assert.deepEqual(routes(qa),routes(prototypeQa));
    return{qa,necessity,zeroBeforeFirstClose,earlyClose:early,lateOpenStillAlive:late,zeroToSolid:solid,
        parentExactlyRecovered:true,aestheticFill:{cell:[2,6],prototypeMapId:prototypeQa.mapId,
            allOptimalActionsAndGhostFramesUnchanged:true,reason:'补齐环形外轮廓；单入口死路没有新增任务'},humanQuality:null};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
    const fresh=verify(),stored=JSON.parse(fs.readFileSync(new URL('evidence.json',import.meta.url)));
    assert.equal(fresh.qa.mapId,stored.qa.mapId);assert.equal(fresh.qa.ruleset,stored.qa.ruleset);
    assert.deepEqual(fresh.qa.routes,stored.qa.routes);assert.deepEqual(fresh.necessity,stored.necessity);
    assert.deepEqual(fresh.zeroBeforeFirstClose,stored.zeroBeforeFirstClose);
    assert.equal(JSON.parse(fs.readFileSync(new URL('source.json',import.meta.url))).humanQuality,null);
    console.log(JSON.stringify({mapId:fresh.qa.mapId,N:50,count:fresh.qa.count,cold:fresh.qa.cold,
        entry:fresh.qa.entry,physical:fresh.qa.physicalAudit,zeroBeforeFirstClose:fresh.zeroBeforeFirstClose,
        early:fresh.earlyClose.status,late:fresh.lateOpenStillAlive.status,aestheticFill:fresh.aestheticFill}));
}
