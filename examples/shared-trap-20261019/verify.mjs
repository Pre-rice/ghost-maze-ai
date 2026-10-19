import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, GameLogic, actionFromName, validateMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';
import { assertButtonAttachments } from '../../src/design/button-support.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';
import { buildMap } from './build.mjs';

export function auditEntry(map,routes){
 const env=createReferenceEnvironment(map),initial=env.initialState(),entryMap=structuredClone(map),l=entryMap.layers[0];l.activeCells[3][0]=true;l.customStartPos={x:0,y:3};l.vWalls[3][1]={type:W.ONE_WAY,keys:0,direction:{dx:1,dy:0}};
 const entered=createReferenceEnvironment(normalizeVoidWalls(entryMap)),prefix=['R','R','R','R','D','L'];
 const interior=s=>JSON.stringify({p:[s.player.x,s.player.y,s.player.layer,s.player.keys,s.player.hp],dead:s.isDead,won:s.isWon,g:s.layerStates.map(l=>l.ghosts.map(g=>[g.x,g.y])),items:s.layerStates.map(l=>l.items),walls:s.layerStates.map((l,li)=>Object.fromEntries(['h','v'].map(axis=>[axis,l.wallStates[axis].flatMap((row,y)=>row.flatMap((w,x)=>{const ac=map.layers[li].activeCells;return ac[y]?.[x]&&(axis==='h'?ac[y-1]?.[x]:ac[y]?.[x-1])?[[x,y,w]]:[];}))])))});
 let arrival=entered.initialState();for(const a of prefix){const n=entered.step(arrival,a);assert(n!==arrival&&!n.isDead&&!n.isWon);assert.deepEqual(n.layerStates[0].ghosts.map(g=>[g.x,g.y]),initial.layerStates[0].ghosts.map(g=>[g.x,g.y]));arrival=n;}assert.equal(interior(arrival),interior(initial));
 for(const r of routes){let a=initial,b=arrival;for(const action of r.actions){a=env.step(a,action);b=entered.step(b,action);assert.equal(interior(a),interior(b));}}
 return{external:[0,0,3],actions:prefix,internal:[0,3,4],keys:0,externalGhosts:0,exteriorSealedExceptEntrance:true,prefixLeavesAllGhostsUnchanged:true,initialInteriorEqual:true,wholeOptimalRoutesInteriorEqual:true,scope:'从西侧进入上室并经普通门到出生，六步均不引动鬼；不证明任意外部入场或任意单步抵达'};
}
export function analyzeMap(map, actions) {
const budget={nodeBudget:1000000,stateBudget:1000000,budgetMs:30000},env=createReferenceEnvironment(map),copy=structuredClone(map);copy.layers[0].endPos=null;const noEnd=createReferenceEnvironment(copy),alpha=g=>g.y<4||g.y===4&&g.x!==3,moved=(s,n,i)=>s.layerStates[0].ghosts[i].x!==n.layerStates[0].ghosts[i].x||s.layerStates[0].ghosts[i].y!==n.layerStates[0].ghosts[i].y;
const diagnostic=(s,a)=>{const d=[];GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:d});return d;};
const specs=[
 ['visitor-first-or-simultaneous',(h,s,a,n)=>{const visitor=moved(s,n,1);if(!h[0]&&moved(s,n,0)&&!visitor)return null;return[h[0]||visitor?1:0];}],
 ['no-host-move-after-visitor',(h,s,a,n)=>h[0]&&moved(s,n,0)?null:[h[0]||moved(s,n,1)?1:0]],
 ['never-import-visitor',(h,s,a,n)=>alpha(n.layerStates[0].ghosts[1])?null:h],
 ['win-with-ghost-outside-upper-room',(h,s,a,n)=>n.isWon&&n.layerStates[0].ghosts.every(alpha)?null:h],
 ['no-common-close',(h,s,a,n)=>s.layerStates[0].wallStates.h[4][3].currentState==='open'&&n.layerStates[0].wallStates.h[4][3].currentState==='closed'&&n.layerStates[0].ghosts.every(alpha)?null:h],
 ['no-main-preparation-before-visitor',(h,s,a,n)=>{const ever=h[0]||moved(s,n,1)?1:0,g=n.layerStates[0].ghosts[0];if(!ever&&g.x===3&&g.y===3&&n.layerStates[0].wallStates.h[4][3].currentState==='closed')return null;return[ever];}],
 ['outside-only',(h,s,a,n)=>s.player.x===5&&s.player.y===4&&a==='D'?null:h],
 ['inside-only',(h,s,a,n)=>s.player.x===3&&s.player.y===4&&a==='L'?null:h],
 ['at-most-two-A-presses',(h,s,a,n)=>{const press=s.player.x===n.player.x&&s.player.y===n.player.y,count=h[0]+(press?1:0);return count>2?null:[count];}],
 ['no-priority',(h,s,a,n)=>diagnostic(s,a).some(d=>d.decision==='visible_target_priority')?null:h],
 ['host-never-loses-to-visitor',(h,s,a,n)=>diagnostic(s,a).some(d=>d.decision==='visible_target_priority'&&d.contenders.some(c=>c.from.x===s.layerStates[0].ghosts[0].x&&c.from.y===s.layerStates[0].ghosts[0].y&&!c.seesAfter)&&d.contenders.some(c=>c.from.x===s.layerStates[0].ghosts[1].x&&c.from.y===s.layerStates[0].ghosts[1].y&&c.seesAfter))?null:h]
];
const queries=specs.map(([name,advance])=>{const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:advance(h,s,a,n)}}),result=q.run(budget);assert.notEqual(result.status,'unknown');return{name,result,actions:q.firstActions(),scope:'原图全部无伤无复活通关，允许非最优重合，去终点安全；历史位／计数进完整键'};});
const choices=[];let s=env.initialState();
for(const[i,selected]of actions.entries()){
 const options=[];for(const a of env.actions){const n=env.step(s,a);if(n===s||n.isDead||n.isWon&&noEnd.step(s,a).isDead)continue;const q=createBreadthFirstSearch({...env,initialState:()=>n},{monitor:{initial:()=>[],advance:(h,b,c,d)=>d.isWon&&noEnd.step(b,c).isDead?null:h}}),result=q.run(budget);assert.notEqual(result.status,'unknown');options.push({a,selected:a===selected,result,suffix:q.firstActions()});}
 choices.push({step:i+1,p:[s.player.x,s.player.y],prefix:actions.slice(0,i),options});s=env.step(s,selected);
}
const prefixes=[['visitor-first',['D']],['visitor-in-hall',['D','U','R']],['wrong-ordinary-parking-then-invite',['L','U','U','L','D','R','R','D','L','L','D']]].map(([name,prefix])=>{
 let state=env.initialState();for(const a of prefix){const n=env.step(state,a);assert(n!==state&&!n.isDead&&!n.isWon);state=n;}const q=createBreadthFirstSearch({...env,initialState:()=>state},{monitor:{initial:()=>[],advance:(h,s,a,n)=>n.isWon&&noEnd.step(s,a).isDead?null:h}});return{name,prefix,player:[state.player.x,state.player.y],ghosts:state.layerStates[0].ghosts.map(g=>[g.x,g.y]),result:q.run(budget),suffix:q.firstActions()};
});
const changes=[];
for(const[axis,x,y,label]of[['h',3,4,'upper-A'],['h',3,5,'lower-A'],['v',4,4,'ordinary']])for(const[type,name]of[[W.EMPTY,'empty'],[W.SOLID,'solid'],[W.DOOR,'door']]){if(label==='ordinary'&&type===W.DOOR)continue;changes.push([label+'-'+name,m=>m.layers[0][axis+'Walls'][y][x]={type,keys:0}]);}
for(const axis of['h','v'])map.layers[0][axis+'Walls'].forEach((row,y)=>row.forEach((wall,x)=>{const ac=map.layers[0].activeCells;if(ac[y]?.[x]&&(axis==='h'?ac[y-1]?.[x]:ac[y]?.[x-1])&&wall.type===W.SOLID)changes.push([['open',axis,x,y].join('-'),m=>m.layers[0][axis+'Walls'][y][x]={type:W.EMPTY,keys:0}]);}));
for(let i=0;i<2;i++){changes.push(['remove-ghost-'+i,m=>m.layers[0].ghosts.splice(i,1)]);changes.push(['remove-button-'+i,m=>m.layers[0].buttons.splice(i,1)]);}
changes.push(['inside-button-previous-4-4',m=>m.layers[0].buttons[1].x=4]);
const reductions=changes.map(([name,edit])=>{const m=structuredClone(map);edit(m);const checked=validateMapData(m);try{assert(checked.valid);assertButtonAttachments(m);}catch(e){return{name,status:'invalid_input',reason:e.message};}
 const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e),result=q.run(budget);assert.notEqual(result.status,'unknown');const r={name,result,actions:q.firstActions()};if(result.status==='solved'){
 r.boundary=auditPuzzleBoundaries(m,budget);const n=structuredClone(m);n.layers[0].endPos=null;try{createReferenceEnvironment(n).replay(r.actions);r.referenceNoEndSafe=true;}catch{r.referenceNoEndSafe=false;}
 }return r;});

