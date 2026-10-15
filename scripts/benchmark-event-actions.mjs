import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createFastEnvironment} from '../src/search/fast-environment.js';
import {hasGhostOverlap} from '../src/training/planning-graph.js';
import {createEventSuccessors} from '../src/training/event-actions.js';
import {createDecisionSuccessors} from '../src/training/decision-actions.js';
import {createIncrementalPlanner} from '../src/training/incremental-planner.js';

const[library,output]=process.argv.slice(2);
if(!output)throw new Error('用法：node scripts/benchmark-event-actions.mjs <verified-library> <新输出>');
assert(!existsSync(output),'不覆盖旧实验');mkdirSync(output,{recursive:true});
const read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const protocol={role:'native_whole_game_action_representation_cost_not_quality',repeats:3,methods:['primitive','events','decisions'],scope:'全信息、无伤、无复活、排除非致死重合；非网页求解器改动',librarySha256:sha(library+'/summary.json'),sources:Object.fromEntries(['scripts/benchmark-event-actions.mjs','src/training/event-actions.js','src/training/decision-actions.js','src/training/incremental-planner.js'].map(p=>[p,sha(p)]))};
writeFileSync(output+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const rows=[];
for(const record of read(library+'/summary.json').records){
    const map=read(library+'/'+record.mapId+'/manifest.json').map;
    for(let repeat=0;repeat<3;repeat++)for(let offset=0;offset<3;offset++){
        const mode=protocol.methods[(repeat+offset)%3],env=createFastEnvironment(map,{canonicalGhosts:true}),isGoal=s=>s.isWon,isAllowed=s=>!s.isDead&&!hasGhostOverlap(s);
        let transitions=0;const step=(s,a)=>{transitions++;return env.step(s,a);};
        const options={stateKey:env.stateKey,step,actions:env.reference.actions,isGoal,isAllowed};
        const macro=mode==='primitive'?null:(mode==='events'?createEventSuccessors:createDecisionSuccessors)(options);
        const successors=macro?macro.generate:s=>env.reference.actions.flatMap(action=>{const n=step(s,action);return n!==s&&isAllowed(n)?[{action,state:n}]:[];});
        const planner=createIncrementalPlanner({initial:env.initialState(),stateKey:env.stateKey,successors,isGoal,strategy:macro?'dijkstra':'bfs'});
        const start=performance.now(),result=planner.advance({additionalExpansions:100000,timeBudgetMs:60000}),wallMs=performance.now()-start;
        assert.equal(result.status,'solved');assert.equal(result.optimality,'proven');assert.equal(result.solution.totalActions,record.shortest);
        const verified=env.reference.replay(result.solution.actions);assert(verified.state.isWon);assert.equal(env.stateKey(verified.state),env.stateKey(result.solution.state));
        rows.push({title:record.title,mapId:record.mapId,mode,repeat,wallMs,transitions,search:result.search,steps:result.solution.totalActions,actions:result.solution.actions,stats:macro?{...macro.stats,events:macro.eventStats}:null});
    }
    console.log(JSON.stringify({title:record.title,runs:9,shortest:record.shortest}));
}
const median=a=>a.sort((x,y)=>x-y)[1];
const totals=protocol.methods.map(mode=>({mode,maps:rows.length/9,runs:rows.filter(r=>r.mode===mode).length,
    summedTaskMedianMs:[...new Set(rows.map(r=>r.mapId))].reduce((s,id)=>s+median(rows.filter(r=>r.mapId===id&&r.mode===mode).map(r=>r.wallMs)),0),
    expanded:rows.filter(r=>r.mode===mode&&r.repeat===0).reduce((s,r)=>s+r.search.expanded,0),
    transitions:rows.filter(r=>r.mode===mode&&r.repeat===0).reduce((s,r)=>s+r.transitions,0)}));
writeFileSync(output+'/records.json',JSON.stringify(rows,null,2)+'\n');writeFileSync(output+'/summary.json',JSON.stringify({protocol,allNativeRoutesPassed:true,totals},null,2)+'\n');
console.log(JSON.stringify({complete:true,totals}));
