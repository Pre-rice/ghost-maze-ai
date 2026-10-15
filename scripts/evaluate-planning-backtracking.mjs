import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createTreePredictor} from '../src/training/tree-predictor.js';
import {createReferenceEnvironment} from '../src/reference/environment.js';
import {hasGhostOverlap} from '../src/training/planning-graph.js';
const [source,models,output]=process.argv.slice(2);if(!output)throw new Error('用法：node scripts/evaluate-planning-backtracking.mjs <graph> <curriculum模型> <新输出>');assert(!existsSync(output));const read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),manifest=read(source+'/manifest.json'),protocol=read(models+'/protocol.json'),trainingDirectory=Object.keys(protocol.files)[0],trainingManifest=read(trainingDirectory+'/manifest.json'),trainedIds=new Set(trainingManifest.records.map(r=>r.mapId)),modelSummary=read(models+'/summary.json');assert.equal(sha(trainingDirectory+'/manifest.json'),protocol.files[trainingDirectory]);assert.deepEqual(trainingManifest.featureEncoder,manifest.featureEncoder);for(const record of manifest.records)assert(!trainedIds.has(record.mapId),'评估图进入了训练集');
for(const [file,expected]of Object.entries({...manifest.files,...manifest.graphFiles}))assert.equal(sha(source+'/'+file),expected);mkdirSync(output,{recursive:true});
writeFileSync(output+'/protocol.json',JSON.stringify({role:'backtracking_first_solution_development',seeds:[17,29,53],modes:['relaxed_distance','random','learned'],search:'complete_DFS_global_physical_seen_no_overlap',budget:100000,optimality:'not_proven; known optimum for reporting only',graphManifestSha256:sha(source+'/manifest.json'),trainProtocolSha256:sha(models+'/protocol.json'),scriptSha256:sha(new URL(import.meta.url)),limitation:'gallery already used in prior development; no fresh independent puzzle-quality claim'},null,2)+'\n');
const bytes=readFileSync(source+'/features.f32'),matrix=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),dimension=manifest.dimension;
function search(nodes,score){const seen=new Set(),stack=[{i:0,actions:[],pending:null,head:0}];let expanded=0;
 while(stack.length){const frame=stack.at(-1),node=nodes[frame.i];if(node.won)return {status:'solved',expanded,actions:frame.actions,steps:frame.actions.length,matchesKnownOptimum:frame.actions.length===nodes[0].distance,optimality:'not_proven_by_search'};
  if(frame.pending===null){if(expanded>=100000)return {status:'unknown',expanded};seen.add(frame.i);expanded++;frame.pending=node.edges.filter(e=>!nodes[e.to].overlap&&e.to!==frame.i).map(e=>({...e,priority:score(e)})).sort((a,b)=>a.priority-b.priority);}
  let edge;while(frame.head<frame.pending.length){const next=frame.pending[frame.head++];if(!seen.has(next.to)){edge=next;break;}}if(!edge){stack.pop();continue;}stack.push({i:edge.to,actions:[...frame.actions,edge.action],pending:null,head:0});
 }return {status:'proven_unsat_within_safe_graph',expanded};
}
const results=[];
for(const seed of [17,29,53]){const modelFile=models+'/models/curriculum-'+seed+'.json';assert.equal(sha(modelFile),modelSummary.experiments.find(e=>e.seed===seed).modelSha256);const predictor=createTreePredictor(read(modelFile)),scores=new Float64Array(manifest.rows);assert.equal(predictor.dimension,dimension);for(let i=0;i<scores.length;i++)scores[i]=predictor.predict(matrix.subarray(i*dimension,(i+1)*dimension));for(const record of manifest.records){
 const graph=read(source+'/graphs/'+record.mapId+'.json'),env=createReferenceEnvironment(graph.map);assert.equal(env.mapId,record.mapId);
 for(const mode of ['relaxed_distance','random','learned']){let randomSeed=seed;const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)|0;return (randomSeed>>>0)/4294967296;};const score=mode==='learned'?e=>-scores[e.row]:mode==='random'?()=>random():e=>graph.nodes[e.to].h,result=search(graph.nodes,score);
  if(result.status==='solved'){let state=env.initialState();for(const action of result.actions){const next=env.step(state,action);assert.notEqual(next,state);assert(!next.isDead&&!hasGhostOverlap(next));state=next;}assert(state.isWon);}
  results.push({seed,mode,title:record.title,mapId:record.mapId,result});
 }
}}
const summaries=[];for(const seed of [17,29,53])for(const mode of ['relaxed_distance','random','learned']){const group=results.filter(r=>r.seed===seed&&r.mode===mode);summaries.push({seed,mode,maps:group.length,solved:group.filter(r=>r.result.status==='solved').length,matchesKnownOptimum:group.filter(r=>r.result.matchesKnownOptimum).length,expanded:group.reduce((s,r)=>s+r.result.expanded,0),solvedWithin256:group.filter(r=>r.result.status==='solved'&&r.result.expanded<=256).length});}
writeFileSync(output+'/summary.json',JSON.stringify({role:'backtracking_first_solution_development',allFoundRoutesNativeReplayed:true,summaries,results},null,2)+'\n');console.log(JSON.stringify(summaries));
