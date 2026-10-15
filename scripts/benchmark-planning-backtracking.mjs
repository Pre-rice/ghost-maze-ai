import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createPlanningEncoder} from '../src/training/planning-features.js';
import {createTreePredictor} from '../src/training/tree-predictor.js';
import {solveBacktracking} from '../src/training/backtracking-solver.js';

const [graphDir,largeDir,smallDir,cartDir,output]=process.argv.slice(2);if(!output)throw new Error('用法：node scripts/benchmark-planning-backtracking.mjs <graph> <64树> <8树> <单树> <新输出>');assert(!existsSync(output));const read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),manifest=read(graphDir+'/manifest.json'),models=[];
for(const [file,expected]of Object.entries({...manifest.files,...manifest.graphFiles}))assert.equal(sha(graphDir+'/'+file),expected);
for(const [kind,directory]of [['large64',largeDir],['small8',smallDir],['cart1',cartDir]]){const protocol=read(directory+'/protocol.json'),trainingDirectory=Object.keys(protocol.files)[0],training=read(trainingDirectory+'/manifest.json'),ids=new Set(training.records.map(r=>r.mapId));assert.equal(sha(trainingDirectory+'/manifest.json'),protocol.files[trainingDirectory]);for(const r of manifest.records)assert(!ids.has(r.mapId),'挑战进入训练');assert.deepEqual(training.featureEncoder,manifest.featureEncoder);const summary=read(directory+'/summary.json');for(const seed of [17,29,53]){const file=directory+'/models/curriculum-'+seed+'.json';assert.equal(sha(file),summary.experiments.find(e=>e.seed===seed).modelSha256);const started=performance.now(),predictor=createTreePredictor(read(file));models.push({kind,seed,predictor,bytes:readFileSync(file).length,loadMs:performance.now()-started,sha256:sha(file)});}}
mkdirSync(output,{recursive:true});writeFileSync(output+'/protocol.json',JSON.stringify({role:'native_backtracking_timing_development',repeats:3,seeds:[17,29,53],models:models.map(({predictor,...m})=>m),graphManifestSha256:sha(graphDir+'/manifest.json'),scriptSha256:sha(new URL(import.meta.url)),solverSha256:sha(new URL('../src/training/backtracking-solver.js',import.meta.url)),forcedChoiceInference:false,optimality:'not_proven_by_this_search; native replay of every found route',limit:'same two gallery families used in prior development; no final independent generalization claim'},null,2)+'\n');
const results=[];
for(const record of manifest.records){const graph=read(graphDir+'/graphs/'+record.mapId+'.json'),encoder=createPlanningEncoder(graph.map,{version:manifest.featureEncoder.version}),modes=[{kind:'manual',seed:0,rank:(s,a,n)=>encoder.relaxed(n)},...models.map(m=>({...m,rank:(s,a,n)=>-m.predictor.predict(encoder.encode(s,a,n))}))],runs=[];
 solveBacktracking(graph.map,{rankCandidate:modes[0].rank});
 for(let repeat=0;repeat<3;repeat++)for(const mode of (repeat%2?[...modes].reverse():modes)){
  const started=performance.now(),result=solveBacktracking(graph.map,{rankCandidate:mode.rank}),wallMs=performance.now()-started;assert.equal(result.status,'solved');assert(result.solution.totalActions>=record.shortest);runs.push({kind:mode.kind,seed:mode.seed,repeat,wallMs,...result});
 }
 results.push({title:record.title,mapId:record.mapId,shortest:record.shortest,runs});console.log(JSON.stringify({title:record.title,complete:true,runs:runs.length}));
}
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],summaries=[];for(const kind of ['manual','large64','small8','cart1'])for(const seed of (kind==='manual'?[0]:[17,29,53])){const rows=results.map(r=>r.runs.filter(n=>n.kind===kind&&n.seed===seed));summaries.push({kind,seed,maps:results.length,allNativeReplayed:true,expanded:rows.reduce((sum,g)=>sum+g[0].search.expanded,0),rankCalls:rows.reduce((sum,g)=>sum+g[0].search.rankCalls,0),summedPerMapMedianMs:rows.reduce((sum,g)=>sum+median(g.map(n=>n.wallMs)),0),matchesKnownOptimum:rows.filter((g,i)=>g[0].solution.totalActions===results[i].shortest).length});}
writeFileSync(output+'/summary.json',JSON.stringify({role:'native_backtracking_timing_development',summaries,results},null,2)+'\n');console.log(JSON.stringify(summaries));
