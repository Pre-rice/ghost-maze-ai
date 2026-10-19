import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, GameLogic, actionFromName } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';
import { createTrajectoryGroups, ghostFrame } from '../../../ghost-maze/src/solver/trajectoryGroups.js';
import { hasGhostOverlap } from '../../src/training/planning-graph.js';
import { auditPuzzleBoundaries } from '../../src/design/rule-boundaries.js';
import { auditMap } from '../gallery-adjustments-20261014/verify.mjs';
import { assertExterior } from '../spatial-clearance-20261019/verify.mjs';
import { buildMap } from './build.mjs';
const budget = { nodeBudget: 1000000, stateBudget: 1000000, budgetMs: 30000 };

/** 原图全解查询允许非最优重合；访问中排的历史位进入完整键。 */
export function analyzeMap(map, actions) {
    const original = { map, qa: { actions } }, env = createReferenceEnvironment(map), copy = structuredClone(map);
    copy.layers[0].endPos = null; const noEnd = createReferenceEnvironment(copy);
const priority=(s,a)=>{const d=[];GameLogic.calculateNextState(s,actionFromName(a),env.mapDefinition,{trails:false,visibility:false,ghostDiagnostics:d});return d.some(r=>r.decision==='visible_target_priority');};
const queries=[];
for(const name of['never-priority','no-priority-after-middle','never-middle','win-after-overlap']){
 const q=createBreadthFirstSearch(env,{monitor:{initial:()=>[0],advance:(h,s,a,n)=>{
  if(n.isWon&&noEnd.step(s,a).isDead)return null;
  if(name==='win-after-overlap'){const next=h[0]||hasGhostOverlap(n)?1:0;return n.isWon&&!next?null:[next];}
  const next=h[0]||n.player.x===3&&n.player.y===4?1:0;
  if(name==='never-priority'&&priority(s,a)||name==='no-priority-after-middle'&&h[0]&&priority(s,a)||name==='never-middle'&&next)return null;
  return[next];
 }}});const result=q.run(budget);assert.notEqual(result.status,'unknown');queries.push({name,result,actions:q.firstActions(),scope:'原图全部去终点安全无伤无复活通关，允许非最优重合；累计位置访问或重合位进完整键'});
}
const choices=[];let s=env.initialState();
for(const[i,selected]of original.qa.actions.entries()){
 const options=[];for(const a of env.actions){const n=env.step(s,a);if(n===s||n.isDead)continue;const q=createBreadthFirstSearch({...env,initialState:()=>n});const result=q.run(budget);assert.notEqual(result.status,'unknown');options.push({action:a,selected:a===selected,result,suffix:q.firstActions()});}
 choices.push({step:i+1,prefix:original.qa.actions.slice(0,i),player:[s.player.x,s.player.y],options});s=env.step(s,selected);
}
const wrongPrefixes=choices.flatMap(r=>r.options.filter(o=>!o.selected&&o.result.status==='proven_unsat').map(o=>[...r.prefix,o.action]));
const changes=[];
for(const axis of['h','v'])map.layers[0][axis+'Walls'].forEach((row,y)=>row.forEach((wall,x)=>{const ac=map.layers[0].activeCells;if(ac[y]?.[x]&&(axis==='h'?ac[y-1]?.[x]:ac[y]?.[x-1])&&wall.type===W.SOLID)changes.push([`open-${axis}-${x}-${y}`,m=>m.layers[0][axis+'Walls'][y][x]={type:W.EMPTY,keys:0}]);}));
for(let i=0;i<3;i++)changes.push(['remove-ghost-'+i,m=>m.layers[0].ghosts.splice(i,1)]);
const physical=s=>JSON.stringify({p:[s.player.x,s.player.y],ghosts:s.layerStates[0].ghosts.map(g=>[g.x,g.y]),won:s.isWon,dead:s.isDead});
const reductions=changes.map(([name,change])=>{
 const m=structuredClone(map);change(m);const e=createReferenceEnvironment(m),q=createBreadthFirstSearch(e),result=q.run(budget);assert.notEqual(result.status,'unknown');const r={name,map:m,result,actions:q.firstActions()};
 if(result.status==='solved'){
  r.boundary=auditPuzzleBoundaries(m,budget);const no=structuredClone(m);no.layers[0].endPos=null;try{createReferenceEnvironment(no).replay(r.actions);r.referenceNoEndSafe=true;}catch{r.referenceNoEndSafe=false;}
  if(!name.startsWith('remove-ghost')){
   let a=env.initialState(),b=e.initialState();r.referencePlayerGhostProjectionEqual=true;
   for(const action of original.qa.actions){a=env.step(a,action);b=e.step(b,action);if(physical(a)!==physical(b)){r.referencePlayerGhostProjectionEqual=false;break;}}
   r.oldWrongPlans=wrongPrefixes.map(prefix=>{let state=e.initialState(),valid=true;for(const action of prefix){const n=e.step(state,action);if(n===state||n.isDead||n.isWon){valid=false;break;}state=n;}const row={prefix,valid};if(valid){const z=createBreadthFirstSearch({...e,initialState:()=>state});row.result=z.run(budget);row.suffix=z.firstActions();}return row;});
  }
 }
 delete r.map;return r;
});

return { queries, choices, reductions, humanQuality: null };
}

