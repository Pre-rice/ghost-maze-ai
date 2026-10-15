import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {smallMap} from '../src/design/grid.js';
import {WALL_TYPES as W,isValidButtonAttachment,DataSerializer} from '../src/reference/engine.js';
import {createReferenceEnvironment} from '../src/reference/environment.js';
import {enumeratePlanningGraph} from '../src/training/planning-graph.js';
import {auditPuzzleBoundaries} from '../src/design/rule-boundaries.js';

const [output,countArg='32',seedArg='1000']=process.argv.slice(2),count=Number(countArg),firstSeed=Number(seedArg);assert(output&&!existsSync(output),'必须指定新输出目录');assert(Number.isSafeInteger(count)&&count>0&&count<=200);assert(Number.isSafeInteger(firstSeed)&&firstSeed>=0);
const family='mechanical-curriculum-generator-v1',designCard=[
 '任务只用于基础求解练习：从给定出生点到终点；最自然的计划是直接接近终点。',
 '直达计划可能被当前门态、资源门槛或可见鬼位阻止；所有后果按共同引擎求解。',
 '不预设尤里卡时刻，不宣称巧妙；学习目标是对门态、资源与鬼位做正确的下一步选择。',
 '不复用地图集模板，不作为已认可作品的增强或新设计成果；同一生成器全部属于一个亲缘组。',
 '全信息、单层、冷开局，不用玻璃或不可见编号；全部最优无伤解不允许重合，不能把验证当趣味评价。',
 '只用10至16个活动格、最多两鬼和两组字母机关；不以数量或长度宣称产品设计进步。'
];
const dirs=[{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0}],records=[],attempts=[],seen=new Set();mkdirSync(output,{recursive:true});
const sha=v=>createHash('sha256').update(v).digest('hex'),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
save(output+'/protocol.json',{role:'mechanical_training_exercises_not_designed_puzzle_candidates',family,designCard,count,firstSeed,maximumAttempts:count*30,sourceSha256:sha(readFileSync(new URL(import.meta.url))),budgets:{states:2500,ms:250},humanQuality:null,galleryChange:false});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
function propose(seed){
 const random=rng(seed),pick=list=>list[Math.floor(random()*list.length)],cells=[[3,3]],target=10+Math.floor(random()*7),occupied=new Set(['3,3']);
 while(cells.length<target){const [x,y]=pick(cells),d=pick(dirs),nx=x+d.dx,ny=y+d.dy,k=`${nx},${ny}`;if(nx>=1&&nx<=5&&ny>=1&&ny<=5&&!occupied.has(k)){occupied.add(k);cells.push([nx,ny]);}}
 const start=pick(cells),ends=cells.filter(c=>Math.abs(c[0]-start[0])+Math.abs(c[1]-start[1])>=3);if(!ends.length)return null;const end=pick(ends),map=smallMap(cells,start,end),edges=[];
 for(const [x,y]of cells){if(occupied.has(`${x+1},${y}`))edges.push({axis:'v',x:x+1,y});if(occupied.has(`${x},${y+1}`))edges.push({axis:'h',x,y:y+1});}
 const put=(e,w)=>map[e.axis==='h'?'hWalls':'vWalls'][e.y][e.x]=w;
 for(const e of edges)if(random()<0.12)put(e,{type:W.SOLID});
 const available=edges.filter(e=>map[e.axis==='h'?'hWalls':'vWalls'][e.y][e.x].type===W.EMPTY),take=()=>{if(!available.length)return null;return available.splice(Math.floor(random()*available.length),1)[0];};
 const used=new Set([start.join(','),end.join(',')]),letters=random()<0.6?['A']:['A','B'];
 for(const letter of letters){for(let n=0,total=1+Math.floor(random()*2);n<total;n++){const e=take();if(e)put(e,{type:W.LETTER_DOOR,letter,initialState:random()<0.5?'open':'closed'});}}
 const buttonSlots=()=>cells.flatMap(([x,y])=>used.has(`${x},${y}`)?[]:dirs.filter(direction=>isValidButtonAttachment({x,y,direction},map)).map(direction=>({x,y,direction})));
 for(const letter of letters){const slots=buttonSlots();if(!slots.length)return null;const b=pick(slots);map.buttons.push({...b,letter});used.add(`${b.x},${b.y}`);}
 if(random()<0.65){const e=take(),places=cells.filter(c=>!used.has(c.join(',')));if(e&&places.length){put(e,{type:W.LOCKED,keys:random()<0.2?0:1});const key=pick(places);map.items.push({x:key[0],y:key[1],type:'key'});used.add(key.join(','));}}
 for(let i=0;i<2;i++)if(random()<0.4){const e=take();if(e)put(e,{type:W.DOOR});}
 for(let i=0,n=random()<0.25?2:1;i<n;i++){const places=cells.filter(c=>!used.has(c.join(','))&&c[0]!==start[0]&&c[1]!==start[1]);if(!places.length)return null;const g=pick(places);map.initialGhosts.push({x:g[0],y:g[1],id:i});used.add(g.join(','));}
 return map;
}
let ruleset;
for(let attempt=0;attempt<count*30&&records.length<count;attempt++){
 const seed=firstSeed+attempt,map=propose(seed);if(!map){attempts.push({seed,status:'no_valid_proposal'});continue;}
 const graph=enumeratePlanningGraph(map,{stateBudget:2500,nodeBudget:2500,budgetMs:250});ruleset??=graph.env.ruleset;
 if(graph.status!=='exhausted'){attempts.push({seed,status:'unknown_budget',states:graph.nodes.length});continue;}
 const shortest=graph.distance[0];if(!Number.isFinite(shortest)){attempts.push({seed,status:'proven_no_nonfatal_solution'});continue;}if(shortest<6||shortest>60||graph.safeDistance[0]!==shortest){attempts.push({seed,status:'outside_training_scope',shortest});continue;}
 const boundaries=auditPuzzleBoundaries(map,{nodeBudget:6000,budgetMs:1000});if(boundaries.status!=='safe'){attempts.push({seed,status:boundaries.status,reason:boundaries.reason});continue;}
 const encoded=DataSerializer.generateShareCode(map);assert(encoded.success);const decoded=DataSerializer.loadFromShareCode(encoded.code);assert(decoded.success);const canonical={...decoded.data.mapData,gameMode:decoded.data.gameMode,initialHealth:decoded.data.initialHealth},env=createReferenceEnvironment(canonical);assert.equal(env.mapId,graph.env.mapId);if(seen.has(env.mapId)){attempts.push({seed,status:'duplicate'});continue;}seen.add(env.mapId);
 let i=0;const actions=[];while(!graph.nodes[i].state.isWon){const e=graph.nodes[i].edges.find(e=>graph.distance[e.to]===graph.distance[i]-1);assert(e);actions.push(e.action);i=e.to;}assert(env.replay(actions).state.isWon);
 const title=`程序练习-${seed}`,dir=output+'/'+env.mapId;mkdirSync(dir);save(dir+'/manifest.json',{schemaVersion:1,role:'solver_supervision_not_human_quality',title,mapId:env.mapId,map:canonical,mapCode:encoded.code,ruleset:env.ruleset,familyId:family,seed,designCardReference:'../protocol.json',sourceRole:'mechanical_curriculum_exercise',humanQuality:null,humanFeedbackStatus:'not_reviewed_not_a_design_proposal',boundaries,optimality:{status:'solved',optimality:'proven',solution:{actions,totalActions:actions.length}}});
 records.push({title,mapId:env.mapId,splitGroup:family,familyId:family,shortest,seed,sourceRole:'mechanical_curriculum_exercise',humanFeedbackStatus:'not_reviewed_not_a_design_proposal',qualityScore:null,boundaryStatus:'safe',graphStates:graph.nodes.length});attempts.push({seed,status:'accepted',mapId:env.mapId,shortest});console.log(JSON.stringify({accepted:records.length,seed,shortest,states:graph.nodes.length}));
}
const summary={schemaVersion:1,role:'mechanical_training_exercises_not_quality_examples',ruleset,maps:records.length,records,requested:count,complete:records.length===count,attempts,conservativeSplitGroups:[family],humanQualitySamplesAdded:0,galleryChanged:false};save(output+'/summary.json',summary);console.log(JSON.stringify({complete:summary.complete,maps:records.length,attempts:attempts.length}));if(!summary.complete)process.exitCode=3;