for (const r of prefixes) assert.notEqual(r.result.status,'unknown');
return { queries, choices, prefixes, reductions, humanQuality: null };
}

export function groupMap(map) {
    const q = createBreadthFirstSearch(createReferenceEnvironment(map), { allOptimal: true, classifyState: ghostFrame });
    const budget = { nodeBudget: 1000000, stateBudget: 1000000, budgetMs: 30000 };
    assert.equal(q.run(budget).status, 'solved');
    const g = createTrajectoryGroups(q.optimalGraph()), result = g.run(budget);
    assert.equal(result.status, 'solved'); return { ...result, routes: [...g.routes()] };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const map = JSON.parse(fs.readFileSync(new URL('map.json', import.meta.url)));
    const old = JSON.parse(fs.readFileSync(new URL('evidence.json', import.meta.url)));
    assert.deepEqual(buildMap(), map); assertExterior(map);
    // 通用入口枚举只查一步或相邻抵达；此图独立复算明确的六步中性接入。
    const native = auditMap(map), qa = { ...native, entry: auditEntry(map, native.routes) };
    const grouping = groupMap(map), analysis = analyzeMap(map, qa.actions);
    for (const key of ['mapId', 'ruleset', 'count', 'mapCode', 'replayCode', 'cold']) assert.equal(qa[key], old.qa[key]);
    assert.equal(qa.allResult.totalActions, 26); assert(qa.cold);
    for (const key of ['routes', 'physicalAudit', 'entry']) assert.deepEqual(qa[key], old.qa[key]);
    assert.equal(qa.noEndSafeRoutes, Number(qa.count));
    assert.equal(grouping.count, old.grouping.count); assert.deepEqual(grouping.routes, old.grouping.routes);
    for (const field of ['queries', 'choices', 'prefixes', 'reductions']) {
        assert.equal(analysis[field].length, old.analysis[field].length);
        analysis[field].forEach((a, i) => {
            const b = old.analysis[field][i];
            for (const key of ['name', 'step', 'p', 'prefix', 'player', 'ghosts', 'actions', 'suffix', 'status']) assert.deepEqual(a[key], b[key]);
            const pairs = [[a, b], ...(a.options ?? []).map((v, j) => [v, b.options[j]])];
            for (const [x, y] of pairs) {
                for (const key of ['a', 'selected', 'suffix']) assert.deepEqual(x[key], y[key]);
                assert.notEqual(x.result?.status, 'unknown');
                assert.equal(x.result?.status, y.result?.status); assert.equal(x.result?.totalActions, y.result?.totalActions);
                assert.equal(x.boundary?.status, y.boundary?.status);
            }
        });
    }
    console.log(JSON.stringify({ title: '对门', N: 26, rawOptimal: qa.count, ghostTrajectories: grouping.count,
        cold: qa.cold, entry: qa.entry, physicalAudit: qa.physicalAudit, humanQuality: null, gallerySelected: false }));
}
