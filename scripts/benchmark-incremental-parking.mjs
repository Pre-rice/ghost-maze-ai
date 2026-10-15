import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createFastEnvironment} from '../src/search/fast-environment.js';
import {createIncrementalPlanner} from '../src/training/incremental-planner.js';
import {hasGhostOverlap} from '../src/training/planning-graph.js';
import {createParkedEncoder} from '../src/training/parked-features.js';
import {createTreePredictor} from '../src/training/tree-predictor.js';

const [testDir,galleryDir,baseline,output]=process.argv.slice(2);
if(!output)throw new Error('用法：node scripts/benchmark-incremental-parking.mjs <test-data> <gallery-data> <old-baseline> <新输出>');
assert(!existsSync(output),'不覆盖旧结果');
const read=path=>JSON.parse(readFileSync(path)),sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const save=(name,data)=>writeFileSync(output+'/'+name,JSON.stringify(data,null,2)+'\n');
const original=read(baseline+'/summary.json'),models=new Map(),modelMetadata=[];
for(const seed of [17,29,53]){
    const path=baseline+`/models/parked-${seed}.json`,expected=original.experiments.find(e=>e.seed===seed).modelSha256;
    assert.equal(sha(path),expected);const started=performance.now(),predictor=createTreePredictor(read(path));
    models.set(seed,predictor);modelMetadata.push({seed,sha256:expected,bytes:readFileSync(path).length,loadAndValidateMs:performance.now()-started});
}
const trainDir=Object.keys(read(baseline+'/protocol.json').sources).find(path=>path.endsWith('/parked-train-data'));
assert(trainDir);const trainedMaps=new Set(read(trainDir+'/manifest.json').tasks.map(t=>t.mapId));
const methods=[{mode:'bfs',seed:0},{mode:'progress',seed:0},...[17,29,53].flatMap(seed=>[{mode:'learned',seed},{mode:'random',seed}])];
const hash=text=>{let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return (value>>>0)/4294967296;};
const point=g=>`${g.x},${g.y}`;
const isTarget=(state,targets)=>targets.every(t=>state.layerStates[0].ghosts.some(g=>g.x===t.x&&g.y===t.y));
const lower=(s,t)=>{const[a,b]=s.layerStates[0].ghosts,dist=(g,p)=>Math.abs(g.x-p.x)+Math.abs(g.y-p.y);return Math.ceil(Math.min(dist(a,t[0])+dist(b,t[1]),dist(a,t[1])+dist(b,t[0]))/2);};
const occupied=(s,targets)=>targets.filter(t=>s.layerStates[0].ghosts.some(g=>g.x===t.x&&g.y===t.y)).length;
const protocol={role:'native_incremental_given_goal_planning_not_quality',sourceSha256:sha(new URL(import.meta.url)),
    plannerSha256:sha(new URL('../src/training/incremental-planner.js',import.meta.url)),
    checkpoints:[64,256,1024,4096],repeats:3,methods,models:modelMetadata,perRunWallBudgetMs:30000,
    sourceManifests:{[testDir]:sha(testDir+'/manifest.json'),[galleryDir]:sha(galleryDir+'/manifest.json')},
    strategy:'BFS proves shortest; other orderings are complete best-first with shorter-prefix reopening, no optimality claim',
    sharing:'one persistent queue and best-prefix map across budget checkpoints, never restarted',
    countedCost:'map environment, per-run encoder setup, engine transitions, model feature extraction and inference; model load separately',
    scope:'given parking targets, no death/revive/nonfatal overlap, no premature parent-game victory',
    noNewTraining:true,noNewMaps:true,noNewHumanLabels:true,websiteIntegrated:false,
    inputsExclude:['kind','anchor identity','exact remaining distance','witness actions','stored graph future transitions'],
    limitations:['same mechanical generator family; gallery is reused development challenge','whole-map held out is not independent new design-family generalization','random hash differs from prior precomputed-row random order, only current native comparison is matched']};
