import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {solveFastMap} from '../src/search/fast-solver.js';
import {createPlanningEncoder} from '../src/training/planning-features.js';
import {createTreePredictor} from '../src/training/tree-predictor.js';

const [graphArg,modelArg,outputArg]=process.argv.slice(2);if(!outputArg)throw new Error('用法：node scripts/benchmark-planning-native.mjs <graph> <baseline> <新输出目录>');
const graphDir=resolve(graphArg),modelDir=resolve(modelArg),output=resolve(outputArg),read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),manifest=read(graphDir+'/manifest.json'),version=manifest.featureEncoder?.version??1;
assert(!existsSync(output),'不能覆盖先前结果');for(const [file,hash]of Object.entries({...manifest.files,...manifest.graphFiles}))assert.equal(sha(graphDir+'/'+file),hash);mkdirSync(output,{recursive:true});
const protocol={role:'native_timing_development_diagnostic',variant:'reachable_states',seed:17,repeats:3,featureVersion:version,graphManifestSha256:sha(graphDir+'/manifest.json'),sourceSha256:sha(new URL(import.meta.url)),budgets:{nodeBudget:100000,stateBudget:100000,budgetMs:60000},models:[]};
const models=new Map();for(const group of manifest.splitGroups){const experiment=read(modelDir+'/reachable_states-17.json'),fold=experiment.folds.find(f=>f.heldOut===group),file=modelDir+'/'+fold.modelFile;assert.equal(sha(file),fold.modelSha256);protocol.models.push({group,sha256:fold.modelSha256,trainMaps:fold.trainMaps,testMaps:fold.testMaps});const started=performance.now(),predictor=createTreePredictor(read(file));models.set(group,{predictor,loadMs:performance.now()-started,bytes:readFileSync(file).length,fold});}
writeFileSync(output+'/protocol.json',JSON.stringify(protocol,null,2)+'\n');
const results=[];
for(const record of manifest.records){
 const graph=read(graphDir+'/graphs/'+record.mapId+'.json'),model=models.get(record.splitGroup);assert(!model.fold.trainMaps.includes(record.mapId),'训练家族泄漏');
 const encoder=createPlanningEncoder(graph.map,{version});let rankCalls=0,rankMs=0;const rank=(before,action,after)=>{const started=performance.now();const score=-model.predictor.predict(encoder.encode(before,action,after));rankCalls++;rankMs+=performance.now()-started;return score;};
 // 一次共同预热，计时仅包含原生求解、特征与推理；模型载入体积／耗时另列。
 solveFastMap(graph.map,{...protocol.budgets});const runs=[];
 for(let repeat=0;repeat<protocol.repeats;repeat++)for(const mode of (repeat%2?['learned','manual']:['manual','learned'])){
  rankCalls=0;rankMs=0;const started=performance.now(),result=solveFastMap(graph.map,{...protocol.budgets,...(mode==='learned'?{rankCandidate:rank}:{})}),wallMs=performance.now()-started;assert.equal(result.status,'solved');assert.equal(result.optimality,'proven');assert.equal(result.solution.totalActions,record.shortest);
  runs.push({mode,repeat,wallMs,rankCalls,rankMs,expanded:result.search.expanded,actions:result.solution.actions,totalActions:result.solution.totalActions});
 }
 const result={title:record.title,mapId:record.mapId,splitGroup:record.splitGroup,shortest:record.shortest,runs,modelBytes:model.bytes,modelLoadMs:model.loadMs};results.push(result);console.log(JSON.stringify({title:record.title,runs:runs.map(({mode,repeat,wallMs,expanded,rankMs})=>({mode,repeat,wallMs,expanded,rankMs}))}));
}
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],totals={};for(const mode of ['manual','learned'])totals[mode]={summedPerMapMedianMs:results.reduce((sum,r)=>sum+median(r.runs.filter(n=>n.mode===mode).map(n=>n.wallMs)),0),expanded:results.reduce((sum,r)=>sum+r.runs.find(n=>n.mode===mode).expanded,0)};
const summary={role:protocol.role,maps:results.length,allRoutesNativeVerified:true,allOptimal:true,totals,speedRatio:totals.learned.summedPerMapMedianMs/totals.manual.summedPerMapMedianMs,models:protocol.models,results,limitations:['三次交错计时是本机开发诊断，不等于手机或网站体验','未计模型网络下载与初次载入；二者只会增加学习方案成本','两个家族留出不能证明独立泛化']};writeFileSync(output+'/summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({complete:true,totals,speedRatio:summary.speedRatio}));
