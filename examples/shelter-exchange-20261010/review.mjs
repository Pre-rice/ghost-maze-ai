import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {describeStep} from '../../src/review/trace-core.js';
import {WALL_TYPES as W} from '../../src/reference/engine.js';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const map=read('map.json'),evidence=read('evidence.json'),env=createReferenceEnvironment(map),certificate=evidence.baseline.solution.actions;
function replay(actions){let state=env.initialState();const trace=[];for(const[action,index]of actions.map((a,i)=>[a,i])){
    const before=state;state=env.step(state,action);const step=describeStep(before,state,action,env.mapDefinition,W);
    trace.push({index:index+1,action,valid:state!==before,...step});if(state.isDead||state.isWon)break;}
    return{status:state.isDead?'dead':state.isWon?'won':'unfinished',trace};}
// 人工提出的常规计划，不能当作观察到的玩家行为。
const plans=[
    {id:'direct_upper_key_right',idea:'先从右边靠近上钥匙，不调整鬼位。',actions:[...'URUU RULUUL'.replaceAll(' ','')]},
    {id:'direct_upper_key_left',idea:'直接沿左列上去拿上钥匙。',actions:[...'UULUUUUR']},
    {id:'open_then_take_lower_key',idea:'A 已打开钥匙室，再开 B 后立刻进去拿钥匙。',actions:[...certificate.slice(0,24),'R','R']}
];
const firstPlans=plans.map(plan=>({...plan,result:replay(plan.actions)}));for(const plan of firstPlans)assert.equal(plan.result.status,'dead',plan.id);
const roles=[
    [[0,0],'左上鬼初位；最后上钥匙局部回路的左侧转角'],[[1,0],'上钥匙被两只鬼夹守；必须先调整相邻鬼位'],[[2,0],'上鬼初位及取钥匙后的右侧出口'],
    [[0,1],'最初引左上鬼与最后钥匙回路共用的竖向视线'],[[1,1],'上钥匙内侧回路：避免把取钥匙变成长距离追逐'],[[2,1],'上鬼接近点及小回路右侧入口'],
    [[3,1],'两钥匙终点；必须完成两边的取得与返回'],
    [[0,2],'诱导左上鬼向右以及后续重新引它向左的共用转角'],[[1,2],'A 站，同时关联下钥匙室与上钥匙回路'],[[2,2],'左上鬼临时停位、B 门两侧及上鬼诱导点'],[[3,2],'上方横向诱导端及终点门前'],
    [[0,3],'C 站；给新的停位开路，再关闭其左侧'],[[1,3],'从临时保护转入的新停位；两侧 C/B 合作'],[[2,3],'B 保护位置的上方出口和向 C 停位移交的视线'],[[3,3],'把左上鬼向右拉开的转角；不设多余按钮'],
    [[0,4],'初期暴露左列视线、后期回 B 时切断横向追逐'],[[1,4],'B 站：临时保护、原地诱导、再保护与位置换手'],[[2,4],'必须先腾出再供后续安排使用的共用保护位置'],[[3,4],'下鬼和下钥匙同格；A 开门后仍须先引鬼出来'],
    [[1,5],'从 B 站回退并切换追逐方向'],[[2,5],'纵向诱导与横向绕行的共用节点'],[[1,6],'起点及诱导回退端'],[[2,6],'保持两格距离、引鬼绕过下方转角']
].map(([cell,role])=>({cell,role}));
const active=map.activeCells.flatMap((row,y)=>row.flatMap((on,x)=>on?[`${x},${y}`]:[]));assert.deepEqual(roles.map(r=>r.cell.join(',')).sort(),active.sort());
const result={date:'2026-10-10',firstPlans,roles,
    qualityReview:{dependentPhases:['上方临时安置为 A/B 安全操作准备条件','把一只鬼从 B 临时位置转移到 C 停位，腾出后续安排需要的位置','再次利用 B 保护位置后，回到上钥匙局部回路'],
        stateChangesPerceptible:'按钮直接改变同字母门，鬼的位置变化可由直线视野推断；默认迷雾未证明知识策略',
        pureTransitCellsIdentified:[],scope:'每格空间作用已审查，不宣称每格都有独立认知必要性；上钥匙末段仍含追逐，整题质量等待真人反馈'},
    claims:{observedHumanBehavior:false,uniqueFullOrderProven:false,fixedGhostIdentityProven:false,allThreeGhostsUnconditionallyNecessaryProven:false,humanQuality:null}};
writeFileSync(new URL('strategy-review.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({plans:firstPlans.map(p=>({id:p.id,status:p.result.status,step:p.result.trace.length})),cells:roles.length}));