mkdirSync(output,{recursive:true});save('protocol.json',protocol);
const records=[],routes=[];let parityRows=0;
for(const[scope,directory]of [['same_generator',testDir],['gallery_given_goals',galleryDir]]){
    const manifest=read(directory+'/manifest.json');
    for(const[name,expected]of Object.entries(manifest.files))assert.equal(sha(directory+'/'+name),expected);
    assert(read(directory+'/native-qa.json').allPassed);
    const bytes=readFileSync(directory+'/features.f32'),features=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
    for(const task of manifest.tasks){
        assert(!trainedMaps.has(task.mapId));const map=read(directory+`/maps/${task.mapId}.json`);
        const qaEnv=createFastEnvironment(map,{canonicalGhosts:true});assert.equal(qaEnv.sourceMapId,task.mapId);assert.equal(qaEnv.reference.ruleset,manifest.ruleset);
        const target=state=>isTarget(state,task.goal),graph=read(directory+`/graphs/${task.taskId}.json`),encoder=createParkedEncoder(map,task.goal);
        // 数据只在计时前核对输入和原证书；规划器没有拿到图、最短标签或参考路线。
        let state=qaEnv.initialState(),index=0;
        for(const action of task.witness.slice(0,3)){
            const edge=graph.nodes[index].edges.find(e=>e.action===action),next=qaEnv.step(state,action),actual=encoder.encode(state,action,next).map(Math.fround);
            assert.equal(actual.length,manifest.dimension);assert.deepEqual(actual,Array.from(features.subarray(edge.row*manifest.dimension,(edge.row+1)*manifest.dimension)));parityRows++;
            state=next;index=edge.to;
        }
        // 一次共同预热；不复用此规划器或其局面、特征缓存。
        const warm=createIncrementalPlanner({initial:qaEnv.initialState(),stateKey:qaEnv.stateKey,isGoal:target,
            successors:s=>qaEnv.reference.actions.map(action=>({action,state:qaEnv.step(s,action)})).filter(n=>n.state!==s&&!n.state.isDead&&!hasGhostOverlap(n.state)&&(!n.state.isWon||target(n.state)))});
        warm.advance({additionalExpansions:16});
        for(let repeat=0;repeat<protocol.repeats;repeat++)for(const method of (repeat%2?[...methods].reverse():methods)){
            const started=performance.now(),env=createFastEnvironment(map,{canonicalGhosts:true}),initial=env.initialState();
            const learned=method.mode==='learned'?createParkedEncoder(map,task.goal):null;
            let modelCalls=0,modelMs=0,transitions=0;
            const rank=method.mode==='bfs'?null:method.mode==='learned'?(before,action,after)=>{
                const t=performance.now(),score=models.get(method.seed).predict(learned.encode(before,action,after));modelMs+=performance.now()-t;modelCalls++;return -score;
            }:method.mode==='progress'?(_s,_a,next)=>[-occupied(next,task.goal),lower(next,task.goal)]:(_s,_a,next)=>hash(method.seed+'|'+env.stateKey(next));
            const planner=createIncrementalPlanner({initial,stateKey:env.stateKey,isGoal:target,strategy:method.mode==='bfs'?'bfs':'greedy',rankCandidate:rank,
                successors:s=>{const result=[];for(const action of env.reference.actions){const next=env.step(s,action);transitions++;if(next===s||next.isDead||hasGhostOverlap(next)||(next.isWon&&!target(next)))continue;result.push({action,state:next});}return result;}});
            const checkpoints=[];
            for(const limit of protocol.checkpoints){
                const current=planner.result(),remainingMs=Math.max(0,protocol.perRunWallBudgetMs-(performance.now()-started));
                const result=planner.advance({additionalExpansions:Math.max(0,limit-current.search.expanded),timeBudgetMs:remainingMs});
                checkpoints.push({budget:limit,status:result.status,reason:result.reason,provenOptimal:result.optimality==='proven',
                    steps:result.solution?.totalActions??null,matchesKnownOptimum:!!result.solution&&result.solution.totalActions===task.shortest,
                    wallMs:performance.now()-started,modelCalls,modelMs,transitions,...result.search});
            }
            const result=planner.result(),actions=result.solution?.actions??[];
            let checked=env.reference.initialState(),vacated=false,moved=false;
            const anchorIndex=checked.layerStates[0].ghosts.findIndex(g=>point(g)===task.anchor);assert(anchorIndex>=0);
            for(const action of actions){const next=env.reference.step(checked,action);assert.notEqual(next,checked);assert(!next.isDead&&!hasGhostOverlap(next));assert(!checked.isWon);checked=next;vacated||=!checked.layerStates[0].ghosts.some(g=>point(g)===task.anchor);moved||=point(checked.layerStates[0].ghosts[anchorIndex])!==task.anchor;}
            const reached=target(checked);assert.equal(reached,result.status==='solved');
            if(method.mode==='bfs'&&reached)assert.equal(actions.length,task.shortest);
            const record={scope,taskId:task.taskId,mapId:task.mapId,kind:task.kind,shortest:task.shortest,...method,repeat,checkpoints,actions};records.push(record);
            routes.push({dataset:directory,taskId:task.taskId,mapId:task.mapId,actions,goalReached:reached,optimalToGoal:reached&&actions.length===task.shortest,vacatedAnchor:vacated,movedOriginal:moved});
        }
        console.log(JSON.stringify({scope,title:task.title,kind:task.kind,shortest:task.shortest,runs:methods.length*protocol.repeats,done:true}));
    }
}
save('records.json',records);
writeFileSync(output+'/routes.jsonl',routes.map(r=>JSON.stringify(r)).join('\n')+'\n');
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],summary=[];
for(const scope of ['same_generator','gallery_given_goals'])for(const method of methods)for(const budget of protocol.checkpoints){
    const group=records.filter(r=>r.scope===scope&&r.mode===method.mode&&r.seed===method.seed),tasks=[...new Set(group.map(r=>r.taskId))];
    const rows=tasks.map(id=>{const runs=group.filter(r=>r.taskId===id).map(r=>r.checkpoints.find(c=>c.budget===budget));
        assert(runs.every(r=>r.status===runs[0].status&&r.steps===runs[0].steps),'确定性路线在重复中不一致');
        return{kind:group.find(r=>r.taskId===id).kind,taskId:id,...runs[0],medianMs:median(runs.map(r=>r.wallMs)),medianModelMs:median(runs.map(r=>r.modelMs))};});
    const record={scope,...method,budget,tasks:tasks.length,solved:rows.filter(r=>r.status==='solved').length,
        optimal:rows.filter(r=>r.matchesKnownOptimum).length,provenOptimal:rows.filter(r=>r.provenOptimal).length,
        mustVacateSolved:rows.filter(r=>r.kind==='must_vacate'&&r.status==='solved').length,
        expanded:rows.reduce((s,r)=>s+r.expanded,0),summedTaskMedianMs:rows.reduce((s,r)=>s+r.medianMs,0),summedModelMedianMs:rows.reduce((s,r)=>s+r.medianModelMs,0)};
    summary.push(record);
}
save('summary.json',{role:protocol.role,models:modelMetadata,featureParityRows:parityRows,runs:records.length,summary});
console.log(JSON.stringify({complete:true,featureParityRows:parityRows,runs:records.length,final:summary.filter(r=>r.budget===4096)}));
