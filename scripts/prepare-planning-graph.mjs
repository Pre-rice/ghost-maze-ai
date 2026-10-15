import {mkdirSync,readFileSync,writeFileSync,openSync,writeSync,closeSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {enumeratePlanningGraph} from '../src/training/planning-graph.js';
import {createPlanningEncoder,PLANNING_FEATURE_VERSION} from '../src/training/planning-features.js';

const [sourceArg,outputArg,versionArg]=process.argv.slice(2),version=versionArg===undefined?PLANNING_FEATURE_VERSION:Number(versionArg);if(!sourceArg||!outputArg)throw new Error('用法：node scripts/prepare-planning-graph.mjs <已核验资料库> <新输出目录> [特征版本]');
const source=resolve(sourceArg),output=resolve(outputArg),summary=JSON.parse(readFileSync(source+'/summary.json'));assert(!existsSync(output),'拒绝覆盖既有资料');mkdirSync(output,{recursive:true});mkdirSync(output+'/graphs');
const matrix=openSync(output+'/features.f32','wx'),meta=openSync(output+'/rows.jsonl','wx'),records=[];let row=0,dimension=null;
try{
 for(const record of summary.records){
  const manifestBytes=readFileSync(source+'/'+record.mapId+'/manifest.json'),manifest=JSON.parse(manifestBytes);assert.equal(manifest.boundaries.status,'safe');assert.equal(manifest.ruleset,summary.ruleset);assert.equal(manifest.familyId,record.splitGroup);
  const graph=enumeratePlanningGraph(manifest.map);assert.equal(graph.status,'exhausted','预算未知不能产生精确标签');assert.equal(graph.distance[0],record.shortest);assert.equal(graph.safeDistance[0],record.shortest);assert.equal(graph.env.mapId,record.mapId);
  const encoder=createPlanningEncoder(manifest.map,{version}),reference=new Set([0]);let state=graph.env.initialState();for(const action of manifest.optimality.solution.actions){state=graph.env.step(state,action);reference.add(graph.index.get(graph.env.stateKey(state)));}
  const compact=[],startRow=row;let positive=0,eligibleStates=0;
  for(const [i,node] of graph.nodes.entries()){
   const trainEligible=!node.overlap&&Number.isFinite(graph.distance[i])&&graph.safeDistance[i]===graph.distance[i]&&!node.state.isWon;let hasPositive=false;
   const edges=[];
   for(const edge of node.edges){
    const target=graph.nodes[edge.to],fullOptimal=Number.isFinite(graph.distance[i])&&graph.distance[edge.to]===graph.distance[i]-1;
    const preferred=fullOptimal&&!target.overlap&&graph.safeDistance[edge.to]===graph.distance[edge.to],features=encoder.encode(node.state,edge.action,target.state);dimension??=features.length;assert.equal(features.length,dimension);assert(features.every(Number.isFinite));
    const values=new Float32Array(features);writeSync(matrix,Buffer.from(values.buffer));
    const label={row,mapId:record.mapId,state:i,to:edge.to,action:edge.action,splitGroup:record.splitGroup,onReference:reference.has(i),trainEligible,optimal:fullOptimal,preferred,remaining:Number.isFinite(graph.distance[i])?graph.distance[i]:null};writeSync(meta,JSON.stringify(label)+'\n');
    edges.push({action:edge.action,to:edge.to,row});row++;if(trainEligible&&preferred){positive++;hasPositive=true;}
   }
   if(trainEligible){assert(hasPositive,'安全最优可续局面必须有正动作');eligibleStates++;}
   compact.push({h:encoder.relaxed(node.state),distance:Number.isFinite(graph.distance[i])?graph.distance[i]:null,overlap:node.overlap,won:node.state.isWon,edges});
  }
  const entry={...record,graphStates:compact.length,graphTransitions:graph.transitions,featureRows:row-startRow,startRow,positive,eligibleStates,sourceManifestSha256:createHash('sha256').update(manifestBytes).digest('hex')};records.push(entry);
  writeFileSync(output+'/graphs/'+record.mapId+'.json',JSON.stringify({mapId:record.mapId,map:manifest.map,nodes:compact}));
  console.log(JSON.stringify({title:record.title,states:compact.length,rows:row-startRow,eligibleStates,positive,family:record.splitGroup}));
 }
}finally{closeSync(matrix);closeSync(meta);}
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const result={schemaVersion:1,createdAtUtc:new Date().toISOString(),role:'solver_supervision_not_human_quality',sourceSummary:relative(process.cwd(),source+'/summary.json'),ruleset:summary.ruleset,records,maps:records.length,rows:row,dimension,format:'little_endian_float32_row_major',files:{'features.f32':digest(output+'/features.f32'),'rows.jsonl':digest(output+'/rows.jsonl')},observationScope:'full_information',target:'all_optimal_continuations_avoiding_nonfatal_ghost_overlap',labelScope:'仅穷尽共同引擎状态图后反向BFS；安全约束不改变已审原图初态最优值；未选到的同长安全动作同为正例',inputExcludes:['mapId','title','family','steps','optimal_remaining','future_actions','human_quality'],humanQualitySamplesAdded:0,previousPlanningDataOverwritten:false,splitGroups:[...new Set(records.map(r=>r.splitGroup))]};result.featureEncoder={version,sha256:digest(new URL('../src/training/planning-features.js',import.meta.url))};result.graphFiles=Object.fromEntries(records.map(r=>['graphs/'+r.mapId+'.json',digest(output+'/graphs/'+r.mapId+'.json')]));writeFileSync(output+'/manifest.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,maps:records.length,rows:row,dimension}));