export function groupMap(map) {
    const q = createBreadthFirstSearch(createReferenceEnvironment(map), { allOptimal: true, classifyState: ghostFrame });
    assert.equal(q.run(budget).status,'solved');
    const g = createTrajectoryGroups(q.optimalGraph()), result = g.run(budget);
    assert.equal(result.status,'solved'); return { ...result, routes: [...g.routes()] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const map = JSON.parse(fs.readFileSync(new URL('map.json',import.meta.url)));
    const old = JSON.parse(fs.readFileSync(new URL('evidence.json',import.meta.url)));
    assert.deepEqual(buildMap(),map); assertExterior(map);
    const qa = auditMap(map), grouping = groupMap(map), analysis = analyzeMap(map,qa.actions);
    assert.equal(qa.mapId,old.qa.mapId); assert.equal(qa.ruleset,old.qa.ruleset);
    assert.equal(qa.allResult.totalActions,24); assert.equal(qa.count,old.qa.count);
    assert.deepEqual(qa.routes,old.qa.routes); assert.deepEqual(qa.physicalAudit,old.qa.physicalAudit);
    assert.equal(grouping.count,old.grouping.count); assert.deepEqual(grouping.routes,old.grouping.routes);
    assert(qa.cold && qa.entry.initialInteriorEqual && qa.entry.wholeOptimalRoutesInteriorEqual);
    assert.equal(qa.noEndSafeRoutes,Number(qa.count));
    for (const field of ['queries','choices','reductions']) {
        assert.equal(analysis[field].length,old.analysis[field].length);
        analysis[field].forEach((r,i) => {
            const p=old.analysis[field][i];
            for (const k of ['name','step','prefix','player','actions','referencePlayerGhostProjectionEqual']) assert.deepEqual(r[k],p[k]);
            for (const pair of [[r,p],...(r.options??[]).map((v,j)=>[v,p.options[j]]),...(r.oldWrongPlans??[]).map((v,j)=>[v,p.oldWrongPlans[j]])]) {
                const [a,b]=pair;for(const k of ['action','selected','valid','prefix','suffix'])assert.deepEqual(a[k],b[k]);
                assert.notEqual(a.result?.status,'unknown');assert.equal(a.result?.status,b.result?.status);assert.equal(a.result?.totalActions,b.result?.totalActions);
                assert.equal(a.boundary?.status,b.boundary?.status);
            }
        });
    }
    console.log(JSON.stringify({title:'易手',N:24,rawOptimal:qa.count,ghostTrajectories:grouping.count,
        cold:qa.cold,entry:qa.entry,physicalAudit:qa.physicalAudit,humanQuality:null,gallerySelected:false}));
}
