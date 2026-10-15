import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,writeSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildGhostRelaxation} from '../src/search/ghost-relaxation.js';
import {createFastEnvironment} from '../src/search/fast-environment.js';
import {reverseDistances,hasGhostOverlap} from '../src/training/planning-graph.js';

const [source,output]=process.argv.slice(2);if(!output)throw new Error('用法：node scripts/prepare-ghost-residual.mjs <graph> <新输出>');assert(!existsSync(output));const read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),manifest=read(source+'/manifest.json');
for(const [file,expected]of Object.entries({...manifest.files,...manifest.graphFiles}))assert.equal(sha(source+'/'+file),expected);mkdirSync(output,{recursive:true});mkdirSync(output+'/graphs');
const bytes=readFileSync(source+'/features.f32'),matrix=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),rows=readFileSync(source+'/rows.jsonl','utf8').trim().split('\n').map(JSON.parse),fd=openSync(output+'/features.f32','wx'),targets=new Float32Array(manifest.rows),records=[];let written=0;
try{for(const record of manifest.records){
 const graph=read(source+'/graphs/'+record.mapId+'.json'),env=createFastEnvironment(graph.map),table=buildGhostRelaxation(graph.map,{stateBudget:100000,nodeBudget:100000,budgetMs:60000});assert.equal(table.status,'exhausted');assert.equal(env.sourceMapId,record.mapId);const states=new Array(graph.nodes.length),keys=new Set();states[0]=env.initialState();
 // 图节点按原BFS发现顺序装配，所有局面仍由唯一引擎的真实前缀产生。
 for(let i=0;i<states.length;i++){const state=states[i];assert(state);assert.equal(state.isWon,graph.nodes[i].won);assert.equal(hasGhostOverlap(state),graph.nodes[i].overlap);const key=env.reference.stateKey(state);assert(!keys.has(key),'原状态索引重复');keys.add(key);for(const e of graph.nodes[i].edges)if(!states[e.to]){const next=env.step(state,e.action);assert(next!==state&&!next.isDead);states[e.to]=next;}}
 const bounds=states.map(s=>table.lowerBound(s)),safe=reverseDistances(graph.nodes.map(n=>({...n,state:{isWon:n.won}})),{avoidOverlap:true});assert.equal(safe[0],record.shortest);
 for(let i=0;i<graph.nodes.length;i++){assert.notEqual(bounds[i],null);assert(bounds[i]<=graph.nodes[i].distance||graph.nodes[i].distance===null);graph.nodes[i].noGhostBound=Number.isFinite(bounds[i])?bounds[i]:null;graph.nodes[i].noGhostUnreachable=!Number.isFinite(bounds[i]);}
 for(const row of rows.slice(record.startRow,record.startRow+record.featureRows)){
  assert.equal(row.mapId,record.mapId);assert.equal(row.row,written);const before=bounds[row.state],after=bounds[row.to],extra=[Number.isFinite(before)?before:100,Number.isFinite(after)?after:100,Number.isFinite(before)&&Number.isFinite(after)?after-before:0,Number.isFinite(before)?1:0,Number.isFinite(after)?1:0],vector=new Float32Array(manifest.dimension+5);vector.set(matrix.subarray(row.row*manifest.dimension,(row.row+1)*manifest.dimension));vector.set(extra,manifest.dimension);assert(vector.every(Number.isFinite));writeSync(fd,Buffer.from(vector.buffer));
  if(Number.isFinite(safe[row.to])){assert(Number.isFinite(after));assert(safe[row.to]>=after);targets[row.row]=Math.min(128,safe[row.to]-after);}else targets[row.row]=128;written++;
 }
 writeFileSync(output+'/graphs/'+record.mapId+'.json',JSON.stringify(graph));records.push({...record,noGhostStates:table.states,noGhostPreparationMs:table.elapsedMs});console.log(JSON.stringify({title:record.title,fullStates:states.length,noGhostStates:table.states,rows:record.featureRows}));
}}finally{closeSync(fd);}
assert.equal(written,manifest.rows);writeFileSync(output+'/targets.f32',Buffer.from(targets.buffer));writeFileSync(output+'/rows.jsonl',readFileSync(source+'/rows.jsonl'));
const result={...manifest,records,dimension:manifest.dimension+5,featureExtension:{role:'exact_no_ghost_bounds_v1',base:manifest.featureEncoder,scriptSha256:sha(new URL(import.meta.url)),helperSha256:sha(new URL('../src/search/ghost-relaxation.js',import.meta.url)),fields:['noGhostBefore','noGhostAfter','noGhostDelta','beforeRelaxedReachable','afterRelaxedReachable']},target:'safe_remaining_after_action_minus_exact_no_ghost_remaining_capped128',sourceManifestSha256:sha(source+'/manifest.json'),files:Object.fromEntries(['features.f32','rows.jsonl','targets.f32'].map(f=>[f,sha(output+'/'+f)])),graphFiles:Object.fromEntries(records.map(r=>['graphs/'+r.mapId+'.json',sha(output+'/graphs/'+r.mapId+'.json')]))};writeFileSync(output+'/manifest.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,maps:records.length,rows:manifest.rows,dimension:result.dimension}));
